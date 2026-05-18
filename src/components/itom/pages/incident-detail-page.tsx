'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingOverlay, useColdLoad } from '@/components/ui/loaders';
import {
  AlertSeverityBadge,
  IncidentStatusBadge,
} from '@/components/itom/alert-badges';
import { formatMetricValue } from '@/components/itom/pages/incidents-page';
import {
  useIncident,
  useIncidentActions,
  useIncidentComment,
} from '@/hooks/use-itom';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { IncidentEventRow } from '@/lib/api';

/**
 * Incident detail — header with lifecycle actions, the alerts correlated
 * into this incident, and the full audit timeline with a comment box.
 */
export function IncidentDetailPage({ incidentId }: { incidentId: string }) {
  const { data, isLoading } = useIncident(incidentId);
  const { acknowledge, resolve } = useIncidentActions();
  const comment = useIncidentComment();
  const [draft, setDraft] = useState('');
  const showOverlay = useColdLoad(isLoading, !!data);

  if (!isLoading && !data) {
    return (
      <div className="w-full space-y-4">
        <BackLink />
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Incident not found — it may have been removed.
          </p>
        </div>
      </div>
    );
  }

  const incident = data?.incident;
  const alerts = data?.alerts ?? [];
  const events = data?.events ?? [];

  const submitComment = () => {
    const message = draft.trim();
    if (!message) return;
    comment.mutate({ id: incidentId, message });
    setDraft('');
  };

  return (
    <div className="w-full space-y-5">
      <LoadingOverlay isLoading={showOverlay} />
      <BackLink />

      {incident && (
        <>
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-2xl font-semibold tracking-tight">
                  {incident.title}
                </h1>
                <AlertSeverityBadge severity={incident.severity} />
                <IncidentStatusBadge status={incident.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="capitalize">{incident.category}</span> ·
                opened {formatRelativeTime(incident.openedAt)} ·{' '}
                {data?.firingAlertCount ?? 0} of {incident.alertCount} alert(s)
                still firing
              </p>
              {data?.readyToClose && (
                <p className="text-sm font-medium text-emerald-600">
                  All alerts have recovered — this incident is ready to close.
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                disabled={incident.status !== 'open' || acknowledge.isPending}
                onClick={() => acknowledge.mutate(incidentId)}
              >
                Acknowledge
              </Button>
              <Button
                disabled={incident.status === 'resolved' || resolve.isPending}
                onClick={() => resolve.mutate(incidentId)}
              >
                Resolve
              </Button>
            </div>
          </div>

          {/* Correlated alerts */}
          <Card className="border-border/90 shadow-(--shadow-soft)">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Correlated alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {alerts.length === 0 ? (
                <p className="px-6 pb-4 text-sm text-muted-foreground">
                  No alerts attached.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[12%]">Severity</TableHead>
                      <TableHead className="w-[40%]">Alert</TableHead>
                      <TableHead className="w-[14%]">State</TableHead>
                      <TableHead className="w-[14%] text-right">Value</TableHead>
                      <TableHead className="w-[20%]">First fired</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <AlertSeverityBadge severity={a.severity} />
                        </TableCell>
                        <TableCell
                          className="truncate font-medium text-foreground"
                          title={a.message}
                        >
                          {a.message}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'text-xs font-medium capitalize',
                              a.state === 'firing'
                                ? 'text-rose-600'
                                : 'text-emerald-600',
                            )}
                          >
                            {a.state}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-foreground">
                          {formatMetricValue(a.metric, a.metricValue)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatRelativeTime(a.firstFiredAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card className="border-border/90 shadow-(--shadow-soft)">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-0">
                {events.map((ev, i) => (
                  <TimelineRow
                    key={ev.id}
                    event={ev}
                    last={i === events.length - 1}
                  />
                ))}
              </ol>

              {/* Comment box */}
              <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Add a comment to the incident timeline…"
                  className="min-h-[72px]"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={!draft.trim() || comment.isPending}
                    onClick={submitComment}
                  >
                    Add comment
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/alerts"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to alerts &amp; incidents
    </Link>
  );
}

/** Colour-coded label per event type. */
const EVENT_TONE: Record<string, string> = {
  opened: 'bg-indigo-500',
  alert_added: 'bg-rose-500',
  alert_resolved: 'bg-emerald-500',
  severity_changed: 'bg-amber-500',
  acknowledged: 'bg-amber-500',
  resolved: 'bg-emerald-500',
  comment: 'bg-slate-400',
};

function TimelineRow({
  event,
  last,
}: {
  event: IncidentEventRow;
  last: boolean;
}) {
  return (
    <li className="flex gap-3">
      {/* Dot + connector rail */}
      <div className="flex flex-col items-center">
        <span
          className={cn(
            'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
            EVENT_TONE[event.type] ?? 'bg-slate-400',
          )}
        />
        {!last && <span className="w-px flex-1 bg-border" />}
      </div>
      <div className={cn('min-w-0 flex-1', last ? 'pb-0' : 'pb-4')}>
        <p className="text-sm text-foreground">{event.message}</p>
        <p className="text-[11px] text-muted-foreground">
          {event.actor ?? 'system'} · {formatRelativeTime(event.occurredAt)}
        </p>
      </div>
    </li>
  );
}
