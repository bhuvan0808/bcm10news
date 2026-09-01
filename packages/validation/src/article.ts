import { z } from 'zod';
import { contentDoc } from './content';
import { articleStatus, contentLanguage, reviewAction, slug, uuid } from './primitives';
import { youtubeUrl } from './youtube';

/**
 * Article input schemas. The admin forms and the API route handlers share
 * these, so a field can only diverge between client and server if someone
 * edits this file.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === '' ? undefined : value));

export const articleDraftInput = z.object({
  title: z.string().trim().min(3, 'Headline is required').max(300),
  titleTe: optionalText(300),
  subtitle: optionalText(400),
  excerpt: optionalText(600),
  slug: slug.optional(),
  language: contentLanguage.default('te'),

  body: contentDoc.default({ type: 'doc', content: [] }),

  categoryId: uuid,
  secondaryCategoryId: uuid.optional().nullable(),
  locationId: uuid.optional().nullable(),

  featuredImageId: uuid.optional().nullable(),
  ogImageId: uuid.optional().nullable(),
  galleryMediaIds: z.array(uuid).max(60).default([]),

  videoUrls: z.array(youtubeUrl).max(10).default([]),

  tagNames: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  coauthorIds: z.array(uuid).max(6).default([]),
  relatedArticleIds: z.array(uuid).max(12).default([]),

  isBreaking: z.boolean().default(false),
  isExclusive: z.boolean().default(false),
  isPremium: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  isSponsored: z.boolean().default(false),
  allowComments: z.boolean().default(true),
  allowSyndication: z.boolean().default(true),
  previewParagraphs: z.number().int().min(0).max(20).default(3),
  priority: z.number().int().min(-100).max(100).default(0),

  seoTitle: optionalText(120),
  seoDescription: optionalText(320),
  canonicalUrl: z.string().url().max(500).optional().nullable(),
  noindex: z.boolean().default(false),

  bylineOverride: optionalText(200),
});

export type ArticleDraftInput = z.infer<typeof articleDraftInput>;

/** Partial save from the editor's autosave loop. */
export const articleAutosaveInput = articleDraftInput.partial().extend({
  id: uuid,
  changeSummary: optionalText(300),
});

export type ArticleAutosaveInput = z.infer<typeof articleAutosaveInput>;

export const articleSubmitInput = z.object({
  id: uuid,
  note: optionalText(1000),
});

export const articleReviewInput = z.object({
  id: uuid,
  action: reviewAction,
  comment: optionalText(2000),
});

export const articlePublishInput = z
  .object({
    id: uuid,
    scheduledFor: z.coerce.date().optional().nullable(),
    sendPush: z.boolean().default(false),
    sendNewsletter: z.boolean().default(false),
    pushHeading: optionalText(120),
    pushMessage: optionalText(200),
  })
  .refine((value) => !value.scheduledFor || value.scheduledFor.getTime() > Date.now() - 60_000, {
    message: 'Scheduled time must be in the future',
    path: ['scheduledFor'],
  });

export type ArticlePublishInput = z.infer<typeof articlePublishInput>;

/** Filters behind the newsroom queues and the admin article list. */
export const articleQueryInput = z.object({
  status: z.array(articleStatus).optional(),
  authorId: uuid.optional(),
  editorId: uuid.optional(),
  categoryId: uuid.optional(),
  locationId: uuid.optional(),
  search: z.string().trim().max(200).optional(),
  isBreaking: z.boolean().optional(),
  isPremium: z.boolean().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z
    .enum(['updated_desc', 'published_desc', 'created_desc', 'title_asc'])
    .default('updated_desc'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export type ArticleQueryInput = z.infer<typeof articleQueryInput>;

/**
 * Editorial transition table, mirroring public.is_legal_transition() in SQL.
 * The database is authoritative; this copy exists so the admin UI can grey out
 * a button instead of offering an action that will be rejected.
 */
export const LEGAL_TRANSITIONS: Record<
  z.infer<typeof articleStatus>,
  z.infer<typeof articleStatus>[]
> = {
  draft: ['draft', 'submitted', 'archived'],
  submitted: ['in_review', 'changes_requested', 'approved', 'draft', 'archived'],
  in_review: ['changes_requested', 'approved', 'submitted', 'archived'],
  changes_requested: ['draft', 'submitted', 'archived'],
  approved: ['scheduled', 'published', 'changes_requested', 'archived'],
  scheduled: ['published', 'approved', 'changes_requested', 'archived'],
  published: ['published', 'archived', 'draft'],
  archived: ['draft', 'published'],
};

export function canTransition(
  from: z.infer<typeof articleStatus>,
  to: z.infer<typeof articleStatus>
): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}
