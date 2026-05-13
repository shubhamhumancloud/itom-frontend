import { readCookieValue } from '@/lib/auth';

export type Agent = {
  agentId: string;
  agentVersion: string;
  fingerprintHash: string | null;
  hostname: string;
  os: string;
  arch: string;
  platform: string;
  platformVersion: string;
  kernelVersion: string;
  ethernetIPs: string[];
  wifiIPs: string[];
  macAddresses: string[];
  cpuModel: string;
  cpuCores: number;
  totalMemoryBytes: number;
  totalDiskBytes: number;
  registeredAt: string;
  lastSeenAt: string;
  status: 'online' | 'offline' | 'unknown';
  statusChangedAt: string;
};

export type Metric = {
  id: string;
  agentId: string;
  timestamp: string;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  memAvailableBytes: number | null;
  loadAvg1m: number | null;
  processCount: number | null;
  createdAt: string;
};

export type NetworkMetric = {
  id: string;
  agentId: string;
  interfaceName: string;
  timestamp: string;
  bytesSent: number;
  bytesRecv: number;
  packetsSent: number;
  packetsRecv: number;
  createdAt: string;
};

export type DiskMetric = {
  id: string;
  agentId: string;
  mountpoint: string;
  timestamp: string;
  usedPercent: number;
  usedBytes: number;
  totalBytes: number;
  createdAt: string;
};

type ApiErrorBody = { message?: string; error?: string };

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody | null;
  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.message || body?.error || `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function getApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) return process.env.NEXT_PUBLIC_API_BASE_URL;
  // In the browser, prefer talking to the backend on the SAME hostname but
  // port 3007. This works for both http://localhost:8080/itom and
  // http://dev.acai.localhost:8080/itom without needing Caddy to proxy
  // /itom/api/* to the backend.
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3007`;
  }
  return 'http://localhost:3007';
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = getApiBaseUrl();
  const token = readCookieValue('accessToken') ?? readCookieValue('itom_accessToken');
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${base}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && typeof window !== 'undefined') {
    document.cookie = 'accessToken=; path=/; max-age=0';
    document.cookie = 'itom_accessToken=; path=/; max-age=0';
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/itom/login?next=${encodeURIComponent(next)}`;
    throw new ApiError(401, { message: 'Unauthorized' });
  }

  if (!response.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = null;
    }
    throw new ApiError(response.status, body);
  }

  return (await response.json()) as T;
}

export interface InstallTokenResponse {
  token: string;
  expiresAt: string;
  tenantId: string;
  publicUrl: string;
  commands: {
    sh: string;
    ps1: string;
  };
}

export const agentsApi = {
  list: () => apiFetch<Agent[]>('/v1/agents'),
  get: (id: string) => apiFetch<Agent>(`/v1/agents/${id}`),
  statusEvents: (agentId: string, limit = 100) =>
    apiFetch<Array<{ id: string; agentId: string; tenantId: string | null; status: 'online' | 'offline'; occurredAt: string; agentVersion: string | null; createdAt: string }>>(
      `/v1/agents/${agentId}/status-events?limit=${limit}`,
    ),
  claimOrphans: () =>
    apiFetch<{ updatedAgents: number; error?: string }>('/v1/agents/claim-orphans', {
      method: 'POST',
    }),
  createInstallToken: () =>
    apiFetch<InstallTokenResponse>('/v1/agents/install-tokens', {
      method: 'POST',
    }),
};

export const metricsApi = {
  list: (params: { agentId?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params.agentId) query.set('agentId', params.agentId);
    query.set('limit', String(params.limit ?? 100));
    return apiFetch<Metric[]>(`/v1/metrics?${query.toString()}`);
  },
  agents: () => apiFetch<Array<{ agentId: string; lastSeen: string; sampleCount: number }>>('/v1/metrics/agents'),
};

export const networkApi = {
  list: (params: { agentId?: string; interfaceName?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params.agentId) query.set('agentId', params.agentId);
    if (params.interfaceName) query.set('interfaceName', params.interfaceName);
    if (params.limit) query.set('limit', String(params.limit));
    return apiFetch<NetworkMetric[]>(`/v1/metrics/network?${query.toString()}`);
  },
};

export const diskApi = {
  list: (params: { agentId?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params.agentId) query.set('agentId', params.agentId);
    if (params.limit) query.set('limit', String(params.limit));
    return apiFetch<DiskMetric[]>(`/v1/metrics/disk?${query.toString()}`);
  },
};

// ----- Discovery / Topology -----

export type DiscoveryDeviceKind =
  | 'firewall'
  | 'router'
  | 'switch'
  | 'server'
  | 'workstation'
  | 'printer'
  | 'camera'
  | 'iot'
  | 'unknown';

export type DiscoveryNode = {
  data: {
    id: string;
    label: string;
    kind: DiscoveryDeviceKind;
    vendor: string | null;
    model: string | null;
    identityKey: string;
    managementIp: string | null;
    availability: 'up' | 'down' | 'unknown' | 'maintenance';
    lifecycle: 'active' | 'decommissioned' | 'archived';
    lastSeenAt: string | null;
    sources: string[];
  };
};

export type DiscoveryEdge = {
  data: {
    id: string;
    source: string;
    target: string;
    kind: 'lldp' | 'cdp' | 'l3_adjacency' | 'ipsec_tunnel' | 'arp';
    fromIfIndex: number | null;
    toIfIndex: number | null;
    lastSeenAt: string | null;
  };
};

export type DiscoveryTopology = {
  nodes: DiscoveryNode[];
  edges: DiscoveryEdge[];
};

export type DiscoveryDevice = DiscoveryNode['data'] & {
  hostname: string | null;
  chassisSerial: string | null;
  sysDescr: string | null;
};

export type DiscoveryDeviceDetail = {
  device: DiscoveryDevice;
  interfaces: Array<{
    id: string;
    ifIndex: number;
    name: string;
    description: string | null;
    type: string | null;
    speedBps: string;
    mac: string | null;
    adminStatus: string;
    operStatus: string;
    zone: string | null;
  }>;
  ips: Array<{ id: string; ip: string; prefixLen: number | null; interfaceId: string }>;
  openPorts: Array<{
    id: string;
    port: number;
    protocol: string;
    service: string | null;
    banner: string | null;
    tlsCertCn: string | null;
    tlsCertSans: string[];
  }>;
  events: Array<{
    id: string;
    kind: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
  neighbors: {
    incoming: DiscoveryEdge['data'][];
    outgoing: DiscoveryEdge['data'][];
  };
};

export const discoveryApi = {
  sites: () =>
    apiFetch<Array<{ id: string; name: string; description: string | null }>>(
      '/v1/discovery/sites',
    ),
  topology: (siteId?: string) => {
    const q = siteId ? `?siteId=${encodeURIComponent(siteId)}` : '';
    return apiFetch<DiscoveryTopology>(`/v1/discovery/topology${q}`);
  },
  devices: (params: { q?: string; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiFetch<DiscoveryDevice[]>(
      `/v1/discovery/devices${qs ? `?${qs}` : ''}`,
    );
  },
  device: (id: string) =>
    apiFetch<DiscoveryDeviceDetail>(`/v1/discovery/devices/${id}`),
  seedDemo: () =>
    apiFetch<{ sessionId: string; observations: number }>(
      '/v1/discovery/demo/seed',
      { method: 'POST' },
    ),
  clearDemo: () =>
    apiFetch<{
      scanJobs: number;
      sessions: number;
      observations: number;
      devices: number;
      edges: number;
    }>('/v1/discovery/demo/seed', { method: 'DELETE' }),
  hosts: (params: { q?: string; limit?: number; collectorId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.collectorId) qs.set('collectorId', params.collectorId);
    const q = qs.toString();
    return apiFetch<DiscoveryHostRow[]>(
      `/v1/discovery/hosts${q ? `?${q}` : ''}`,
    );
  },
};

export type DiscoveryHostRow = {
  id: string;
  hostname: string | null;
  ip: string | null;
  ips: string[];
  mac: string | null;
  vendor: string | null;
  model: string | null;
  kind: DiscoveryDeviceKind;
  availability: 'up' | 'down' | 'unknown' | 'maintenance';
  lifecycle: 'active' | 'decommissioned' | 'archived';
  identityKey: string;
  sysDescr: string | null;
  lastSeenAt: string | null;
  sources: string[];
  ports: Array<{
    port: number;
    protocol: string;
    service: string | null;
    banner: string | null;
    tlsCertCn: string | null;
  }>;
};

// ----- Collectors -----

export type CollectorRow = {
  id: string;
  name: string;
  allowedCidrs: string[];
  status: 'pending' | 'online' | 'offline' | 'unknown';
  lastSeenAt: string | null;
  version: string | null;
  createdAt: string;
};

export type CreateCollectorResp = CollectorRow & {
  tenantId: string;
  bearerToken: string; // shown ONCE — the BE doesn't store the plaintext
};

export const collectorsApi = {
  list: () => apiFetch<CollectorRow[]>('/v1/discovery/collectors'),
  create: (body: { name: string; allowedCidrs: string[] }) =>
    apiFetch<CreateCollectorResp>('/v1/discovery/collectors', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    apiFetch<{ scanJobs: number; sessions: number; observations: number }>(
      `/v1/discovery/collectors/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};

// ----- Scan jobs -----

export type ScanJobRow = {
  id: string;
  tenantId: string;
  collectorId: string | null;
  pillar: 'firewall' | 'active' | 'noop';
  status:
    | 'queued'
    | 'assigned'
    | 'running'
    | 'completed'
    | 'failed'
    | 'timeout'
    | 'cancelled';
  statusReason: string | null;
  targetSpec: Record<string, unknown> | null;
  credentialRefs: string[];
  createdAt: string;
  updatedAt: string;
};

export const scansApi = {
  list: (limit = 25) =>
    apiFetch<ScanJobRow[]>(`/v1/discovery/scans?limit=${limit}`),
  get: (id: string) => apiFetch<ScanJobRow>(`/v1/discovery/scans/${id}`),
  create: (body: {
    pillar: 'active' | 'firewall' | 'noop';
    collectorId?: string | null;
    targetSpec?: Record<string, unknown>;
    credentialRefs?: string[];
  }) =>
    apiFetch<ScanJobRow>('/v1/discovery/scans', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// ----- Signing pubkey (useful for the "register a collector" flow) -----

export const signingApi = {
  publicKey: () =>
    apiFetch<{ algorithm: string; publicKeyBase64: string }>(
      '/v1/discovery/signing/public-key',
    ),
};

export type DashboardSummary = {
  totalAgents: number;
  onlineAgents: number;
  offlineAgents: number;
  unknownAgents: number;
  avgCpu: number;
  avgMemory: number;
  avgDisk: number;
  totalMemoryBytes: number;
  totalDiskBytes: number;
  lastUpdatedAt: string;
};

export type ActivityTrendPoint = {
  date: string;
  heartbeats: number;
  agents: number;
};

export type OsDistributionEntry = { os: string; count: number };

export type CpuByAgentEntry = {
  agentId: string;
  hostname: string;
  os: string | null;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  status: string;
  timestamp: string | null;
};

export const dashboardApi = {
  summary: () => apiFetch<DashboardSummary>('/v1/dashboard/summary'),
  activityTrend: (days = 30) =>
    apiFetch<ActivityTrendPoint[]>(`/v1/dashboard/activity-trend?days=${days}`),
  osDistribution: () =>
    apiFetch<OsDistributionEntry[]>('/v1/dashboard/os-distribution'),
  cpuByAgent: (limit = 8) =>
    apiFetch<CpuByAgentEntry[]>(`/v1/dashboard/cpu-by-agent?limit=${limit}`),
};

// ----- Observability types (processes / battery / sensors / gpu / software) -----

export type ProcessRow = {
  agentId: string;
  timestamp: string;
  processName: string;
  pidCount: number;
  cpuPercent: number | string;
  memoryBytes: number;
  ioReadBytes: number | null;
  ioWriteBytes: number | null;
};

export type ProcessSparklinePoint = { t: string; cpu: number; mem: number };
export type ProcessSparklines = Record<string, ProcessSparklinePoint[]>;

export type BatteryRow = {
  agentId: string;
  timestamp: string;
  percent: number | string;
  charging: boolean;
  onAC: boolean;
  cycleCount: number | null;
  designCapacityMwh: number | null;
  fullCapacityMwh: number | null;
  healthPercent: number | string | null;
  timeToFullSeconds: number | null;
  timeToEmptySeconds: number | null;
};

export type SensorRow = {
  agentId: string;
  timestamp: string;
  name: string;
  kind: 'temperature_c' | 'fan_rpm';
  value: number | string;
};

export type GpuRow = {
  agentId: string;
  timestamp: string;
  gpuIndex: number;
  name: string;
  utilizationPercent: number | string;
  memoryUsedBytes: number;
  memoryTotalBytes: number;
  temperatureC: number | string | null;
  powerWatts: number | string | null;
};

export type SoftwareItem = {
  agentId: string;
  name: string;
  version: string;
  publisher: string | null;
  installedAt: string | null;
  sizeBytes: number | null;
  source: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type SoftwarePage = {
  items: SoftwareItem[];
  nextCursor: string | null;
};

export const observabilityApi = {
  processes: (agentId: string, limit = 100) =>
    apiFetch<ProcessRow[]>(`/v1/agents/${agentId}/processes?limit=${limit}`),
  processSparklines: (agentId: string, names: string[], points = 30) =>
    apiFetch<ProcessSparklines>(
      `/v1/agents/${agentId}/processes/sparklines?names=${encodeURIComponent(
        names.join(','),
      )}&points=${points}`,
    ),
  battery: (agentId: string, limit = 100) =>
    apiFetch<BatteryRow[]>(`/v1/agents/${agentId}/battery?limit=${limit}`),
  sensors: (agentId: string, kind?: 'temperature_c' | 'fan_rpm', limit = 200) => {
    const q = new URLSearchParams();
    if (kind) q.set('kind', kind);
    q.set('limit', String(limit));
    return apiFetch<SensorRow[]>(`/v1/agents/${agentId}/sensors?${q}`);
  },
  gpu: (agentId: string) =>
    apiFetch<GpuRow[]>(`/v1/agents/${agentId}/gpu`),
  gpuHistory: (agentId: string, limit = 120) =>
    apiFetch<GpuRow[]>(`/v1/agents/${agentId}/gpu/history?limit=${limit}`),
  software: (
    agentId: string,
    opts: { search?: string; cursor?: string; limit?: number } = {},
  ) => {
    const q = new URLSearchParams();
    if (opts.search) q.set('search', opts.search);
    if (opts.cursor) q.set('cursor', opts.cursor);
    if (opts.limit) q.set('limit', String(opts.limit));
    return apiFetch<SoftwarePage>(`/v1/agents/${agentId}/software?${q}`);
  },
};

export const installInfoApi = {
  get: () => apiFetch<{ itomServerUrl: string; unixCurl: string; windowsPowerShell: string }>('/v1/install-info'),
};
