/**
 * A single headline number.
 *
 * Deliberately not a chart. One value with a comparison is a stat tile — drawing
 * a two-point sparkline for it would add ink without adding information.
 *
 * The trend is the point. A number on a dashboard with nothing to compare it to
 * cannot be acted on: 4,200 views is good or bad only relative to last week.
 * Direction is carried by an arrow and a sign as well as colour, so it survives
 * colour blindness and a monochrome print.
 */
export function StatTile({
  label,
  value,
  previous,
  days,
  suffix = '',
  hint,
}: {
  label: string;
  value: number | string;
  previous?: number;
  days?: number;
  suffix?: string;
  hint?: string;
}) {
  const current = Number(value) || 0;
  const hasComparison = previous !== undefined && previous > 0;
  const change = hasComparison ? ((current - previous) / previous) * 100 : null;

  const direction = change === null ? null : change > 1 ? 'up' : change < -1 ? 'down' : 'flat';

  return (
    <div className="rounded-sm border border-rule bg-paper-raised p-3">
      <p className="text-xs font-medium text-ink-muted">{label}</p>

      <p className="mt-1 text-2xl font-bold text-ink tabular-nums">
        {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
        {suffix ? <span className="text-base font-semibold text-ink-muted">{suffix}</span> : null}
      </p>

      {direction ? (
        <p
          className={`mt-1 flex items-center gap-1 text-xs font-medium ${
            direction === 'up'
              ? 'text-status-published'
              : direction === 'down'
                ? 'text-brand'
                : 'text-ink-faint'
          }`}
        >
          <span aria-hidden="true">
            {direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'}
          </span>
          {/* The sign is spelled out, so the meaning does not rest on the arrow
              glyph or the colour alone. */}
          {change! > 0 ? '+' : ''}
          {change!.toFixed(0)}%
          <span className="font-normal text-ink-faint">vs previous {days ?? 30}d</span>
        </p>
      ) : hasComparison ? null : (
        <p className="mt-1 text-xs text-ink-faint">no earlier period to compare</p>
      )}

      {hint ? <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">{hint}</p> : null}
    </div>
  );
}
