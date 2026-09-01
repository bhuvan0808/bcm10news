'use client';

import { useState } from 'react';

/**
 * Views per day for one story.
 *
 * A single series, so there is no legend — the section heading already names
 * what is plotted, and a legend box for one thing is noise.
 *
 * Bars rather than a line: daily counts are discrete quantities, and a line
 * between them implies a continuous value at 3pm on Tuesday that does not exist.
 * A news story's traffic is also spiky — a line smooths away exactly the launch
 * spike an editor is looking for.
 *
 * 4px rounded data-ends anchored to the baseline, with a 2px gap between bars.
 */
export function ArticleTrendChart({ series }: { series: { day: string; views: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (!series.length) return null;

  const max = Math.max(...series.map((point) => point.views), 1);
  const peakIndex = series.findIndex((point) => point.views === max);

  return (
    <figure className="m-0">
      <div className="flex items-end gap-[2px]" style={{ height: 180 }}>
        {series.map((point, index) => {
          const heightPercent = (point.views / max) * 100;
          const isHovered = hover === index;

          return (
            <div
              key={point.day}
              className="group relative flex h-full flex-1 items-end"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
            >
              <div
                className={`w-full rounded-t-[4px] transition-colors ${
                  isHovered ? 'bg-brand-dark' : 'bg-brand'
                }`}
                style={{
                  // A zero day still shows a 2px stub, so the axis reads as
                  // "no reads" rather than "no data".
                  height: point.views === 0 ? '2px' : `${Math.max(2, heightPercent)}%`,
                  opacity: point.views === 0 ? 0.25 : 1,
                }}
              />

              {isHovered ? (
                <div
                  role="status"
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-sm border border-rule bg-paper-raised px-2 py-1 text-xs whitespace-nowrap shadow-lg"
                >
                  <span className="font-semibold text-ink">
                    {point.views.toLocaleString('en-IN')}
                  </span>{' '}
                  <span className="text-ink-muted">
                    {point.views === 1 ? 'view' : 'views'} · {shortDate(point.day)}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Selective direct labels: the ends and the peak. A number over every bar
          is unreadable at 30 days and tells you nothing at 90. */}
      <div className="mt-2 flex justify-between text-[11px] text-ink-faint">
        <span>{shortDate(series[0]!.day)}</span>
        {peakIndex > 2 && peakIndex < series.length - 3 ? (
          <span className="font-medium text-ink-muted">
            peak {max.toLocaleString('en-IN')} on {shortDate(series[peakIndex]!.day)}
          </span>
        ) : null}
        <span>{shortDate(series.at(-1)!.day)}</span>
      </div>
    </figure>
  );
}

function shortDate(day: string): string {
  return new Date(day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}
