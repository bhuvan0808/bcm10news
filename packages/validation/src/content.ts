import { z } from 'zod';

/**
 * The article body is a ProseMirror/Tiptap document. It is validated on the way
 * in so that stored content is always a well-formed tree of known node types —
 * an unknown node reaching the renderer is a bug, not a rendering decision.
 *
 * Nothing here is HTML. Marks carry `href` etc. as data, and the renderer
 * decides what is safe to emit.
 */

export const CONTENT_NODE_TYPES = [
  'doc',
  'paragraph',
  'heading',
  'text',
  'hardBreak',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'horizontalRule',
  'codeBlock',
  'image',
  'gallery',
  'youtube',
  'callout',
  'relatedStory',
  'embed',
  'figure',
  'caption',
] as const;

export const CONTENT_MARK_TYPES = [
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'link',
  'subscript',
  'superscript',
] as const;

const markSchema = z.object({
  type: z.enum(CONTENT_MARK_TYPES),
  attrs: z.record(z.unknown()).optional(),
});

export type ContentMark = z.infer<typeof markSchema>;

export interface ContentNode {
  type: (typeof CONTENT_NODE_TYPES)[number];
  attrs?: Record<string, unknown>;
  content?: ContentNode[];
  marks?: ContentMark[];
  text?: string;
}

export const contentNode: z.ZodType<ContentNode> = z.lazy(() =>
  z.object({
    type: z.enum(CONTENT_NODE_TYPES),
    attrs: z.record(z.unknown()).optional(),
    content: z.array(contentNode).optional(),
    marks: z.array(markSchema).optional(),
    text: z.string().optional(),
  })
);

export const contentDoc = z.object({
  type: z.literal('doc'),
  content: z.array(contentNode).default([]),
});

export type ContentDoc = z.infer<typeof contentDoc>;

export const EMPTY_DOC: ContentDoc = { type: 'doc', content: [] };

/** Flattens every text node. Mirrors public.extract_doc_text() in SQL. */
export function docToPlainText(doc: ContentDoc | ContentNode | null | undefined): string {
  if (!doc) return '';

  const parts: string[] = [];
  const walk = (node: ContentNode) => {
    if (typeof node.text === 'string') parts.push(node.text);
    node.content?.forEach(walk);
  };
  walk(doc as ContentNode);

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function wordCount(doc: ContentDoc): number {
  const text = docToPlainText(doc);
  if (!text) return 0;
  return text.split(/\s+/).length;
}

/** 200 wpm, floored at one minute. Matches articles_derive_content() in SQL. */
export function readingTimeMinutes(doc: ContentDoc): number {
  return Math.max(1, Math.ceil(wordCount(doc) / 200));
}

/**
 * Truncates a document to the first N top-level block nodes, for the free
 * preview of a premium story.
 *
 * This runs on the server only. It is a presentation convenience — the actual
 * paywall is the RLS policy that keeps the full row out of a non-subscriber's
 * hands in the first place.
 */
export function truncateDoc(doc: ContentDoc, paragraphs: number): ContentDoc {
  if (paragraphs <= 0) return EMPTY_DOC;

  const kept: ContentNode[] = [];
  let counted = 0;

  for (const node of doc.content ?? []) {
    kept.push(node);
    // Only prose counts toward the allowance; a rule or image is not a paragraph.
    if (node.type === 'paragraph' || node.type === 'blockquote' || node.type === 'heading') {
      counted += 1;
    }
    if (counted >= paragraphs) break;
  }

  return { type: 'doc', content: kept };
}

/** First paragraph of the body, used when a reporter leaves the excerpt blank. */
export function deriveExcerpt(doc: ContentDoc, maxLength = 200): string {
  const firstParagraph = (doc.content ?? []).find(
    (node) => node.type === 'paragraph' && docToPlainText(node).length > 0
  );
  const text = docToPlainText(firstParagraph ?? null) || docToPlainText(doc);
  if (text.length <= maxLength) return text;

  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Media ids referenced by image/gallery nodes, for usage tracking. */
export function collectMediaIds(doc: ContentDoc): string[] {
  const ids = new Set<string>();

  const walk = (node: ContentNode) => {
    const mediaId = node.attrs?.['mediaId'];
    if (typeof mediaId === 'string') ids.add(mediaId);

    const items = node.attrs?.['items'];
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item && typeof item === 'object' && typeof (item as { mediaId?: unknown }).mediaId === 'string') {
          ids.add((item as { mediaId: string }).mediaId);
        }
      }
    }

    node.content?.forEach(walk);
  };
  walk(doc as ContentNode);

  return [...ids];
}

/** YouTube video ids embedded in the body. */
export function collectVideoIds(doc: ContentDoc): string[] {
  const ids = new Set<string>();

  const walk = (node: ContentNode) => {
    if (node.type === 'youtube' && typeof node.attrs?.['videoId'] === 'string') {
      ids.add(node.attrs['videoId'] as string);
    }
    node.content?.forEach(walk);
  };
  walk(doc as ContentNode);

  return [...ids];
}
