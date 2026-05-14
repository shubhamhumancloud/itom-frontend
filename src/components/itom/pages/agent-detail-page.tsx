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
import { StatusBadge } from '@/components/itom/status-badge';
import { FetchProgressBar, LoadingOverlay, useColdLoad } from '@/components/ui/loaders';
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
  // Page-wide fetch indicator: pulses whenever either the agent header
  // data or the status log are background-refreshing. Child tabs run
  // their own queries and surface their own bars.
  const isFetching = agentQ.isFetching || statusEventsQ.isFetching;
  const showOverlay = useColdLoad(agentQ.isLoading, !!agent);

  return (
    <div className="w-full space-y-4">
      <LoadingOverlay isLoading={showOverlay} />
      <FetchProgressBar isFetching={isFetching && !showOverlay} />
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

      <Tabs defaultValue="overview">
        <TabsList className="!h-12 gap-1 p-1.5">
          <TabsTrigger value="overview" className={tabTriggerCls}>
            <LayoutDashboard />
            Overview
          </TabsTrigger>
          <TabsTrigger value="metrics" className={tabTriggerCls}>
            <BarChart3 />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="processes" className={tabTriggerCls}>
            <Activity />
            Processes
          </TabsTrigger>
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
          <TabsTrigger value="status-events" className={tabTriggerCls}>
            <History />
            Status log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="mt-4">
          <AgentPerformanceTab agentId={agentId} />
        </TabsContent>
        <TabsContent value="processes" className="mt-4">
          <AgentProcessesTab agentId={agentId} os={agent?.os} />
        </TabsContent>
        <TabsContent value="hardware" className="mt-4">
          <AgentHardwareTab agentId={agentId} />
        </TabsContent>
        <TabsContent value="software" className="mt-4">
          <AgentSoftwareTab agentId={agentId} />
        </TabsContent>
        <TabsContent value="network" className="mt-4">
          <NetworkOverviewPage agentId={agentId} />
        </TabsContent>
        <TabsContent value="disk" className="mt-4">
          <DiskOverviewPage agentId={agentId} />
        </TabsContent>

        <TabsContent value="overview" className="mt-4">
          <Card className="border-border/90 shadow-(--shadow-soft)">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Device facts</CardTitle>
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

// Shared className for every TabsTrigger on this page.
//   - cursor-pointer                          → hand cursor on hover.
//   - gap-2 px-4 text-sm + size-4 svg override → bigger pill + icon sizing.
//   - hover:text-foreground/60                → keep inactive labels muted on
//                                               hover (override shadcn's
//                                               default darken-to-foreground).
//   - data-active:hover:text-primary-foreground → restore white text when the
//                                                 user hovers the active pill
//                                                 (otherwise the line above
//                                                 would turn its label gray).
const tabTriggerCls =
  "cursor-pointer gap-2 px-4 text-sm [&_svg:not([class*='size-'])]:size-4 " +
  "hover:text-foreground/60 data-active:hover:text-primary-foreground";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 break-words text-foreground">{value}</div>
    </div>
  );
}
