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
import { StatusBadge } from '@/components/itom/status-badge';
import { agentLabel, formatRelativeTime } from '@/lib/format';

type Incident = {
  agentId: string;
  hostname?: string | null;
  os: string;
  arch: string;
  status: string;
  statusChangedAt: string;
};

/**
 * Fixed body height for the incidents card so it never grows/shrinks
 * with the row count — keeps the dashboard grid row stable whether
 * there are 0 or 10 incidents. Holds the sticky header + ~4 rows;
 * any overflow scrolls inside this box. Sized so the card sits close
 * to the OS-distribution donut beside it, leaving no dead space.
 */
const BODY_HEIGHT = 'h-[232px]';

/**
 * "Latest incidents" card — bounded to the 10 most-recent non-online
 * agents so the table stays scannable no matter how many devices are
 * in the fleet. Mirrors the Hear "Recent Cases" card layout: title
 * + helper text on the left, right-aligned "View all →" deep link
 * to the full agents page.
 *
 * The body area is a fixed-height scroll container: the card keeps a
 * constant height regardless of how many incidents are present, and
 * the table's sticky header stays pinned while rows scroll under it.
 */
export function IncidentsCard({
  incidents,
}: {
  incidents: Incident[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div>
          <CardTitle>Latest Incidents</CardTitle>
          <p className="text-xs text-muted-foreground">
            Agents currently in a non-online state, most recent change first
          </p>
        </div>
        {incidents.length > 0 ? (
          <Link
            href="/agents"
            className="shrink-0 text-sm font-semibold text-primary hover:underline"
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
            No active incidents — every agent is online.
          </div>
        ) : (
          <div className={`${BODY_HEIGHT} overflow-y-auto`}>
            <Table>
              <TableHeader className="!bg-card [&_th]:!border-b-0">
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>OS / Arch</TableHead>
                  <TableHead>Since</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((a) => (
                  <TableRow key={`incident-${a.agentId}`}>
                    <TableCell className="font-medium">
                      {a.status === 'offline'
                        ? 'Connection lost'
                        : 'Awaiting connection'}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/agents/${a.agentId}`}
                        className="font-medium text-foreground hover:text-primary"
                        title={a.hostname ?? ''}
                      >
                        {agentLabel(a.os, a.agentId)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.os} · {a.arch}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeTime(a.statusChangedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <StatusBadge status={a.status} />
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
