import { describe, expect, it } from 'vitest';
import {
  collectMediaIds,
  collectVideoIds,
  contentDoc,
  deriveExcerpt,
  docToPlainText,
  readingTimeMinutes,
  truncateDoc,
  wordCount,
  type ContentDoc,
} from '../content';

const paragraph = (text: string) => ({
  type: 'paragraph' as const,
  content: [{ type: 'text' as const, text }],
});

const doc: ContentDoc = {
  type: 'doc',
  content: [
    paragraph('First paragraph of the story.'),
    paragraph('Second paragraph with more detail.'),
    { type: 'image', attrs: { mediaId: '11111111-1111-1111-1111-111111111111' } },
    paragraph('Third paragraph.'),
    { type: 'youtube', attrs: { videoId: 'dQw4w9WgXcQ' } },
    paragraph('Fourth paragraph.'),
  ],
};

describe('docToPlainText', () => {
  it('flattens nested text nodes', () => {
    expect(docToPlainText(doc)).toBe(
      'First paragraph of the story. Second paragraph with more detail. Third paragraph. Fourth paragraph.'
    );
  });

  it('handles an empty document', () => {
    expect(docToPlainText({ type: 'doc', content: [] })).toBe('');
    expect(docToPlainText(null)).toBe('');
  });
});

describe('reading time', () => {
  it('counts words', () => {
    expect(wordCount(doc)).toBe(14);
  });

  it('never reports less than a minute', () => {
    expect(readingTimeMinutes({ type: 'doc', content: [paragraph('One.')] })).toBe(1);
  });

  it('rounds up at 200 words per minute', () => {
    const long: ContentDoc = {
      type: 'doc',
      content: [paragraph(Array.from({ length: 450 }, () => 'word').join(' '))],
    };
    expect(readingTimeMinutes(long)).toBe(3);
  });
});

describe('truncateDoc', () => {
  it('keeps only the allowed number of prose blocks', () => {
    const preview = truncateDoc(doc, 2);
    expect(preview.content.filter((n) => n.type === 'paragraph')).toHaveLength(2);
  });

  it('does not count images or videos against the paragraph allowance', () => {
    const preview = truncateDoc(doc, 3);
    const paragraphs = preview.content.filter((n) => n.type === 'paragraph');
    expect(paragraphs).toHaveLength(3);
    expect(preview.content.some((n) => n.type === 'image')).toBe(true);
  });

  it('returns nothing when the allowance is zero', () => {
    expect(truncateDoc(doc, 0).content).toHaveLength(0);
  });

  it('is a no-op when the allowance exceeds the document', () => {
    expect(truncateDoc(doc, 50).content).toHaveLength(doc.content.length);
  });
});

describe('deriveExcerpt', () => {
  it('uses the first non-empty paragraph', () => {
    expect(deriveExcerpt(doc)).toBe('First paragraph of the story.');
  });

  it('truncates on a word boundary and ellipsises', () => {
    const long = { type: 'doc' as const, content: [paragraph('word '.repeat(80).trim())] };
    const excerpt = deriveExcerpt(long, 50);
    expect(excerpt.length).toBeLessThanOrEqual(51);
    expect(excerpt.endsWith('…')).toBe(true);
  });
});

describe('media and video collection', () => {
  it('finds media ids on image nodes', () => {
    expect(collectMediaIds(doc)).toEqual(['11111111-1111-1111-1111-111111111111']);
  });

  it('finds media ids inside gallery item arrays', () => {
    const gallery: ContentDoc = {
      type: 'doc',
      content: [
        {
          type: 'gallery',
          attrs: { items: [{ mediaId: 'a' }, { mediaId: 'b' }] },
        },
      ],
    };
    expect(collectMediaIds(gallery)).toEqual(['a', 'b']);
  });

  it('finds embedded YouTube ids', () => {
    expect(collectVideoIds(doc)).toEqual(['dQw4w9WgXcQ']);
  });
});

describe('contentDoc schema', () => {
  it('accepts a well-formed document', () => {
    expect(contentDoc.safeParse(doc).success).toBe(true);
  });

  it('rejects an unknown node type rather than storing it', () => {
    const result = contentDoc.safeParse({
      type: 'doc',
      content: [{ type: 'script', attrs: { src: 'https://evil.example/x.js' } }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a root that is not a doc', () => {
    expect(contentDoc.safeParse({ type: 'paragraph' }).success).toBe(false);
  });
});
