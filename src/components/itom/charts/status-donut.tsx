'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

type Slice = { name: string; value: number; color: string };

export function StatusDonut({
  online,
  offline,
  unknown,
}: {
  online: number;
  offline: number;
  unknown: number;
}) {
  const total = online + offline + unknown;

  if (total === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No agents yet
      </div>
    );
  }

  const slices: Slice[] = [
    { name: 'Online', value: online, color: 'var(--status-online)' },
    { name: 'Offline', value: offline, color: 'var(--status-offline)' },
    { name: 'Unknown', value: unknown, color: 'var(--status-unknown)' },
  ].filter((s) => s.value > 0);

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
              {slices.map((s) => (
                <Cell key={s.name} fill={s.color} />
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
          <div className="text-xs text-muted-foreground">agents</div>
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
