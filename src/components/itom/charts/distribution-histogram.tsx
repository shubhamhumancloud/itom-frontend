'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Fleet utilization histogram.
 *
 * Buckets the fleet into 10 evenly-spaced 0–100% slots and renders the
 * count of agents in each slot. Bars in the right half shift to amber
 * / rose so the eye instantly catches a right-skewed (stressed) fleet.
 *
 * Scales to any fleet size: the chart only ever renders 10 bars
 * regardless of how many agents the buckets summarize.
 */
export type DistributionHistogramProps = {
  /** 10 values: count of agents in [0-10), [10-20), ..., [90-100]. */
  buckets: number[];
  /** Optional units suffix on the x-axis labels (defaults to %). */
  unit?: string;
  /** Optional tighter height — defaults to 180. */
  height?: number;
};

const BAR_COLORS = [
  '#22c55e', // 0-10  green
  '#22c55e', // 10-20
  '#4ade80', // 20-30
  '#84cc16', // 30-40
  '#a3e635', // 40-50
  '#facc15', // 50-60
  '#f59e0b', // 60-70
  '#f97316', // 70-80
  '#ef4444', // 80-90
  '#dc2626', // 90-100
];

export function DistributionHistogram({
  buckets,
  unit = '%',
  height = 180,
}: DistributionHistogramProps) {
  const data = buckets.map((count, i) => ({
    bucket: `${i * 10}-${i * 10 + 10}`,
    count,
    color: BAR_COLORS[i],
  }));
  const total = buckets.reduce((s, v) => s + v, 0);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="bucket"
            stroke="var(--muted-foreground)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${String(v).split('-')[0]}${unit}`}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={28}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value, _name, props) => {
              const n = Number(value);
              const pct = total > 0 ? Math.round((n / total) * 100) : 0;
              const range = (props?.payload as { bucket?: string } | undefined)
                ?.bucket;
              return [`${n} agents (${pct}%)`, `${range}${unit}`];
            }}
            labelFormatter={() => ''}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {data.map((d) => (
              <Cell key={d.bucket} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
