'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, Network, ScanLine, Server } from 'lucide-react';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { discoveryApi } from '@/lib/api';
import { formatRelativeTime } from '@/lib/format';

/**
 * Right-rail detail panel for the topology page. Shows what fusion
 * knows about one device — sources, interfaces, IPs, open ports, and
 * the last events touching it.
 */
export interface DeviceDetailPanelProps {
  deviceId: string | null;
}

export function DeviceDetailPanel({ deviceId }: DeviceDetailPanelProps) {
  const detail = useQuery({
    queryKey: ['discovery', 'device', deviceId],
    queryFn: () => discoveryApi.device(deviceId!),
    enabled: !!deviceId,
  });

  if (!deviceId) {
    return (
      <>
        <CardHeader>
          <CardTitle className="text-sm">Device detail</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Click a node in the graph to see its details.
        </CardContent>
      </>
    );
  }
  if (detail.isLoading) {
    return (
      <>
        <CardHeader>
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-1/2" />
        </CardContent>
      </>
    );
  }
  if (detail.error || !detail.data) {
    return (
      <>
        <CardHeader>
          <CardTitle className="text-sm">Device not found</CardTitle>
        </CardHeader>
        <CardContent />
      </>
    );
  }

  const d = detail.data;

  return (
    <>
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="text-base">
          {d.device.hostname ?? d.device.managementIp ?? d.device.identityKey}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="secondary">{d.device.kind}</Badge>
          {d.device.vendor && <Badge variant="outline">{d.device.vendor}</Badge>}
          <AvailabilityBadge state={d.device.availability} />
        </div>
        {d.device.sysDescr && (
          <p className="pt-1 text-xs text-muted-foreground">{d.device.sysDescr}</p>
        )}
      </CardHeader>
      <CardContent className="flex-1 space-y-4 overflow-y-auto text-sm">
        <Section icon={<Server className="h-4 w-4" />} title="Identity">
          <KV k="Management IP" v={d.device.managementIp ?? '—'} />
          <KV k="Chassis serial" v={d.device.chassisSerial ?? '—'} />
          <KV k="Identity key" v={d.device.identityKey} mono />
          <KV k="Last seen" v={d.device.lastSeenAt ? formatRelativeTime(d.device.lastSeenAt) : '—'} />
          <KV k="Sources" v={d.device.sources.join(', ') || '—'} />
        </Section>

        {d.interfaces.length > 0 && (
          <Section icon={<Network className="h-4 w-4" />} title={`Interfaces (${d.interfaces.length})`}>
            <ul className="space-y-1">
              {d.interfaces.map((it) => (
                <li
                  key={it.id}
                  className="rounded-sm border border-border/60 bg-muted/40 px-2 py-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{it.name}</span>
                    <Badge variant={it.operStatus === 'up' ? 'default' : 'outline'}>
                      {it.operStatus}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    if{it.ifIndex} · {it.type ?? 'ethernet'} · {it.mac ?? '—'}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {d.ips.length > 0 && (
          <Section icon={<Network className="h-4 w-4" />} title={`IP bindings (${d.ips.length})`}>
            <ul className="space-y-1 font-mono text-xs">
              {d.ips.map((b) => (
                <li key={b.id}>
                  {b.ip}
                  {b.prefixLen != null ? `/${b.prefixLen}` : ''}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {d.openPorts.length > 0 && (
          <Section icon={<ScanLine className="h-4 w-4" />} title={`Open ports (${d.openPorts.length})`}>
            <ul className="space-y-1">
              {d.openPorts.map((p) => (
                <li key={p.id} className="rounded-sm border border-border/60 px-2 py-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono">
                      {p.protocol}/{p.port}
                    </span>
                    {p.service && <Badge variant="outline">{p.service}</Badge>}
                  </div>
                  {p.banner && (
                    <div className="mt-0.5 truncate text-xs text-muted-foreground" title={p.banner}>
                      {p.banner}
                    </div>
                  )}
                  {p.tlsCertCn && (
                    <div className="text-xs text-blue-600">cert: {p.tlsCertCn}</div>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {d.events.length > 0 && (
          <Section icon={<Activity className="h-4 w-4" />} title={`Events (${d.events.length})`}>
            <ul className="space-y-1 text-xs">
              {d.events.slice(0, 8).map((e) => (
                <li key={e.id} className="flex justify-between gap-2">
                  <span className="font-medium">{e.kind}</span>
                  <span className="text-muted-foreground">
                    {formatRelativeTime(e.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </CardContent>
    </>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className={mono ? 'font-mono text-xs' : 'text-right'}>{v}</span>
    </div>
  );
}

function AvailabilityBadge({ state }: { state: string }) {
  const variant: 'default' | 'destructive' | 'outline' =
    state === 'up' ? 'default' : state === 'down' ? 'destructive' : 'outline';
  return <Badge variant={variant}>{state}</Badge>;
}
