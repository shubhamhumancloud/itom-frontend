'use client';

import {
  HeartPulse,
  HelpCircle,
  ServerOff,
  Users,
} from 'lucide-react';
import { KpiCard, type KpiTone } from '@/components/itom/kpi-card';
import { KpiCardSkeleton } from '@/components/ui/loaders';
import type { FleetStats } from '@/hooks/use-itom';

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
  const unknownTone = (n: number): KpiTone => (n > 0 ? 'orange' : 'green');

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
  );
}

function pct(part: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}
