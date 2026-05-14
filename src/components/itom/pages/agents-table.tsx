'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  const showOverlay = useColdLoad(isLoading, data.length > 0);

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter(
      (a) =>
        (a.hostname ?? '').toLowerCase().includes(q) ||
        agentLabel(a.os, a.agentId).toLowerCase().includes(q) ||
        (a.agentId ?? '').toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className="w-full space-y-6">
      <LoadingOverlay isLoading={showOverlay} />
      <PageHeader
        title="Agents"
        description="Every host reporting into your tenant"
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
          <CardTitle className="text-base font-semibold">All agents</CardTitle>
          <Input
            className="w-72"
            placeholder="Search name, hostname, or ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardHeader>
        <CardContent>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Hostname</TableHead>
                  <TableHead>OS / Arch</TableHead>
                  <TableHead>Ethernet IP/Wifi IP</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="text-right">Status</TableHead>
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
                      <TableCell>
                        <span className="font-medium text-foreground" title={agent.agentId}>
                          {label}
                        </span>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {truncateMiddle(agent.agentId)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-foreground">{agent.hostname}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {agent.os} · {agent.arch}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ips || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
