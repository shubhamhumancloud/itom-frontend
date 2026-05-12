'use client';

import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  HardDrive,
  MemoryStick,
  Server,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

export function DashboardOverview() {
  const summaryQ = useDashboardSummary();
  const agentsQ = useAgents();
  const osQ = useOsDistribution();
  const cpuQ = useCpuByAgent(8);

  const summary = summaryQ.data;
  const agents = agentsQ.data ?? [];
  const osDist = osQ.data ?? [];
  const cpuByAgent = cpuQ.data ?? [];
  const recentIncidents = agents.filter((agent) => agent.status !== 'online').slice(0, 8);

  const isLoading = summaryQ.isLoading && agentsQ.isLoading;

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-xs text-muted-foreground">Overview of your ITOM environment</p>
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px] rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total Agents"
              value={summary?.totalAgents ?? 0}
              icon={Server}
              tone="violet"
              descriptor={`${summary?.onlineAgents ?? 0} active`}
              descriptorTone="emerald"
            />
            <KpiCard
              label="Online Agents"
              value={summary?.onlineAgents ?? 0}
              icon={CheckCircle2}
              tone="emerald"
              descriptor={`of ${summary?.totalAgents ?? 0} agents`}
              descriptorTone="muted"
            />
            <KpiCard
              label="Offline Agents"
              value={summary?.offlineAgents ?? 0}
              icon={AlertTriangle}
              tone="rose"
              descriptor={
                summary?.offlineAgents
                  ? `${summary.offlineAgents} unreachable`
                  : 'all reachable'
              }
              descriptorTone={summary?.offlineAgents ? 'rose' : 'muted'}
            />
            <KpiCard
              label="Avg CPU"
              value={formatPercent(summary?.avgCpu ?? 0)}
              icon={Cpu}
              tone="orange"
              descriptor="fleet average"
              descriptorTone="muted"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Avg Memory"
              value={formatPercent(summary?.avgMemory ?? 0)}
              icon={MemoryStick}
              tone="indigo"
              descriptor="fleet average"
              descriptorTone="muted"
            />
            <KpiCard
              label="Avg Disk"
              value={formatPercent(summary?.avgDisk ?? 0)}
              icon={HardDrive}
              tone="teal"
              descriptor="fleet average"
              descriptorTone="muted"
            />
            <KpiCard
              label="Unknown"
              value={summary?.unknownAgents ?? 0}
              icon={Activity}
              tone="violet"
              descriptor="awaiting connection"
              descriptorTone="muted"
            />
            <KpiCard
              label="Last Update"
              value={summary ? formatRelativeTime(summary.lastUpdatedAt) : '-'}
              icon={TrendingUp}
              tone="emerald"
              descriptor="auto-refresh 15s"
              descriptorTone="muted"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="border-border/90 shadow-(--shadow-soft) lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  Recent Incidents (last 24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentIncidents.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-8 text-center">
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
                        <TableHead>Incident Occurred At</TableHead>
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
                          <TableCell className="font-medium" title={agent.hostname ?? ''}>
                            {agentLabel(agent.os, agent.agentId)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {agent.os} · {agent.arch}
                          </TableCell>
                          <TableCell className="text-muted-foreground">now</TableCell>
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

            <Card className="border-border/90 shadow-(--shadow-soft)">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Agent Status</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusDonut
                  online={summary?.onlineAgents ?? 0}
                  offline={summary?.offlineAgents ?? 0}
                  unknown={summary?.unknownAgents ?? 0}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="border-border/90 shadow-(--shadow-soft) lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Cpu className="h-4 w-4 text-orange-600" />
                  CPU by Agent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CpuByAgentChart data={cpuByAgent} />
              </CardContent>
            </Card>

            <Card className="border-border/90 shadow-(--shadow-soft)">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">OS Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <OsDistributionChart data={osDist} />
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/90 shadow-(--shadow-soft)">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">Live Agents</CardTitle>
              <span className="text-xs text-muted-foreground">
                {summary ? `Last updated ${formatRelativeTime(summary.lastUpdatedAt)}` : ''}
              </span>
            </CardHeader>
            <CardContent>
              {agents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    No agents registered yet. Visit{' '}
                    <Link
                      href="/settings"
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Settings
                    </Link>{' '}
                    for install instructions.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>OS</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Last seen</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.slice(0, 8).map((agent) => (
                      <TableRow key={agent.agentId}>
                        <TableCell>
                          <Link
                            href={`/agents/${agent.agentId}`}
                            className="font-medium text-foreground hover:text-primary"
                            title={agent.hostname ?? ''}
                          >
                            {agentLabel(agent.os, agent.agentId)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {agent.os} · {agent.arch}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {agent.ethernetIPs?.[0] ?? agent.wifiIPs?.[0] ?? '-'}
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
        </>
      )}
    </div>
  );
}
