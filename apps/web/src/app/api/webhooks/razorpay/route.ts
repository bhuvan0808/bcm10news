import type { NextRequest } from 'next/server';
import { createAdminClient } from '@bcm10/database/admin';
import { createPaymentService, type PaymentEvent } from '@bcm10/payments';
import { createEmailService, paymentFailedEmail, subscriptionConfirmedEmail } from '@bcm10/email';
import { captureServer } from '@bcm10/analytics';
import { formatPaise } from '@bcm10/validation';
import { json, serverError, unauthorized } from '@/lib/api';
import { SITE, absoluteUrl } from '@/lib/site';

/**
 * Razorpay webhook — the authority on who has paid.
 *
 * Order of operations matters here, and each step exists for a reason:
 *
 *  1. Read the RAW body text. Verifying an HMAC against a re-serialised object
 *     will fail intermittently, because key order and whitespace are not
 *     preserved by JSON.parse/stringify.
 *  2. Verify the signature before parsing anything. An unsigned request is
 *     treated as hostile, not as malformed.
 *  3. Record the event first, keyed by the provider's event id. The unique
 *     constraint makes redelivery idempotent — Razorpay retries, and without
 *     this a retried `payment.captured` would extend a subscription twice.
 *  4. Only then interpret it and move money-derived state.
 *
 * Uses the service-role client because there is no user session on a webhook,
 * and `payment_events` deliberately has no RLS policy for any human role.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const payments = createPaymentService();
  if (!payments.enabled) {
    return json({ ok: false, message: 'Payments are not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');

  if (!signature || !payments.verifyWebhookSignature(rawBody, signature)) {
    console.warn('Rejected Razorpay webhook: bad signature');
    return unauthorized('Invalid signature');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, message: 'Malformed JSON' }, { status: 400 });
  }

  const event = payments.interpretEvent(payload);
  if (!event) return json({ ok: true, ignored: 'unrecognised payload' });

  const supabase = createAdminClient();

  // Idempotency gate. `ignoreDuplicates` turns a redelivery into a no-op
  // insert, and the select tells us whether this delivery is the first.
  const { data: inserted, error: insertError } = await supabase
    .from('payment_events')
    .upsert(
      {
        provider: 'razorpay',
        provider_event_id: event.providerEventId,
        event_type: event.rawType,
        payload: payload as never,
        signature_verified: true,
      },
      { onConflict: 'provider,provider_event_id', ignoreDuplicates: true }
    )
    .select('id')
    .maybeSingle();

  if (insertError) {
    console.error('Could not record payment event', insertError.message);
    return serverError('Could not record event');
  }

  if (!inserted) {
    // Already processed. Acknowledge so Razorpay stops retrying.
    return json({ ok: true, duplicate: true });
  }

  try {
    await applyEvent(supabase, event);

    await supabase
      .from('payment_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', inserted.id);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Unknown processing error';
    console.error('Payment event processing failed', message);

    await supabase.from('payment_events').update({ process_error: message }).eq('id', inserted.id);

    // 500 so Razorpay retries; the event row is already stored, so the retry
    // is safe and will find its own duplicate guard.
    return serverError('Processing failed');
  }

  return json({ ok: true });
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function applyEvent(supabase: AdminClient, event: PaymentEvent): Promise<void> {
  const profileId = event.notes['profile_id'] ?? null;
  const organizationId = event.notes['organization_id'] ?? null;
  const planCode = event.notes['plan_code'] ?? null;

  switch (event.type) {
    case 'payment.captured':
    case 'subscription.charged': {
      await recordPayment(supabase, event, 'captured', profileId, organizationId);
      if (planCode) await activateSubscription(supabase, event, planCode, profileId, organizationId);
      break;
    }

    case 'payment.authorized':
      await recordPayment(supabase, event, 'authorized', profileId, organizationId);
      break;

    case 'payment.failed': {
      await recordPayment(supabase, event, 'failed', profileId, organizationId);
      await notifyPaymentFailure(supabase, event, planCode, profileId);
      if (profileId && planCode) {
        await captureServer(profileId, 'payment_failed', {
          plan_code: planCode,
          reason: event.errorDescription ?? undefined,
        });
      }
      break;
    }

    case 'subscription.activated':
      if (planCode) await activateSubscription(supabase, event, planCode, profileId, organizationId);
      break;

    case 'subscription.cancelled':
    case 'subscription.completed':
    case 'subscription.halted': {
      if (!event.subscriptionId) break;

      /*
       * Status only. The `subscriptions_sync_entitlements` trigger revokes the
       * entitlements as a consequence — access is derived from subscription
       * state in exactly one place, so it cannot drift.
       */
      await supabase
        .from('subscriptions')
        .update({
          status: event.type === 'subscription.halted' ? 'past_due' : 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('provider_subscription_id', event.subscriptionId);
      break;
    }

    case 'refund.processed': {
      if (!event.paymentId) break;
      await supabase
        .from('payments')
        .update({
          status: 'refunded',
          amount_refunded_paise: event.amountPaise ?? 0,
        })
        .eq('provider_payment_id', event.paymentId);
      break;
    }

    default:
      // Stored but not acted on. The row in payment_events is the record.
      break;
  }
}

async function recordPayment(
  supabase: AdminClient,
  event: PaymentEvent,
  status: 'captured' | 'authorized' | 'failed',
  profileId: string | null,
  organizationId: string | null
): Promise<void> {
  if (!event.paymentId) return;

  await supabase.from('payments').upsert(
    {
      provider: 'razorpay',
      provider_payment_id: event.paymentId,
      provider_order_id: event.orderId,
      profile_id: profileId,
      organization_id: organizationId,
      status,
      amount_paise: event.amountPaise ?? 0,
      currency: event.currency ?? 'INR',
      method: event.method,
      failure_reason: event.errorDescription,
      paid_at: status === 'captured' ? event.occurredAt.toISOString() : null,
    },
    { onConflict: 'provider,provider_payment_id' }
  );
}

/**
 * Moves a subscription to active and sets the period.
 *
 * Entitlements are not written here. The database trigger derives them from
 * the subscription row, so there is a single code path that decides what a
 * plan grants, and a manual fix applied in SQL produces the same result as a
 * webhook.
 */
async function activateSubscription(
  supabase: AdminClient,
  event: PaymentEvent,
  planCode: string,
  profileId: string | null,
  organizationId: string | null
): Promise<void> {
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('id, name, interval, amount_paise')
    .eq('code', planCode)
    .maybeSingle();

  if (!plan) {
    throw new Error(`Unknown plan code in webhook notes: ${planCode}`);
  }

  const start = event.occurredAt;
  const end = addInterval(start, plan.interval);

  const { data: subscription } = await supabase
    .from('subscriptions')
    .upsert(
      {
        profile_id: organizationId ? null : profileId,
        organization_id: organizationId,
        plan_id: plan.id,
        status: 'active',
        current_period_start: start.toISOString(),
        current_period_end: end.toISOString(),
        provider: 'razorpay',
        provider_subscription_id: event.subscriptionId,
      },
      { onConflict: 'provider,provider_subscription_id' }
    )
    .select('id, profile_id')
    .maybeSingle();

  if (profileId) {
    await captureServer(profileId, 'payment_success', {
      plan_code: planCode,
      amount_paise: event.amountPaise ?? plan.amount_paise,
    });
  }

  if (subscription?.profile_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', subscription.profile_id)
      .maybeSingle();

    if (profile?.email) {
      const email = createEmailService();
      await email.send(
        subscriptionConfirmedEmail(
          { siteName: SITE.name, siteUrl: SITE.origin },
          {
            to: profile.email,
            planName: plan.name,
            amount: formatPaise(event.amountPaise ?? plan.amount_paise),
            renewsOn: end.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
          }
        )
      );
    }
  }
}

async function notifyPaymentFailure(
  supabase: AdminClient,
  event: PaymentEvent,
  planCode: string | null,
  profileId: string | null
): Promise<void> {
  if (!profileId) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', profileId)
    .maybeSingle();

  if (!profile?.email) return;

  const email = createEmailService();
  await email.send(
    paymentFailedEmail(
      { siteName: SITE.name, siteUrl: SITE.origin },
      {
        to: profile.email,
        planName: planCode ?? 'your subscription',
        retryUrl: absoluteUrl('/account/billing'),
        reason: event.errorDescription ?? undefined,
      }
    )
  );
}

function addInterval(from: Date, interval: string): Date {
  const end = new Date(from);
  switch (interval) {
    case 'annual':
      end.setFullYear(end.getFullYear() + 1);
      break;
    case 'quarterly':
      end.setMonth(end.getMonth() + 3);
      break;
    case 'one_time':
      end.setFullYear(end.getFullYear() + 100);
      break;
    default:
      end.setMonth(end.getMonth() + 1);
  }
  return end;
}
