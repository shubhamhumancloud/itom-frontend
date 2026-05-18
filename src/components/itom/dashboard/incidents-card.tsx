'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertSeverityBadge,
  IncidentStatusBadge,
} from '@/components/itom/alert-badges';
import { useIncidents } from '@/hooks/use-itom';
import { formatRelativeTime } from '@/lib/format';

/**
 * Fixed body height so the card never grows/shrinks with the row count —
 * keeps the dashboard grid row stable whether there are 0 or 10 incidents.
 * Holds the sticky header + ~4 rows; overflow scrolls inside this box.
 */
const BODY_HEIGHT = 'h-[232px]';

/**
 * "Latest incidents" dashboard card — the 10 most-recent non-resolved
 * incidents raised by the alert evaluator. Self-fetches via `useIncidents`
 * (no props) and deep-links each row to its incident detail page.
 */
export function IncidentsCard() {
  const { data = [] } = useIncidents();
  const incidents = data
    .filter((i) => i.status !== 'resolved')
    .slice(0, 10);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div>
          <CardTitle>Latest incidents</CardTitle>
          <p className="text-xs text-muted-foreground">
            Open incidents across the fleet, most recent first
          </p>
        </div>
        {incidents.length > 0 ? (
          <Link
            href="/alerts"
            className="shrink-0 text-xs font-medium text-primary hover:underline"
          >
            View all →
          </Link>
        ) : null}
      </CardHeader>
      <CardContent className="pt-0">
        {incidents.length === 0 ? (
          <div
            className={`flex ${BODY_HEIGHT} items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-sm text-muted-foreground`}
          >
            No open incidents — every monitored threshold is within range.
          </div>
        ) : (
          <div className={`${BODY_HEIGHT} overflow-y-auto`}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Incident</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((inc) => (
                  <TableRow key={inc.id}>
                    <TableCell>
                      <AlertSeverityBadge severity={inc.severity} />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/alerts/${inc.id}`}
                        className="font-medium text-foreground hover:text-primary"
                        title={inc.title}
                      >
                        {inc.title}
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {inc.category}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeTime(inc.openedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <IncidentStatusBadge status={inc.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
