'use client';

import {
  AlertTriangle,
  Cpu,
  HardDrive,
  HeartPulse,
  HelpCircle,
  MemoryStick,
  ServerOff,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingOverlay, useColdLoad } from '@/components/ui/loaders';
import {
  useAgents,
  useFleetStats,
  useOsDistribution,
  type MetricStats,
} from '@/hooks/use-itom';
import { agentLabel, formatPercent, formatRelativeTime } from '@/lib/format';
import { KpiCard, type KpiTone } from './kpi-card';
import { OsDistributionChart } from './charts/os-distribution-chart';
import { DistributionHistogram } from './charts/distribution-histogram';
import { StatusBadge } from './status-badge';
import { PageHeader } from '@/components/app/page-header';

/**
 * Fleet-operations dashboard. Almost-entirely aggregate so the page
 * scales to any fleet size; the one exception is the "Latest incidents"
 * table on Row 4, which is bounded to 10 rows so it stays scannable
 * even if 10k agents are offline at once.
 *
 * Rows
 *   1. Attention — counts that should be zero for the fleet to be OK
 *   2. Posture   — fleet utilization with p50/p95/max sub-line
 *   3. Latest incidents + OS distribution
 *   4. CPU / Memory / Disk distribution histograms
 *
 * TODO (backend): once `/v1/dashboard/fleet-stats` exists, drop the
 * client-side percentile / category math from `useFleetStats` and
 * call the endpoint directly.
 */
export function DashboardOverview() {
  const stats = useFleetStats();
  const osQ = useOsDistribution();
  const agentsQ = useAgents();

  const isLoading = stats.isLoading;
  const showOverlay = useColdLoad(isLoading, stats.totalAgents > 0);

  // Latest-incidents feed: every agent currently in a non-online state,
  // sorted by most-recent status change. Bounded to 10 rows so the table
  // stays scannable regardless of fleet size.
  const incidents = (agentsQ.data ?? [])
    .filter((a) => a.status !== 'online')
    .slice()
    .sort(
      (a, b) =>
        new Date(b.statusChangedAt).getTime() -
        new Date(a.statusChangedAt).getTime(),
    )
    .slice(0, 10);

  // Tone helpers: utilization tiles turn yellow > 70 and rose > 85 so
  // the colour itself tells you whether the fleet is healthy.
  const utilTone = (avg: number): KpiTone =>
    avg >= 85 ? 'rose' : avg >= 70 ? 'yellow' : 'green';

  // Issue tone — anything non-zero gets a rose tile so the eye lands on
  // it first. Same trick for offline/unknown.
  const issueTone = (n: number): KpiTone => (n > 0 ? 'rose' : 'green');
  const unknownTone = (n: number): KpiTone => (n > 0 ? 'orange' : 'green');

  return (
    <div className="w-full space-y-6">
      <LoadingOverlay isLoading={showOverlay} />

      <PageHeader
        title="Dashboard"
        description="Live operations view across your ITOM fleet"
      />

      {/* Row 1 — Attention. Headline counts that should be zero. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Agents"
          value={stats.totalAgents}
          icon={Users}
          tone="purple"
          descriptor={`${stats.online} online · ${stats.offline} offline`}
          descriptorTone="muted"
        />
        <KpiCard
          label="Offline Agents"
          value={stats.offline}
          icon={ServerOff}
          tone={issueTone(stats.offline)}
          descriptor={
            stats.offline === 0
              ? 'all reachable'
              : `${pct(stats.offline, stats.totalAgents)} of fleet`
          }
          descriptorTone={stats.offline > 0 ? 'danger' : 'success'}
        />
        <KpiCard
          label="Unknown / Stale"
          value={stats.unknown}
          icon={HelpCircle}
          tone={unknownTone(stats.unknown)}
          descriptor={
            stats.unknown === 0
              ? 'no stale agents'
              : `${pct(stats.unknown, stats.totalAgents)} of fleet`
          }
          descriptorTone={stats.unknown > 0 ? 'warning' : 'success'}
        />
        <KpiCard
          label="Healthy Agents"
          value={stats.healthy}
          icon={HeartPulse}
          tone="green"
          descriptor={`${pct(stats.healthy, stats.totalAgents)} of fleet`}
          descriptorTone="success"
        />
      </div>

      {/* Row 2 — Fleet posture. Averages + p50/p95/max sub-line — no
          hostname, because that doesn't scale to 1000 agents. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Issues"
          value={stats.issues}
          icon={AlertTriangle}
          tone={issueTone(stats.issues)}
          descriptor={
            stats.issues === 0 ? 'all clear' : 'offline + unknown'
          }
          descriptorTone={stats.issues > 0 ? 'danger' : 'success'}
        />
        <KpiCard
          label="Avg CPU"
          value={formatPercent(stats.cpu.avg)}
          icon={Cpu}
          tone={utilTone(stats.cpu.avg)}
          descriptor={percentileSummary(stats.cpu)}
          descriptorTone="muted"
        />
        <KpiCard
          label="Avg Memory"
          value={formatPercent(stats.memory.avg)}
          icon={MemoryStick}
          tone={utilTone(stats.memory.avg)}
          descriptor={percentileSummary(stats.memory)}
          descriptorTone="muted"
        />
        <KpiCard
          label="Avg Disk"
          value={formatPercent(stats.disk.avg)}
          icon={HardDrive}
          tone={utilTone(stats.disk.avg)}
          descriptor={percentileSummary(stats.disk)}
          descriptorTone="muted"
        />
      </div>



      {/* Row 4 — Latest incidents (bounded list, scales fine) + OS donut. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
            <div>
              <CardTitle>Latest incidents</CardTitle>
              <p className="text-xs text-muted-foreground">
                Agents currently in a non-online state, most recent change first
              </p>
            </div>
            {incidents.length > 0 ? (
              <Link
                href="/agents"
                className="shrink-0 text-xs font-medium text-primary hover:underline"
              >
                View all →
              </Link>
            ) : null}
          </CardHeader>
          <CardContent className="pt-0">
            {incidents.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
                No active incidents — every agent is online.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>OS / Arch</TableHead>
                    <TableHead>Since</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents.map((a) => (
                    <TableRow key={`incident-${a.agentId}`}>
                      <TableCell className="font-medium">
                        {a.status === 'offline'
                          ? 'Connection lost'
                          : 'Awaiting connection'}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/agents/${a.agentId}`}
                          className="font-medium text-foreground hover:text-primary"
                          title={a.hostname ?? ''}
                        >
                          {agentLabel(a.os, a.agentId)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.os} · {a.arch}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatRelativeTime(a.statusChangedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <StatusBadge status={a.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>OS Distribution</CardTitle>
            <p className="text-xs text-muted-foreground">
              Breakdown of agents by operating system
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <OsDistributionChart data={osQ.data ?? []} />
          </CardContent>
        </Card>
      </div>

            {/* Row 3 — Distribution histograms. The single most scalable way
          to read fleet stress: 10 bars regardless of agent count. */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              CPU usage distribution
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Agents bucketed by their latest CPU% sample
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <DistributionHistogram buckets={stats.cpu.buckets} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <MemoryStick className="h-4 w-4 text-primary" />
              Memory usage distribution
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Agents bucketed by their latest memory% sample
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <DistributionHistogram buckets={stats.memory.buckets} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              Disk usage distribution
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Agents bucketed by their highest mountpoint usage
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <DistributionHistogram buckets={stats.disk.buckets} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function pct(part: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

function percentileSummary(m: MetricStats): string {
  return `p50 ${Math.round(m.p50)}% · p95 ${Math.round(m.p95)}% · max ${Math.round(m.max)}%`;
}
