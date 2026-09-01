import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@bcm10/database/admin';
import { json, serverError, unauthorized } from '@/lib/api';

/**
 * Resend delivery webhook.
 *
 * Stores delivery, bounce and complaint events so the newsroom can see why a
 * digest did not arrive, and so hard bounces can be suppressed rather than
 * retried into a reputation problem.
 *
 * Resend signs with Svix headers (svix-id, svix-timestamp, svix-signature).
 * The signed content is `id.timestamp.body`, the secret is base64 after a
 * `whsec_` prefix, and the signature header may carry several
 * space-separated `v1,<sig>` values during a key rotation — any match counts.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EVENT_MAP: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delivery_delayed',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
};

export async function POST(request: NextRequest) {
  const secret = process.env['RESEND_WEBHOOK_SECRET'];
  if (!secret) return json({ ok: false, message: 'Email webhooks are not configured' }, { status: 503 });

  const rawBody = await request.text();

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) return unauthorized('Missing signature headers');

  if (!verifySvix({ secret, id: svixId, timestamp: svixTimestamp, signature: svixSignature, body: rawBody })) {
    console.warn('Rejected Resend webhook: bad signature');
    return unauthorized('Invalid signature');
  }

  let payload: ResendEvent;
  try {
    payload = JSON.parse(rawBody) as ResendEvent;
  } catch {
    return json({ ok: false, message: 'Malformed JSON' }, { status: 400 });
  }

  const kind = EVENT_MAP[payload.type ?? ''];
  if (!kind) return json({ ok: true, ignored: payload.type });

  const recipients = payload.data?.to ?? [];
  if (!recipients.length) return json({ ok: true, ignored: 'no recipient' });

  const supabase = createAdminClient();

  const { error } = await supabase.from('email_events').insert(
    recipients.map((recipient) => ({
      provider: 'resend',
      provider_message_id: payload.data?.email_id ?? null,
      // svix-id is unique per delivery, so it deduplicates retries.
      provider_event_id: `${svixId}:${recipient}`,
      kind: kind as never,
      recipient,
      subject: payload.data?.subject ?? null,
      payload: payload as never,
      occurred_at: payload.created_at ?? new Date().toISOString(),
    }))
  );

  // A duplicate delivery is expected; the unique index rejecting it is the
  // mechanism working, not a failure.
  if (error && !error.message.includes('duplicate key')) {
    console.error('Could not record email events', error.message);
    return serverError('Could not record event');
  }

  /*
   * A hard bounce or a spam complaint means stop mailing this address. Left
   * unhandled, repeated sends to a dead address damage the sending domain's
   * reputation and start costing delivery to everyone else.
   */
  if (kind === 'bounced' || kind === 'complained') {
    await supabase
      .from('newsletter_subscribers')
      .update({ unsubscribed_at: new Date().toISOString() })
      .in('email', recipients);
  }

  return json({ ok: true });
}

interface ResendEvent {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[];
    subject?: string;
  };
}

function verifySvix({
  secret,
  id,
  timestamp,
  signature,
  body,
}: {
  secret: string;
  id: string;
  timestamp: string;
  signature: string;
  body: string;
}): boolean {
  // Reject anything more than five minutes old, so a captured request cannot
  // be replayed later.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');

  return signature
    .split(' ')
    .map((part) => part.split(',')[1])
    .some((candidate) => candidate !== undefined && timingSafeEqual(candidate, expected));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
