'use client';

import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BatteryCharging,
  BatteryFull,
  Cpu,
  Fan,
  Plug,
  Thermometer,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useAgentBattery,
  useAgentGpu,
  useAgentGpuHistory,
  useAgentSensors,
} from '@/hooks/use-itom';
import {
  formatBytes,
  formatDuration,
  formatNumber,
  toNumber,
} from '@/lib/format';

export function AgentHardwareTab({ agentId }: { agentId: string }) {
  return (
    <div className="space-y-4">
      <BatterySection agentId={agentId} />
      <SensorsSection agentId={agentId} />
      <GpuSection agentId={agentId} />
    </div>
  );
}

// ---------------- Battery ----------------

function BatterySection({ agentId }: { agentId: string }) {
  const { data: history = [] } = useAgentBattery(agentId, 60);
  const latest = history[0];

  if (!latest) {
    return (
      <Card className="border-border/90 shadow-(--shadow-soft)">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <BatteryFull className="h-4 w-4 text-muted-foreground" /> Battery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <NotDetected text="No battery detected (desktop, server, or VM)." />
        </CardContent>
      </Card>
    );
  }

  const percent = toNumber(latest.percent);
  const health = latest.healthPercent != null ? toNumber(latest.healthPercent) : null;
  const trend = [...history]
    .reverse()
    .map((b) => ({ t: b.timestamp, percent: toNumber(b.percent) }));

  return (
    <Card className="border-border/90 shadow-(--shadow-soft)">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          {latest.charging ? (
            <BatteryCharging className="h-4 w-4 text-emerald-600" />
          ) : (
            <BatteryFull className="h-4 w-4 text-muted-foreground" />
          )}
          Battery
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Stat
            label="Charge"
            value={`${percent.toFixed(0)}%`}
            sub={
              latest.charging
                ? 'Charging'
                : latest.onAC
                ? 'On AC (full)'
                : 'On battery'
            }
            color={
              percent < 20 && !latest.charging
                ? 'text-red-600'
                : percent < 40 && !latest.charging
                ? 'text-amber-600'
                : 'text-foreground'
            }
          />
          <Stat
            label="Battery health"
            value={health != null ? `${health.toFixed(0)}%` : '—'}
            sub={
              latest.designCapacityMwh && latest.fullCapacityMwh
                ? `${formatNumber(latest.fullCapacityMwh / 1000)} / ${formatNumber(
                    latest.designCapacityMwh / 1000,
                  )} Wh`
                : 'Vs design capacity'
            }
            color={
              health != null && health < 70
                ? 'text-amber-600'
                : 'text-foreground'
            }
          />
          <Stat
            label="Cycles"
            value={latest.cycleCount != null ? String(latest.cycleCount) : '—'}
            sub={
              latest.timeToFullSeconds
                ? `${formatDuration(latest.timeToFullSeconds)} to full`
                : latest.timeToEmptySeconds
                ? `${formatDuration(latest.timeToEmptySeconds)} remaining`
                : 'Lifetime cycle count'
            }
          />
        </div>

        {trend.length >= 2 && (
          <div className="mt-4 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis hide dataKey="t" />
                <YAxis domain={[0, 100]} unit="%" fontSize={10} width={40} />
                <Tooltip
                  contentStyle={tipStyle}
                  formatter={(v: any) =>
                    typeof v === 'number' ? `${v.toFixed(0)}%` : String(v)
                  }
                  labelFormatter={(l) => new Date(l).toLocaleString()}
                />
                <Line
                  type="monotone"
                  dataKey="percent"
                  stroke="var(--chart-1)"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------- Sensors (CPU temp + fan) ----------------

function SensorsSection({ agentId }: { agentId: string }) {
  const { data: rows = [] } = useAgentSensors(agentId, undefined, 240);

  // Group by sensor name; latest value first (rows are DESC by timestamp).
  const grouped = useMemo(() => {
    const byName = new Map<string, typeof rows>();
    for (const r of rows) {
      const arr = byName.get(r.name) ?? [];
      arr.push(r);
      byName.set(r.name, arr);
    }
    return Array.from(byName.entries()).map(([name, list]) => ({
      name,
      kind: list[0].kind,
      latest: toNumber(list[0].value),
      series: [...list]
        .reverse()
        .map((s) => ({ t: s.timestamp, v: toNumber(s.value) })),
    }));
  }, [rows]);

  if (grouped.length === 0) {
    return (
      <Card className="border-border/90 shadow-(--shadow-soft)">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Thermometer className="h-4 w-4 text-muted-foreground" />
            Temperatures &amp; fans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <NotDetected text="No sensor data exposed by this OS or hardware." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/90 shadow-(--shadow-soft)">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Thermometer className="h-4 w-4 text-orange-600" />
          Temperatures &amp; fans
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {grouped.map((s) => (
            <div
              key={s.name}
              className="rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {s.kind === 'fan_rpm' ? (
                    <Fan className="h-3.5 w-3.5" />
                  ) : (
                    <Cpu className="h-3.5 w-3.5" />
                  )}
                  <span className="truncate">{s.name}</span>
                </div>
                <span
                  className={`text-base font-semibold tabular-nums ${
                    s.kind === 'temperature_c' && s.latest >= 85
                      ? 'text-red-600'
                      : s.kind === 'temperature_c' && s.latest >= 70
                      ? 'text-amber-600'
                      : 'text-foreground'
                  }`}
                >
                  {s.latest.toFixed(1)}
                  {s.kind === 'temperature_c' ? '°C' : ' RPM'}
                </span>
              </div>
              {s.series.length >= 2 && (
                <div className="mt-2 h-12">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={s.series}>
                      <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke={
                          s.kind === 'temperature_c'
                            ? 'var(--chart-1)'
                            : 'var(--chart-2)'
                        }
                        dot={false}
                        strokeWidth={1.5}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------- GPU ----------------

function GpuSection({ agentId }: { agentId: string }) {
  const { data: latest = [] } = useAgentGpu(agentId);
  const { data: history = [] } = useAgentGpuHistory(agentId, 120);

  if (latest.length === 0) {
    return (
      <Card className="border-border/90 shadow-(--shadow-soft)">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Zap className="h-4 w-4 text-muted-foreground" />
            GPU
          </CardTitle>
        </CardHeader>
        <CardContent>
          <NotDetected text="No NVIDIA GPU detected (only NVIDIA cards are reported in v1)." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/90 shadow-(--shadow-soft)">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Zap className="h-4 w-4 text-violet-600" />
          GPU
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {latest.map((g) => {
            const series = history
              .filter((h) => h.gpuIndex === g.gpuIndex)
              .reverse()
              .map((h) => ({
                t: h.timestamp,
                util: toNumber(h.utilizationPercent),
                temp: h.temperatureC != null ? toNumber(h.temperatureC) : null,
              }));
            const memUsedPct = g.memoryTotalBytes
              ? (g.memoryUsedBytes / g.memoryTotalBytes) * 100
              : 0;
            return (
              <div
                key={g.gpuIndex}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{g.name}</span>
                  <span className="text-xs text-muted-foreground">
                    GPU {g.gpuIndex}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <Stat
                    label="Utilization"
                    value={`${formatNumber(g.utilizationPercent)}%`}
                    sub=""
                  />
                  <Stat
                    label="Memory"
                    value={`${memUsedPct.toFixed(0)}%`}
                    sub={`${formatBytes(g.memoryUsedBytes)} / ${formatBytes(
                      g.memoryTotalBytes,
                    )}`}
                  />
                  {g.temperatureC != null ? (
                    <Stat
                      label="Temp · Power"
                      value={`${formatNumber(g.temperatureC)}°C`}
                      sub={
                        g.powerWatts != null
                          ? `${formatNumber(g.powerWatts)} W`
                          : ''
                      }
                    />
                  ) : (
                    <Stat
                      label="Power"
                      value={
                        g.powerWatts != null
                          ? `${formatNumber(g.powerWatts)} W`
                          : '—'
                      }
                      sub=""
                    />
                  )}
                </div>
                {series.length >= 2 && (
                  <div className="mt-3 h-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={series}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                        />
                        <XAxis hide dataKey="t" />
                        <YAxis
                          domain={[0, 100]}
                          unit="%"
                          fontSize={10}
                          width={36}
                        />
                        <Tooltip
                          contentStyle={tipStyle}
                          labelFormatter={(l) =>
                            new Date(l).toLocaleString()
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="util"
                          stroke="var(--chart-1)"
                          dot={false}
                          strokeWidth={2}
                          name="Util %"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------- Tiny shared bits ----------------

function Stat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`text-xl font-semibold tabular-nums ${color ?? 'text-foreground'}`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function NotDetected({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
      <Plug className="h-4 w-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

const tipStyle = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--popover-foreground)',
} as const;
