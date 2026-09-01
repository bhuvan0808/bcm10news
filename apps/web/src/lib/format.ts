import { SITE } from './site';

/**
 * Date and number formatting.
 *
 * Everything is rendered in Asia/Kolkata regardless of where the server runs.
 * A dateline that shifts because a Vercel function happened to execute in
 * Frankfurt is a correctness bug in a newsroom, not a cosmetic one.
 */

const IST = 'Asia/Kolkata';

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  let existing = dateFormatters.get(key);
  if (!existing) {
    existing = new Intl.DateTimeFormat(locale, { timeZone: IST, ...options });
    dateFormatters.set(key, existing);
  }
  return existing;
}

export function formatDate(value: string | Date, locale: 'te' | 'en' = SITE.defaultLocale): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return formatter(locale === 'te' ? 'te-IN' : 'en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | Date, locale: 'te' | 'en' = SITE.defaultLocale): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return formatter(locale === 'te' ? 'te-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/** ISO 8601 with the IST offset, for datetime attributes and structured data. */
export function toIsoString(value: string | Date): string {
  return (typeof value === 'string' ? new Date(value) : value).toISOString();
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/**
 * "12 minutes ago". Anything older than a week gets an absolute date instead —
 * "7 weeks ago" is harder to place than "14 July".
 */
export function formatRelative(
  value: string | Date,
  locale: 'te' | 'en' = SITE.defaultLocale,
  now: Date = new Date()
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const absolute = Math.abs(seconds);

  if (absolute > 7 * 24 * 3600) return formatDate(date, locale);
  if (absolute < 60) return locale === 'te' ? 'ఇప్పుడే' : 'just now';

  const rtf = new Intl.RelativeTimeFormat(locale === 'te' ? 'te-IN' : 'en-IN', { numeric: 'auto' });

  for (const [unit, unitSeconds] of RELATIVE_UNITS) {
    if (absolute >= unitSeconds) {
      return rtf.format(Math.round(seconds / unitSeconds), unit);
    }
  }

  return rtf.format(Math.round(seconds / 60), 'minute');
}

/** Compact counts: 12400 -> "12.4K". Indian grouping for the full form. */
export function formatCount(value: number, locale: 'te' | 'en' = SITE.defaultLocale): string {
  return new Intl.NumberFormat(locale === 'te' ? 'te-IN' : 'en-IN', {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

export function readingTimeLabel(minutes: number, locale: 'te' | 'en' = SITE.defaultLocale): string {
  return locale === 'te' ? `${minutes} నిమిషాల పఠనం` : `${minutes} min read`;
}

/**
 * Picks the Telugu field when it exists and the reader is on Telugu, falling
 * back to English. Stories are often filed with only one of the two.
 */
export function localised(
  primary: string | null | undefined,
  telugu: string | null | undefined,
  locale: 'te' | 'en' = SITE.defaultLocale
): string {
  if (locale === 'te') return telugu?.trim() || primary?.trim() || '';
  return primary?.trim() || telugu?.trim() || '';
}
