import { z } from 'zod';

/**
 * Shared primitive schemas. These mirror the CHECK constraints in the database
 * so a bad value is rejected at the edge with a readable message instead of
 * surfacing as a Postgres constraint violation.
 */

export const uuid = z.string().uuid();

/**
 * Slugs may contain Telugu characters — a Telugu headline should be able to
 * produce a Telugu URL. Matches the `articles_slug_format` CHECK.
 */
export const SLUG_PATTERN = /^[a-z0-9ఀ-౿]+(-[a-z0-9ఀ-౿]+)*$/u;

export const slug = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(200, 'Slug must be at most 200 characters')
  .regex(SLUG_PATTERN, 'Slug may contain lowercase letters, digits, Telugu characters and hyphens');

/** ASCII-only slug, for taxonomy where the URL is a stable English key. */
export const asciiSlug = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug may contain lowercase letters, digits and hyphens');

export const email = z.string().trim().toLowerCase().email('Enter a valid email address');

export const contentLanguage = z.enum(['te', 'en']);

export const articleStatus = z.enum([
  'draft',
  'submitted',
  'in_review',
  'changes_requested',
  'approved',
  'scheduled',
  'published',
  'archived',
]);

export const userRole = z.enum([
  'super_admin',
  'managing_editor',
  'editor',
  'reporter',
  'photographer',
  'subscription_manager',
  'business_customer',
  'reader',
]);

export const reviewAction = z.enum([
  'submitted',
  'claimed',
  'approved',
  'changes_requested',
  'rejected',
  'published',
  'scheduled',
  'unpublished',
  'archived',
  'restored',
]);

export const newsletterKind = z.enum([
  'daily_digest',
  'morning_briefing',
  'evening_briefing',
  'breaking_news',
  'category_digest',
  'weekly_roundup',
]);

export const pushTopic = z.enum([
  'breaking_news',
  'politics',
  'sports',
  'cinema',
  'business',
  'technology',
  'andhra_pradesh',
  'telangana',
  'national',
  'international',
]);

/** Money is always integer paise. A float here is a bug, so reject it. */
export const paise = z
  .number()
  .int('Amounts are stored in integer paise')
  .nonnegative()
  .max(100_000_000_000);

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
});

export type Pagination = z.infer<typeof pagination>;
export type ArticleStatus = z.infer<typeof articleStatus>;
export type UserRole = z.infer<typeof userRole>;
export type ReviewAction = z.infer<typeof reviewAction>;
export type ContentLanguage = z.infer<typeof contentLanguage>;
export type NewsletterKind = z.infer<typeof newsletterKind>;
export type PushTopic = z.infer<typeof pushTopic>;
