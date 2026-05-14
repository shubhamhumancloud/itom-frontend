'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { StatusTimelinePoint } from '@/lib/api';

/**
 * Stacked-area chart of fleet status over the last N hours.
 *
 * Each x-bucket is one hour. Bands stack online → offline → unknown so
 * the total height = total registered agents at that moment. Pure
 * aggregate — no hostname appears, scales to any fleet size.
 */
export function StatusTimelineChart({
  data,
  height = 260,
}: {
  data: StatusTimelinePoint[];
  height?: number;
}) {
  const formatted = data.map((p) => ({
    ...p,
    label: new Date(p.hour).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={formatted}
          margin={{ top: 10, right: 8, left: -16, bottom: 0 }}
        >
          <defs>
            <linearGradient id="statusOnline" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="statusOffline" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="statusUnknown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9ca3af" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#9ca3af" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--popover-foreground)',
            }}
            labelFormatter={(_label, items) => {
              const p = items?.[0]?.payload as
                | { hour?: string }
                | undefined;
              return p?.hour
                ? new Date(p.hour).toLocaleString('en-US', {
                    weekday: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '';
            }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          <Area
            type="monotone"
            dataKey="online"
            name="Online"
            stackId="status"
            stroke="#22c55e"
            strokeWidth={2}
            fill="url(#statusOnline)"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="offline"
            name="Offline"
            stackId="status"
            stroke="#ef4444"
            strokeWidth={2}
            fill="url(#statusOffline)"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="unknown"
            name="Unknown"
            stackId="status"
            stroke="#9ca3af"
            strokeWidth={2}
            fill="url(#statusUnknown)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
