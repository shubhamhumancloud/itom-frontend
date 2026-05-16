'use client';

import { useMemo } from 'react';
import { LoadingOverlay, useColdLoad } from '@/components/ui/loaders';
import { useAgents, useFleetStats, useOsDistribution } from '@/hooks/use-itom';
import { PageHeader } from '@/components/app/page-header';
import { FleetKpiRow } from './dashboard/fleet-kpi-row';
import { IncidentsCard } from './dashboard/incidents-card';
import { OsDistributionCard } from './dashboard/os-distribution-card';
import { DistributionHistogramRow } from './dashboard/distribution-histogram-row';

/**
 * Fleet-operations dashboard — composed from row components in
 * `./dashboard/*` so each row owns its layout, colour logic, and
 * empty states independently. Mirrors the acai Hear admin dashboard
 * pattern (separate KPI / table / chart cards rather than one giant
 * file) so future pages can reuse the same primitives.
 *
 * Vertical rhythm: outer `space-y-6` between PageHeader and content,
 * inner `space-y-4` between rows, `gap-4` inside each grid — matches
 * Hear's 24px / 16px / 16px page rhythm exactly.
 *
 * Rows
 *   1. Fleet attention    — counts that should be zero
 *   2. Latest incidents + OS distribution
 *   3. CPU / Memory / Disk distribution histograms
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
  const incidents = useMemo(
    () =>
      (agentsQ.data ?? [])
        .filter((a) => a.status !== 'online')
        .slice()
        .sort(
          (a, b) =>
            new Date(b.statusChangedAt).getTime() -
            new Date(a.statusChangedAt).getTime(),
        )
        .slice(0, 10),
    [agentsQ.data],
  );

  return (
    <div className="space-y-6">
      <LoadingOverlay isLoading={showOverlay} />

      <PageHeader
        title="Dashboard"
        description="Live operations view across your ITOM fleet"
      />

      <div className="space-y-4">
        <FleetKpiRow stats={stats} isLoading={isLoading} />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <IncidentsCard incidents={incidents} />
          </div>
          <OsDistributionCard data={osQ.data ?? []} />
        </div>

        <DistributionHistogramRow stats={stats} />
      </div>
    </div>
  );
}
