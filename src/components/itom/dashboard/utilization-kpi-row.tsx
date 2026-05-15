'use client';

import { AlertTriangle, Cpu, HardDrive, MemoryStick } from 'lucide-react';
import { KpiCard, type KpiTone } from '@/components/itom/kpi-card';
import { KpiCardSkeleton } from '@/components/ui/loaders';
import type { FleetStats, MetricStats } from '@/hooks/use-itom';
import { formatPercent } from '@/lib/format';

/**
 * Row 2 — Fleet posture.
 *
 * Aggregate utilization (no per-host hostnames — that doesn't scale)
 * with a p50/p95/max sub-line so the operator can see the spread
 * behind the average at a glance. Tile colour shifts green → yellow
 * (>70%) → rose (>85%) so a stressed fleet pages the eye on its own.
 */
export function UtilizationKpiRow({
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

  const utilTone = (avg: number): KpiTone =>
    avg >= 85 ? 'rose' : avg >= 70 ? 'yellow' : 'green';
  const issueTone = (n: number): KpiTone => (n > 0 ? 'rose' : 'green');

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Total Issues"
        value={stats.issues}
        icon={AlertTriangle}
        tone={issueTone(stats.issues)}
        descriptor={stats.issues === 0 ? 'all clear' : 'offline + unknown'}
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
  );
}

function percentileSummary(m: MetricStats): string {
  return `p50 ${Math.round(m.p50)}% · p95 ${Math.round(m.p95)}% · max ${Math.round(m.max)}%`;
}
