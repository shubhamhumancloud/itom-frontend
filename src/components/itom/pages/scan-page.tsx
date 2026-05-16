'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  Radar,
  Server,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CardSkeleton, LoadingOverlay, useColdLoad } from '@/components/ui/loaders';
import { PageHeader } from '@/components/app/page-header';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  collectorsApi,
  scansApi,
  type CollectorRow,
  type CreateCollectorResp,
  type ScanJobRow,
} from '@/lib/api';
import { countCidrs, parseRanges } from '@/lib/ip-range';

const ANY_COLLECTOR_VALUE = '__any__';

/**
 * Network Scan page.
 *
 * Lets an operator:
 *  1. Register a collector and copy its bearer token (shown once).
 *  2. Submit an `active`-pillar scan job over one or more IP ranges
 *     (CIDR or `192.168.1.1-254` style — both accepted, range syntax
 *     is converted client-side to covering CIDRs).
 *  3. See recent scan jobs and their status, auto-refreshing.
 *
 * The actual probing happens inside the collector daemon (which must be
 * running and connected over WebSocket). This page just queues the job.
 */
export function ScanPage() {
  const qc = useQueryClient();

  const collectors = useQuery({
    queryKey: ['discovery', 'collectors'],
    queryFn: () => collectorsApi.list(),
    refetchInterval: 10_000,
  });

  const scans = useQuery({
    queryKey: ['discovery', 'scans'],
    queryFn: () => scansApi.list(25),
    refetchInterval: 5_000,
  });

  // ---- "Register a collector" modal state ----
  const [showRegister, setShowRegister] = useState(false);
  const [newCollectorName, setNewCollectorName] = useState('');
  const [newCollectorCidrs, setNewCollectorCidrs] = useState('10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12');
  const [newCollector, setNewCollector] = useState<CreateCollectorResp | null>(null);

  const deleteCollector = useMutation({
    mutationFn: (id: string) => collectorsApi.remove(id),
    onSuccess: (r) => {
      toast.success(
        `Collector deleted — ${r.scanJobs} job${r.scanJobs === 1 ? '' : 's'}, ${r.observations} observation${r.observations === 1 ? '' : 's'} removed`,
      );
      qc.invalidateQueries({ queryKey: ['discovery', 'collectors'] });
      qc.invalidateQueries({ queryKey: ['discovery', 'scans'] });
      qc.invalidateQueries({ queryKey: ['discovery', 'hosts'] });
    },
    onError: (e: any) => toast.error(e?.message ?? String(e)),
  });

  const registerCollector = useMutation({
    mutationFn: () => {
      const parsed = parseRanges(newCollectorCidrs);
      if (parsed.cidrs.length === 0) {
        return Promise.reject(new Error('At least one CIDR is required for the allowlist'));
      }
      return collectorsApi.create({
        name: newCollectorName.trim(),
        allowedCidrs: parsed.cidrs,
      });
    },
    onSuccess: (r) => {
      toast.success(`Collector "${r.name}" registered`);
      setNewCollector(r);
      qc.invalidateQueries({ queryKey: ['discovery', 'collectors'] });
    },
    onError: (e: any) => toast.error(e?.message ?? String(e)),
  });

  // ---- "Run a scan" form state ----
  const [selectedCollector, setSelectedCollector] = useState<string>(ANY_COLLECTOR_VALUE);
  const [rangesInput, setRangesInput] = useState('192.168.1.0/24');

  // Track whether the user has manually edited the ranges textarea.
  // Once they have, we never auto-overwrite it on collector change —
  // their custom input wins.
  const rangesEditedRef = useRef(false);

  // When the user explicitly picks a collector from the dropdown,
  // pre-fill the ranges textarea with that collector's saved
  // allowedCidrs. That gives them a sensible default ("scan what this
  // collector is allowed to scan") without forcing them to retype.
  const onCollectorChange = (v: string | null | undefined) => {
    const next = v ?? ANY_COLLECTOR_VALUE;
    setSelectedCollector(next);
    if (next === ANY_COLLECTOR_VALUE) return;
    const c = (collectors.data ?? []).find((x) => x.id === next);
    if (c && c.allowedCidrs.length > 0) {
      setRangesInput(c.allowedCidrs.join(', '));
      rangesEditedRef.current = false; // it's a fresh suggested default
    }
  };

  // First-load default: when the collectors list arrives and we still
  // have the "Any available" sentinel selected, switch to the first
  // collector and pre-fill its CIDRs. Runs exactly once.
  const collectorDefaultAppliedRef = useRef(false);
  useEffect(() => {
    if (collectorDefaultAppliedRef.current) return;
    if (selectedCollector !== ANY_COLLECTOR_VALUE) return;
    if (!collectors.data || collectors.data.length === 0) return;
    collectorDefaultAppliedRef.current = true;
    const first = collectors.data[0];
    setSelectedCollector(first.id);
    if (first.allowedCidrs.length > 0 && !rangesEditedRef.current) {
      setRangesInput(first.allowedCidrs.join(', '));
    }
  }, [collectors.data, selectedCollector]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [maxConcurrency, setMaxConcurrency] = useState(256);
  const [rateLimitPps, setRateLimitPps] = useState(1000);
  const [snmpAllowDefaults, setSnmpAllowDefaults] = useState(false);
  const [skipMulticast, setSkipMulticast] = useState(false);

  const parsedRanges = useMemo(() => parseRanges(rangesInput), [rangesInput]);
  const totalIps = useMemo(() => countCidrs(parsedRanges.cidrs), [parsedRanges]);

  const submitScan = useMutation({
    mutationFn: () => {
      if (parsedRanges.cidrs.length === 0) {
        return Promise.reject(new Error('Enter at least one IP range or CIDR'));
      }
      if (parsedRanges.errors.length > 0) {
        return Promise.reject(
          new Error(
            `Couldn't parse: ${parsedRanges.errors.map((e) => e.token).join(', ')}`,
          ),
        );
      }
      // The Select uses '__any__' as a sentinel for "let the dispatcher
      // pick any online collector". Translate it back to null — the BE
      // column is uuid|null and rejects the literal string.
      const collectorId =
        selectedCollector && selectedCollector !== ANY_COLLECTOR_VALUE
          ? selectedCollector
          : null;
      return scansApi.create({
        pillar: 'active',
        collectorId,
        targetSpec: {
          cidrs: parsedRanges.cidrs,
          maxConcurrency,
          rateLimitPps,
          snmpAllowDefaults,
          skipMulticast,
        },
      });
    },
    onSuccess: (job) => {
      toast.success(
        `Scan queued (${parsedRanges.cidrs.length} CIDR${parsedRanges.cidrs.length === 1 ? '' : 's'}, ~${totalIps} IPs)`,
      );
      qc.invalidateQueries({ queryKey: ['discovery', 'scans'] });
      void job;
    },
    onError: (e: any) => toast.error(e?.message ?? String(e)),
  });

  const showOverlay = useColdLoad(
    collectors.isLoading,
    (collectors.data?.length ?? 0) > 0,
  );

  const onlineCollectors = (collectors.data ?? []).filter(
    (c) => c.status === 'online',
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-6 overflow-y-auto px-6 py-6">
      <LoadingOverlay isLoading={showOverlay} />
      <PageHeader
        title="Network Scan"
        description="Sweep an IP range to discover everything alive — hostname, MAC, open ports, TLS cert names, banner. Results land on the topology page automatically."
        action={
          <Link
            href="/discovery/topology"
            className="inline-flex items-center rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            View topology
            <ExternalLink className="ml-1 h-4 w-4" />
          </Link>
        }
      />

      <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
        {/* Left column — Collectors */}
        <Card className="flex h-fit flex-col xl:sticky xl:top-4">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-base">Collectors</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setNewCollector(null);
                setNewCollectorName('');
                setShowRegister(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              Register
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {collectors.isLoading && (
              <div className="space-y-2">
                <CardSkeleton lines={3} />
                <CardSkeleton lines={3} />
              </div>
            )}
            {!collectors.isLoading && (collectors.data ?? []).length === 0 && (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No collectors registered yet. Click <b>Register</b> to add one,
                then run it inside the network you want to scan.
              </div>
            )}
            {(collectors.data ?? []).map((c) => (
              <CollectorRowView
                key={c.id}
                row={c}
                onDelete={(id, name) => {
                  if (
                    window.confirm(
                      `Delete collector "${name}"? This removes its scan jobs, sessions and observations. Typed device rows are kept.`,
                    )
                  ) {
                    deleteCollector.mutate(id);
                  }
                }}
                deletePending={deleteCollector.isPending}
              />
            ))}
          </CardContent>
        </Card>

        {/* Right column — Scan form + recent scans */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scan a Network</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="collector">Collector</Label>
                  <Select
                    value={selectedCollector}
                    onValueChange={(v) => onCollectorChange(v)}
                  >
                    <SelectTrigger id="collector">
                      <SelectValue placeholder="Any available collector" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY_COLLECTOR_VALUE}>
                        Any available collector
                      </SelectItem>
                      {(collectors.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2">
                            <StatusDot status={c.status} />
                            {c.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {onlineCollectors.length === 0
                      ? '⚠ No collectors are currently connected. Start one to actually run scans.'
                      : `${onlineCollectors.length} online`}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Scan type</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">active sweep</Badge>
                    <span className="text-xs text-muted-foreground">
                      ICMP + TCP + banners + multicast
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ranges">IP ranges</Label>
                <Textarea
                  id="ranges"
                  rows={3}
                  value={rangesInput}
                  onChange={(e) => {
                    setRangesInput(e.target.value);
                    rangesEditedRef.current = true;
                  }}
                  placeholder="192.168.1.0/24, 10.0.0.1-254, 172.16.0.10-172.16.0.50"
                  className="font-mono text-sm"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    CIDR or range syntax (Advanced-IP-Scanner style).
                    Comma- or whitespace-separated.
                  </span>
                  <span className={parsedRanges.errors.length > 0 ? 'text-destructive' : 'text-muted-foreground'}>
                    {parsedRanges.cidrs.length > 0 && (
                      <>
                        {parsedRanges.cidrs.length} CIDR{parsedRanges.cidrs.length === 1 ? '' : 's'} · ~{totalIps.toLocaleString()} IPs
                      </>
                    )}
                    {parsedRanges.errors.length > 0 && (
                      <>
                        {' '}· bad: {parsedRanges.errors.map((e) => e.token).join(', ')}
                      </>
                    )}
                  </span>
                </div>
                {parsedRanges.cidrs.length > 0 && (
                  <details className="mt-1 text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      Parsed CIDRs ({parsedRanges.cidrs.length})
                    </summary>
                    <div className="mt-1 max-h-32 overflow-auto rounded border bg-muted/30 p-2 font-mono">
                      {parsedRanges.cidrs.join('\n')}
                    </div>
                  </details>
                )}
              </div>

              <details
                open={advancedOpen}
                onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
              >
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                  Advanced options
                </summary>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="conc">Max concurrency</Label>
                    <Input
                      id="conc"
                      type="number"
                      min={1}
                      max={4096}
                      value={maxConcurrency}
                      onChange={(e) => setMaxConcurrency(Number(e.target.value) || 256)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Goroutines (default 256)
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rate">Rate limit (PPS)</Label>
                    <Input
                      id="rate"
                      type="number"
                      min={1}
                      max={50000}
                      value={rateLimitPps}
                      onChange={(e) => setRateLimitPps(Number(e.target.value) || 1000)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Per /24 token bucket (default 1000)
                    </p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={snmpAllowDefaults}
                      onChange={(e) => setSnmpAllowDefaults(e.target.checked)}
                    />
                    Probe SNMP with public/private as fallback
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={skipMulticast}
                      onChange={(e) => setSkipMulticast(e.target.checked)}
                    />
                    Skip multicast discovery
                  </label>
                </div>
              </details>

              <div className="flex justify-end">
                <Button
                  onClick={() => submitScan.mutate()}
                  disabled={
                    submitScan.isPending ||
                    parsedRanges.cidrs.length === 0 ||
                    parsedRanges.errors.length > 0
                  }
                >
                  {submitScan.isPending ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      Queueing…
                    </>
                  ) : (
                    <>
                      <Radar className="mr-1 h-4 w-4" />
                      Start scan
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Recent Scans</CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {(scans.data ?? []).length} job{(scans.data ?? []).length === 1 ? '' : 's'}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => qc.invalidateQueries({ queryKey: ['discovery', 'scans'] })}
                  title="Refresh"
                >
                  <Loader2
                    className={`h-3.5 w-3.5 ${scans.isFetching ? 'animate-spin' : ''}`}
                  />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {scans.isLoading && (
                <p className="text-sm text-muted-foreground">Loading…</p>
              )}
              {!scans.isLoading && (scans.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No scans yet. Submit one above.
                </p>
              )}
              {(scans.data ?? []).map((j) => (
                <ScanJobRowView key={j.id} job={j} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <RegisterCollectorDialog
        open={showRegister}
        onOpenChange={(o) => {
          setShowRegister(o);
          if (!o) setNewCollector(null);
        }}
        name={newCollectorName}
        onName={setNewCollectorName}
        cidrs={newCollectorCidrs}
        onCidrs={setNewCollectorCidrs}
        onSubmit={() => registerCollector.mutate()}
        submitting={registerCollector.isPending}
        created={newCollector}
      />
    </div>
  );
}

// ----- Subcomponents ----------------------------------------------------

function StatusDot({ status }: { status: CollectorRow['status'] }) {
  const colour = {
    online: 'bg-green-500',
    offline: 'bg-red-500',
    pending: 'bg-amber-500',
    unknown: 'bg-slate-400',
  }[status];
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${colour}`}
      aria-label={status}
    />
  );
}

function CollectorRowView({
  row,
  onDelete,
  deletePending,
}: {
  row: CollectorRow;
  onDelete: (id: string, name: string) => void;
  deletePending: boolean;
}) {
  // Online collectors can't be deleted — the daemon would just reconnect
  // and recreate the row. Operator has to stop the daemon (or wait for
  // it to time out) first.
  const canDelete = row.status !== 'online';
  return (
    <div className="group flex items-start gap-2 rounded-md border bg-card p-3 text-sm">
      <Server className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <StatusDot status={row.status} />
          <span className="truncate font-medium">{row.name}</span>
        </div>
        <div className="mt-0.5 break-words text-xs text-muted-foreground">
          {row.allowedCidrs.slice(0, 3).join(', ')}
          {row.allowedCidrs.length > 3 && ` +${row.allowedCidrs.length - 3} more`}
        </div>
        {row.lastSeenAt && (
          <div className="text-xs text-muted-foreground">
            Last seen {timeAgo(row.lastSeenAt)}
            {row.version && ` · v${row.version}`}
          </div>
        )}
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0 opacity-0 transition group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
        title={
          canDelete
            ? 'Delete collector + its scan history'
            : 'Stop the daemon first — online collectors cannot be deleted'
        }
        disabled={!canDelete || deletePending}
        onClick={() => onDelete(row.id, row.name)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function ScanJobRowView({ job }: { job: ScanJobRow }) {
  const [expanded, setExpanded] = useState(false);
  const spec = (job.targetSpec ?? {}) as {
    cidrs?: string[];
    vendor?: string;
    seeds?: string[];
    maxConcurrency?: number;
    rateLimitPps?: number;
    snmpAllowDefaults?: boolean;
    skipMulticast?: boolean;
  };
  const cidrs = spec.cidrs ?? [];
  const ago = timeAgo(job.updatedAt || job.createdAt);
  const isFailed = job.status === 'failed' || job.status === 'timeout';

  return (
    <div className={`rounded-md border text-sm ${isFailed ? 'border-red-300 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20' : ''}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-2 p-3 text-left hover:bg-accent/40"
      >
        <Activity className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline">{job.pillar}</Badge>
            <StatusBadge status={job.status} />
            <span className="text-muted-foreground">{ago}</span>
            <span className="ml-auto text-muted-foreground">
              {expanded ? '▲' : '▼'}
            </span>
          </div>
          <div className="mt-1 truncate font-mono text-xs">
            {cidrs.length > 0
              ? cidrs.slice(0, 4).join(', ') +
                (cidrs.length > 4 ? `  +${cidrs.length - 4} more` : '')
              : spec.vendor || spec.seeds?.join(', ') || '—'}
          </div>
          {job.statusReason && !expanded && (
            <div className={`mt-0.5 truncate text-xs ${isFailed ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground'}`}>
              {job.statusReason}
            </div>
          )}
        </div>
      </button>

      {expanded && (
        <div className="space-y-2 border-t bg-muted/30 px-3 py-2 text-xs">
          {job.statusReason && (
            <div>
              <div className="font-medium text-muted-foreground">Status reason</div>
              <div className={`mt-0.5 break-words ${isFailed ? 'text-red-700 dark:text-red-300' : ''}`}>
                {job.statusReason}
              </div>
            </div>
          )}
          {cidrs.length > 0 && (
            <div>
              <div className="font-medium text-muted-foreground">
                CIDRs ({cidrs.length})
              </div>
              <div className="mt-0.5 max-h-40 overflow-y-auto rounded border bg-background p-2 font-mono leading-relaxed">
                {cidrs.join(', ')}
              </div>
            </div>
          )}
          {spec.vendor && (
            <div>
              <span className="font-medium text-muted-foreground">Vendor: </span>
              <span className="font-mono">{spec.vendor}</span>
            </div>
          )}
          {spec.seeds && spec.seeds.length > 0 && (
            <div>
              <span className="font-medium text-muted-foreground">Seeds: </span>
              <span className="font-mono">{spec.seeds.join(', ')}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {typeof spec.maxConcurrency === 'number' && (
              <KV label="Concurrency" value={String(spec.maxConcurrency)} />
            )}
            {typeof spec.rateLimitPps === 'number' && (
              <KV label="Rate limit" value={`${spec.rateLimitPps} PPS`} />
            )}
            {typeof spec.snmpAllowDefaults === 'boolean' && (
              <KV
                label="SNMP defaults"
                value={spec.snmpAllowDefaults ? 'allowed' : 'off'}
              />
            )}
            {typeof spec.skipMulticast === 'boolean' && (
              <KV
                label="Multicast"
                value={spec.skipMulticast ? 'skipped' : 'on'}
              />
            )}
            <KV label="Job ID" value={job.id} mono />
            <KV
              label="Collector"
              value={job.collectorId ?? 'any (dispatcher pick)'}
              mono={!!job.collectorId}
            />
            <KV label="Created" value={new Date(job.createdAt).toLocaleString()} />
            <KV label="Updated" value={new Date(job.updatedAt).toLocaleString()} />
          </div>
        </div>
      )}
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground">{label}</div>
      <div className={`truncate ${mono ? 'font-mono' : ''}`} title={value}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ScanJobRow['status'] }) {
  const variants: Record<ScanJobRow['status'], { label: string; cls: string }> = {
    queued:    { label: 'queued',    cls: 'bg-slate-200 text-slate-800' },
    assigned:  { label: 'assigned',  cls: 'bg-blue-100 text-blue-800' },
    running:   { label: 'running',   cls: 'bg-amber-100 text-amber-800' },
    completed: { label: 'done',      cls: 'bg-green-100 text-green-800' },
    failed:    { label: 'failed',    cls: 'bg-red-100 text-red-800' },
    timeout:   { label: 'timeout',   cls: 'bg-red-100 text-red-800' },
    cancelled: { label: 'cancelled', cls: 'bg-slate-200 text-slate-700' },
  };
  const v = variants[status] ?? variants.queued;
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${v.cls}`}>{v.label}</span>;
}

function RegisterCollectorDialog({
  open,
  onOpenChange,
  name,
  onName,
  cidrs,
  onCidrs,
  onSubmit,
  submitting,
  created,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  name: string;
  onName: (s: string) => void;
  cidrs: string;
  onCidrs: (s: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  created: CreateCollectorResp | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[92vw] max-w-3xl flex-col overflow-hidden p-0 sm:w-full">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-lg">
            {created ? 'Collector registered' : 'Register a collector'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {created
              ? 'Save the bearer token below — it is shown only once. Then start the collector on a machine inside the network you want to scan.'
              : 'A collector is the agent that does the actual probing. It runs inside the network being scanned.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!created ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cn">Name</Label>
                <Input
                  id="cn"
                  value={name}
                  onChange={(e) => onName(e.target.value)}
                  placeholder="office-laptop"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc">Allowed CIDRs (signed allowlist)</Label>
                <Textarea
                  id="cc"
                  rows={3}
                  value={cidrs}
                  onChange={(e) => onCidrs(e.target.value)}
                  placeholder="10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  The collector cryptographically verifies that every probed IP
                  falls inside this allowlist. Use broad ranges for dev; tighten
                  in production.
                </p>
              </div>
            </div>
          ) : (
            <CreatedCollectorView resp={created} />
          )}
        </div>

        <DialogFooter className="border-t px-6 py-3">
          {!created ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={onSubmit} disabled={submitting || !name.trim()}>
                {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Register
              </Button>
            </>
          ) : (
            <Button onClick={() => onOpenChange(false)}>
              <Check className="mr-1 h-4 w-4" />
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreatedCollectorView({ resp }: { resp: CreateCollectorResp }) {
  const apiBase =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:3007`
      : 'http://localhost:3007';
  const psCmd = [
    '# Run from backend/collector/',
    `$env:ITOM_COLLECTOR_TENANT_ID="${resp.tenantId}"`,
    `$env:ITOM_COLLECTOR_SERVER_URL="${apiBase}"`,
    `$env:ITOM_COLLECTOR_ID="${resp.id}"`,
    `$env:ITOM_COLLECTOR_AUTH_TOKEN="${resp.bearerToken}"`,
    `# Fetch the CIDR pubkey:`,
    `$pk = (Invoke-RestMethod ${apiBase}/v1/discovery/signing/public-key).publicKeyBase64`,
    `$env:ITOM_COLLECTOR_CIDR_PUBKEY=$pk`,
    `go run .\\cmd\\collectord run`,
  ].join('\n');

  const copy = (s: string, label: string) => {
    navigator.clipboard
      .writeText(s)
      .then(() => toast.success(`${label} copied`))
      .catch(() => toast.error('Clipboard write failed'));
  };

  return (
    <div className="space-y-4">
      <SecretField
        label="Collector ID"
        value={resp.id}
        onCopy={() => copy(resp.id, 'Collector ID')}
      />

      <SecretField
        label="Bearer token"
        labelTone="warn"
        labelSuffix="shown ONCE"
        value={resp.bearerToken}
        onCopy={() => copy(resp.bearerToken, 'Bearer token')}
        hint="Save this now — the backend stores only its hash. If you lose it, register a new collector."
      />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>PowerShell command to start the collector</Label>
          <Button size="sm" variant="outline" onClick={() => copy(psCmd, 'Command')}>
            <Copy className="mr-1 h-3.5 w-3.5" />
            Copy
          </Button>
        </div>
        <pre className="max-h-72 overflow-auto whitespace-pre rounded-md border bg-muted/50 p-3 font-mono text-xs leading-relaxed">
{psCmd}
        </pre>
        <p className="text-xs text-muted-foreground">
          Paste this in a PowerShell window inside the network you want to scan.
          The collector connects back over WebSocket and starts picking up jobs.
        </p>
      </div>
    </div>
  );
}

/**
 * One-line "label + boxed value + copy button" row. Value is rendered
 * in a monospace box that wraps long strings rather than truncating —
 * the whole point of showing the value is letting the user select +
 * copy it manually if the clipboard API is blocked.
 */
function SecretField({
  label,
  labelTone,
  labelSuffix,
  value,
  hint,
  onCopy,
}: {
  label: string;
  labelTone?: 'warn';
  labelSuffix?: string;
  value: string;
  hint?: string;
  onCopy: () => void;
}) {
  const labelCls = labelTone === 'warn' ? 'text-amber-700 dark:text-amber-400' : '';
  const boxCls =
    labelTone === 'warn'
      ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200'
      : 'bg-muted';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label className={labelCls}>{label}</Label>
        {labelSuffix && (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${labelTone === 'warn' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-muted text-muted-foreground'}`}>
            {labelSuffix}
          </span>
        )}
      </div>
      <div className="flex items-start gap-2">
        <code
          className={`block min-h-[2.25rem] flex-1 select-all break-all rounded-md border px-2.5 py-1.5 font-mono text-xs leading-relaxed ${boxCls}`}
        >
          {value}
        </code>
        <Button size="icon" variant="outline" onClick={onCopy} title={`Copy ${label}`}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ----- helpers ----------------------------------------------------------

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
}
