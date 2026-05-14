'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  agentsApi,
  dashboardApi,
  diskApi,
  metricsApi,
  networkApi,
  observabilityApi,
  type SoftwarePage,
} from '@/lib/api';

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: dashboardApi.summary,
    refetchInterval: 15_000,
  });
}

export function useActivityTrend(days = 30) {
  return useQuery({
    queryKey: ['dashboard', 'activity-trend', days],
    queryFn: () => dashboardApi.activityTrend(days),
    refetchInterval: 60_000,
  });
}

/**
 * Per-hour status mix across the fleet for the trailing N hours.
 * Refetches every minute so the rightmost bucket grows in near-real-time.
 */
export function useStatusTimeline(hours = 24) {
  return useQuery({
    queryKey: ['dashboard', 'status-timeline', hours],
    queryFn: () => dashboardApi.statusTimeline(hours),
    refetchInterval: 60_000,
  });
}

export function useOsDistribution() {
  return useQuery({
    queryKey: ['dashboard', 'os-distribution'],
    queryFn: dashboardApi.osDistribution,
    refetchInterval: 60_000,
  });
}

export function useCpuByAgent(limit = 8) {
  return useQuery({
    queryKey: ['dashboard', 'cpu-by-agent', limit],
    queryFn: () => dashboardApi.cpuByAgent(limit),
    refetchInterval: 15_000,
  });
}

/**
 * Fleet-wide stats derived client-side from `useCpuByAgent`. Returns
 * percentiles (p50 / p95 / max) and 10-bucket histograms for each of
 * CPU / Memory / Disk, plus combined health counts.
 *
 * Designed as a drop-in replacement target: if the backend later
 * exposes `/v1/dashboard/fleet-stats` with the same shape, swap the
 * implementation without touching callers.
 *
 * Note: pulls each agent's latest metrics (~200B/agent). Fine through
 * a few thousand agents; beyond that, move the aggregation backend-side.
 */
export type FleetStats = {
  isLoading: boolean;
  totalAgents: number;
  online: number;
  offline: number;
  unknown: number;
  healthy: number;
  issues: number; // offline + unknown
  cpu: MetricStats;
  memory: MetricStats;
  disk: MetricStats;
  /**
   * Count of agents matching each "issue type" — used by the Issue
   * Breakdown chart. Categories overlap: one agent can land in
   * multiple buckets (e.g., online + CPU>85% + Mem>85%).
   */
  issueBreakdown: IssueBreakdown;
};

export type IssueBreakdown = {
  offline: number;
  unknown: number;
  cpuHigh: number; // cpuPercent ≥ 85
  memoryHigh: number;
  diskHigh: number;
};

export type MetricStats = {
  avg: number;
  p50: number;
  p95: number;
  max: number;
  buckets: number[]; // 10 buckets: [0-10), [10-20), ..., [90-100]
};

export function useFleetStats(): FleetStats {
  const q = useQuery({
    queryKey: ['dashboard', 'fleet-stats'],
    // Reuse the existing cpu-by-agent endpoint — it already returns
    // per-agent CPU/Mem/Disk + status. Big limit so we cover the fleet.
    queryFn: () => dashboardApi.cpuByAgent(10_000),
    refetchInterval: 15_000,
  });
  const rows = q.data ?? [];

  const cpuVals = rows.map((r) => Number(r.cpuPercent ?? 0));
  const memVals = rows.map((r) => Number(r.memoryPercent ?? 0));
  const diskVals = rows.map((r) => Number(r.diskPercent ?? 0));

  const online = rows.filter((r) => r.status === 'online').length;
  const offline = rows.filter((r) => r.status === 'offline').length;
  const unknown = rows.filter(
    (r) => r.status !== 'online' && r.status !== 'offline',
  ).length;

  // Categorical issue counts — overlapping by design. One stressed
  // agent can be both "CPU>85" and "Mem>85" so the bars in the Issue
  // Breakdown chart can sum to more than `totalAgents`.
  const issueBreakdown: IssueBreakdown = {
    offline,
    unknown,
    cpuHigh: rows.filter((r) => Number(r.cpuPercent ?? 0) >= 85).length,
    memoryHigh: rows.filter((r) => Number(r.memoryPercent ?? 0) >= 85).length,
    diskHigh: rows.filter((r) => Number(r.diskPercent ?? 0) >= 85).length,
  };

  return {
    isLoading: q.isLoading,
    totalAgents: rows.length,
    online,
    offline,
    unknown,
    healthy: online,
    issues: offline + unknown,
    cpu: summarize(cpuVals),
    memory: summarize(memVals),
    disk: summarize(diskVals),
    issueBreakdown,
  };
}

function summarize(values: number[]): MetricStats {
  if (!values.length) {
    return { avg: 0, p50: 0, p95: 0, max: 0, buckets: Array(10).fill(0) };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);
  const avg = sum / sorted.length;
  const p50 = percentile(sorted, 0.5);
  const p95 = percentile(sorted, 0.95);
  const max = sorted[sorted.length - 1];

  // 10 buckets covering 0–100% inclusive. The last bucket catches 100.
  const buckets = Array(10).fill(0);
  for (const v of values) {
    const i = Math.min(9, Math.max(0, Math.floor(v / 10)));
    buckets[i]++;
  }

  return { avg, p50, p95, max, buckets };
}

function percentile(sortedAsc: number[], q: number): number {
  if (!sortedAsc.length) return 0;
  const idx = (sortedAsc.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

export function useAgents() {
  return useQuery({ queryKey: ['agents'], queryFn: agentsApi.list });
}

export function useAgent(agentId: string) {
  return useQuery({
    queryKey: ['agent', agentId],
    queryFn: () => agentsApi.get(agentId),
    enabled: !!agentId,
    refetchInterval: 15_000,
  });
}

export function useAgentStatusEvents(agentId: string, limit = 100) {
  return useQuery({
    queryKey: ['status-events', agentId, limit],
    queryFn: () => agentsApi.statusEvents(agentId, limit),
    enabled: !!agentId,
    refetchInterval: 15_000,
  });
}

export function useAgentMetrics(agentId: string, limit = 100) {
  return useQuery({
    queryKey: ['metrics', agentId, limit],
    queryFn: () => metricsApi.list({ agentId, limit }),
    enabled: !!agentId,
    refetchInterval: 12_000,
  });
}

export function useFleetMetrics(limit = 300) {
  return useQuery({
    queryKey: ['metrics-fleet', limit],
    queryFn: () => metricsApi.list({ limit }),
    refetchInterval: 12_000,
  });
}

export function useAgentNetwork(agentId: string, limit = 200) {
  return useQuery({
    queryKey: ['network', agentId, limit],
    queryFn: () => networkApi.list({ agentId, limit }),
    enabled: !!agentId,
    refetchInterval: 12_000,
  });
}

export function useFleetNetwork(limit = 500) {
  return useQuery({
    queryKey: ['network-fleet', limit],
    queryFn: () => networkApi.list({ limit }),
    refetchInterval: 12_000,
  });
}

export function useAgentDisk(agentId: string, limit = 100) {
  return useQuery({
    queryKey: ['disk', agentId, limit],
    queryFn: () => diskApi.list({ agentId, limit }),
    enabled: !!agentId,
    refetchInterval: 12_000,
  });
}

export function useFleetDisk(limit = 500) {
  return useQuery({
    queryKey: ['disk-fleet', limit],
    queryFn: () => diskApi.list({ limit }),
    refetchInterval: 12_000,
  });
}

// ----- Observability -----

export function useAgentProcesses(agentId: string, limit = 100) {
  return useQuery({
    queryKey: ['processes', agentId, limit],
    queryFn: () => observabilityApi.processes(agentId, limit),
    enabled: !!agentId,
    refetchInterval: 30_000,
  });
}

export function useAgentProcessSparklines(
  agentId: string,
  names: string[],
  points = 30,
) {
  // Stable key — order-independent, content-based.
  const namesKey = [...names].sort().join('|');
  return useQuery({
    queryKey: ['process-sparks', agentId, namesKey, points],
    queryFn: () => observabilityApi.processSparklines(agentId, names, points),
    enabled: !!agentId && names.length > 0,
    refetchInterval: 30_000,
  });
}

export function useAgentBattery(agentId: string, limit = 60) {
  return useQuery({
    queryKey: ['battery', agentId, limit],
    queryFn: () => observabilityApi.battery(agentId, limit),
    enabled: !!agentId,
    refetchInterval: 60_000,
  });
}

export function useAgentSensors(
  agentId: string,
  kind?: 'temperature_c' | 'fan_rpm',
  limit = 200,
) {
  return useQuery({
    queryKey: ['sensors', agentId, kind ?? 'all', limit],
    queryFn: () => observabilityApi.sensors(agentId, kind, limit),
    enabled: !!agentId,
    refetchInterval: 30_000,
  });
}

export function useAgentGpu(agentId: string) {
  return useQuery({
    queryKey: ['gpu', agentId],
    queryFn: () => observabilityApi.gpu(agentId),
    enabled: !!agentId,
    refetchInterval: 30_000,
  });
}

export function useAgentGpuHistory(agentId: string, limit = 120) {
  return useQuery({
    queryKey: ['gpu-history', agentId, limit],
    queryFn: () => observabilityApi.gpuHistory(agentId, limit),
    enabled: !!agentId,
    refetchInterval: 30_000,
  });
}

export function useAgentSoftware(agentId: string, search: string) {
  return useInfiniteQuery({
    queryKey: ['software', agentId, search],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      observabilityApi.software(agentId, {
        search: search || undefined,
        cursor: pageParam,
        limit: 50,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: SoftwarePage) => last.nextCursor ?? undefined,
    enabled: !!agentId,
  });
}
