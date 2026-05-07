'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import type { CpuByAgentEntry } from '@/lib/api';
import { agentLabel } from '@/lib/format';

export function CpuByAgentChart({ data }: { data: CpuByAgentEntry[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No agent metrics yet
      </div>
    );
  }

  const colored = data.map((d) => ({
    ...d,
    label: agentLabel(d.os, d.agentId),
    fill:
      d.cpuPercent >= 85
        ? 'var(--status-offline)'
        : d.cpuPercent >= 60
        ? 'var(--kpi-warn)'
        : 'var(--chart-1)',
  }));

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={colored} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-15}
            textAnchor="end"
            height={50}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
            unit="%"
            width={42}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--popover-foreground)',
            }}
            formatter={(value: number) => [`${value}%`, 'CPU']}
          />
          <Bar dataKey="cpuPercent" radius={[6, 6, 0, 0]}>
            {colored.map((entry, idx) => (
              <Cell key={idx} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
