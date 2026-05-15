'use client';

import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Cpu,
  HardDrive,
  History,
  LayoutDashboard,
  Network as NetworkIcon,
  Package,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/itom/status-badge';
import { LoadingOverlay, useColdLoad } from '@/components/ui/loaders';
import { useAgent, useAgentStatusEvents } from '@/hooks/use-itom';
import { agentLabel, formatBytes, formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AgentProcessesTab } from './agent-processes-tab';
import { AgentHardwareTab } from './agent-hardware-tab';
import { AgentSoftwareTab } from './agent-software-tab';
import { AgentPerformanceTab } from './agent-performance-tab';
import { NetworkOverviewPage } from './network-overview-page';
import { DiskOverviewPage } from './disk-overview-page';

export function AgentDetailPage({ agentId }: { agentId: string }) {
  const agentQ = useAgent(agentId);
  const statusEventsQ = useAgentStatusEvents(agentId, 100);
  const agent = agentQ.data;
  const statusEvents = statusEventsQ.data ?? [];
  const showOverlay = useColdLoad(agentQ.isLoading, !!agent);

  return (
    <div className="w-full space-y-4">
      <LoadingOverlay isLoading={showOverlay} />
      <div className="min-w-0">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to agents
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {agentLabel(agent?.os, agentId)}
          </h1>
          {agent && <StatusBadge status={agent.status} />}
        </div>
      </div>

      <Tabs
        defaultValue="overview"
        orientation="vertical"
        className="!gap-4 w-full"
      >
        <TabsList
          variant="line"
          className="!h-auto w-48 shrink-0 flex-col items-stretch justify-start !rounded-none !p-0 !bg-transparent"
        >
          <p className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Overview
          </p>
          <TabsTrigger value="overview" className={tabTriggerCls}>
            <LayoutDashboard />
            Overview
          </TabsTrigger>

          <p className="px-2 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Monitoring
          </p>
          <TabsTrigger value="metrics" className={tabTriggerCls}>
            <BarChart3 />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="processes" className={tabTriggerCls}>
            <Activity />
            Processes
          </TabsTrigger>

          <p className="px-2 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Inventory
          </p>
          <TabsTrigger value="hardware" className={tabTriggerCls}>
            <Cpu />
            Hardware
          </TabsTrigger>
          <TabsTrigger value="software" className={tabTriggerCls}>
            <Package />
            Software
          </TabsTrigger>
          <TabsTrigger value="network" className={tabTriggerCls}>
            <NetworkIcon />
            Network
          </TabsTrigger>
          <TabsTrigger value="disk" className={tabTriggerCls}>
            <HardDrive />
            Disk
          </TabsTrigger>

          <p className="px-2 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Activity
          </p>
          <TabsTrigger value="status-events" className={tabTriggerCls}>
            <History />
            Status log
          </TabsTrigger>
        </TabsList>

        <div className="min-w-0 flex-1">
          <TabsContent value="metrics" className="!mt-0">
            <AgentPerformanceTab agentId={agentId} />
          </TabsContent>
          <TabsContent value="processes" className="!mt-0">
            <AgentProcessesTab agentId={agentId} os={agent?.os} />
          </TabsContent>
          <TabsContent value="hardware" className="!mt-0">
            <AgentHardwareTab agentId={agentId} />
          </TabsContent>
          <TabsContent value="software" className="!mt-0">
            <AgentSoftwareTab agentId={agentId} />
          </TabsContent>
          <TabsContent value="network" className="!mt-0">
            <NetworkOverviewPage agentId={agentId} />
          </TabsContent>
          <TabsContent value="disk" className="!mt-0">
            <DiskOverviewPage agentId={agentId} />
          </TabsContent>

          <TabsContent value="overview" className="!mt-0">
            <Card className="border-border/90 shadow-(--shadow-soft)">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Device Facts</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm md:grid-cols-2">
                <Field label="Hostname" value={agent?.hostname ?? '-'} />
                <Field
                  label="Agent ID"
                  value={
                    <span className="break-all font-mono text-xs" title={agentId}>
                      {agentId}
                    </span>
                  }
                />
                <Field
                  label="Operating system"
                  value={`${agent?.os ?? '-'} · ${agent?.arch ?? '-'} · ${agent?.platform ?? '-'} ${agent?.platformVersion ?? ''}`.trim()}
                />
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

          <TabsContent value="status-events" className="!mt-0">
            <Card className="border-border/90 shadow-(--shadow-soft)">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Connection history</CardTitle>
              </CardHeader>
              <CardContent>
                {statusEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No status changes recorded yet.
                  </p>
                ) : (
                  // Viewport-relative height so the connection history fills
                  // the available page space (rather than capping at 480px).
                  // The sticky header stays pinned while body rows scroll
                  // inside this bounded box.
                  <div className="h-[calc(100vh-260px)] min-h-[400px] overflow-y-auto rounded-md border border-border/60">
                    <Table className="table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[28%]">Status</TableHead>
                          <TableHead className="w-[36%]">Occurred</TableHead>
                          <TableHead className="w-[36%]">Agent Version</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statusEvents.map((ev) => (
                          <TableRow key={ev.id}>
                            <TableCell
                              className={cn(
                                'truncate font-medium',
                                ev.status === 'online'
                                  ? 'text-emerald-600'
                                  : 'text-rose-600',
                              )}
                            >
                              {ev.status === 'online' ? '● Online' : '○ Offline'}
                            </TableCell>
                            <TableCell
                              className="truncate text-muted-foreground"
                              title={ev.occurredAt}
                            >
                              {formatRelativeTime(ev.occurredAt)}
                            </TableCell>
                            <TableCell className="truncate text-muted-foreground tabular-nums">
                              {ev.agentVersion ?? '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// Vertical sidebar tab: full-width row with icon + label, muted bg on active.
// Overrides the primitive's defaults (flex-1, h-[calc(100%-1px)], primary bg)
// so each tab renders as an auto-height row matching the Hear-style inner nav.
const tabTriggerCls =
  "cursor-pointer !h-auto !flex-initial w-full justify-start gap-2 px-3 py-2 text-sm rounded-md " +
  "after:!hidden " +
  "text-foreground/70 hover:bg-muted/60 hover:!text-foreground " +
  "data-active:!bg-muted data-active:!text-foreground " +
  "[&_svg:not([class*='size-'])]:size-4";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 break-words text-foreground">{value}</div>
    </div>
  );
}
