'use client';

import {
  HeartPulse,
  Network,
  ServerOff,
  Users,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { KpiCard, type KpiTone } from '@/components/itom/kpi-card';
import { KpiCardSkeleton } from '@/components/ui/loaders';
import type { FleetStats } from '@/hooks/use-itom';
import { discoveryApi } from '@/lib/api';

/**
 * Row 1 — Fleet attention.
 *
 * Four headline counts that should be zero for a healthy fleet:
 * total agents, offline, unknown/stale, healthy. The peach tile on
 * the "Total Agents" KPI grounds the row in brand identity; the
 * remaining tiles flip to rose / orange / green based on real state
 * so the eye lands on what's broken first.
 *
 * Stays a separate component (rather than inlining in the dashboard)
 * so the same row can be reused on a future "Fleet Overview" page or
 * embedded inside an org-wide multi-fleet view without duplicating
 * the tone logic.
 */
export function FleetKpiRow({
  stats,
  isLoading,
}: {
  stats: FleetStats;
  isLoading: boolean;
}) {
  // Discovered hosts come from a separate API (TopologyService.listHosts)
  // — they're devices observed on the network, not necessarily agents.
  // We count them here so the "Total Hosts" tile reflects discovery
  // results independently of agent enrolment.
  const hostsQ = useQuery({
    queryKey: ['discovery', 'hosts', 'count'],
    queryFn: () => discoveryApi.hosts({}),
  });
  const totalHosts = hostsQ.data?.length ?? 0;

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const issueTone = (n: number): KpiTone => (n > 0 ? 'rose' : 'green');

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Total Agents"
        value={stats.totalAgents}
        icon={Users}
        tone="peach"
        descriptor={`${stats.online} online · ${stats.offline} offline`}
        descriptorTone="muted"
      />
      <KpiCard
        label="Total Hosts"
        value={totalHosts}
        icon={Network}
        tone="indigo"
        descriptor={
          totalHosts === 0 ? 'no hosts discovered' : 'discovered on network'
        }
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
        label="Healthy Agents"
        value={stats.healthy}
        icon={HeartPulse}
        tone="green"
        descriptor={`${pct(stats.healthy, stats.totalAgents)} of fleet`}
        descriptorTone="success"
      />
    </div>
  );
}

function pct(part: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}
