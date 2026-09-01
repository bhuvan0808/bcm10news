/**
 * Formatting for the newsroom.
 *
 * Always Asia/Kolkata. A deadline that renders in the server's timezone is a
 * missed deadline, and Vercel functions do not run in India.
 */
const IST = 'Asia/Kolkata';

export function formatDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const absolute = Math.abs(seconds);

  if (absolute < 45) return 'just now';

  const rtf = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });
  for (const [unit, unitSeconds] of UNITS) {
    if (absolute >= unitSeconds) return rtf.format(Math.round(seconds / unitSeconds), unit);
  }
  return rtf.format(Math.round(seconds / 60), 'minute');
}

/**
 * "in 2 hours" for a scheduled story, or "overdue by 20 minutes" when the
 * publish time has passed and cron has not caught it yet — that distinction
 * matters to an editor watching a queue.
 */
export function formatSchedule(value: string | Date): { label: string; overdue: boolean } {
  const date = typeof value === 'string' ? new Date(value) : value;
  const overdue = date.getTime() < Date.now();
  return {
    label: overdue ? `overdue — ${formatRelative(date)}` : formatRelative(date),
    overdue,
  };
}

/** Converts a datetime-local input value (IST wall clock) to a UTC ISO string. */
export function istLocalInputToIso(value: string): string | null {
  if (!value) return null;
  // datetime-local has no timezone; the reporter means IST, which is UTC+5:30.
  const asIst = new Date(`${value}:00+05:30`);
  return Number.isNaN(asIst.getTime()) ? null : asIst.toISOString();
}

/** The reverse, for populating a datetime-local input from a stored timestamp. */
export function isoToIstLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
