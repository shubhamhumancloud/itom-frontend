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

export function useAgentDiskHealth(agentId: string) {
  return useQuery({
    queryKey: ['disk-health', agentId],
    queryFn: () => observabilityApi.diskHealth(agentId),
    enabled: !!agentId,
    refetchInterval: 60_000,
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
