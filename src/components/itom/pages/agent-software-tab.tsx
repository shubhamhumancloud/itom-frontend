'use client';

import { useEffect, useMemo, useState } from 'react';
import { Package, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAgentSoftware } from '@/hooks/use-itom';
import { useBottomObserver } from '@/hooks/use-bottom-observer';
import { formatBytes } from '@/lib/format';

export function AgentSoftwareTab({ agentId }: { agentId: string }) {
  const [rawSearch, setRawSearch] = useState('');
  const [search, setSearch] = useState('');

  // Debounce 250ms — keeps backend pressure low without UI lag.
  useEffect(() => {
    const t = setTimeout(() => setSearch(rawSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [rawSearch]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useAgentSoftware(agentId, search);

  const items = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  const sentinelRef = useBottomObserver(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  });

  const totalLoaded = items.length;

  return (
    <Card className="border-border/90 shadow-(--shadow-soft)">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Package className="h-4 w-4 text-emerald-600" />
            Installed software
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Refreshed daily from the host package manager
          </p>
        </div>
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-7"
            placeholder="Search by name, version, publisher"
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading software…
          </p>
        ) : totalLoaded === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {search
                ? `No software matches "${search}".`
                : 'No software inventory yet. The agent reports it once per day.'}
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Publisher</TableHead>
                  <TableHead>Installed</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead className="text-right">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => (
                  <TableRow key={`${s.name}::${s.version}`}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {s.version || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.publisher ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.installedAt ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {s.sizeBytes != null ? formatBytes(s.sizeBytes) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-[10px]">
                        {s.source}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div ref={sentinelRef} className="h-4" />
            {isFetchingNextPage && (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Loading more…
              </p>
            )}
            {!hasNextPage && totalLoaded > 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Showing {totalLoaded.toLocaleString()} apps
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
