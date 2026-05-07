'use client';

import { useEffect, useMemo, useState } from 'react';
import { HardDrive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAgentDisk, useAgents, useFleetDisk } from '@/hooks/use-itom';
import { agentLabel, formatBytes, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AgentPicker, ALL_AGENTS_VALUE } from '@/components/itom/agent-picker';

export function DiskOverviewPage() {
  const [agentId, setAgentId] = useState<string>('');
  const { data: agents = [] } = useAgents();

  useEffect(() => {
    if (!agentId && agents.length > 0) {
      setAgentId(agents[0].agentId);
    }
  }, [agentId, agents]);

  const isAll = agentId === ALL_AGENTS_VALUE;
  const fleet = useFleetDisk(400);
  const single = useAgentDisk(isAll || !agentId ? '' : agentId, 400);

  const data = isAll ? fleet.data ?? [] : single.data ?? [];
  const isLoading = isAll ? fleet.isLoading : single.isLoading;

  const labelById = useMemo(
    () => new Map(agents.map((a) => [a.agentId, agentLabel(a.os, a.agentId)])),
    [agents],
  );

  // For the selected agent, collapse to latest sample per mountpoint;
  // for the fleet, show top N rows by usedPercent.
  const rows = useMemo(() => {
    if (isAll) {
      return [...data]
        .sort((a, b) => Number(b.usedPercent ?? 0) - Number(a.usedPercent ?? 0))
        .slice(0, 25);
    }
    const byMount = new Map<string, (typeof data)[number] & { ts: number }>();
    for (const r of data) {
      const ts = new Date(r.timestamp).getTime();
      const cur = byMount.get(r.mountpoint);
      if (!cur || ts > cur.ts) byMount.set(r.mountpoint, { ...r, ts });
    }
    return [...byMount.values()].sort(
      (a, b) => Number(b.usedPercent ?? 0) - Number(a.usedPercent ?? 0),
    );
  }, [data, isAll]);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Disk</h1>
          <p className="text-xs text-muted-foreground">
            {isAll
              ? 'Mountpoints sorted by utilization across the fleet'
              : 'Mountpoints for the selected agent'}
          </p>
        </div>
        <AgentPicker value={agentId} onChange={setAgentId} />
      </div>

      <Card className="border-border/90 shadow-(--shadow-soft)">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <HardDrive className="h-4 w-4 text-teal-600" />
            Disk utilization
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading disk metrics…</p>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
              No disk metrics available.
            </div>
          ) : (
            <div className="space-y-4">
              {rows.map((row) => {
                const used = Number(row.usedPercent ?? 0);
                const tone =
                  used >= 90 ? 'bg-rose-500' : used >= 75 ? 'bg-orange-500' : 'bg-emerald-500';
                return (
                  <div key={row.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <div className="font-medium">{row.mountpoint || '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {isAll && (
                            <>
                              {labelById.get(row.agentId) ?? row.agentId.slice(0, 8)} ·{' '}
                            </>
                          )}
                          {formatBytes(Number(row.usedBytes ?? 0))} /{' '}
                          {formatBytes(Number(row.totalBytes ?? 0))}
                        </div>
                      </div>
                      <div
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          used >= 90
                            ? 'bg-rose-100 text-rose-700'
                            : used >= 75
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-emerald-100 text-emerald-700',
                        )}
                      >
                        {formatPercent(used)}
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full transition-all', tone)}
                        style={{ width: `${Math.min(used, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
