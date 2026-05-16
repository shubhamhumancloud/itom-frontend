'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ChevronDown, ListFilter, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingOverlay, TableSkeleton, useColdLoad } from '@/components/ui/loaders';
import { PageHeader } from '@/components/app/page-header';
import { useAgents } from '@/hooks/use-itom';
import { agentLabel, formatRelativeTime, truncateMiddle } from '@/lib/format';
import { StatusBadge } from '@/components/itom/status-badge';

export function AgentsTable() {
  const router = useRouter();
  const { data = [], isLoading } = useAgents();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [osFilter, setOsFilter] = useState<'all' | 'windows' | 'darwin' | 'linux'>('all');
  // The "More" popover holds these secondary filters — each renders as
  // its own labelled Select inside the popover, mirroring the Hear
  // pattern (Status / Time Period sections under the More button).
  const [archFilter, setArchFilter] = useState<'all' | 'amd64' | 'arm64'>('all');
  const [lastSeenFilter, setLastSeenFilter] = useState<'all' | 'recent' | 'stale'>('all');
  const showOverlay = useColdLoad(isLoading, data.length > 0);

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    const now = Date.now();
    const RECENT_MS = 5 * 60 * 1000; // last 5 minutes
    const STALE_MS = 24 * 60 * 60 * 1000; // beyond 24 hours
    return data.filter((a) => {
      const matchesSearch =
        (a.hostname ?? '').toLowerCase().includes(q) ||
        agentLabel(a.os, a.agentId).toLowerCase().includes(q) ||
        (a.agentId ?? '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
      const matchesOs =
        osFilter === 'all' || (a.os ?? '').toLowerCase().includes(osFilter);
      const matchesArch =
        archFilter === 'all' || (a.arch ?? '').toLowerCase().includes(archFilter);
      let matchesLastSeen = true;
      if (lastSeenFilter === 'recent' || lastSeenFilter === 'stale') {
        const last = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
        const delta = now - last;
        matchesLastSeen =
          lastSeenFilter === 'recent' ? delta <= RECENT_MS : delta >= STALE_MS;
      }
      return matchesSearch && matchesStatus && matchesOs && matchesArch && matchesLastSeen;
    });
  }, [data, search, statusFilter, osFilter, archFilter, lastSeenFilter]);

  return (
    <div className="w-full space-y-6">
      <LoadingOverlay isLoading={showOverlay} />
      <PageHeader
        title="All Agents"
        description={`${data.length} total agent${data.length === 1 ? '' : 's'}`}
      />

      {/* Toolbar row sits on the page background, above the table card.
          Search bar on the left, filter dropdowns on the right —
          matches the Hear "Critical Cases" toolbar layout. */}
      <div className="flex flex-row items-center justify-between gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 w-full rounded-md bg-white pl-10 focus-visible:!border-input focus-visible:!ring-0"
            placeholder="Search by name, hostname, or ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="!h-10 w-[140px] !rounded-md bg-white">
              <SelectValue>
                {{ all: 'All Status', online: 'Online', offline: 'Offline' }[statusFilter]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={osFilter}
            onValueChange={(v) => setOsFilter(v as typeof osFilter)}
          >
            <SelectTrigger className="!h-10 w-[140px] !rounded-md bg-white">
              <SelectValue>
                {
                  {
                    all: 'All OS',
                    windows: 'Windows',
                    darwin: 'macOS',
                    linux: 'Linux',
                  }[osFilter]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All OS</SelectItem>
              <SelectItem value="windows">Windows</SelectItem>
              <SelectItem value="darwin">macOS</SelectItem>
              <SelectItem value="linux">Linux</SelectItem>
            </SelectContent>
          </Select>
          {/* "More" popover — clicking opens a small panel with extra
              filter dimensions, each in its own labelled Select. Same
              pattern as the Hear "More" button in Critical Cases. */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex h-10 w-[140px] items-center justify-between gap-1.5 rounded-md border border-input bg-white px-3 text-sm whitespace-nowrap outline-none data-[popup-open]:bg-accent/40"
            >
              <span className="flex items-center gap-1.5">
                <ListFilter className="h-4 w-4 text-muted-foreground" />
                More
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="!w-64 space-y-3 p-3"
            >
              <div className="space-y-1.5">
                <p className="text-[12px] font-medium text-foreground">
                  Architecture
                </p>
                <Select
                  value={archFilter}
                  onValueChange={(v) => setArchFilter(v as typeof archFilter)}
                >
                  <SelectTrigger className="!h-9 w-full !rounded-md bg-white">
                    <SelectValue>
                      {
                        { all: 'All Architectures', amd64: 'amd64', arm64: 'arm64' }[archFilter]
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Architectures</SelectItem>
                    <SelectItem value="amd64">amd64</SelectItem>
                    <SelectItem value="arm64">arm64</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-[12px] font-medium text-foreground">
                  Last Seen
                </p>
                <Select
                  value={lastSeenFilter}
                  onValueChange={(v) =>
                    setLastSeenFilter(v as typeof lastSeenFilter)
                  }
                >
                  <SelectTrigger className="!h-9 w-full !rounded-md bg-white">
                    <SelectValue>
                      {
                        {
                          all: 'All Time',
                          recent: 'Last 5 minutes',
                          stale: 'Older than 24h',
                        }[lastSeenFilter]
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="recent">Last 5 minutes</SelectItem>
                    <SelectItem value="stale">Older than 24h</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* The Card itself acts as the table — no padding, no inner
          wrappers. Table fills edge-to-edge inside the rounded white
          surface; the sticky header pins to the top of the card while
          rows scroll underneath. */}
      {isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No agents found.{' '}
            <Link
              href="/settings"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Install an agent
            </Link>{' '}
            or claim orphan agents from Settings.
          </p>
        </div>
      ) : (
        <Card className="!p-0">
          <CardContent className="!p-0">
            <div className="h-[calc(100vh-240px)] min-h-[520px] overflow-y-auto">
              <Table className="table-fixed">
                <TableHeader className="!bg-card [&_th]:!border-b-0">
                  <TableRow>
                    <TableHead className="w-[22%]">Agent</TableHead>
                    <TableHead className="w-[15%]">Hostname</TableHead>
                    <TableHead className="w-[14%]">OS / Arch</TableHead>
                    <TableHead className="w-[22%]">Ethernet IP / Wifi IP</TableHead>
                    <TableHead className="w-[14%]">Last Seen</TableHead>
                    <TableHead className="w-[13%] text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((agent) => {
                    const ips = [
                      ...(agent.ethernetIPs ?? []),
                      ...(agent.wifiIPs ?? []),
                    ]
                      .slice(0, 2)
                      .join(', ');
                    const label = agentLabel(agent.os, agent.agentId);
                    const href = `/agents/${agent.agentId}`;
                    return (
                      <TableRow
                        key={agent.agentId}
                        role="link"
                        tabIndex={0}
                        onClick={() => router.push(href)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(href);
                          }
                        }}
                        className="cursor-pointer hover:bg-muted/50 focus:bg-muted/50 focus:outline-none"
                      >
                        <TableCell className="truncate" title={agent.agentId}>
                          <div className="truncate font-medium text-foreground">
                            {label}
                          </div>
                          <div className="truncate font-mono text-[10px] text-muted-foreground">
                            {truncateMiddle(agent.agentId)}
                          </div>
                        </TableCell>
                        <TableCell
                          className="truncate text-foreground"
                          title={agent.hostname ?? undefined}
                        >
                          {agent.hostname}
                        </TableCell>
                        <TableCell className="truncate text-muted-foreground">
                          {agent.os} · {agent.arch}
                        </TableCell>
                        <TableCell
                          className="truncate text-muted-foreground tabular-nums"
                          title={ips || undefined}
                        >
                          {ips || '-'}
                        </TableCell>
                        <TableCell className="truncate text-muted-foreground">
                          {formatRelativeTime(agent.lastSeenAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <StatusBadge status={agent.status} />
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
    </div>
  );
}
