'use client';

import { useMemo, useRef, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useAgentProcessSparklines,
  useAgentProcesses,
} from '@/hooks/use-itom';
import { LoadingMoreRow, TableSkeleton } from '@/components/ui/loaders';
import { formatBytes, formatNumber, toNumber } from '@/lib/format';
import { SoftwareIcon } from './agent-software-tab';

type SortKey = 'cpu' | 'mem' | 'name';
const PAGE = 20;

// iconKeyFromProcessName normalises a raw process name (`chrome.exe`,
// `Google Chrome Helper (Renderer)`, `code.exe`) into a string the shared
// SoftwareIcon resolver can map to a brand logo. Stripping common binary
// suffixes is the only transform the icon's existing slugifier doesn't
// already do — everything else (paren noise, casing, strip-tokens) is
// handled inside SoftwareIcon.
function iconKeyFromProcessName(name: string): string {
  return name.replace(/\.(exe|bin|app)$/i, '').trim();
}

export function AgentProcessesTab({
  agentId,
  os,
}: {
  agentId: string;
  os?: string;
}) {
  // Per-process I/O counters work on Linux (/proc/<pid>/io) and Windows
  // (NtQueryInformationProcess), but on macOS they require root + private
  // APIs that the agent intentionally doesn't touch — gopsutil returns
  // nothing useful there. Hide the two I/O columns on Macs so the table
  // doesn't show two columns of dashes; keep them everywhere else.
  // Unknown OS → show (no-loss default).
  const showIO = (os ?? '').toLowerCase() !== 'darwin';
  const { data: rows = [], isLoading } = useAgentProcesses(agentId, 200);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('cpu');
  const [visible, setVisible] = useState(PAGE);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? rows.filter((r) => r.processName.toLowerCase().includes(q))
      : rows;
    const sorted = [...list].sort((a, b) => {
      switch (sort) {
        case 'cpu':
          return toNumber(b.cpuPercent) - toNumber(a.cpuPercent);
        case 'mem':
          return b.memoryBytes - a.memoryBytes;
        case 'name':
          return a.processName.localeCompare(b.processName);
      }
    });
    return sorted;
  }, [rows, search, sort]);

  const shown = filtered.slice(0, visible);
  const sparkNames = shown.map((r) => r.processName);
  const { data: sparks } = useAgentProcessSparklines(agentId, sparkNames, 30);

  // Internal-scroll pagination — mirrors the disk raw-samples table.
  // We page the in-memory `filtered` list (PAGE rows at a time) when
  // the user scrolls within 120px of the bottom of the bordered
  // container; the IntersectionObserver pattern can't see scroll
  // inside a fixed-height container so onScroll is the right shape.
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const handleTableScroll = () => {
    const container = tableContainerRef.current;
    if (!container || visible >= filtered.length) return;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      120;
    if (!nearBottom) return;
    setVisible((v) => Math.min(v + PAGE, filtered.length));
  };

  if (isLoading) {
    return (
      <Card className="border-border/90 shadow-(--shadow-soft)">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Top processes</CardTitle>
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={10} columns={7} />
        </CardContent>
      </Card>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          No process data yet. The agent samples processes every 60 s.
        </p>
      </div>
    );
  }

  const latestTimestamp = rows[0]?.timestamp;

  return (
    <Card className="border-border/90 shadow-(--shadow-soft)">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <div>
          <CardTitle className="text-base font-semibold">
            Top processes
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Aggregated by executable name · last sampled{' '}
            {latestTimestamp
              ? new Date(latestTimestamp).toLocaleTimeString()
              : '-'}
          </p>
        </div>
        <Input
          className="w-72"
          placeholder="Search process name"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setVisible(PAGE);
          }}
        />
      </CardHeader>
      <CardContent>
        <div
          ref={tableContainerRef}
          onScroll={handleTableScroll}
          className="max-h-[600px] overflow-y-auto overflow-x-auto rounded-md border border-border/60"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead label="Process" active={sort === 'name'} onClick={() => setSort('name')} />
                <TableHead className="text-right">Instances</TableHead>
                <SortHead label="CPU" active={sort === 'cpu'} onClick={() => setSort('cpu')} className="text-right" />
                <TableHead className="text-right">Trend</TableHead>
                <SortHead label="Memory" active={sort === 'mem'} onClick={() => setSort('mem')} className="text-right" />
                {showIO && (
                  <>
                    <TableHead className="text-right">I/O Read</TableHead>
                    <TableHead className="text-right">I/O Write</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => {
                const series = sparks?.[r.processName] ?? [];
                return (
                  <TableRow key={r.processName}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <SoftwareIcon name={iconKeyFromProcessName(r.processName)} />
                        <span>{r.processName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {r.pidCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(r.cpuPercent)}%
                    </TableCell>
                    <TableCell className="text-right">
                      <Sparkline data={series} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBytes(r.memoryBytes)}
                    </TableCell>
                    {showIO && (
                      <>
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {r.ioReadBytes != null ? formatBytes(r.ioReadBytes) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {r.ioWriteBytes != null ? formatBytes(r.ioWriteBytes) : '-'}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {visible < filtered.length ? (
            <LoadingMoreRow current={visible} total={filtered.length} />
          ) : (
            shown.length > 0 && (
              <div className="px-3 py-2 text-center text-xs text-muted-foreground">
                Showing all {filtered.length} processes
              </div>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SortHead({
  label,
  active,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <TableHead className={className}>
      <button
        onClick={onClick}
        className="hover:text-foreground"
      >
        {label} {active ? '↓' : ''}
      </button>
    </TableHead>
  );
}

function Sparkline({
  data,
}: {
  data: { t: string; cpu: number; mem: number }[];
}) {
  if (!data || data.length < 2) {
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }
  return (
    <div className="ml-auto h-6 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <YAxis hide domain={[0, 'dataMax + 1']} />
          <Line
            type="monotone"
            dataKey="cpu"
            stroke="var(--chart-1)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
