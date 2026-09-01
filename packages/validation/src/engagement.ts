import { z } from 'zod';
import { contentLanguage, newsletterKind, pushTopic, uuid } from './primitives';

/** Reader-facing input: search, comments, newsletter, push, view tracking. */

export const searchInput = z.object({
  q: z.string().trim().min(2, 'Enter at least two characters').max(200),
  category: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
});

export type SearchInput = z.infer<typeof searchInput>;

export const commentInput = z.object({
  articleId: uuid,
  parentId: uuid.optional().nullable(),
  body: z.string().trim().min(1, 'Write something first').max(4000),
});

export const newsletterSignupInput = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  kinds: z.array(newsletterKind).min(1).default(['daily_digest']),
  language: contentLanguage.default('te'),
  source: z.string().trim().max(60).default('website'),
  // Honeypot: a real person leaves this empty.
  website: z.string().max(0).optional(),
});

export type NewsletterSignupInput = z.infer<typeof newsletterSignupInput>;

export const pushPreferenceInput = z.object({
  playerId: z.string().trim().min(1).max(200),
  topics: z.array(pushTopic).default(['breaking_news']),
  language: contentLanguage.default('te'),
});

export const articleViewInput = z.object({
  articleId: uuid,
  readDepth: z.number().int().min(0).max(100).optional(),
  referrerHost: z.string().trim().max(128).optional(),
});

/** Read-progress milestones reported to PostHog. */
export const READ_DEPTH_MILESTONES = [25, 50, 75, 100] as const;
export type ReadDepthMilestone = (typeof READ_DEPTH_MILESTONES)[number];
