'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { IssueBreakdown } from '@/hooks/use-itom';

/**
 * Horizontal bar chart showing agent counts per issue category.
 *
 * Categories are NOT mutually exclusive — a single agent can land in
 * `cpuHigh` AND `memoryHigh` at the same time. The chart intentionally
 * doesn't normalize: the absolute count per category is what an admin
 * acts on ("there are 14 hosts past 85% CPU; that's tonight's work").
 */
export function IssueBreakdownChart({
  data,
  height = 240,
}: {
  data: IssueBreakdown;
  height?: number;
}) {
  const rows = [
    { key: 'offline', label: 'Offline', count: data.offline, color: '#dc2626' },
    { key: 'cpu', label: 'CPU > 85%', count: data.cpuHigh, color: '#f97316' },
    {
      key: 'memory',
      label: 'Memory > 85%',
      count: data.memoryHigh,
      color: '#f59e0b',
    },
    { key: 'disk', label: 'Disk > 85%', count: data.diskHigh, color: '#facc15' },
    {
      key: 'unknown',
      label: 'Unknown / never reported',
      count: data.unknown,
      color: '#9ca3af',
    },
  ];

  const hasAny = rows.some((r) => r.count > 0);
  if (!hasAny) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-sm text-muted-foreground"
      >
        Fleet is all-clear — no agents match any issue category.
      </div>
    );
  }

  // YAxis width has to fit the longest label ("Unknown / never reported").
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 3"
            horizontal={false}
          />
          <XAxis
            type="number"
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={170}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => {
              const n = Number(value);
              return [`${n} ${n === 1 ? 'agent' : 'agents'}`, 'Affected'];
            }}
          />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={20}>
            {rows.map((r) => (
              <Cell key={r.key} fill={r.color} />
            ))}
            <LabelList
              dataKey="count"
              position="right"
              fill="var(--foreground)"
              fontSize={11}
              fontWeight={600}
              formatter={(v) => {
                const n = typeof v === 'number' ? v : Number(v);
                return Number.isFinite(n) && n > 0 ? String(n) : '';
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
