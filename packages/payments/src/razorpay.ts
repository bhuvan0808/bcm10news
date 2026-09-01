import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import type {
  CreateOrderRequest,
  CreateSubscriptionRequest,
  CreatedOrder,
  CreatedSubscription,
  PaymentEvent,
  PaymentService,
} from './types';

/**
 * Razorpay implementation.
 *
 * Signature verification uses `crypto.timingSafeEqual` rather than `===`. A
 * string comparison returns early on the first differing byte, which leaks
 * enough timing information to let an attacker reconstruct a valid signature
 * one byte at a time.
 */
export class RazorpayPaymentService implements PaymentService {
  readonly enabled = true;
  readonly publicKeyId: string;

  private readonly client: Razorpay;

  constructor(
    keyId: string,
    private readonly keySecret: string,
    private readonly webhookSecret: string
  ) {
    this.publicKeyId = keyId;
    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  async createOrder(request: CreateOrderRequest): Promise<CreatedOrder> {
    const order = await this.client.orders.create({
      amount: request.amountPaise,
      currency: request.currency ?? 'INR',
      receipt: request.receipt,
      notes: request.notes,
      // Capture automatically: an authorised-but-uncaptured payment expires
      // and leaves a reader who paid without access.
      payment_capture: true,
    });

    return {
      orderId: order.id,
      amountPaise: Number(order.amount),
      currency: order.currency,
      keyId: this.publicKeyId,
    };
  }

  async createSubscription(request: CreateSubscriptionRequest): Promise<CreatedSubscription> {
    const subscription = await this.client.subscriptions.create({
      plan_id: request.providerPlanId,
      // Razorpay requires a cycle count; 120 months is effectively "until cancelled".
      total_count: request.totalCount ?? 120,
      customer_notify: request.customerNotify === false ? 0 : 1,
      notes: request.notes,
    });

    return {
      subscriptionId: subscription.id,
      shortUrl: subscription.short_url ?? null,
      status: subscription.status,
    };
  }

  async cancelSubscription(providerSubscriptionId: string, atPeriodEnd: boolean): Promise<void> {
    await this.client.subscriptions.cancel(providerSubscriptionId, atPeriodEnd);
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    return timingSafeEqualHex(expected, signature);
  }

  verifyCheckoutSignature({
    orderId,
    paymentId,
    signature,
  }: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    const expected = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return timingSafeEqualHex(expected, signature);
  }

  interpretEvent(payload: unknown): PaymentEvent | null {
    if (!payload || typeof payload !== 'object') return null;

    const event = payload as RazorpayWebhookPayload;
    const rawType = event.event;
    if (!rawType) return null;

    const payment = event.payload?.payment?.entity;
    const subscription = event.payload?.subscription?.entity;
    const refund = event.payload?.refund?.entity;

    return {
      providerEventId: event.id ?? `${rawType}:${event.created_at ?? Date.now()}`,
      type: mapEventType(rawType),
      rawType,
      paymentId: payment?.id ?? refund?.payment_id ?? null,
      orderId: payment?.order_id ?? null,
      subscriptionId: subscription?.id ?? payment?.subscription_id ?? null,
      amountPaise: payment?.amount ?? refund?.amount ?? null,
      currency: payment?.currency ?? null,
      method: payment?.method ?? null,
      errorDescription: payment?.error_description ?? null,
      notes: {
        ...(subscription?.notes ?? {}),
        ...(payment?.notes ?? {}),
      },
      occurredAt: event.created_at ? new Date(event.created_at * 1000) : new Date(),
    };
  }
}

function mapEventType(rawType: string): PaymentEvent['type'] {
  const known: Record<string, PaymentEvent['type']> = {
    'payment.captured': 'payment.captured',
    'payment.failed': 'payment.failed',
    'payment.authorized': 'payment.authorized',
    'refund.processed': 'refund.processed',
    'subscription.activated': 'subscription.activated',
    'subscription.charged': 'subscription.charged',
    'subscription.cancelled': 'subscription.cancelled',
    'subscription.completed': 'subscription.completed',
    'subscription.halted': 'subscription.halted',
    'subscription.pending': 'subscription.pending',
  };
  return known[rawType] ?? 'unknown';
}

/**
 * Constant-time hex comparison. Length is checked first because
 * timingSafeEqual throws on a length mismatch, and an attacker learns nothing
 * from the length of a signature they supplied themselves.
 */
function timingSafeEqualHex(expected: string, actual: string): boolean {
  if (typeof actual !== 'string' || expected.length !== actual.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(actual, 'utf8'));
  } catch {
    return false;
  }
}

interface RazorpayWebhookPayload {
  id?: string;
  event?: string;
  created_at?: number;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        subscription_id?: string;
        amount?: number;
        currency?: string;
        method?: string;
        error_description?: string;
        notes?: Record<string, string>;
      };
    };
    subscription?: {
      entity?: { id?: string; status?: string; notes?: Record<string, string> };
    };
    refund?: { entity?: { id?: string; payment_id?: string; amount?: number } };
  };
}

/**
 * Used when Razorpay is not configured.
 *
 * Every method throws rather than pretending to succeed. Payments are the one
 * area where a silent no-op would be dangerous: a checkout that appears to
 * work but takes no money is worse than one that plainly refuses.
 */
export class DisabledPaymentService implements PaymentService {
  readonly enabled = false;
  readonly publicKeyId = null;

  private fail(): never {
    throw new Error(
      'Payments are not configured. Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET.'
    );
  }

  async createOrder(): Promise<CreatedOrder> {
    this.fail();
  }
  async createSubscription(): Promise<CreatedSubscription> {
    this.fail();
  }
  async cancelSubscription(): Promise<void> {
    this.fail();
  }
  verifyWebhookSignature(): boolean {
    return false;
  }
  verifyCheckoutSignature(): boolean {
    return false;
  }
  interpretEvent(): PaymentEvent | null {
    return null;
  }
}

export function createPaymentService(env: NodeJS.ProcessEnv = process.env): PaymentService {
  const keyId = env['RAZORPAY_KEY_ID'];
  const keySecret = env['RAZORPAY_KEY_SECRET'];
  const webhookSecret = env['RAZORPAY_WEBHOOK_SECRET'];

  if (!keyId || !keySecret || !webhookSecret) return new DisabledPaymentService();

  return new RazorpayPaymentService(keyId, keySecret, webhookSecret);
}
