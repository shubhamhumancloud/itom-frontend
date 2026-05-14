'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitBranch, RefreshCw, Search, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InlineLoader, LoadingOverlay, useColdLoad } from '@/components/ui/loaders';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/app/page-header';
import { discoveryApi, type DiscoveryDevice, type DiscoveryTopology } from '@/lib/api';
import { TopologyGraph } from './topology-graph';
import { DeviceDetailPanel } from './device-detail-panel';

/**
 * Top-level Network Topology page. Three columns:
 *  - Left: device list (searchable)
 *  - Middle: the Cytoscape graph
 *  - Right: detail panel for the selected device
 *
 * If there's no data yet, prominently offer "Seed demo data" so the
 * operator can preview the page without standing up real gear.
 */
export function TopologyPage() {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const topology = useQuery<DiscoveryTopology>({
    queryKey: ['discovery', 'topology'],
    queryFn: () => discoveryApi.topology(),
    refetchInterval: 30_000,
  });

  const devices = useQuery<DiscoveryDevice[]>({
    queryKey: ['discovery', 'devices', search],
    queryFn: () => discoveryApi.devices({ q: search || undefined, limit: 200 }),
    refetchInterval: 30_000,
  });

  const seedDemo = useMutation({
    mutationFn: () => discoveryApi.seedDemo(),
    onSuccess: (r) => {
      toast.success(`Demo data seeded — ${r.observations} observations`);
      qc.invalidateQueries({ queryKey: ['discovery'] });
    },
    onError: (e: any) => toast.error(`Seed failed: ${e.message ?? e}`),
  });

  const clearDemo = useMutation({
    mutationFn: () => discoveryApi.clearDemo(),
    onSuccess: (r) => {
      if (r.devices === 0 && r.scanJobs === 0) {
        toast.info('No demo data to clear');
      } else {
        toast.success(
          `Cleared demo — ${r.devices} devices, ${r.edges} edges, ${r.observations} observations`,
        );
      }
      setSelectedDeviceId(null);
      qc.invalidateQueries({ queryKey: ['discovery'] });
    },
    onError: (e: any) => toast.error(`Clear failed: ${e.message ?? e}`),
  });

  const empty = (topology.data?.nodes.length ?? 0) === 0 && !topology.isLoading;
  const showOverlay = useColdLoad(
    topology.isLoading || devices.isLoading,
    (topology.data?.nodes.length ?? 0) > 0 || (devices.data?.length ?? 0) > 0,
  );

  // Filter devices by search client-side too so we can highlight in the
  // graph immediately while the network request lands.
  const matchedDeviceIds = useMemo(() => {
    if (!search.trim() || !devices.data) return new Set<string>();
    const q = search.trim().toLowerCase();
    return new Set(
      devices.data
        .filter(
          (d) =>
            (d.hostname ?? '').toLowerCase().includes(q) ||
            (d.managementIp ?? '').toLowerCase().includes(q) ||
            (d.identityKey ?? '').toLowerCase().includes(q),
        )
        .map((d) => d.id),
    );
  }, [search, devices.data]);

  // Auto-select first device when none chosen but list arrives.
  useEffect(() => {
    if (!selectedDeviceId && devices.data && devices.data.length > 0) {
      setSelectedDeviceId(devices.data[0].id);
    }
  }, [devices.data, selectedDeviceId]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-6 px-6 py-6">
      <LoadingOverlay isLoading={showOverlay} />
      <PageHeader
        title="Network Topology"
        description="Fused view of every device the collectors discovered. Click any node for details."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                topology.refetch();
                devices.refetch();
              }}
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => seedDemo.mutate()}
              disabled={seedDemo.isPending}
            >
              <Sparkles className="mr-1 h-4 w-4" />
              {seedDemo.isPending ? 'Seeding…' : 'Seed demo data'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (window.confirm('Wipe all demo-seeded devices, edges, and observations for this tenant? Real discovery data is not touched.')) {
                  clearDemo.mutate();
                }
              }}
              disabled={clearDemo.isPending}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              {clearDemo.isPending ? 'Clearing…' : 'Clear demo data'}
            </Button>
          </div>
        }
      />

      {empty ? (
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>No devices discovered yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Run a scan job from a connected collector, or click <b>Seed demo data</b>
              {' '}above to plant a synthetic 6-device network so you can preview the UI.
            </p>
            <p>
              Once observations arrive, fusion produces typed device + edge rows
              and this graph appears automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid flex-1 grid-cols-[260px_1fr_360px] gap-4 overflow-hidden">
          {/* Left — device list */}
          <Card className="flex flex-col overflow-hidden">
            <CardHeader className="space-y-2 pb-2">
              <CardTitle className="text-sm">Devices</CardTitle>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8 text-sm"
                  placeholder="Search hostname or IP"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-1 overflow-y-auto pt-2 text-sm">
              {devices.isLoading ? (
                <div className="space-y-1.5 px-1 py-1">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-7 w-full rounded-md" />
                  ))}
                </div>
              ) : (
                (devices.data ?? []).map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDeviceId(d.id)}
                    className={
                      'flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left transition ' +
                      (selectedDeviceId === d.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-accent')
                    }
                  >
                    <span className="font-medium">
                      {d.hostname ?? d.managementIp ?? d.identityKey}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {d.kind} · {d.managementIp ?? '—'}
                    </span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {/* Middle — graph */}
          <Card className="flex flex-col overflow-hidden">
            <CardContent className="flex-1 p-0">
              <TopologyGraph
                data={topology.data}
                loading={topology.isLoading}
                selectedDeviceId={selectedDeviceId}
                onSelect={setSelectedDeviceId}
                highlightDeviceIds={matchedDeviceIds}
              />
            </CardContent>
          </Card>

          {/* Right — detail panel */}
          <Card className="flex flex-col overflow-hidden">
            <DeviceDetailPanel deviceId={selectedDeviceId} />
          </Card>
        </div>
      )}
    </div>
  );
}
