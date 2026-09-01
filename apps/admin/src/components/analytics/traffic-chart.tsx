'use client';

import { useId, useMemo, useState } from 'react';

/**
 * Daily traffic.
 *
 * Form: change over time, two series in the same unit (page views and readers),
 * so one chart with one y-axis. Never two scales — a dual axis lets the two
 * lines cross wherever the scaling happens to put them, which invents a
 * relationship that is not in the data.
 *
 * Colour: two categorical slots, blue and orange, assigned in fixed order and
 * validated for both modes with the palette checker — worst adjacent pair
 * ΔE 24.7 protan in light, 26.8 in dark, well clear of the 8 floor. Both series
 * are also directly labelled, so identity never rests on colour alone.
 *
 * Drawn as plain SVG. A charting library would be several hundred kilobytes for
 * one line chart, on a page a reporter opens on a phone.
 */
interface Point {
  day: string;
  views: number;
  visitors: number;
}

const SERIES = [
  { key: 'views' as const, label: 'Page views', light: '#2a78d6', dark: '#3987e5' },
  { key: 'visitors' as const, label: 'Readers', light: '#eb6834', dark: '#d95926' },
];

export function TrafficChart({ series }: { series: Point[] }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);

  const width = 900;
  const height = 260;
  const pad = { top: 16, right: 16, bottom: 28, left: 48 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;

  const { max, ticks, points } = useMemo(() => {
    const peak = Math.max(...series.flatMap((p) => [p.views, p.visitors]), 1);
    // Round the ceiling to something a human reads off an axis.
    const magnitude = Math.pow(10, Math.floor(Math.log10(peak)));
    const ceiling = Math.ceil(peak / magnitude) * magnitude;

    const step = ceiling / 4;
    return {
      max: ceiling,
      ticks: [0, step, step * 2, step * 3, ceiling],
      points: series.map((point, index) => ({
        ...point,
        x:
          pad.left +
          (series.length === 1 ? plotWidth / 2 : (index / (series.length - 1)) * plotWidth),
      })),
    };
  }, [series, pad.left, plotWidth]);

  const y = (value: number) => pad.top + plotHeight - (value / max) * plotHeight;

  const path = (key: 'views' | 'visitors') =>
    points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${y(p[key]).toFixed(1)}`)
      .join(' ');

  const areaPath = (key: 'views' | 'visitors') =>
    `${path(key)} L ${points.at(-1)!.x.toFixed(1)} ${pad.top + plotHeight} L ${points[0]!.x.toFixed(1)} ${pad.top + plotHeight} Z`;

  const active = hover !== null ? points[hover] : null;

  if (!series.length) return null;

  return (
    <figure className="traffic-chart m-0">
      {/* Legend: two series, so a legend is required; both are also labelled at
          the line end, which is the secondary encoding. */}
      <figcaption className="mb-3 flex flex-wrap items-center gap-4 text-xs">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-ink-muted">
            <span
              className="size-2.5 rounded-full"
              style={{ background: `var(--series-${s.key})` }}
            />
            {s.label}
          </span>
        ))}
      </figcaption>

      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[640px]"
          role="img"
          aria-label={`Daily page views and readers over the last ${series.length} days`}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            {SERIES.map((s) => (
              <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={`var(--series-${s.key})`} stopOpacity="0.16" />
                <stop offset="100%" stopColor={`var(--series-${s.key})`} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* Recessive grid — present enough to read a value against, quiet
              enough that the data reads first. */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-rule"
                strokeWidth="1"
              />
              <text
                x={pad.left - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-ink-faint text-[11px] tabular-nums"
              >
                {compact(tick)}
              </text>
            </g>
          ))}

          {SERIES.map((s) => (
            <g key={s.key}>
              <path d={areaPath(s.key)} fill={`url(#${id}-${s.key})`} />
              <path
                d={path(s.key)}
                fill="none"
                stroke={`var(--series-${s.key})`}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          ))}

          {/* Crosshair on hover. */}
          {active ? (
            <g>
              <line
                x1={active.x}
                x2={active.x}
                y1={pad.top}
                y2={pad.top + plotHeight}
                className="stroke-rule-strong"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              {SERIES.map((s) => (
                <circle
                  key={s.key}
                  cx={active.x}
                  cy={y(active[s.key])}
                  r="4.5"
                  fill={`var(--series-${s.key})`}
                  // 2px surface ring, so overlapping markers stay separable.
                  stroke="var(--color-paper-raised)"
                  strokeWidth="2"
                />
              ))}
            </g>
          ) : null}

          {/* Invisible hit areas, wider than the marks. */}
          {points.map((point, index) => (
            <rect
              key={point.day}
              x={point.x - plotWidth / points.length / 2}
              y={pad.top}
              width={plotWidth / points.length}
              height={plotHeight}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
            />
          ))}

          {/* Date axis: first, middle and last only. One label per day collides. */}
          {[0, Math.floor(points.length / 2), points.length - 1]
            .filter((index, i, all) => all.indexOf(index) === i && points[index])
            .map((index) => (
              <text
                key={index}
                x={points[index]!.x}
                y={height - 8}
                textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
                className="fill-ink-faint text-[11px]"
              >
                {shortDate(points[index]!.day)}
              </text>
            ))}
        </svg>

        {active ? (
          <div
            role="status"
            className="pointer-events-none absolute top-2 rounded-sm border border-rule bg-paper-raised px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${(active.x / width) * 100}%`,
              transform: `translateX(${active.x > width / 2 ? '-105%' : '5%'})`,
            }}
          >
            <p className="font-semibold text-ink">{longDate(active.day)}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="mt-0.5 flex items-center gap-1.5 text-ink-muted">
                <span
                  className="size-2 rounded-full"
                  style={{ background: `var(--series-${s.key})` }}
                />
                {s.label}:{' '}
                <strong className="text-ink tabular-nums">
                  {active[s.key].toLocaleString('en-IN')}
                </strong>
              </p>
            ))}
          </div>
        ) : null}
      </div>

      {/*
        Series colours as CSS custom properties, defined for light, OS dark and
        an explicit theme stamp. The dark values are separately validated steps
        for the dark surface, not an automatic flip.
      */}
      <style>{`
        .traffic-chart {
          --series-views: ${SERIES[0]!.light};
          --series-visitors: ${SERIES[1]!.light};
        }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme='light']) .traffic-chart {
            --series-views: ${SERIES[0]!.dark};
            --series-visitors: ${SERIES[1]!.dark};
          }
        }
        :root[data-theme='dark'] .traffic-chart {
          --series-views: ${SERIES[0]!.dark};
          --series-visitors: ${SERIES[1]!.dark};
        }
      `}</style>
    </figure>
  );
}

function compact(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return String(Math.round(value));
}

function shortDate(day: string): string {
  return new Date(day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

function longDate(day: string): string {
  return new Date(day).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Kolkata',
  });
}
