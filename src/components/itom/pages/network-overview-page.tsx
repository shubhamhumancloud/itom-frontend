'use client';

import { useEffect, useMemo, useState } from 'react';
import { Network } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAgentNetwork, useAgents, useFleetNetwork } from '@/hooks/use-itom';
import { agentLabel, formatBytes } from '@/lib/format';
import { AgentPicker, ALL_AGENTS_VALUE } from '@/components/itom/agent-picker';

export function NetworkOverviewPage() {
  const [agentId, setAgentId] = useState<string>('');
  const { data: agents = [] } = useAgents();

  useEffect(() => {
    if (!agentId && agents.length > 0) {
      setAgentId(agents[0].agentId);
    }
  }, [agentId, agents]);

  const isAll = agentId === ALL_AGENTS_VALUE;
  const fleet = useFleetNetwork(600);
  const single = useAgentNetwork(isAll || !agentId ? '' : agentId, 400);

  const data = isAll ? fleet.data ?? [] : single.data ?? [];
  const isLoading = isAll ? fleet.isLoading : single.isLoading;

  const labelById = useMemo(
    () => new Map(agents.map((a) => [a.agentId, agentLabel(a.os, a.agentId)])),
    [agents],
  );

  const rows = useMemo(() => {
    if (isAll) {
      // Top talkers across the fleet (by total bytes per row).
      return [...data]
        .sort(
          (a, b) =>
            Number(b.bytesRecv ?? 0) +
            Number(b.bytesSent ?? 0) -
            (Number(a.bytesRecv ?? 0) + Number(a.bytesSent ?? 0)),
        )
        .slice(0, 25);
    }
    // Single agent — collapse by interface, summing rx/tx.
    const byIface = new Map<
      string,
      { interfaceName: string; agentId: string; bytesRecv: number; bytesSent: number; lastTs: number }
    >();
    for (const r of data) {
      const ts = new Date(r.timestamp).getTime();
      const cur = byIface.get(r.interfaceName);
      if (!cur || ts > cur.lastTs) {
        byIface.set(r.interfaceName, {
          interfaceName: r.interfaceName,
          agentId: r.agentId,
          bytesRecv: Number(r.bytesRecv ?? 0),
          bytesSent: Number(r.bytesSent ?? 0),
          lastTs: ts,
        });
      }
    }
    return [...byIface.values()].sort(
      (a, b) => b.bytesRecv + b.bytesSent - (a.bytesRecv + a.bytesSent),
    );
  }, [data, isAll]);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Network</h1>
          <p className="text-xs text-muted-foreground">
            {isAll ? 'Top talkers across your fleet' : 'Per-interface throughput for the selected agent'}
          </p>
        </div>
        <AgentPicker value={agentId} onChange={setAgentId} />
      </div>

      <Card className="border-border/90 shadow-(--shadow-soft)">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Network className="h-4 w-4 text-indigo-600" />
            {isAll ? 'Top talkers' : 'Interfaces'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading network metrics…</p>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
              No network data yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Interface</TableHead>
                  {isAll && <TableHead>Agent</TableHead>}
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => {
                  const recv = Number(row.bytesRecv ?? 0);
                  const sent = Number(row.bytesSent ?? 0);
                  return (
                    <TableRow key={`${row.agentId}-${row.interfaceName}-${idx}`}>
                      <TableCell className="font-medium">{row.interfaceName}</TableCell>
                      {isAll && (
                        <TableCell className="text-muted-foreground">
                          {labelById.get(row.agentId) ?? row.agentId.slice(0, 8)}
                        </TableCell>
                      )}
                      <TableCell className="text-right text-muted-foreground">
                        {formatBytes(recv)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatBytes(sent)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatBytes(recv + sent)}
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
