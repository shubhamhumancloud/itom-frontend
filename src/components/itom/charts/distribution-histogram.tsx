'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Fleet utilization histogram.
 *
 * Buckets the fleet into 10 evenly-spaced 0–100% slots and renders the
 * count of agents in each slot. Visual language is borrowed from the
 * acai Hear "Cases Over Time" chart:
 *
 *   • All bars share one solid brand-peach fill — a flat series reads
 *     more cleanly than a multi-colour ramp at this density.
 *   • Dashed horizontal grid lines, no axis lines, no tick marks.
 *   • Both axes carry visible numeric labels — the x-axis renders 0%
 *     (at the y-axis origin) through 100% (rightmost tick), so the
 *     operator can immediately tell which bucket each bar represents.
 *
 * Scales to any fleet size: the chart only ever renders 10 bars
 * regardless of how many agents the buckets summarize.
 */
export type DistributionHistogramProps = {
  /** 10 values: count of agents in [0-10), [10-20), ..., [90-100]. */
  buckets: number[];
  /** Optional units suffix on the x-axis labels (defaults to %). */
  unit?: string;
  /** Optional tighter height — defaults to 220. */
  height?: number;
};

export function DistributionHistogram({
  buckets,
  unit = '%',
  height = 220,
}: DistributionHistogramProps) {
  // Each data point sits at its bucket midpoint on a numeric x-axis
  // (5, 15, 25, …, 95). That way the 11 boundary ticks (0, 10, …,
  // 100) fall *between* bars — the correct histogram convention —
  // and no bar gets clipped against the chart edges.
  const data = buckets.map((count, i) => ({
    midpoint: i * 10 + 5,
    bucket: `${i * 10}-${(i + 1) * 10}`,
    count,
  }));
  const total = buckets.reduce((s, v) => s + v, 0);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 12, right: 16, left: -8, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />

          {/*
            X-axis renders bucket lower bounds (0, 10, …, 90) plus an
            additional explicit "100" terminal tick so the visible
            domain reads "0% → 100%" — every histogram bar's range is
            unambiguous to the operator without a legend.
            `interval={0}` forces all 11 labels even on a narrow chart
            (we render three of these side-by-side on the dashboard).
          */}
          <XAxis
            dataKey="midpoint"
            type="number"
            domain={[0, 100]}
            ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
            interval={0}
            stroke="var(--muted-foreground)"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}${unit}`}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={36}
          />

          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.35 }}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              boxShadow: 'var(--shadow-elevated)',
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

          <Bar
            dataKey="count"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
            fill="var(--primary)"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
