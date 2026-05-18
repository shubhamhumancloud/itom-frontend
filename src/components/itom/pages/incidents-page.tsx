'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingOverlay, TableSkeleton, useColdLoad } from '@/components/ui/loaders';
import { PageHeader } from '@/components/app/page-header';
import { KpiCard } from '@/components/itom/kpi-card';
import {
  AlertSeverityBadge,
  IncidentStatusBadge,
} from '@/components/itom/alert-badges';
import { IncidentRulesTab } from '@/components/itom/pages/incident-rules-tab';
import {
  useAlertsSummary,
  useIncidentActions,
  useIncidents,
} from '@/hooks/use-itom';
import { formatRelativeTime } from '@/lib/format';

/**
 * Alerts & Incidents — the operator's view of everything the threshold
 * evaluator has flagged. Two tabs: tracked Incidents (correlated, with
 * ack/resolve actions) and the threshold Rules a tenant can tune.
 */
export function IncidentsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'open' | 'acknowledged' | 'resolved'
  >('all');
  const incidentsQ = useIncidents(
    statusFilter === 'all' ? undefined : statusFilter,
  );
  const summaryQ = useAlertsSummary();
  const { acknowledge, resolve } = useIncidentActions();

  const incidents = incidentsQ.data ?? [];
  const summary = summaryQ.data;
  const showOverlay = useColdLoad(incidentsQ.isLoading, incidents.length > 0);

  return (
    <div className="w-full space-y-6">
      <LoadingOverlay isLoading={showOverlay} />
      <PageHeader
        title="Alerts & Incidents"
        description="Threshold breaches detected across the fleet, correlated into incidents."
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Open incidents"
          value={summary?.openIncidents ?? 0}
          tone="indigo"
          icon={BellRing}
        />
        <KpiCard
          label="Critical"
          value={summary?.criticalIncidents ?? 0}
          tone="rose"
          icon={AlertTriangle}
        />
        <KpiCard
          label="Acknowledged"
          value={summary?.acknowledgedIncidents ?? 0}
          tone="yellow"
          icon={ShieldCheck}
        />
        <KpiCard
          label="Firing alerts"
          value={summary?.firingAlerts ?? 0}
          tone="orange"
          icon={CheckCircle2}
        />
      </div>

      <Tabs defaultValue="incidents" className="w-full">
        <TabsList>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
        </TabsList>

        {/* ───────────── Incidents tab ───────────── */}
        <TabsContent value="incidents" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
            >
              <SelectTrigger className="!h-10 w-[160px] !rounded-md bg-white">
                <SelectValue>
                  {
                    {
                      all: 'All statuses',
                      open: 'Open',
                      acknowledged: 'Acknowledged',
                      resolved: 'Resolved',
                    }[statusFilter]
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {incidentsQ.isLoading ? (
            <TableSkeleton rows={6} columns={7} />
          ) : incidents.length === 0 ? (
            <EmptyState message="No incidents — every monitored threshold is within range." />
          ) : (
            <Card className="!p-0">
              <CardContent className="!p-0">
                <div className="max-h-[calc(100vh-360px)] min-h-[320px] overflow-y-auto">
                  <Table className="table-fixed">
                    <TableHeader className="!bg-card [&_th]:!border-b-0">
                      <TableRow>
                        <TableHead className="w-[10%]">Severity</TableHead>
                        <TableHead className="w-[28%]">Incident</TableHead>
                        <TableHead className="w-[11%]">Category</TableHead>
                        <TableHead className="w-[11%]">Status</TableHead>
                        <TableHead className="w-[10%]">Opened</TableHead>
                        <TableHead className="w-[8%] text-center">Alerts</TableHead>
                        <TableHead className="w-[22%] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incidents.map((inc) => {
                        const ready =
                          inc.status !== 'resolved' &&
                          inc.firingAlertCount === 0;
                        return (
                          <TableRow
                            key={inc.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => router.push(`/alerts/${inc.id}`)}
                          >
                            <TableCell>
                              <AlertSeverityBadge severity={inc.severity} />
                            </TableCell>
                            <TableCell
                              className="truncate font-medium text-foreground"
                              title={inc.title}
                            >
                              {inc.title}
                              {ready && (
                                <span className="ml-2 text-[11px] font-normal text-emerald-600">
                                  · ready to close
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="capitalize text-muted-foreground">
                              {inc.category}
                            </TableCell>
                            <TableCell>
                              <IncidentStatusBadge status={inc.status} />
                            </TableCell>
                            <TableCell className="truncate text-muted-foreground">
                              {formatRelativeTime(inc.openedAt)}
                            </TableCell>
                            <TableCell className="text-center tabular-nums text-muted-foreground">
                              {inc.firingAlertCount}/{inc.alertCount}
                            </TableCell>
                            <TableCell
                              className="text-right"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  disabled={
                                    inc.status !== 'open' ||
                                    acknowledge.isPending
                                  }
                                  onClick={() => acknowledge.mutate(inc.id)}
                                >
                                  Acknowledge
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-8"
                                  disabled={
                                    inc.status === 'resolved' ||
                                    resolve.isPending
                                  }
                                  onClick={() => resolve.mutate(inc.id)}
                                >
                                  Resolve
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ───────────── Rules tab ───────────── */}
        <TabsContent value="rules" className="mt-4">
          <IncidentRulesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/** Format a metric value with the right unit for its metric type. */
export function formatMetricValue(metric: string, value: number): string {
  if (metric === 'agent_offline') return '—';
  if (metric === 'agent_flapping') return `${value.toFixed(0)}×`;
  if (metric === 'gpu_temp' || metric === 'cpu_temp')
    return `${value.toFixed(1)} °C`;
  if (metric === 'net_throughput') return `${value.toFixed(1)} Mbps`;
  return `${value.toFixed(1)}%`;
}
