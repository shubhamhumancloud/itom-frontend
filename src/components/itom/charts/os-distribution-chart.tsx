'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { OsDistributionEntry } from '@/lib/api';

// Monochromatic blue ramp with wide lightness gaps — adjacent slices
// were too close (blue-900 vs blue-700) so Windows / macOS / Linux
// blended together on the donut. Jumping two-to-three Tailwind steps
// between entries gives a visibly distinct shade per slice while
// keeping the whole palette in the blue family.
const PALETTE = [
  '#0a2472', // navy (deepest)
  '#2563eb', // blue-600
  '#7dd3fc', // sky-300
  '#0ea5e9', // sky-500
  '#1e40af', // blue-800
  '#bae6fd', // sky-200 (lightest)
];

const OS_LABELS: Record<string, string> = {
  windows: 'Windows',
  darwin: 'macOS',
  linux: 'Linux',
  unknown: 'Unknown',
};

export function OsDistributionChart({ data }: { data: OsDistributionEntry[] }) {
  if (!data.length) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No agents yet
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);
  const slices = data.map((d, idx) => ({
    name: OS_LABELS[d.os] ?? d.os,
    value: d.count,
    color: PALETTE[idx % PALETTE.length],
  }));

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {slices.map((s, idx) => (
                <Cell key={idx} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--popover-foreground)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold leading-none tracking-tight">{total}</div>
          <div className="text-xs text-muted-foreground">total</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs">
        {slices.map((s) => (
          <div key={s.name} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-muted-foreground">{s.name}</span>
            <span className="font-semibold">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
