'use client';

import { useEffect, useMemo, useState } from 'react';
import { Cpu } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAgentMetrics, useAgents, useFleetMetrics } from '@/hooks/use-itom';
import { AgentPicker, ALL_AGENTS_VALUE } from '@/components/itom/agent-picker';

export function FleetMetricsPage() {
  const [agentId, setAgentId] = useState<string>('');
  const { data: agents = [] } = useAgents();

  // On first agent load, auto-select the first agent so the chart renders a
  // coherent single-host timeline instead of an interleaved fleet-wide view.
  useEffect(() => {
    if (!agentId && agents.length > 0) {
      setAgentId(agents[0].agentId);
    }
  }, [agentId, agents]);

  const isAll = agentId === ALL_AGENTS_VALUE;
  const fleet = useFleetMetrics(400);
  const single = useAgentMetrics(isAll || !agentId ? '' : agentId, 400);

  const data = isAll ? fleet.data ?? [] : single.data ?? [];
  const isLoading = isAll ? fleet.isLoading : single.isLoading;

  const chartData = useMemo(
    () =>
      [...data]
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        )
        .map((d) => ({
          ...d,
          label: new Date(d.timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        })),
    [data],
  );

  return (
    <div className="w-full space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Metrics</h1>
          <p className="text-xs text-muted-foreground">
            {isAll
              ? 'CPU and memory across every agent in your tenant'
              : 'CPU, memory and disk for the selected agent'}
          </p>
        </div>
        <AgentPicker value={agentId} onChange={setAgentId} />
      </div>

      <Card className="border-border/90 shadow-(--shadow-soft)">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Cpu className="h-4 w-4 text-orange-600" />
            {isAll ? 'Fleet utilization' : 'Agent utilization'}
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[480px] p-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading metrics…</p>
          ) : chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
              No metrics have been reported yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="diskGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  unit="%"
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--popover)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value, name) => {
                    const n = typeof value === 'number' ? value : Number(value);
                    const formatted = Number.isFinite(n) ? `${n.toFixed(2)}%` : `${value ?? '-'}%`;
                    return [formatted, name];
                  }}
                />
                <Area dataKey="cpuPercent" type="monotone" stroke="var(--chart-1)" fill="url(#cpuGradient)" strokeWidth={2} name="CPU" />
                <Area dataKey="memoryPercent" type="monotone" stroke="var(--chart-2)" fill="url(#memGradient)" strokeWidth={2} name="Memory" />
                {!isAll && (
                  <Area dataKey="diskPercent" type="monotone" stroke="var(--chart-5)" fill="url(#diskGradient)" strokeWidth={2} name="Disk" />
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
