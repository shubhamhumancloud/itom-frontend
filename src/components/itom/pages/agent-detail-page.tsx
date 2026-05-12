'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/itom/status-badge';
import {
  useAgent,
  useAgentDisk,
  useAgentMetrics,
  useAgentNetwork,
  useAgentStatusEvents,
} from '@/hooks/use-itom';
import { agentLabel, formatBytes, formatPercent, formatRelativeTime } from '@/lib/format';
import { AgentProcessesTab } from './agent-processes-tab';
import { AgentHardwareTab } from './agent-hardware-tab';
import { AgentSoftwareTab } from './agent-software-tab';
import { cn } from '@/lib/utils';

export function AgentDetailPage({ agentId }: { agentId: string }) {
  const { data: agent } = useAgent(agentId);
  const { data: metrics = [] } = useAgentMetrics(agentId, 200);
  const { data: network = [] } = useAgentNetwork(agentId, 1000);
  const { data: disk = [] } = useAgentDisk(agentId, 1000);
  const { data: statusEvents = [] } = useAgentStatusEvents(agentId, 100);

  const chartData = [...metrics]
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )
    .map((m) => ({
      ...m,
      label: new Date(m.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }));

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
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
        const points: NetworkPoint[] = [];
        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1];
          const curr = sorted[i];
          const dtSeconds =
            (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000;
          if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) continue;

          const deltaIn = Number(curr.bytesRecv ?? 0) - Number(prev.bytesRecv ?? 0);
          const deltaOut = Number(curr.bytesSent ?? 0) - Number(prev.bytesSent ?? 0);
          const deltaInPackets =
            Number(curr.packetsRecv ?? 0) - Number(prev.packetsRecv ?? 0);
          const deltaOutPackets =
            Number(curr.packetsSent ?? 0) - Number(prev.packetsSent ?? 0);
          if (deltaIn < 0 || deltaOut < 0 || deltaInPackets < 0 || deltaOutPackets < 0) continue;

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
        const avgInBps = points.reduce((sum, p) => sum + p.inBps, 0) / points.length;
        const avgOutBps = points.reduce((sum, p) => sum + p.outBps, 0) / points.length;
        const peakInBps = points.reduce((max, p) => Math.max(max, p.inBps), 0);
        const peakOutBps = points.reduce((max, p) => Math.max(max, p.outBps), 0);

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
      .sort((a, b) => b.currentInBps + b.currentOutBps - (a.currentInBps + a.currentOutBps));

    const snapshots = interfaces
      .flatMap((iface) => iface.points.map((p) => ({ ...p })))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return { interfaces, snapshots };
  }, [network]);
  const [selectedDiskMount, setSelectedDiskMount] = useState('');
  const [diskViewMode, setDiskViewMode] = useState<'latest' | 'raw'>('latest');
  const diskInsights = useMemo(() => {
    const byMount = new Map<string, typeof disk>();
    for (const row of disk) {
      const list = byMount.get(row.mountpoint) ?? [];
      list.push(row);
      byMount.set(row.mountpoint, list);
    }

    const latestRows = Array.from(byMount.entries())
      .map(([mountpoint, rows]) => {
        const sorted = [...rows].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
        const latest = sorted[sorted.length - 1];
        return {
          mountpoint,
          latest,
          history: sorted.map((d) => ({
            timestamp: d.timestamp,
            label: new Date(d.timestamp).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            usedPercent: Number(d.usedPercent ?? 0),
            usedBytes: Number(d.usedBytes ?? 0),
            totalBytes: Number(d.totalBytes ?? 0),
          })),
        };
      })
      .sort(
        (a, b) =>
          Number(b.latest?.usedPercent ?? 0) - Number(a.latest?.usedPercent ?? 0),
      );

    const totalUsedBytes = latestRows.reduce(
      (sum, row) => sum + Number(row.latest?.usedBytes ?? 0),
      0,
    );
    const totalCapacityBytes = latestRows.reduce(
      (sum, row) => sum + Number(row.latest?.totalBytes ?? 0),
      0,
    );
    const criticalCount = latestRows.filter(
      (row) => Number(row.latest?.usedPercent ?? 0) >= 90,
    ).length;
    const warningCount = latestRows.filter((row) => {
      const pct = Number(row.latest?.usedPercent ?? 0);
      return pct >= 75 && pct < 90;
    }).length;
    const mostUtilized = latestRows[0] ?? null;

    return {
      latestRows,
      totalUsedBytes,
      totalCapacityBytes,
      criticalCount,
      warningCount,
      mostUtilized,
      mountpoints: latestRows.map((row) => row.mountpoint),
    };
  }, [disk]);

  useEffect(() => {
    if (!diskInsights.mountpoints.length) {
      setSelectedDiskMount('');
      return;
    }
    if (!selectedDiskMount || !diskInsights.mountpoints.includes(selectedDiskMount)) {
      setSelectedDiskMount(diskInsights.mountpoints[0]);
    }
  }, [diskInsights.mountpoints, selectedDiskMount]);

  const selectedDiskRow =
    diskInsights.latestRows.find((row) => row.mountpoint === selectedDiskMount) ??
    diskInsights.latestRows[0];
  const DISK_PAGE_SIZE = 50;
  const rawDiskRows = useMemo(
    () =>
      [...disk]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .map((row) => {
          const usedBytes = Number(row.usedBytes ?? 0);
          const totalBytes = Number(row.totalBytes ?? 0);
          const usedPercent = Number(row.usedPercent ?? 0);
          return {
            id: row.id,
            mountpoint: row.mountpoint,
            usedBytes,
            totalBytes,
            freeBytes: Math.max(totalBytes - usedBytes, 0),
            usedPercent,
            timestamp: row.timestamp,
          };
        }),
    [disk],
  );
  const [visibleDiskRows, setVisibleDiskRows] = useState(DISK_PAGE_SIZE);
  const diskTableContainerRef = useRef<HTMLDivElement | null>(null);
  const visibleRawDiskRows = rawDiskRows.slice(0, visibleDiskRows);
  const hasMoreRawDiskRows = visibleDiskRows < rawDiskRows.length;
  const NETWORK_PAGE_SIZE = 30;
  const [visibleNetworkRows, setVisibleNetworkRows] = useState(NETWORK_PAGE_SIZE);
  const networkTableContainerRef = useRef<HTMLDivElement | null>(null);

  const networkRows = networkInsights.snapshots;
  const visibleNetworkSnapshots = networkRows.slice(0, visibleNetworkRows);
  const hasMoreNetworkRows = visibleNetworkRows < networkRows.length;

  useEffect(() => {
    setVisibleNetworkRows(NETWORK_PAGE_SIZE);
  }, [networkRows.length]);

  useEffect(() => {
    if (!hasMoreNetworkRows) return;
    const container = networkTableContainerRef.current;
    if (!container) return;
    if (container.scrollHeight <= container.clientHeight) {
      setVisibleNetworkRows((prev) => Math.min(prev + NETWORK_PAGE_SIZE, networkRows.length));
    }
  }, [hasMoreNetworkRows, networkRows.length, visibleNetworkRows]);

  const handleNetworkTableScroll = () => {
    const container = networkTableContainerRef.current;
    if (!container || !hasMoreNetworkRows) return;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (!nearBottom) return;
    setVisibleNetworkRows((prev) => Math.min(prev + NETWORK_PAGE_SIZE, networkRows.length));
  };

  useEffect(() => {
    setVisibleDiskRows(DISK_PAGE_SIZE);
  }, [rawDiskRows.length, diskViewMode]);

  useEffect(() => {
    if (diskViewMode !== 'raw' || !hasMoreRawDiskRows) return;
    const container = diskTableContainerRef.current;
    if (!container) return;
    if (container.scrollHeight <= container.clientHeight) {
      setVisibleDiskRows((prev) => Math.min(prev + DISK_PAGE_SIZE, rawDiskRows.length));
    }
  }, [diskViewMode, hasMoreRawDiskRows, rawDiskRows.length, visibleDiskRows]);

  const handleDiskTableScroll = () => {
    const container = diskTableContainerRef.current;
    if (!container || !hasMoreRawDiskRows) return;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (!nearBottom) return;
    setVisibleDiskRows((prev) => Math.min(prev + DISK_PAGE_SIZE, rawDiskRows.length));
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/agents"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to agents
          </Link>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {agentLabel(agent?.os, agentId)}
          </h1>
          <p className="text-xs text-muted-foreground">
            {agent?.hostname ?? '-'}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground" title={agentId}>
            {agentId}
          </p>
          <p className="text-xs text-muted-foreground">
            {agent?.os} · {agent?.arch} · {agent?.platform}{' '}
            {agent?.platformVersion}
          </p>
        </div>
        {agent && <StatusBadge status={agent.status} />}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="processes">Processes</TabsTrigger>
          <TabsTrigger value="hardware">Hardware</TabsTrigger>
          <TabsTrigger value="software">Software</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="disk">Disk</TabsTrigger>
          <TabsTrigger value="status-events">Status log</TabsTrigger>
        </TabsList>

        <TabsContent value="processes" className="mt-4">
          <AgentProcessesTab agentId={agentId} />
        </TabsContent>
        <TabsContent value="hardware" className="mt-4">
          <AgentHardwareTab agentId={agentId} />
        </TabsContent>
        <TabsContent value="software" className="mt-4">
          <AgentSoftwareTab agentId={agentId} />
        </TabsContent>

        <TabsContent value="overview" className="mt-4">
          <Card className="border-border/90 shadow-(--shadow-soft)">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Device facts</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm md:grid-cols-2">
              <Field label="CPU" value={`${agent?.cpuModel ?? '-'} (${agent?.cpuCores ?? '?'} cores)`} />
              <Field label="Total memory" value={formatBytes(agent?.totalMemoryBytes)} />
              <Field label="Total disk" value={formatBytes(agent?.totalDiskBytes)} />
              <Field label="Kernel" value={agent?.kernelVersion ?? '-'} />
              <Field label="Agent version" value={agent?.agentVersion ?? '-'} />
              <Field label="Last seen" value={formatRelativeTime(agent?.lastSeenAt)} />
              <Field label="Ethernet IPs" value={agent?.ethernetIPs?.join(', ') || '-'} />
              <Field label="Wi-Fi IPs" value={agent?.wifiIPs?.join(', ') || '-'} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="mt-4">
          <Card className="border-border/90 shadow-(--shadow-soft)">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">CPU / Memory / Disk</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No metrics yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} unit="%" />
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
                    <Line type="monotone" dataKey="cpuPercent" name="CPU" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="memoryPercent" name="Memory" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="diskPercent" name="Disk" stroke="var(--chart-5)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network" className="mt-4">
          <Card className="border-border/90 shadow-(--shadow-soft)">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Per-interface throughput</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {networkInsights.interfaces.length === 0 ? (
                <p className="text-muted-foreground">
                  No usable network rate samples yet. Waiting for at least two samples per interface.
                </p>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                          In {formatRate(iface.currentInBps)} · Out {formatRate(iface.currentOutBps)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Avg In {formatRate(iface.avgInBps)} · Avg Out {formatRate(iface.avgOutBps)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Peak In {formatRate(iface.peakInBps)} · Peak Out {formatRate(iface.peakOutBps)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    ref={networkTableContainerRef}
                    onScroll={handleNetworkTableScroll}
                    className="max-h-[460px] overflow-auto rounded-md border border-border/60"
                  >
                    <div className="border-b border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                      Inbound = traffic received by this interface. Outbound = traffic sent by this interface.
                      Throughput columns are bytes per second, packet columns are packets per second.
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Interface</TableHead>
                          <TableHead>Inbound Throughput</TableHead>
                          <TableHead>Outbound Throughput</TableHead>
                          <TableHead>Inbound Packet Rate</TableHead>
                          <TableHead>Outbound Packet Rate</TableHead>
                          <TableHead>Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleNetworkSnapshots.map((row) => (
                          <TableRow key={`nw-${row.id}`}>
                            <TableCell className="font-medium">{row.interfaceName}</TableCell>
                            <TableCell>{formatRate(row.inBps)}</TableCell>
                            <TableCell>{formatRate(row.outBps)}</TableCell>
                            <TableCell>{formatPacketRate(row.inPps)}</TableCell>
                            <TableCell>{formatPacketRate(row.outPps)}</TableCell>
                            <TableCell>
                              <div>{formatLocalTimestamp(row.timestamp)}</div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="px-3 py-2 text-center text-xs text-muted-foreground">
                      {hasMoreNetworkRows
                        ? `Loading more... (${visibleNetworkSnapshots.length}/${networkRows.length})`
                        : `Showing all ${networkRows.length} rows`}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disk" className="mt-4">
          <Card className="border-border/90 shadow-(--shadow-soft)">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">Mountpoints</CardTitle>
              <div className="inline-flex rounded-md border border-border/60 p-0.5 text-xs">
                <button
                  type="button"
                  className={cn(
                    'rounded px-2 py-1',
                    diskViewMode === 'latest' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                  )}
                  onClick={() => setDiskViewMode('latest')}
                >
                  Latest by mount
                </button>
                <button
                  type="button"
                  className={cn(
                    'rounded px-2 py-1',
                    diskViewMode === 'raw' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                  )}
                  onClick={() => setDiskViewMode('raw')}
                >
                  Raw samples
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {diskInsights.latestRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No disk metrics yet.</p>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-md border border-border/60 bg-background px-3 py-2">
                      <div className="text-xs text-muted-foreground">Most utilized mount</div>
                      <div className="font-medium">
                        {diskInsights.mostUtilized?.mountpoint ?? '-'}{' '}
                        {diskInsights.mostUtilized
                          ? formatPercent(
                              Number(diskInsights.mostUtilized.latest.usedPercent ?? 0),
                            )
                          : ''}
                      </div>
                    </div>
                    <div className="rounded-md border border-border/60 bg-background px-3 py-2">
                      <div className="text-xs text-muted-foreground">Fleet disk used</div>
                      <div className="font-medium">
                        {formatBytes(diskInsights.totalUsedBytes)} /{' '}
                        {formatBytes(diskInsights.totalCapacityBytes)}
                      </div>
                    </div>
                    <div className="rounded-md border border-border/60 bg-background px-3 py-2">
                      <div className="text-xs text-muted-foreground">Critical mountpoints</div>
                      <div className="font-medium">{diskInsights.criticalCount}</div>
                    </div>
                    <div className="rounded-md border border-border/60 bg-background px-3 py-2">
                      <div className="text-xs text-muted-foreground">Warning mountpoints</div>
                      <div className="font-medium">{diskInsights.warningCount}</div>
                    </div>
                  </div>

                  {diskViewMode === 'latest' ? (
                    <div className="grid gap-3 lg:grid-cols-3">
                      <div className="rounded-md border border-border/60 lg:col-span-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Mountpoint</TableHead>
                              <TableHead>Used</TableHead>
                              <TableHead>Capacity</TableHead>
                              <TableHead>Free</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Last Sample</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {diskInsights.latestRows.map((row) => {
                              const used = Number(row.latest?.usedPercent ?? 0);
                              const usedBytes = Number(row.latest?.usedBytes ?? 0);
                              const totalBytes = Number(row.latest?.totalBytes ?? 0);
                              const freeBytes = Math.max(totalBytes - usedBytes, 0);
                              const isSelected = selectedDiskMount === row.mountpoint;
                              return (
                                <TableRow
                                  key={`disk-${row.mountpoint}`}
                                  className={cn(
                                    'cursor-pointer',
                                    isSelected && 'bg-muted/40',
                                  )}
                                  onClick={() => setSelectedDiskMount(row.mountpoint)}
                                >
                                  <TableCell className="font-medium">{row.mountpoint}</TableCell>
                                  <TableCell>{formatPercent(used)}</TableCell>
                                  <TableCell>{formatBytes(totalBytes)}</TableCell>
                                  <TableCell>{formatBytes(freeBytes)}</TableCell>
                                  <TableCell>{diskHealthLabel(used)}</TableCell>
                                  <TableCell>{formatLocalTimestamp(row.latest.timestamp)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="rounded-md border border-border/60 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-medium">Usage trend</p>
                          <select
                            value={selectedDiskRow?.mountpoint ?? ''}
                            onChange={(e) => setSelectedDiskMount(e.target.value)}
                            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                          >
                            {diskInsights.mountpoints.map((mount) => (
                              <option key={`disk-opt-${mount}`} value={mount}>
                                {mount}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="h-64">
                          {selectedDiskRow?.history?.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={selectedDiskRow.history}
                                margin={{ top: 6, right: 8, left: -22, bottom: 0 }}
                              >
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
                                  interval="preserveStartEnd"
                                  minTickGap={28}
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
                                  labelFormatter={(_, payload) => {
                                    const row = payload?.[0]?.payload as
                                      | { timestamp?: string }
                                      | undefined;
                                    return row?.timestamp
                                      ? formatLocalTimestamp(row.timestamp)
                                      : '';
                                  }}
                                  formatter={(value, name) => {
                                    if (name === 'Used %') {
                                      const n =
                                        typeof value === 'number' ? value : Number(value);
                                      return [formatPercent(n), 'Used %'];
                                    }
                                    return [value, name];
                                  }}
                                  contentStyle={{
                                    background: 'var(--popover)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 8,
                                    fontSize: 12,
                                  }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="usedPercent"
                                  name="Used %"
                                  stroke="var(--chart-5)"
                                  strokeWidth={2}
                                  dot={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                              No trend data for selected mountpoint.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      ref={diskTableContainerRef}
                      onScroll={handleDiskTableScroll}
                      className="max-h-[420px] overflow-auto rounded-md border border-border/60"
                    >
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Mountpoint</TableHead>
                            <TableHead>Used</TableHead>
                            <TableHead>Capacity</TableHead>
                            <TableHead>Free</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Sample Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleRawDiskRows.map((row) => (
                            <TableRow key={`disk-raw-${row.id}`}>
                              <TableCell className="font-medium">{row.mountpoint}</TableCell>
                              <TableCell>{formatPercent(row.usedPercent)}</TableCell>
                              <TableCell>{formatBytes(row.totalBytes)}</TableCell>
                              <TableCell>{formatBytes(row.freeBytes)}</TableCell>
                              <TableCell>{diskHealthLabel(row.usedPercent)}</TableCell>
                              <TableCell>{formatLocalTimestamp(row.timestamp)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="px-3 py-2 text-center text-xs text-muted-foreground">
                        {hasMoreRawDiskRows
                          ? `Loading more... (${visibleRawDiskRows.length}/${rawDiskRows.length})`
                          : `Showing all ${rawDiskRows.length} rows`}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status-events" className="mt-4">
          <Card className="border-border/90 shadow-(--shadow-soft)">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Connection history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {statusEvents.length === 0 ? (
                <p className="text-muted-foreground">No status changes recorded yet.</p>
              ) : (
                statusEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="grid grid-cols-3 gap-4 border-b border-border/60 py-2 last:border-0"
                  >
                    <span
                      className={cn(
                        'font-medium',
                        ev.status === 'online' ? 'text-emerald-600' : 'text-rose-600',
                      )}
                    >
                      {ev.status === 'online' ? '● Online' : '○ Offline'}
                    </span>
                    <span>{formatRelativeTime(ev.occurredAt)}</span>
                    <span className="text-right text-muted-foreground">
                      {ev.agentVersion ?? '-'}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 break-words text-foreground">{value}</div>
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

function diskHealthLabel(usedPercent: number) {
  if (usedPercent >= 90) return 'Critical';
  if (usedPercent >= 75) return 'Warning';
  return 'Healthy';
}
