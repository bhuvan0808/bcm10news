import { describe, expect, it } from 'vitest';
import { articleSlug, disambiguateSlug, slugify } from '../slug';
import { SLUG_PATTERN } from '../primitives';

describe('slugify', () => {
  it('lowercases and hyphenates English headlines', () => {
    expect(slugify('Cyclone Warning For Coastal Andhra')).toBe(
      'cyclone-warning-for-coastal-andhra'
    );
  });

  it('preserves Telugu characters instead of dropping them', () => {
    const result = slugify('తెలంగాణ ఎన్నికల ఫలితాలు');
    expect(result).toBe('తెలంగాణ-ఎన్నికల-ఫలితాలు');
    expect(SLUG_PATTERN.test(result)).toBe(true);
  });

  it('collapses punctuation and repeated separators', () => {
    expect(slugify('Budget 2026:  what it means -- for farmers!')).toBe(
      'budget-2026-what-it-means-for-farmers'
    );
  });

  it('trims to the maximum length on a word boundary', () => {
    const slug = slugify('a'.repeat(40) + ' ' + 'b'.repeat(40) + ' ' + 'c'.repeat(40), {
      maxLength: 90,
    });
    expect(slug.length).toBeLessThanOrEqual(90);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('produces slugs the database CHECK will accept', () => {
    for (const title of [
      'AP CM reviews Polavaram progress',
      'హైదరాబాద్‌లో భారీ వర్షాలు',
      'ISRO — Chandrayaan 4 update!!',
    ]) {
      expect(SLUG_PATTERN.test(slugify(title))).toBe(true);
    }
  });
});

describe('articleSlug', () => {
  it('prefers the English headline for portability', () => {
    expect(articleSlug({ title: 'Heavy rain in Hyderabad', titleTe: 'హైదరాబాద్‌లో వర్షాలు' })).toBe(
      'heavy-rain-in-hyderabad'
    );
  });

  it('falls back to Telugu when there is no usable English headline', () => {
    // The ZWNJ inside హైదరాబాద్‌లో is dropped, not turned into a hyphen: it sits
    // inside a word and is invisible, so it must not create a word boundary.
    expect(articleSlug({ title: '—', titleTe: 'హైదరాబాద్‌లో వర్షాలు' })).toBe(
      'హైదరాబాద్లో-వర్షాలు'
    );
  });

  it('strips zero-width joiners so two identical-looking slugs cannot diverge', () => {
    expect(slugify('హైదరాబాద్‌లో')).toBe(slugify('హైదరాబాద్లో'));
  });
});

describe('disambiguateSlug', () => {
  it('leaves the first attempt untouched', () => {
    expect(disambiguateSlug('story', 0)).toBe('story');
  });

  it('appends a human-sensible counter', () => {
    expect(disambiguateSlug('story', 1)).toBe('story-2');
    expect(disambiguateSlug('story', 2)).toBe('story-3');
  });
});
