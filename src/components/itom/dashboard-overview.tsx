'use client';

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  HardDrive,
  HelpCircle,
  MemoryStick,
  RefreshCw,
  Server,
  ServerOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingOverlay, useColdLoad } from '@/components/ui/loaders';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useAgents,
  useCpuByAgent,
  useDashboardSummary,
  useOsDistribution,
} from '@/hooks/use-itom';
import { agentLabel, formatPercent, formatRelativeTime } from '@/lib/format';
import { KpiCard } from './kpi-card';
import { StatusBadge } from './status-badge';
import { CpuByAgentChart } from './charts/cpu-by-agent-chart';
import { OsDistributionChart } from './charts/os-distribution-chart';
import { StatusDonut } from './charts/status-donut';
import { PageHeader } from '@/components/app/page-header';

export function DashboardOverview() {
  const summaryQ = useDashboardSummary();
  const agentsQ = useAgents();
  const osQ = useOsDistribution();
  const cpuQ = useCpuByAgent(8);

  const summary = summaryQ.data;
  const agents = agentsQ.data ?? [];
  const osDist = osQ.data ?? [];
  const cpuByAgent = cpuQ.data ?? [];
  const recentIncidents = agents
    .filter((agent) => agent.status !== 'online')
    .slice(0, 8);

  const isLoading = summaryQ.isLoading && agentsQ.isLoading;
  const showOverlay = useColdLoad(isLoading, !!summary || agents.length > 0);

  // CPU/memory/disk tones flip from green → yellow → red as the fleet
  // average climbs. Keeps the dashboard's overall mood matching what's
  // actually happening to the fleet.
  const cpu = Number(summary?.avgCpu ?? 0);
  const mem = Number(summary?.avgMemory ?? 0);
  const disk = Number(summary?.avgDisk ?? 0);
  const utilTone = (v: number): 'green' | 'yellow' | 'rose' =>
    v >= 85 ? 'rose' : v >= 70 ? 'yellow' : 'green';

  return (
    <div className="w-full space-y-6">
      <LoadingOverlay isLoading={showOverlay} />

      <PageHeader
        title="Dashboard"
        description="Overview of your ITOM environment"
      />

      {/* Row 1 — KPI grid, 8 metrics in 4-col layout (per acai screenshot).
          Sticking to gap-4 (16px) per Hear DS spec. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Agents"
          value={summary?.totalAgents ?? 0}
          icon={Server}
          tone="purple"
          descriptor={`${summary?.onlineAgents ?? 0} active`}
          descriptorTone="success"
        />
        <KpiCard
          label="Online Agents"
          value={summary?.onlineAgents ?? 0}
          icon={CheckCircle2}
          tone="teal"
          descriptor={`of ${summary?.totalAgents ?? 0} agents`}
          descriptorTone="muted"
        />
        <KpiCard
          label="Offline Agents"
          value={summary?.offlineAgents ?? 0}
          icon={ServerOff}
          tone="rose"
          descriptor={
            summary?.offlineAgents
              ? `${summary.offlineAgents} unreachable`
              : 'all reachable'
          }
          descriptorTone={summary?.offlineAgents ? 'danger' : 'muted'}
        />
        <KpiCard
          label="Avg CPU"
          value={formatPercent(cpu)}
          icon={Cpu}
          tone={utilTone(cpu)}
          descriptor="fleet average"
          descriptorTone="muted"
        />

        <KpiCard
          label="Avg Memory"
          value={formatPercent(mem)}
          icon={MemoryStick}
          tone={utilTone(mem)}
          descriptor="fleet average"
          descriptorTone="muted"
        />
        <KpiCard
          label="Avg Disk"
          value={formatPercent(disk)}
          icon={HardDrive}
          tone={utilTone(disk)}
          descriptor="fleet average"
          descriptorTone="muted"
        />
        <KpiCard
          label="Unknown"
          value={summary?.unknownAgents ?? 0}
          icon={HelpCircle}
          tone="orange"
          descriptor="awaiting connection"
          descriptorTone={summary?.unknownAgents ? 'warning' : 'muted'}
        />
        <KpiCard
          label="Last Update"
          value={summary ? formatRelativeTime(summary.lastUpdatedAt) : '—'}
          icon={RefreshCw}
          tone="green"
          descriptor="auto-refresh 15s"
          descriptorTone="muted"
        />
      </div>

      {/* Row 2 — Recent incidents (wide) + agent status donut (narrow). */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              Recent Incidents (last 24h)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {recentIncidents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No incidents in the last 24 hours.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Incident</TableHead>
                    <TableHead>Affected Agent</TableHead>
                    <TableHead>Affected Device</TableHead>
                    <TableHead>Occurred At</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentIncidents.map((agent) => (
                    <TableRow key={`incident-${agent.agentId}`}>
                      <TableCell>
                        {agent.status === 'offline'
                          ? 'Connection lost'
                          : 'Awaiting connection'}
                      </TableCell>
                      <TableCell
                        className="font-medium"
                        title={agent.hostname ?? ''}
                      >
                        {agentLabel(agent.os, agent.agentId)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {agent.os} · {agent.arch}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatRelativeTime(agent.lastSeenAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <StatusBadge status={agent.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Agent Status</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <StatusDonut
              online={summary?.onlineAgents ?? 0}
              offline={summary?.offlineAgents ?? 0}
              unknown={summary?.unknownAgents ?? 0}
            />
          </CardContent>
        </Card>
      </div>

      {/* Row 3 — CPU by Agent (wide) + OS Distribution (narrow). */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              CPU by Agent
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <CpuByAgentChart data={cpuByAgent} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>OS Distribution</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <OsDistributionChart data={osDist} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
