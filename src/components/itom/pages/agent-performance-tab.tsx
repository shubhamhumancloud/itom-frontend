'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useAgent,
  useAgentDisk,
  useAgentGpuHistory,
  useAgentMetrics,
  useAgentNetwork,
} from '@/hooks/use-itom';
import { formatBytes } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Task-Manager-style Performance view for one agent.
 *
 *   ┌────────────┬──────────────────────────────────────────┐
 *   │ CPU   ──   │                                          │
 *   │ Memory ──  │   Big chart of the selected resource     │
 *   │ Disk C: ── │   over the selected time window.         │
 *   │ Wi-Fi  ──  │                                          │
 *   │ GPU 0  ──  │   Stat grid below.                       │
 *   └────────────┴──────────────────────────────────────────┘
 *
 * Left rail = one row per resource with an inline sparkline of recent
 * values and the current value. Right pane focuses one resource at a
 * time. Time window applies to both the sparklines and the big chart.
 *
 * Data sources: same hooks the rest of the dashboard uses
 * (useAgentMetrics, useAgentDisk, useAgentNetwork, useAgentGpuHistory).
 */
export function AgentPerformanceTab({ agentId }: { agentId: string }) {
  const [window, setWindow] = useState<WindowKey>('15m');
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>(
    defaultCustomRange(),
  );
  const [selected, setSelected] = useState<string>('cpu');

  // Hooks — limits are sized so the chosen window fits comfortably
  // (then we filter client-side to the exact range).
  const limit = SAMPLE_LIMITS[window];
  const { data: agent } = useAgent(agentId);
  const { data: metrics = [] } = useAgentMetrics(agentId, limit);
  const { data: diskSamples = [] } = useAgentDisk(agentId, limit * 5);
  const { data: networkSamples = [] } = useAgentNetwork(agentId, limit * 5);
  const { data: gpuSamples = [] } = useAgentGpuHistory(agentId, limit);

  // Determine the [from, to) time window in ms.
  const range = useMemo(() => computeRange(window, customRange), [window, customRange]);

  // Build the resource list — what shows up in the left rail.
  const resources = useMemo<Resource[]>(() => {
    const out: Resource[] = [];

    out.push({
      key: 'cpu',
      label: 'CPU',
      sublabel: agent?.cpuModel ?? undefined,
      currentDisplay: pctOrDash(metrics[0]?.cpuPercent),
      points: framedPercentSeries(metrics, 'cpuPercent', range),
      colour: 'var(--chart-1)',
    });

    out.push({
      key: 'memory',
      label: 'Memory',
      sublabel: agent?.totalMemoryBytes
        ? `${formatBytes(agent.totalMemoryBytes)} total`
        : undefined,
      currentDisplay: pctOrDash(metrics[0]?.memoryPercent),
      points: framedPercentSeries(metrics, 'memoryPercent', range),
      colour: 'var(--chart-2)',
    });

    // Per-disk-mount entries from the disk samples stream.
    const byMount = new Map<string, typeof diskSamples>();
    for (const s of diskSamples) {
      const arr = byMount.get(s.mountpoint) ?? [];
      arr.push(s);
      byMount.set(s.mountpoint, arr);
    }
    for (const [mount, rows] of byMount) {
      const sorted = [...rows].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      const latest = sorted[0];
      const series = framedSeries(
        sorted,
        (r) => Number(r.usedPercent),
        (r) => r.timestamp,
        range,
      );
      out.push({
        key: `disk:${mount}`,
        label: `Disk (${mount})`,
        sublabel: latest
          ? `${formatBytes(latest.usedBytes)} / ${formatBytes(latest.totalBytes)}`
          : undefined,
        currentDisplay: pctOrDash(latest?.usedPercent),
        points: series,
        colour: 'var(--chart-5)',
      });
    }

    // Per-network-iface entries; bandwidth derived from byte counter deltas.
    const byIface = new Map<string, typeof networkSamples>();
    for (const s of networkSamples) {
      const arr = byIface.get(s.interfaceName) ?? [];
      arr.push(s);
      byIface.set(s.interfaceName, arr);
    }
    for (const [iface, rows] of byIface) {
      const points = networkThroughput(rows, range);
      const latestBps =
        points.length > 0 ? points[points.length - 1].value : 0;
      out.push({
        key: `net:${iface}`,
        label: iface,
        sublabel: 'Network interface',
        currentDisplay: latestBps > 0 ? formatBitrate(latestBps) : '—',
        points,
        colour: 'var(--chart-3)',
        unit: 'bps',
      });
    }

    // Per-GPU entries when GPU telemetry is present.
    const byGpu = new Map<number, typeof gpuSamples>();
    for (const s of gpuSamples) {
      const arr = byGpu.get(s.gpuIndex) ?? [];
      arr.push(s);
      byGpu.set(s.gpuIndex, arr);
    }
    for (const [idx, rows] of byGpu) {
      const sorted = [...rows].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      const latest = sorted[0];
      out.push({
        key: `gpu:${idx}`,
        label: `GPU ${idx}`,
        sublabel: latest?.name ?? undefined,
        currentDisplay: pctOrDash(latest?.utilizationPercent),
        points: framedSeries(
          rows,
          (r) => Number(r.utilizationPercent),
          (r) => r.timestamp,
          range,
        ),
        colour: 'var(--chart-4)',
      });
    }

    return out;
  }, [agent, metrics, diskSamples, networkSamples, gpuSamples, range]);

  // Keep selection valid even when resources change (e.g. a new mount appears).
  useEffect(() => {
    if (resources.length === 0) return;
    if (!resources.some((r) => r.key === selected)) {
      setSelected(resources[0].key);
    }
  }, [resources, selected]);

  const activeRes =
    resources.find((r) => r.key === selected) ?? resources[0] ?? null;

  return (
    // The card itself fills its parent — the page wrapper passes
    // `flex-1 min-h-0` so we get a real height to work with. Inner
    // `min-h-0` on the flex children lets the rail's overflow-auto and
    // the right-pane chart claim space without bloating the page.
    <Card className="flex h-full min-h-0 flex-1 flex-col border-border/90 shadow-(--shadow-soft)">
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Left rail */}
          <div className="flex w-full min-h-0 shrink-0 flex-col border-b lg:w-72 lg:border-b-0 lg:border-r">
            <div className="border-b px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Resources
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {resources.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No telemetry yet
                </p>
              ) : (
                resources.map((r) => (
                  <RailRow
                    key={r.key}
                    res={r}
                    active={r.key === activeRes?.key}
                    onClick={() => setSelected(r.key)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right pane */}
          <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-y-auto p-5">
            {activeRes ? (
              <DetailPane
                res={activeRes}
                agent={agent}
                window={window}
                onWindowChange={setWindow}
                customRange={customRange}
                onCustomRange={setCustomRange}
                disk={diskSamples}
                network={networkSamples}
                gpu={gpuSamples}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No resource selected
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ----- Subcomponents ----------------------------------------------------

function RailRow({
  res,
  active,
  onClick,
}: {
  res: Resource;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'mb-1 flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition',
        active
          ? 'border-primary/60 bg-primary/5'
          : 'border-transparent hover:border-border hover:bg-accent/40',
      )}
    >
      <div className="h-10 w-24 shrink-0">
        <Sparkline points={res.points} colour={res.colour} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{res.label}</div>
        {res.sublabel && (
          <div className="truncate text-[11px] text-muted-foreground">
            {res.sublabel}
          </div>
        )}
        <div className="text-[11px] font-medium text-foreground/80">
          {res.currentDisplay}
        </div>
      </div>
    </button>
  );
}

function Sparkline({ points, colour }: { points: SeriesPoint[]; colour: string }) {
  if (points.length < 2) {
    return <div className="h-full w-full rounded bg-muted/40" />;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <Area
          type="monotone"
          dataKey="value"
          stroke={colour}
          strokeWidth={1.5}
          fill={colour}
          fillOpacity={0.25}
          isAnimationActive={false}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function DetailPane({
  res,
  agent,
  window,
  onWindowChange,
  customRange,
  onCustomRange,
  disk,
  network,
  gpu,
}: {
  res: Resource;
  agent: ReturnType<typeof useAgent>['data'];
  window: WindowKey;
  onWindowChange: (w: WindowKey) => void;
  customRange: { from: string; to: string };
  onCustomRange: (r: { from: string; to: string }) => void;
  disk: ReturnType<typeof useAgentDisk>['data'] extends infer T
    ? T extends undefined
      ? never[]
      : T
    : never[];
  network: ReturnType<typeof useAgentNetwork>['data'] extends infer T
    ? T extends undefined
      ? never[]
      : T
    : never[];
  gpu: ReturnType<typeof useAgentGpuHistory>['data'] extends infer T
    ? T extends undefined
      ? never[]
      : T
    : never[];
}) {
  // Header: resource title + model/sublabel right-aligned + window selector.
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight">{res.label}</h2>
          {res.sublabel && (
            <p className="text-xs text-muted-foreground">{res.sublabel}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {res.key === 'cpu' && agent?.cpuModel && (
            <span className="text-xs font-medium text-muted-foreground">
              {agent.cpuModel}
            </span>
          )}
          <WindowSelector
            window={window}
            onChange={onWindowChange}
            customRange={customRange}
            onCustomChange={onCustomRange}
          />
        </div>
      </div>

      <ChartArea res={res} />

      <StatsGrid res={res} agent={agent} disk={disk} network={network} gpu={gpu} />
    </div>
  );
}

function ChartArea({ res }: { res: Resource }) {
  if (res.points.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-dashed bg-muted/20 text-sm text-muted-foreground">
        No data in the selected window
      </div>
    );
  }
  const isPercent = res.unit !== 'bps';
  // Per-resource gradient id so multiple charts on the page don't share
  // a <defs> entry. The gradient mirrors the shadcn "interactive area"
  // pattern: solid colour at the top (80% opacity) fading to nearly
  // transparent (10%) at the bottom of the area.
  const gradientId = `chartArea-fill-${res.key}`;
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={res.points} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={res.colour} stopOpacity={0.8} />
              <stop offset="95%" stopColor={res.colour} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
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
            {...(isPercent
              ? { domain: [0, 100], unit: '%' }
              : { tickFormatter: (v: number) => formatBitrate(v) })}
            width={isPercent ? 38 : 64}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => {
              const n = typeof value === 'number' ? value : Number(value);
              if (!Number.isFinite(n)) return ['—', res.label] as [string, string];
              return [isPercent ? `${n.toFixed(2)}%` : formatBitrate(n), res.label] as [
                string,
                string,
              ];
            }}
            labelFormatter={(l) => String(l)}
          />
          <Area
            type="natural"
            dataKey="value"
            stroke={res.colour}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function WindowSelector({
  window,
  onChange,
  customRange,
  onCustomChange,
}: {
  window: WindowKey;
  onChange: (w: WindowKey) => void;
  customRange: { from: string; to: string };
  onCustomChange: (r: { from: string; to: string }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {(['15m', '1h', '24h', '1w', 'custom'] as WindowKey[]).map((w) => (
        <Button
          key={w}
          size="sm"
          variant={window === w ? 'default' : 'outline'}
          className="h-7 px-2 text-xs"
          onClick={() => onChange(w)}
        >
          {WINDOW_LABELS[w]}
        </Button>
      ))}
      {window === 'custom' && (
        <div className="ml-1 flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            From
          </Label>
          <Input
            type="datetime-local"
            value={customRange.from}
            onChange={(e) => onCustomChange({ ...customRange, from: e.target.value })}
            className="h-7 w-[170px] text-xs"
          />
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            to
          </Label>
          <Input
            type="datetime-local"
            value={customRange.to}
            onChange={(e) => onCustomChange({ ...customRange, to: e.target.value })}
            className="h-7 w-[170px] text-xs"
          />
        </div>
      )}
    </div>
  );
}

function StatsGrid({
  res,
  agent,
  disk,
  network,
  gpu,
}: {
  res: Resource;
  agent: ReturnType<typeof useAgent>['data'];
  disk: any[];
  network: any[];
  gpu: any[];
}) {
  const items = useMemo(() => {
    if (res.key === 'cpu') {
      return [
        { k: 'Utilisation', v: res.currentDisplay },
        { k: 'Cores', v: agent?.cpuCores != null ? String(agent.cpuCores) : '—' },
        { k: 'Model', v: agent?.cpuModel ?? '—' },
        { k: 'Arch', v: agent?.arch ?? '—' },
        { k: 'OS', v: agent ? `${agent.os} ${agent.platformVersion ?? ''}`.trim() : '—' },
        { k: 'Kernel', v: agent?.kernelVersion ?? '—' },
      ];
    }
    if (res.key === 'memory') {
      const total = agent?.totalMemoryBytes ?? 0;
      const usedPct = res.points.at(-1)?.value ?? 0;
      const usedBytes = total > 0 ? (total * usedPct) / 100 : 0;
      return [
        { k: 'In use', v: total > 0 ? formatBytes(usedBytes) : '—' },
        { k: 'Total', v: total > 0 ? formatBytes(total) : '—' },
        { k: 'Utilisation', v: `${usedPct.toFixed(2)}%` },
      ];
    }
    if (res.key.startsWith('disk:')) {
      const mount = res.key.slice(5);
      const sorted = [...disk]
        .filter((d) => d.mountpoint === mount)
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
      const latest = sorted[0];
      return [
        { k: 'Mountpoint', v: mount },
        { k: 'Used', v: latest ? formatBytes(latest.usedBytes) : '—' },
        { k: 'Total', v: latest ? formatBytes(latest.totalBytes) : '—' },
        {
          k: 'Free',
          v: latest
            ? formatBytes(Number(latest.totalBytes) - Number(latest.usedBytes))
            : '—',
        },
        { k: 'Utilisation', v: pctOrDash(latest?.usedPercent) },
      ];
    }
    if (res.key.startsWith('net:')) {
      const iface = res.key.slice(4);
      const rows = network
        .filter((n) => n.interfaceName === iface)
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
      const last = rows.at(-1);
      const prev = rows.length >= 2 ? rows[rows.length - 2] : null;
      let inBps = 0;
      let outBps = 0;
      if (last && prev) {
        const dt =
          (new Date(last.timestamp).getTime() - new Date(prev.timestamp).getTime()) /
          1000;
        if (dt > 0) {
          inBps = Math.max(0, Number(last.bytesRecv) - Number(prev.bytesRecv)) * 8 / dt;
          outBps = Math.max(0, Number(last.bytesSent) - Number(prev.bytesSent)) * 8 / dt;
        }
      }
      return [
        { k: 'Interface', v: iface },
        { k: 'Send', v: formatBitrate(outBps) },
        { k: 'Receive', v: formatBitrate(inBps) },
        { k: 'Bytes sent', v: last ? formatBytes(Number(last.bytesSent)) : '—' },
        { k: 'Bytes received', v: last ? formatBytes(Number(last.bytesRecv)) : '—' },
        { k: 'Packets sent', v: last ? String(last.packetsSent) : '—' },
        { k: 'Packets received', v: last ? String(last.packetsRecv) : '—' },
      ];
    }
    if (res.key.startsWith('gpu:')) {
      const idx = Number(res.key.slice(4));
      const rows = gpu
        .filter((g) => g.gpuIndex === idx)
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
      const latest = rows[0];
      if (!latest) return [];
      return [
        { k: 'Name', v: latest.name ?? '—' },
        { k: 'Utilisation', v: pctOrDash(latest.utilizationPercent) },
        {
          k: 'Memory',
          v: `${formatBytes(latest.memoryUsedBytes)} / ${formatBytes(latest.memoryTotalBytes)}`,
        },
        {
          k: 'Temperature',
          v:
            latest.temperatureC != null
              ? `${Number(latest.temperatureC).toFixed(1)} °C`
              : '—',
        },
        {
          k: 'Power',
          v:
            latest.powerWatts != null
              ? `${Number(latest.powerWatts).toFixed(1)} W`
              : '—',
        },
      ];
    }
    return [];
  }, [res, agent, disk, network, gpu]);

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border bg-muted/20 p-4 text-sm md:grid-cols-3">
      {items.map((it) => (
        <div key={it.k}>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {it.k}
          </div>
          <div className="mt-0.5 break-words font-medium">{it.v}</div>
        </div>
      ))}
    </div>
  );
}

// ----- Types + helpers --------------------------------------------------

type WindowKey = '15m' | '1h' | '24h' | '1w' | 'custom';

const WINDOW_LABELS: Record<WindowKey, string> = {
  '15m': '15m',
  '1h': '1h',
  '24h': '24h',
  '1w': '1w',
  custom: 'Custom',
};

const SAMPLE_LIMITS: Record<WindowKey, number> = {
  '15m': 250,
  '1h': 800,
  '24h': 2000,
  '1w': 5000,
  custom: 5000,
};

type SeriesPoint = { ts: number; value: number; label: string };

type Resource = {
  key: string;
  label: string;
  sublabel?: string;
  currentDisplay: string;
  points: SeriesPoint[];
  colour: string;
  unit?: 'pct' | 'bps';
};

function pctOrDash(v: unknown): string {
  if (v == null || v === '') return '—';
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
}

function defaultCustomRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getTime() - 60 * 60 * 1000);
  return { from: toLocalInput(from), to: toLocalInput(now) };
}

function toLocalInput(d: Date): string {
  // datetime-local wants `YYYY-MM-DDTHH:mm` in local time.
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function computeRange(
  window: WindowKey,
  custom: { from: string; to: string },
): { fromMs: number; toMs: number } {
  if (window === 'custom') {
    const fromMs = custom.from ? new Date(custom.from).getTime() : 0;
    const toMs = custom.to ? new Date(custom.to).getTime() : Date.now();
    if (Number.isFinite(fromMs) && Number.isFinite(toMs) && fromMs < toMs) {
      return { fromMs, toMs };
    }
    return { fromMs: Date.now() - 60 * 60 * 1000, toMs: Date.now() };
  }
  const windowMs: Record<Exclude<WindowKey, 'custom'>, number> = {
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000,
  };
  const toMs = Date.now();
  return { fromMs: toMs - windowMs[window], toMs };
}

function framedPercentSeries<T extends { timestamp: string }>(
  rows: T[],
  field: keyof T,
  range: { fromMs: number; toMs: number },
): SeriesPoint[] {
  return framedSeries(
    rows,
    (r) => Number((r as any)[field]),
    (r) => r.timestamp,
    range,
  );
}

function framedSeries<T>(
  rows: T[],
  getVal: (r: T) => number,
  getTs: (r: T) => string,
  range: { fromMs: number; toMs: number },
): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (const r of rows) {
    const ts = new Date(getTs(r)).getTime();
    if (!Number.isFinite(ts)) continue;
    if (ts < range.fromMs || ts > range.toMs) continue;
    const v = getVal(r);
    if (!Number.isFinite(v)) continue;
    out.push({ ts, value: v, label: shortTimeLabel(ts, range) });
  }
  out.sort((a, b) => a.ts - b.ts);
  // Downsample if huge — keep ~500 points for chart responsiveness.
  if (out.length > 600) {
    const step = Math.ceil(out.length / 500);
    return out.filter((_, i) => i % step === 0);
  }
  return out;
}

function networkThroughput(
  rows: Array<{ timestamp: string; bytesRecv: number; bytesSent: number }>,
  range: { fromMs: number; toMs: number },
): SeriesPoint[] {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const out: SeriesPoint[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const tPrev = new Date(prev.timestamp).getTime();
    const tCurr = new Date(curr.timestamp).getTime();
    const dt = (tCurr - tPrev) / 1000;
    if (!Number.isFinite(dt) || dt <= 0) continue;
    if (tCurr < range.fromMs || tCurr > range.toMs) continue;
    const deltaIn = Math.max(0, Number(curr.bytesRecv) - Number(prev.bytesRecv));
    const deltaOut = Math.max(0, Number(curr.bytesSent) - Number(prev.bytesSent));
    const bps = ((deltaIn + deltaOut) * 8) / dt; // both directions, bits/s
    out.push({ ts: tCurr, value: bps, label: shortTimeLabel(tCurr, range) });
  }
  if (out.length > 600) {
    const step = Math.ceil(out.length / 500);
    return out.filter((_, i) => i % step === 0);
  }
  return out;
}

function shortTimeLabel(ts: number, range: { fromMs: number; toMs: number }): string {
  const widthMs = range.toMs - range.fromMs;
  const d = new Date(ts);
  // Long windows: include the date, drop the seconds.
  if (widthMs > 24 * 60 * 60 * 1000) {
    return d.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBitrate(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return '0 bps';
  const units = ['bps', 'Kbps', 'Mbps', 'Gbps'];
  let v = bps;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

// Avoid "unused import" warnings while keeping the LineChart import
// available for sparkline-as-line fallback in the future.
void LineChart;
void Line;
