import { z } from 'zod';
import { email, paise, uuid } from './primitives';

/**
 * Commerce input schemas.
 *
 * Note what is absent: nothing here lets a client assert that a payment
 * succeeded. Checkout only names a plan; the subscription state is written by
 * the webhook handler after signature verification.
 */

export const checkoutInput = z.object({
  planCode: z.string().trim().min(1).max(60),
  organizationId: uuid.optional(),
  couponCode: z.string().trim().max(40).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutInput>;

/**
 * What Razorpay Checkout hands back to the browser. It is recorded for
 * correlation and answered with "we'll confirm shortly" — never with access.
 * The webhook is what grants entitlements.
 */
export const checkoutCallbackInput = z.object({
  razorpay_order_id: z.string().min(1).max(200),
  razorpay_payment_id: z.string().min(1).max(200),
  razorpay_signature: z.string().min(1).max(500),
});

export type CheckoutCallbackInput = z.infer<typeof checkoutCallbackInput>;

export const planInput = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]+$/, 'Plan codes are lowercase letters, digits and underscores'),
  name: z.string().trim().min(2).max(120),
  nameTe: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  audience: z.enum(['reader', 'business']).default('reader'),
  interval: z.enum(['one_time', 'monthly', 'quarterly', 'annual']).default('monthly'),
  amountPaise: paise,
  trialDays: z.number().int().min(0).max(90).default(0),
  entitlements: z
    .array(
      z.enum(['premium_content', 'ad_light', 'newsletter_premium', 'content_license', 'api_access'])
    )
    .default([]),
  licenseQuota: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(true),
  position: z.number().int().default(100),
});

export const cancelSubscriptionInput = z.object({
  subscriptionId: uuid,
  atPeriodEnd: z.boolean().default(true),
  reason: z.string().trim().max(500).optional(),
});

export const organizationInput = z.object({
  name: z.string().trim().min(2).max(200),
  billingEmail: email,
  gstin: z
    .string()
    .trim()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Enter a valid GSTIN')
    .optional(),
  contactPhone: z.string().trim().max(20).optional(),
  billingAddress: z
    .object({
      line1: z.string().trim().max(200).optional(),
      line2: z.string().trim().max(200).optional(),
      city: z.string().trim().max(100).optional(),
      state: z.string().trim().max(100).optional(),
      postalCode: z.string().trim().max(12).optional(),
      country: z.string().trim().max(60).default('India'),
    })
    .default({}),
});

export const licenseInput = z.object({
  organizationId: uuid,
  name: z.string().trim().min(2).max(200),
  quotaPerPeriod: z.number().int().positive().nullable(),
  periodEnd: z.coerce.date().nullable().optional(),
  allowFullText: z.boolean().default(true),
  allowImages: z.boolean().default(false),
  allowRepublish: z.boolean().default(false),
  allowApi: z.boolean().default(false),
  allowedCategoryIds: z.array(uuid).default([]),
});

/** Formats integer paise for display. 9900 → "₹99". */
export function formatPaise(amountPaise: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: amountPaise % 100 === 0 ? 0 : 2,
  }).format(amountPaise / 100);
}
