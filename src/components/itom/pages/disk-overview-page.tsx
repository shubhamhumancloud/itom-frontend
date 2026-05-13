'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAgentDisk, useAgents } from '@/hooks/use-itom';
import { formatBytes, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AgentPicker, ALL_AGENTS_VALUE } from '@/components/itom/agent-picker';
import { FetchProgressBar, LoadingMoreRow, LoadingOverlay, useColdLoad } from '@/components/ui/loaders';

/**
 * Sidebar Monitoring → Disk page.
 *
 * Hosts the per-mountpoint disk view that used to live on the
 * agent-detail "Disk" sub-tab. Pinned to one agent at a time —
 * per-mount utilization only makes sense per host. "All agents"
 * from the picker falls back to the first concrete agent.
 */
export function DiskOverviewPage() {
  const [agentId, setAgentId] = useState<string>('');
  const { data: agents = [] } = useAgents();

  useEffect(() => {
    if (!agentId && agents.length > 0) {
      setAgentId(agents[0].agentId);
    }
  }, [agentId, agents]);

  const { data: disk = [], isFetching, isLoading } = useAgentDisk(agentId, 1000);
  const showOverlay = useColdLoad(isLoading, disk.length > 0);

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
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
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
          Number(b.latest?.usedPercent ?? 0) -
          Number(a.latest?.usedPercent ?? 0),
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
    if (
      !selectedDiskMount ||
      !diskInsights.mountpoints.includes(selectedDiskMount)
    ) {
      setSelectedDiskMount(diskInsights.mountpoints[0]);
    }
  }, [diskInsights.mountpoints, selectedDiskMount]);

  const selectedDiskRow =
    diskInsights.latestRows.find(
      (row) => row.mountpoint === selectedDiskMount,
    ) ?? diskInsights.latestRows[0];

  const DISK_PAGE_SIZE = 50;
  const rawDiskRows = useMemo(
    () =>
      [...disk]
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
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

  useEffect(() => {
    setVisibleDiskRows(DISK_PAGE_SIZE);
  }, [rawDiskRows.length, diskViewMode]);

  // Scroll-driven infinite loader only. No "auto-fill while container
  // has empty space" companion effect — that pattern pre-loaded the
  // entire dataset on tall screens and defeated pagination. Now the
  // only way to load more is to scroll near the bottom of the bounded
  // container.
  const handleDiskTableScroll = () => {
    const container = diskTableContainerRef.current;
    if (!container || !hasMoreRawDiskRows) return;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      120;
    if (!nearBottom) return;
    setVisibleDiskRows((prev) =>
      Math.min(prev + DISK_PAGE_SIZE, rawDiskRows.length),
    );
  };

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <LoadingOverlay isLoading={showOverlay} />
      <FetchProgressBar isFetching={isFetching && !showOverlay} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Disk
          </h1>
          <p className="text-xs text-muted-foreground">
            Mountpoint utilization, capacity and raw samples for the selected
            agent.
          </p>
        </div>
        <AgentPicker
          value={agentId}
          onChange={(v) => {
            // "All agents" doesn't make sense for per-mountpoint disk
            // utilization — fall back to the first concrete agent.
            if (!v || v === ALL_AGENTS_VALUE) {
              setAgentId(agents[0]?.agentId ?? '');
              return;
            }
            setAgentId(v);
          }}
          placeholder="Select agent"
        />
      </div>

      <Card className="border-border/90 shadow-(--shadow-soft)">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">Mountpoints</CardTitle>
          <div className="inline-flex rounded-md border border-border/60 p-0.5 text-xs">
            <button
              type="button"
              className={cn(
                'rounded px-2 py-1',
                diskViewMode === 'latest'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground',
              )}
              onClick={() => setDiskViewMode('latest')}
            >
              Latest by mount
            </button>
            <button
              type="button"
              className={cn(
                'rounded px-2 py-1',
                diskViewMode === 'raw'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground',
              )}
              onClick={() => setDiskViewMode('raw')}
            >
              Raw samples
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {diskInsights.latestRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No disk metrics yet.
            </p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-md border border-border/60 bg-background px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    Most utilized mount
                  </div>
                  <div className="font-medium">
                    {diskInsights.mostUtilized?.mountpoint ?? '-'}{' '}
                    {diskInsights.mostUtilized
                      ? formatPercent(
                          Number(
                            diskInsights.mostUtilized.latest.usedPercent ?? 0,
                          ),
                        )
                      : ''}
                  </div>
                </div>
                <div className="rounded-md border border-border/60 bg-background px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    Fleet disk used
                  </div>
                  <div className="font-medium">
                    {formatBytes(diskInsights.totalUsedBytes)} /{' '}
                    {formatBytes(diskInsights.totalCapacityBytes)}
                  </div>
                </div>
                <div className="rounded-md border border-border/60 bg-background px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    Critical mountpoints
                  </div>
                  <div className="font-medium">
                    {diskInsights.criticalCount}
                  </div>
                </div>
                <div className="rounded-md border border-border/60 bg-background px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    Warning mountpoints
                  </div>
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
                          const totalBytes = Number(
                            row.latest?.totalBytes ?? 0,
                          );
                          const freeBytes = Math.max(totalBytes - usedBytes, 0);
                          const isSelected =
                            selectedDiskMount === row.mountpoint;
                          return (
                            <TableRow
                              key={`disk-${row.mountpoint}`}
                              className={cn(
                                'cursor-pointer',
                                isSelected && 'bg-muted/40',
                              )}
                              onClick={() =>
                                setSelectedDiskMount(row.mountpoint)
                              }
                            >
                              <TableCell className="font-medium">
                                {row.mountpoint}
                              </TableCell>
                              <TableCell>{formatPercent(used)}</TableCell>
                              <TableCell>{formatBytes(totalBytes)}</TableCell>
                              <TableCell>{formatBytes(freeBytes)}</TableCell>
                              <TableCell>{diskHealthLabel(used)}</TableCell>
                              <TableCell>
                                {formatLocalTimestamp(row.latest.timestamp)}
                              </TableCell>
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
                        onChange={(e) =>
                          setSelectedDiskMount(e.target.value)
                        }
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
                                    typeof value === 'number'
                                      ? value
                                      : Number(value);
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
                  className="h-[480px] overflow-y-auto overflow-x-auto rounded-md border border-border/60"
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
                          <TableCell className="font-medium">
                            {row.mountpoint}
                          </TableCell>
                          <TableCell>{formatPercent(row.usedPercent)}</TableCell>
                          <TableCell>{formatBytes(row.totalBytes)}</TableCell>
                          <TableCell>{formatBytes(row.freeBytes)}</TableCell>
                          <TableCell>
                            {diskHealthLabel(row.usedPercent)}
                          </TableCell>
                          <TableCell>
                            {formatLocalTimestamp(row.timestamp)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {hasMoreRawDiskRows ? (
                    <LoadingMoreRow
                      current={visibleRawDiskRows.length}
                      total={rawDiskRows.length}
                    />
                  ) : (
                    <div className="px-3 py-2 text-center text-xs text-muted-foreground">
                      Showing all {rawDiskRows.length} rows
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
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
