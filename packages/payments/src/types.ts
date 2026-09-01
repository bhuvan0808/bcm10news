/**
 * Payment seam.
 *
 * The single rule this interface exists to enforce: **the webhook is
 * authoritative**. Nothing here lets a browser assert that a payment
 * succeeded. `createOrder` opens a checkout; `verifyWebhookSignature` and
 * `interpretEvent` are what turn money into access.
 *
 * The client-side callback (`verifyCheckoutSignature`) exists only to give the
 * reader immediate feedback. It never grants an entitlement — if the webhook
 * has not arrived yet, the UI says "confirming", and access follows when it does.
 */

export interface CreateOrderRequest {
  amountPaise: number;
  currency?: string;
  /** Correlates the order with our own records. Echoed back by the provider. */
  receipt: string;
  notes?: Record<string, string>;
}

export interface CreatedOrder {
  orderId: string;
  amountPaise: number;
  currency: string;
  /** Public key id the browser checkout needs. Not a secret. */
  keyId: string;
}

export interface CreateSubscriptionRequest {
  providerPlanId: string;
  totalCount?: number;
  customerNotify?: boolean;
  notes?: Record<string, string>;
}

export interface CreatedSubscription {
  subscriptionId: string;
  shortUrl: string | null;
  status: string;
}

/** Normalised event, so the handler never reads a provider-shaped payload. */
export interface PaymentEvent {
  providerEventId: string;
  type:
    | 'payment.captured'
    | 'payment.failed'
    | 'payment.authorized'
    | 'refund.processed'
    | 'subscription.activated'
    | 'subscription.charged'
    | 'subscription.cancelled'
    | 'subscription.completed'
    | 'subscription.halted'
    | 'subscription.pending'
    | 'unknown';
  rawType: string;
  paymentId: string | null;
  orderId: string | null;
  subscriptionId: string | null;
  amountPaise: number | null;
  currency: string | null;
  method: string | null;
  errorDescription: string | null;
  /** Notes we attached at order creation — how we find our own records. */
  notes: Record<string, string>;
  occurredAt: Date;
}

export interface PaymentService {
  readonly enabled: boolean;
  readonly publicKeyId: string | null;

  createOrder(request: CreateOrderRequest): Promise<CreatedOrder>;
  createSubscription(request: CreateSubscriptionRequest): Promise<CreatedSubscription>;
  cancelSubscription(providerSubscriptionId: string, atPeriodEnd: boolean): Promise<void>;

  /**
   * Verifies the HMAC on a webhook body. Called with the RAW request text —
   * a re-serialised JSON object will not produce the same digest.
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean;

  /** Verifies the browser callback triple. Feedback only; grants nothing. */
  verifyCheckoutSignature(input: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean;

  interpretEvent(payload: unknown): PaymentEvent | null;
}
