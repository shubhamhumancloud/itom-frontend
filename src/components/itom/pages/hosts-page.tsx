'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  ExternalLink,
  Loader2,
  ListChecks,
  Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingOverlay, TableSkeleton, useColdLoad } from '@/components/ui/loaders';
import { PageHeader } from '@/components/app/page-header';
import { collectorsApi, discoveryApi, type DiscoveryHostRow } from '@/lib/api';

const ALL_COLLECTORS = '__all__';

type SortKey =
  | 'availability'
  | 'hostname'
  | 'ip'
  | 'mac'
  | 'vendor'
  | 'kind'
  | 'ports'
  | 'lastSeenAt';

type SortDir = 'asc' | 'desc';

const KIND_DOT: Record<DiscoveryHostRow['kind'], string> = {
  firewall: 'bg-red-500',
  router: 'bg-blue-500',
  switch: 'bg-cyan-500',
  server: 'bg-green-500',
  workstation: 'bg-purple-500',
  printer: 'bg-fuchsia-500',
  camera: 'bg-orange-500',
  iot: 'bg-amber-400',
  unknown: 'bg-slate-400',
};

/**
 * Discovery → Hosts page. Flat Advanced-IP-Scanner-style table over
 * every discovered device for the tenant. Columns: Status · Hostname
 * · IP · MAC · Vendor · Kind · Ports · Last seen. Sortable, searchable,
 * exportable to CSV.
 *
 * Data source: GET /v1/discovery/hosts (TopologyService.listHosts).
 * The same Postgres rows that drive the topology graph also drive this
 * table — clicking any row jumps to the device's detail panel on the
 * topology page.
 */
export function HostsPage() {
  const qc = useQueryClient();

  const [searchInput, setSearchInput] = useState('');
  const [kindFilter, setKindFilter] = useState<string>('__all__');
  const [statusFilter, setStatusFilter] = useState<string>('__all__');
  const [collectorFilter, setCollectorFilter] = useState<string>(ALL_COLLECTORS);
  const [sortKey, setSortKey] = useState<SortKey>('ip');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const collectors = useQuery({
    queryKey: ['discovery', 'collectors'],
    queryFn: () => collectorsApi.list(),
    refetchInterval: 15_000,
  });

  // Default to the first available collector so the user sees data
  // scoped to ONE source out of the box (not a mash-up of demo seed +
  // every scan ever). The ref guards us against the 15s background
  // refetch — once the user picks "All" or another collector, we
  // never auto-override their choice.
  const defaultAppliedRef = useRef(false);
  useEffect(() => {
    if (defaultAppliedRef.current) return;
    if (collectors.data && collectors.data.length > 0) {
      setCollectorFilter(collectors.data[0].id);
      defaultAppliedRef.current = true;
    }
  }, [collectors.data]);

  const hosts = useQuery({
    queryKey: ['discovery', 'hosts', searchInput, collectorFilter],
    queryFn: () =>
      discoveryApi.hosts({
        q: searchInput || undefined,
        limit: 1000,
        collectorId:
          collectorFilter === ALL_COLLECTORS ? undefined : collectorFilter,
      }),
    refetchInterval: 15_000,
  });

  const showOverlay = useColdLoad(
    hosts.isLoading,
    (hosts.data?.length ?? 0) > 0,
  );

  const rows = useMemo(() => {
    const filtered = (hosts.data ?? []).filter((h) => {
      if (kindFilter !== '__all__' && h.kind !== kindFilter) return false;
      if (statusFilter !== '__all__' && h.availability !== statusFilter) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => cmp(a, b, sortKey)).reverse();
    if (sortDir === 'asc') sorted.reverse();
    return sorted;
  }, [hosts.data, kindFilter, statusFilter, sortKey, sortDir]);

  const counts = useMemo(() => {
    const c = { up: 0, down: 0, unknown: 0, total: (hosts.data ?? []).length };
    for (const h of hosts.data ?? []) {
      if (h.availability === 'up') c.up++;
      else if (h.availability === 'down') c.down++;
      else c.unknown++;
    }
    return c;
  }, [hosts.data]);

  const exportCsv = () => {
    const header = ['Status', 'Hostname', 'IP', 'MAC', 'Vendor', 'Kind', 'Ports', 'Last seen'];
    const lines = [header.join(',')];
    for (const h of rows) {
      lines.push(
        [
          h.availability,
          csvEscape(h.hostname ?? ''),
          h.ip ?? '',
          h.mac ?? '',
          csvEscape(h.vendor ?? ''),
          h.kind,
          csvEscape(h.ports.map((p) => p.port).join(' ')),
          h.lastSeenAt ?? '',
        ].join(','),
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `itom-hosts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-6 overflow-y-auto px-6 py-6">
      <LoadingOverlay isLoading={showOverlay} />
      <PageHeader
        title="Hosts"
        description="Every discovered device — hostname, IP, MAC, open ports. Click a row to jump to its detail on the topology page."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ['discovery', 'hosts'] })}
              disabled={hosts.isFetching}
            >
              <Loader2 className={`mr-1 h-4 w-4 ${hosts.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="mr-1 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">
              {counts.total} host{counts.total === 1 ? '' : 's'}
            </CardTitle>
            <Badge variant="outline" className="border-green-500/40 text-green-700 dark:text-green-400">
              ● {counts.up} up
            </Badge>
            {counts.down > 0 && (
              <Badge variant="outline" className="border-red-500/40 text-red-700 dark:text-red-400">
                ● {counts.down} down
              </Badge>
            )}
            {counts.unknown > 0 && (
              <Badge variant="outline">{counts.unknown} unknown</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="w-64 pl-8 text-sm"
                placeholder="Search hostname"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Select
              value={collectorFilter}
              onValueChange={(v) => setCollectorFilter(v || ALL_COLLECTORS)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Collector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_COLLECTORS}>All collectors</SelectItem>
                {(collectors.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          c.status === 'online'
                            ? 'bg-green-500'
                            : c.status === 'offline'
                            ? 'bg-red-500'
                            : 'bg-amber-500'
                        }`}
                      />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={kindFilter} onValueChange={(v) => setKindFilter(v || '__all__')}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All kinds</SelectItem>
                {(Object.keys(KIND_DOT) as Array<keyof typeof KIND_DOT>).map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || '__all__')}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All status</SelectItem>
                <SelectItem value="up">up</SelectItem>
                <SelectItem value="down">down</SelectItem>
                <SelectItem value="unknown">unknown</SelectItem>
                <SelectItem value="maintenance">maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {hosts.isLoading ? (
            <TableSkeleton rows={8} columns={7} className="m-3 border-none" />
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No hosts discovered yet. Run a{' '}
              <Link href="/discovery/scan" className="underline underline-offset-2">
                network scan
              </Link>{' '}
              to populate this table.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-xs">
                  <tr>
                    <Th
                      label="Status"
                      sortKey="availability"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={(k) => toggleSort(k, sortKey, sortDir, setSortKey, setSortDir)}
                      className="w-20"
                    />
                    <Th
                      label="Hostname"
                      sortKey="hostname"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={(k) => toggleSort(k, sortKey, sortDir, setSortKey, setSortDir)}
                    />
                    <Th
                      label="IP"
                      sortKey="ip"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={(k) => toggleSort(k, sortKey, sortDir, setSortKey, setSortDir)}
                    />
                    <Th
                      label="MAC"
                      sortKey="mac"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={(k) => toggleSort(k, sortKey, sortDir, setSortKey, setSortDir)}
                    />
                    <Th
                      label="Vendor"
                      sortKey="vendor"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={(k) => toggleSort(k, sortKey, sortDir, setSortKey, setSortDir)}
                    />
                    <Th
                      label="Kind"
                      sortKey="kind"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={(k) => toggleSort(k, sortKey, sortDir, setSortKey, setSortDir)}
                    />
                    <Th
                      label="Ports"
                      sortKey="ports"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={(k) => toggleSort(k, sortKey, sortDir, setSortKey, setSortDir)}
                    />
                    <Th
                      label="Last seen"
                      sortKey="lastSeenAt"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={(k) => toggleSort(k, sortKey, sortDir, setSortKey, setSortDir)}
                    />
                    <th className="px-3 py-2 text-left font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((h) => (
                    <HostRow key={h.id} h={h} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Th({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === activeKey;
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={`px-3 py-2 text-left font-medium ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${active ? 'text-foreground' : 'text-muted-foreground'}`}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

function HostRow({ h }: { h: DiscoveryHostRow }) {
  const statusDotColour =
    h.availability === 'up'
      ? 'bg-green-500'
      : h.availability === 'down'
      ? 'bg-red-500'
      : 'bg-slate-400';
  const portsDisplay = h.ports.slice(0, 6).map((p) => p.port).join(', ');
  const portsMore = h.ports.length > 6 ? ` +${h.ports.length - 6}` : '';
  const kindDot = KIND_DOT[h.kind] ?? KIND_DOT.unknown;
  return (
    <tr className="border-b transition hover:bg-muted/30">
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className={`inline-block h-2 w-2 rounded-full ${statusDotColour}`} />
          {h.availability}
        </span>
      </td>
      <td className="px-3 py-2 font-medium" title={h.identityKey}>
        {h.hostname ?? <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-2 font-mono text-xs">
        {h.ip ?? <span className="text-muted-foreground">—</span>}
        {h.ips.length > 1 && (
          <span className="ml-1 text-[10px] text-muted-foreground" title={h.ips.join(', ')}>
            +{h.ips.length - 1}
          </span>
        )}
      </td>
      <td className="px-3 py-2 font-mono text-xs">
        {h.mac ?? <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-2 text-xs">
        {h.vendor ?? <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className={`inline-block h-2 w-2 rounded-full ${kindDot}`} />
          {h.kind}
        </span>
      </td>
      <td className="px-3 py-2 font-mono text-xs" title={h.ports.map((p) => `${p.port}/${p.protocol}${p.service ? ' ' + p.service : ''}`).join('\n')}>
        {h.ports.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <>
            {portsDisplay}
            <span className="text-muted-foreground">{portsMore}</span>
          </>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground" title={h.lastSeenAt ?? undefined}>
        {h.lastSeenAt ? timeAgo(h.lastSeenAt) : 'never'}
      </td>
      <td className="px-3 py-2 text-right">
        <Link
          href={`/discovery/topology?device=${encodeURIComponent(h.id)}`}
          className="inline-flex items-center text-xs text-primary hover:underline"
        >
          Open
          <ExternalLink className="ml-0.5 h-3 w-3" />
        </Link>
      </td>
    </tr>
  );
}

// ----- helpers ----------------------------------------------------------

function cmp(a: DiscoveryHostRow, b: DiscoveryHostRow, key: SortKey): number {
  switch (key) {
    case 'ip':
      return ipToInt(a.ip) - ipToInt(b.ip);
    case 'ports':
      return a.ports.length - b.ports.length;
    case 'lastSeenAt': {
      const ta = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
      const tb = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
      return ta - tb;
    }
    case 'availability':
    case 'hostname':
    case 'mac':
    case 'vendor':
    case 'kind':
      return (a[key] ?? '').toString().localeCompare((b[key] ?? '').toString());
  }
}

function ipToInt(ip: string | null): number {
  if (!ip) return 0;
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p))) return 0;
  return (parts[0] << 24 >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function toggleSort(
  next: SortKey,
  current: SortKey,
  currentDir: SortDir,
  setKey: (k: SortKey) => void,
  setDir: (d: SortDir) => void,
) {
  if (next === current) {
    setDir(currentDir === 'asc' ? 'desc' : 'asc');
  } else {
    setKey(next);
    setDir('asc');
  }
}

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
}

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
