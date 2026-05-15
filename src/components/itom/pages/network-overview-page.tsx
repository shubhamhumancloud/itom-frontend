'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Network } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAgentNetwork, useAgents } from '@/hooks/use-itom';
import { formatBytes, formatRelativeTime } from '@/lib/format';
import { AgentPicker, ALL_AGENTS_VALUE } from '@/components/itom/agent-picker';
import { LoadingMoreRow, LoadingOverlay, useColdLoad } from '@/components/ui/loaders';
import { PageHeader } from '@/components/app/page-header';

/**
 * Sidebar Monitoring → Network page.
 *
 * Hosts the per-interface throughput view that used to live on the
 * agent-detail "Network" sub-tab. Pinned to one agent at a time
 * (throughput + packet rates per interface only make sense per host;
 * a fleet-wide aggregate would interleave different machines).
 */
export function NetworkOverviewPage({
  agentId: externalAgentId,
}: { agentId?: string } = {}) {
  // When the page is embedded inside the per-agent detail view, the
  // parent passes agentId via prop and we skip the internal picker.
  // Standalone (sidebar) mode keeps its own state + auto-pick logic.
  const isEmbedded = externalAgentId !== undefined;
  const [internalAgentId, setInternalAgentId] = useState<string>('');
  const { data: agents = [] } = useAgents();

  useEffect(() => {
    if (!isEmbedded && !internalAgentId && agents.length > 0) {
      setInternalAgentId(agents[0].agentId);
    }
  }, [isEmbedded, internalAgentId, agents]);

  const agentId = isEmbedded ? externalAgentId! : internalAgentId;
  const setAgentId = setInternalAgentId;

  const { data: network = [], isLoading } = useAgentNetwork(agentId, 1000);
  const showOverlay = useColdLoad(isLoading, network.length > 0);

  // Derive per-interface throughput from byte-counter deltas. We need
  // at least two consecutive samples per interface to compute a rate.
  const networkInsights = useMemo(() => {
    const byInterface = new Map<string, typeof network>();
    for (const sample of network) {
      const list = byInterface.get(sample.interfaceName) ?? [];
      list.push(sample);
      byInterface.set(sample.interfaceName, list);
    }

    type NetworkPoint = {
      id: string;
      interfaceName: string;
      timestamp: string;
      label: string;
      inBps: number;
      outBps: number;
      inPps: number;
      outPps: number;
    };

    const interfaces = Array.from(byInterface.entries())
      .map(([name, rows]) => {
        const sorted = [...rows].sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
        const points: NetworkPoint[] = [];
        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1];
          const curr = sorted[i];
          const dtSeconds =
            (new Date(curr.timestamp).getTime() -
              new Date(prev.timestamp).getTime()) /
            1000;
          if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) continue;

          const deltaIn = Number(curr.bytesRecv ?? 0) - Number(prev.bytesRecv ?? 0);
          const deltaOut = Number(curr.bytesSent ?? 0) - Number(prev.bytesSent ?? 0);
          const deltaInPackets =
            Number(curr.packetsRecv ?? 0) - Number(prev.packetsRecv ?? 0);
          const deltaOutPackets =
            Number(curr.packetsSent ?? 0) - Number(prev.packetsSent ?? 0);
          if (
            deltaIn < 0 ||
            deltaOut < 0 ||
            deltaInPackets < 0 ||
            deltaOutPackets < 0
          )
            continue;

          points.push({
            id: curr.id,
            interfaceName: name,
            timestamp: curr.timestamp,
            label: new Date(curr.timestamp).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            inBps: deltaIn / dtSeconds,
            outBps: deltaOut / dtSeconds,
            inPps: deltaInPackets / dtSeconds,
            outPps: deltaOutPackets / dtSeconds,
          });
        }

        if (!points.length) return null;

        const current = points[points.length - 1];
        const avgInBps =
          points.reduce((sum, p) => sum + p.inBps, 0) / points.length;
        const avgOutBps =
          points.reduce((sum, p) => sum + p.outBps, 0) / points.length;
        const peakInBps = points.reduce((max, p) => Math.max(max, p.inBps), 0);
        const peakOutBps = points.reduce(
          (max, p) => Math.max(max, p.outBps),
          0,
        );

        return {
          name,
          currentInBps: current.inBps,
          currentOutBps: current.outBps,
          avgInBps,
          avgOutBps,
          peakInBps,
          peakOutBps,
          points,
          lastTimestamp: current.timestamp,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort(
        (a, b) =>
          b.currentInBps + b.currentOutBps - (a.currentInBps + a.currentOutBps),
      );

    const snapshots = interfaces
      .flatMap((iface) => iface.points.map((p) => ({ ...p })))
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

    return { interfaces, snapshots };
  }, [network]);

  // Last-hour activity: per-minute buckets of byte/packet deltas, summed
  // across every interface. Drives the area chart + the four KPI tiles
  // (Activity Monitor-style: data received/sent, packets in/out, plus
  // current per-second rates).
  const hourly = useMemo(() => {
    const now = Date.now();
    const cutoff = now - 60 * 60 * 1000;

    // Group raw samples by interface.
    const byIface = new Map<string, typeof network>();
    for (const s of network) {
      const arr = byIface.get(s.interfaceName) ?? [];
      arr.push(s);
      byIface.set(s.interfaceName, arr);
    }

    type Bucket = {
      tsMinute: number;
      bytesIn: number;
      bytesOut: number;
      pktIn: number;
      pktOut: number;
      dt: number; // seconds of observation that contributed to this bucket
    };
    const buckets = new Map<number, Bucket>();

    for (const [, rows] of byIface) {
      const sorted = [...rows].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const tCurr = new Date(curr.timestamp).getTime();
        if (tCurr < cutoff) continue;
        const dt =
          (tCurr - new Date(prev.timestamp).getTime()) / 1000;
        if (!Number.isFinite(dt) || dt <= 0) continue;
        const dIn = Math.max(
          0,
          Number(curr.bytesRecv ?? 0) - Number(prev.bytesRecv ?? 0),
        );
        const dOut = Math.max(
          0,
          Number(curr.bytesSent ?? 0) - Number(prev.bytesSent ?? 0),
        );
        const dInP = Math.max(
          0,
          Number(curr.packetsRecv ?? 0) - Number(prev.packetsRecv ?? 0),
        );
        const dOutP = Math.max(
          0,
          Number(curr.packetsSent ?? 0) - Number(prev.packetsSent ?? 0),
        );

        const minute = Math.floor(tCurr / 60000) * 60000;
        const existing = buckets.get(minute);
        if (existing) {
          existing.bytesIn += dIn;
          existing.bytesOut += dOut;
          existing.pktIn += dInP;
          existing.pktOut += dOutP;
          existing.dt += dt;
        } else {
          buckets.set(minute, {
            tsMinute: minute,
            bytesIn: dIn,
            bytesOut: dOut,
            pktIn: dInP,
            pktOut: dOutP,
            dt,
          });
        }
      }
    }

    const points = Array.from(buckets.values())
      .sort((a, b) => a.tsMinute - b.tsMinute)
      .map((b) => ({
        ts: b.tsMinute,
        label: new Date(b.tsMinute).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        // bytes/sec, derived from total bytes in the bucket / dt observed.
        inBps: b.dt > 0 ? b.bytesIn / b.dt : 0,
        outBps: b.dt > 0 ? b.bytesOut / b.dt : 0,
        inPps: b.dt > 0 ? b.pktIn / b.dt : 0,
        outPps: b.dt > 0 ? b.pktOut / b.dt : 0,
      }));

    let totalBytesIn = 0;
    let totalBytesOut = 0;
    let totalPktIn = 0;
    let totalPktOut = 0;
    for (const b of buckets.values()) {
      totalBytesIn += b.bytesIn;
      totalBytesOut += b.bytesOut;
      totalPktIn += b.pktIn;
      totalPktOut += b.pktOut;
    }

    const last = points[points.length - 1];
    return {
      points,
      totals: {
        bytesIn: totalBytesIn,
        bytesOut: totalBytesOut,
        pktIn: totalPktIn,
        pktOut: totalPktOut,
      },
      current: {
        inBps: last?.inBps ?? 0,
        outBps: last?.outBps ?? 0,
        inPps: last?.inPps ?? 0,
        outPps: last?.outPps ?? 0,
      },
    };
  }, [network]);

  const NETWORK_PAGE_SIZE = 30;
  const [visibleNetworkRows, setVisibleNetworkRows] = useState(NETWORK_PAGE_SIZE);
  const networkTableContainerRef = useRef<HTMLDivElement | null>(null);

  const networkRows = networkInsights.snapshots;
  const visibleNetworkSnapshots = networkRows.slice(0, visibleNetworkRows);
  const hasMoreNetworkRows = visibleNetworkRows < networkRows.length;

  // Reset visible page count whenever the underlying dataset changes
  // (different agent picked, fresh poll). Otherwise we'd keep showing a
  // partial slice with no relation to the new data.
  useEffect(() => {
    setVisibleNetworkRows(NETWORK_PAGE_SIZE);
  }, [networkRows.length]);

  // Scroll-driven infinite loader. No "auto-fill while container has
  // empty space" companion effect — the previous version of this page
  // had one, and on tall screens it eagerly pre-loaded the entire
  // dataset in one go (defeating the point of pagination). Now the
  // only way to load more is to actually scroll to the bottom of the
  // bounded container.
  const handleNetworkTableScroll = () => {
    const container = networkTableContainerRef.current;
    if (!container || !hasMoreNetworkRows) return;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      120;
    if (!nearBottom) return;
    setVisibleNetworkRows((prev) =>
      Math.min(prev + NETWORK_PAGE_SIZE, networkRows.length),
    );
  };

  return (
    // Full-height page — header + a content card that fills the rest.
    // The card itself is flex-col; the scrollable table grows to claim
    // remaining vertical space instead of capping at a fixed 460px.
    <div className="flex h-full w-full flex-col gap-4">
      <LoadingOverlay isLoading={showOverlay} />
      {!isEmbedded && (
        <PageHeader
          title="Network"
          description="Per-interface throughput and packet rates for the selected agent."
          action={
            <AgentPicker
              value={agentId}
              onChange={(v) => {
                if (!v || v === ALL_AGENTS_VALUE) {
                  setAgentId(agents[0]?.agentId ?? '');
                  return;
                }
                setAgentId(v);
              }}
              placeholder="Select agent"
            />
          }
        />
      )}

      {/* Last-hour summary — sits above the per-interface card. Has its
          own natural height (chart + 4 KPI tiles), shrink-0 so the table
          below claims the rest of the page. */}
      <Card className="shrink-0 border-border/90 shadow-(--shadow-soft)">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-2 text-base font-semibold">
            <span className="flex items-center gap-2">
              <Network className="h-4 w-4 text-indigo-600" />
              Last 60 minutes
            </span>
            <span className="text-[11px] font-normal text-muted-foreground">
              per-minute buckets · summed across interfaces
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Big throughput chart */}
          <div className="h-56 w-full">
            {hourly.points.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-md border border-dashed bg-muted/20 text-sm text-muted-foreground">
                No usable samples in the last hour
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={hourly.points}
                  margin={{ top: 10, right: 16, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="netInGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D94871" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#D94871" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="netOutGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1A237E" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#1A237E" stopOpacity={0.05} />
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
                    width={64}
                    tickFormatter={(v: number) => `${formatBytes(v)}/s`}
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
                      return [
                        Number.isFinite(n) ? `${formatBytes(n)}/s` : '—',
                        name,
                      ];
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={28}
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="inBps"
                    name="Received"
                    stroke="#D94871"
                    strokeWidth={2}
                    fill="url(#netInGradient)"
                    isAnimationActive={false}
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="outBps"
                    name="Sent"
                    stroke="#1A237E"
                    strokeWidth={2}
                    fill="url(#netOutGradient)"
                    isAnimationActive={false}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* KPI tiles — totals + current rates */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiTile
              tone="in"
              label="Data received"
              total={formatBytes(hourly.totals.bytesIn)}
              rate={`${formatBytes(hourly.current.inBps)}/s`}
            />
            <KpiTile
              tone="out"
              label="Data sent"
              total={formatBytes(hourly.totals.bytesOut)}
              rate={`${formatBytes(hourly.current.outBps)}/s`}
            />
            <KpiTile
              tone="in"
              label="Packets in"
              total={hourly.totals.pktIn.toLocaleString()}
              rate={`${hourly.current.inPps.toFixed(0)} pkt/s`}
            />
            <KpiTile
              tone="out"
              label="Packets out"
              total={hourly.totals.pktOut.toLocaleString()}
              rate={`${hourly.current.outPps.toFixed(0)} pkt/s`}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/90 shadow-(--shadow-soft)">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Network className="h-4 w-4 text-indigo-600" />
            Per-interface throughput
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {networkInsights.interfaces.length === 0 ? (
            <p className="text-muted-foreground">
              No usable network rate samples yet. Waiting for at least two
              samples per interface.
            </p>
          ) : (
            <>
              <div className="grid shrink-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {networkInsights.interfaces.map((iface) => (
                  <div
                    key={iface.name}
                    className="rounded-md border border-border/60 bg-background px-3 py-2"
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="font-medium">{iface.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(iface.lastTimestamp)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      In {formatRate(iface.currentInBps)} · Out{' '}
                      {formatRate(iface.currentOutBps)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Avg In {formatRate(iface.avgInBps)} · Avg Out{' '}
                      {formatRate(iface.avgOutBps)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Peak In {formatRate(iface.peakInBps)} · Peak Out{' '}
                      {formatRate(iface.peakOutBps)}
                    </div>
                  </div>
                ))}
              </div>

              {/*
                Fixed-height scrollable container. The table inside lives
                in a 480px box; rows beyond what fits there are reached
                by scrolling inside this div, NOT by scrolling the
                whole page. Pagination loads NETWORK_PAGE_SIZE more rows
                once the user is within 120px of the bottom.
              */}
              <div
                ref={networkTableContainerRef}
                onScroll={handleNetworkTableScroll}
                className="h-[480px] overflow-y-auto rounded-md border border-border/60"
              >
                <div className="border-b border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  Inbound = traffic received by this interface. Outbound =
                  traffic sent by this interface. Throughput columns are bytes
                  per second, packet columns are packets per second.
                </div>
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[12%]">Interface</TableHead>
                      <TableHead className="w-[17%] !whitespace-normal leading-tight">
                        Inbound Throughput
                      </TableHead>
                      <TableHead className="w-[17%] !whitespace-normal leading-tight">
                        Outbound Throughput
                      </TableHead>
                      <TableHead className="w-[17%] !whitespace-normal leading-tight">
                        Inbound Packet Rate
                      </TableHead>
                      <TableHead className="w-[17%] !whitespace-normal leading-tight">
                        Outbound Packet Rate
                      </TableHead>
                      <TableHead className="w-[20%]">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleNetworkSnapshots.map((row) => (
                      <TableRow key={`nw-${row.id}`}>
                        <TableCell
                          className="truncate font-medium"
                          title={row.interfaceName}
                        >
                          {row.interfaceName}
                        </TableCell>
                        <TableCell className="truncate tabular-nums">
                          {formatRate(row.inBps)}
                        </TableCell>
                        <TableCell className="truncate tabular-nums">
                          {formatRate(row.outBps)}
                        </TableCell>
                        <TableCell className="truncate tabular-nums">
                          {formatPacketRate(row.inPps)}
                        </TableCell>
                        <TableCell className="truncate tabular-nums">
                          {formatPacketRate(row.outPps)}
                        </TableCell>
                        <TableCell
                          className="truncate"
                          title={formatLocalTimestamp(row.timestamp)}
                        >
                          {formatLocalTimestamp(row.timestamp)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {hasMoreNetworkRows ? (
                  <LoadingMoreRow
                    current={visibleNetworkSnapshots.length}
                    total={networkRows.length}
                  />
                ) : (
                  <div className="px-3 py-2 text-center text-xs text-muted-foreground">
                    Showing all {networkRows.length} rows
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiTile({
  tone,
  label,
  total,
  rate,
}: {
  tone: 'in' | 'out';
  label: string;
  total: string;
  rate: string;
}) {
  const Icon = tone === 'in' ? ArrowDownToLine : ArrowUpFromLine;
  const toneClasses =
    tone === 'in'
      ? 'border-green-300/40 bg-green-50/40 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-400'
      : 'border-orange-300/40 bg-orange-50/40 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-400';
  return (
    <div className="rounded-md border border-border/60 bg-background px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${toneClasses}`}
        >
          <Icon className="h-3 w-3" />
        </span>
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{total}</div>
      <div className="text-[11px] text-muted-foreground tabular-nums">
        Current {rate}
      </div>
    </div>
  );
}

function formatRate(bytesPerSec: number) {
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatPacketRate(packetsPerSec: number) {
  return `${packetsPerSec.toFixed(2)} pkt/s`;
}

function formatLocalTimestamp(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
