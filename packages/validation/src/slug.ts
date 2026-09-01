/**
 * Slug generation.
 *
 * Mirrors public.slugify() in the database. Telugu characters are preserved
 * rather than transliterated: a Telugu headline should be able to produce a
 * Telugu URL, and Google indexes percent-encoded Unicode paths fine.
 */

/** Telugu Unicode block, U+0C00–U+0C7F. */
const TELUGU_RANGE = 'ఀ-౿';

const NON_SLUG = new RegExp(`[^a-z0-9${TELUGU_RANGE}]+`, 'gu');

/**
 * Zero-width joiner and non-joiner. Telugu uses these to control ligature
 * shaping, so they appear inside ordinary words — but they are invisible, and
 * two slugs that differ only by a ZWNJ would look identical to a human while
 * being different URLs. They are removed rather than turned into a hyphen,
 * because a joiner sits inside a word, not between two.
 */
const ZERO_WIDTH_JOINERS = /[‌‍]/gu;

export function slugify(input: string, options: { maxLength?: number } = {}): string {
  const maxLength = options.maxLength ?? 90;

  const base = input
    .normalize('NFC')
    .toLowerCase()
    .replace(ZERO_WIDTH_JOINERS, '')
    .replace(NON_SLUG, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  if (base.length <= maxLength) return base;

  // Trim at a hyphen so the slug never ends mid-word.
  const cut = base.slice(0, maxLength);
  const lastHyphen = cut.lastIndexOf('-');
  return (lastHyphen > maxLength * 0.6 ? cut.slice(0, lastHyphen) : cut).replace(/-+$/, '');
}

/**
 * Appends a short suffix to resolve a collision. Callers retry with an
 * incrementing attempt number; the database's UNIQUE constraint is the
 * final arbiter.
 */
export function disambiguateSlug(base: string, attempt: number): string {
  if (attempt <= 0) return base;
  return `${base}-${attempt + 1}`;
}

/**
 * Builds the slug for a story. Prefers the English headline when there is one,
 * because English slugs are more portable in analytics and share links, and
 * falls back to the Telugu headline otherwise.
 */
export function articleSlug(titles: { title: string; titleTe?: string | null }): string {
  const fromEnglish = slugify(titles.title);
  if (fromEnglish.length >= 3) return fromEnglish;
  return slugify(titles.titleTe ?? '') || `story-${Date.now().toString(36)}`;
}
