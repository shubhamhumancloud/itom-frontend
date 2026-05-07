'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAgents } from '@/hooks/use-itom';
import { agentLabel, formatRelativeTime, truncateMiddle } from '@/lib/format';
import { StatusBadge } from '@/components/itom/status-badge';

export function AgentsTable() {
  const { data = [], isLoading } = useAgents();
  const [search, setSearch] = useState('');

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
    <div className="w-full space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="text-xs text-muted-foreground">
          Every host reporting into your tenant
        </p>
      </div>

      <Card className="border-border/90 shadow-(--shadow-soft)">
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
            <p className="text-sm text-muted-foreground">Loading agents…</p>
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
                  return (
                    <TableRow key={agent.agentId}>
                      <TableCell>
                        <Link
                          href={`/agents/${agent.agentId}`}
                          className="font-medium text-foreground hover:text-primary"
                          title={agent.agentId}
                        >
                          {label}
                        </Link>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {truncateMiddle(agent.agentId)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/agents/${agent.agentId}`}
                          className="text-foreground hover:text-primary"
                        >
                          {agent.hostname}
                        </Link>
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
