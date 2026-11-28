'use client';

import { useMemo, useState } from 'react';

export interface ChartAssessment {
  id: string;
  assessment_date: string;
  subject_name: string;
  title: string;
  score: number;
  max_score: number;
  percentage: number;
}

const WIDTH = 640;
const HEIGHT = 280;
const PAD_LEFT = 44;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 36;
const INNER_W = WIDTH - PAD_LEFT - PAD_RIGHT;
const INNER_H = HEIGHT - PAD_TOP - PAD_BOTTOM;
const GRID_LINES = [0, 25, 50, 75, 100];
const PALETTE = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0891b2'];

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Score-over-time line chart drawn as plain SVG.
 * Points are in date order and evenly spaced; hover a point for details.
 */
export function ProgressChart({
  assessments,
}: {
  assessments: ChartAssessment[];
}) {
  const [selected, setSelected] = useState('all');

  const subjects = useMemo(
    () => Array.from(new Set(assessments.map((a) => a.subject_name))).sort(),
    [assessments]
  );
  // If the chosen subject is not in this child's data, fall back to "all"
  const subject = subjects.includes(selected) ? selected : 'all';

  const points = useMemo(() => {
    const rows = assessments.filter(
      (a) => subject === 'all' || a.subject_name === subject
    );
    return [...rows].sort((a, b) =>
      a.assessment_date.localeCompare(b.assessment_date)
    );
  }, [assessments, subject]);

  if (assessments.length === 0 || points.length === 0) return null;

  const n = points.length;
  const x = (i: number) =>
    n === 1 ? PAD_LEFT + INNER_W / 2 : PAD_LEFT + (i / (n - 1)) * INNER_W;
  const y = (pct: number) =>
    PAD_TOP + (1 - Math.min(Math.max(pct, 0), 100) / 100) * INNER_H;
  const colorFor = (name: string) =>
    PALETTE[subjects.indexOf(name) % PALETTE.length];

  const first = points[0].percentage;
  const last = points[n - 1].percentage;
  const average = points.reduce((sum, p) => sum + p.percentage, 0) / n;
  const diff = last - first;

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.percentage)}`)
    .join(' ');

  const tickIndexes =
    n <= 6
      ? points.map((_, i) => i)
      : Array.from(
          new Set([0, 1, 2, 3, 4].map((k) => Math.round((k * (n - 1)) / 4)))
        );

  let summary: string;
  if (n === 1) {
    summary = `Only one assessment so far (${last.toFixed(1)}%). A trend appears after the next one.`;
  } else if (Math.abs(diff) < 0.05) {
    summary = `Latest ${last.toFixed(1)}%, unchanged since the first assessment.`;
  } else {
    summary = `Latest ${last.toFixed(1)}%, ${diff > 0 ? 'up' : 'down'} ${Math.abs(diff).toFixed(1)} points since the first assessment.`;
  }

  const ariaLabel = `Line chart of ${n} assessment ${
    n === 1 ? 'score' : 'scores'
  } for ${subject === 'all' ? 'all subjects' : subject}, from ${first.toFixed(
    0
  )}% to ${last.toFixed(0)}%.`;

  return (
    <div className="rounded-lg border p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Score over time</h2>
          <p className="text-xs text-muted-foreground mt-1">{summary}</p>
        </div>
        {subjects.length > 1 && (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Subject
            <select
              value={subject}
              onChange={(e) => setSelected(e.target.value)}
              className="rounded border px-2 py-1 text-sm bg-background text-foreground"
            >
              <option value="all">All subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label={ariaLabel}
      >
        {GRID_LINES.map((g) => (
          <g key={g}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={y(g)}
              y2={y(g)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={PAD_LEFT - 8}
              y={y(g) + 4}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize={11}
            >
              {g}%
            </text>
          </g>
        ))}

        {n > 1 && (
          <>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={y(average)}
              y2={y(average)}
              className="stroke-muted-foreground"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={WIDTH - PAD_RIGHT}
              y={y(average) - 5}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize={11}
            >
              Average {average.toFixed(0)}%
            </text>
            <path
              d={path}
              fill="none"
              className="stroke-primary"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}

        {points.map((p, i) => (
          <circle
            key={p.id}
            cx={x(i)}
            cy={y(p.percentage)}
            r={5}
            fill={colorFor(p.subject_name)}
            className="stroke-background"
            strokeWidth={2}
          >
            <title>
              {`${p.subject_name}: ${p.title} · ${p.score} / ${p.max_score} (${p.percentage.toFixed(
                1
              )}%) · ${shortDate(p.assessment_date)}`}
            </title>
          </circle>
        ))}

        {tickIndexes.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={HEIGHT - 12}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={11}
          >
            {shortDate(points[i].assessment_date)}
          </text>
        ))}
      </svg>

      {subject === 'all' && subjects.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {subjects.map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: colorFor(s) }}
              />
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}