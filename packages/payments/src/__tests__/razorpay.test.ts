import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DisabledPaymentService, RazorpayPaymentService } from '../razorpay';

const KEY_ID = 'rzp_test_key';
const KEY_SECRET = 'test_secret';
const WEBHOOK_SECRET = 'webhook_secret';

const service = new RazorpayPaymentService(KEY_ID, KEY_SECRET, WEBHOOK_SECRET);

const sign = (secret: string, payload: string) =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

describe('webhook signature verification', () => {
  const body = JSON.stringify({ event: 'payment.captured', id: 'evt_1' });

  it('accepts a correctly signed body', () => {
    expect(service.verifyWebhookSignature(body, sign(WEBHOOK_SECRET, body))).toBe(true);
  });

  it('rejects a signature made with the wrong secret', () => {
    expect(service.verifyWebhookSignature(body, sign('not_the_secret', body))).toBe(false);
  });

  it('rejects a body that was altered after signing', () => {
    const signature = sign(WEBHOOK_SECRET, body);
    const tampered = JSON.stringify({ event: 'payment.captured', id: 'evt_1', amount: 999999 });
    expect(service.verifyWebhookSignature(tampered, signature)).toBe(false);
  });

  it('rejects an empty or malformed signature rather than throwing', () => {
    expect(service.verifyWebhookSignature(body, '')).toBe(false);
    expect(service.verifyWebhookSignature(body, 'nonsense')).toBe(false);
    expect(service.verifyWebhookSignature(body, null as unknown as string)).toBe(false);
  });
});

describe('checkout callback verification', () => {
  const orderId = 'order_abc';
  const paymentId = 'pay_xyz';

  it('accepts the genuine order|payment digest', () => {
    const signature = sign(KEY_SECRET, `${orderId}|${paymentId}`);
    expect(service.verifyCheckoutSignature({ orderId, paymentId, signature })).toBe(true);
  });

  it('rejects a signature for a different payment, so one receipt cannot be replayed', () => {
    const signature = sign(KEY_SECRET, `${orderId}|pay_other`);
    expect(service.verifyCheckoutSignature({ orderId, paymentId, signature })).toBe(false);
  });
});

describe('interpretEvent', () => {
  it('normalises a captured payment', () => {
    const event = service.interpretEvent({
      id: 'evt_123',
      event: 'payment.captured',
      created_at: 1_767_225_600,
      payload: {
        payment: {
          entity: {
            id: 'pay_1',
            order_id: 'order_1',
            amount: 9900,
            currency: 'INR',
            method: 'upi',
            notes: { plan_code: 'premium_monthly', profile_id: 'user-1' },
          },
        },
      },
    });

    expect(event).toMatchObject({
      providerEventId: 'evt_123',
      type: 'payment.captured',
      paymentId: 'pay_1',
      orderId: 'order_1',
      amountPaise: 9900,
      method: 'upi',
    });
    expect(event?.notes['plan_code']).toBe('premium_monthly');
  });

  it('carries the failure reason through on a failed payment', () => {
    const event = service.interpretEvent({
      id: 'evt_fail',
      event: 'payment.failed',
      payload: { payment: { entity: { id: 'pay_2', error_description: 'Insufficient funds' } } },
    });

    expect(event?.type).toBe('payment.failed');
    expect(event?.errorDescription).toBe('Insufficient funds');
  });

  it('maps subscription lifecycle events', () => {
    const event = service.interpretEvent({
      id: 'evt_sub',
      event: 'subscription.activated',
      payload: { subscription: { entity: { id: 'sub_1', status: 'active', notes: { profile_id: 'u1' } } } },
    });

    expect(event).toMatchObject({ type: 'subscription.activated', subscriptionId: 'sub_1' });
  });

  it('labels an unrecognised event rather than dropping it, so it is still logged', () => {
    const event = service.interpretEvent({ id: 'evt_x', event: 'order.paid' });
    expect(event?.type).toBe('unknown');
    expect(event?.rawType).toBe('order.paid');
  });

  it('returns null for a payload that is not an event', () => {
    expect(service.interpretEvent(null)).toBeNull();
    expect(service.interpretEvent('nope')).toBeNull();
    expect(service.interpretEvent({})).toBeNull();
  });
});

describe('DisabledPaymentService', () => {
  const disabled = new DisabledPaymentService();

  it('refuses to create an order rather than silently taking no money', async () => {
    await expect(disabled.createOrder()).rejects.toThrow(/not configured/i);
  });

  it('never validates a signature', () => {
    expect(disabled.verifyWebhookSignature()).toBe(false);
    expect(disabled.verifyCheckoutSignature()).toBe(false);
  });
});
