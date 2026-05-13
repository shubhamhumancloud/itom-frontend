import { useEffect, useState } from 'react';
import { Spinner as HCSpinner } from '@swar-da/humancloud-ui';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * Loading primitives used everywhere.
 *
 * The pattern is hybrid: skeletons for full panels (tables, KPI grids,
 * charts) so the layout doesn't jump when data arrives, plus a small
 * Spinner for inline actions, infinite-scroll "loading more" markers,
 * and dropdowns where a full skeleton would be overkill.
 *
 * Skeletons use the `Skeleton` primitive (animate-pulse bg-muted),
 * and the Spinner re-exports `@swar-da/humancloud-ui`'s arc SVG so
 * it follows the surrounding `text-*` color via `currentColor`.
 */

export function Spinner({
  size = 'sm',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return <HCSpinner size={size} className={cn('text-primary', className)} />;
}

/**
 * Full-area blocking loader. Renders an absolute-positioned blur
 * backdrop with a centered spinner — covers everything in its
 * positioned ancestor (AppShell's `<main>` is `relative`, so the
 * overlay sits over the content area while the sidebar stays
 * interactive).
 *
 * Use this ONLY for the cold-first-load case. For subsequent agent
 * switches or refetches, pair it with `useColdLoad(...)` so the blur
 * doesn't reappear every time TanStack swaps query keys.
 */
export function LoadingOverlay({
  isLoading,
  className,
  fullScreen = false,
}: {
  isLoading?: boolean;
  className?: string;
  fullScreen?: boolean;
}) {
  if (!isLoading) return null;
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={cn(
        fullScreen ? 'fixed inset-0' : 'absolute inset-0',
        'z-40 flex items-center justify-center bg-background/45 backdrop-blur-sm',
        'animate-in fade-in-0 duration-100',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-card/95 shadow-(--shadow-soft)">
        <Spinner size="md" />
      </div>
    </div>
  );
}

/**
 * Tracks "this is the very first load — no data has ever been shown".
 * Returns `true` while the query is loading AND no data has rendered
 * yet; flips to `false` permanently once data arrives once and stays
 * `false` for every subsequent refetch / agent switch.
 *
 * Pair with `LoadingOverlay` so the blur shows on initial page entry
 * only, and later refreshes use `FetchProgressBar` (subtle bar) instead.
 */
export function useColdLoad(isLoading: boolean, hasData: boolean): boolean {
  const [seenData, setSeenData] = useState(hasData);
  useEffect(() => {
    if (hasData && !seenData) setSeenData(true);
  }, [hasData, seenData]);
  return isLoading && !seenData;
}

/**
 * Thin animated progress bar that shows whenever a tab/section is
 * background-fetching. Skeletons cover the cold first-load case; this
 * gives feedback on every tab switch, because TanStack Query refetches
 * on mount and `isFetching` flips true briefly even when cached data
 * is already on screen.
 *
 * Renders an indeterminate sliding bar inside a thin track. Hidden
 * when `isFetching` is false so it doesn't consume layout space.
 */
export function FetchProgressBar({
  isFetching,
  className,
}: {
  isFetching?: boolean;
  className?: string;
}) {
  if (!isFetching) return null;
  return (
    <div
      role="progressbar"
      aria-busy="true"
      className={cn(
        'relative h-0.5 w-full overflow-hidden rounded-full bg-muted/60',
        className,
      )}
    >
      <div className="absolute inset-y-0 w-1/3 animate-[fetch-slide_1.1s_ease-in-out_infinite] rounded-full bg-primary" />
    </div>
  );
}

export function InlineLoader({
  label,
  size = 'sm',
  className,
}: {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-sm text-muted-foreground',
        className,
      )}
    >
      <Spinner size={size} />
      {label ? <span>{label}</span> : null}
    </div>
  );
}

export function LoadingMoreRow({
  current,
  total,
  label = 'Loading more…',
}: {
  current?: number;
  total?: number;
  label?: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2 px-3 py-2 text-xs text-muted-foreground">
      <Spinner size="sm" className="h-3 w-3" />
      <span>
        {label}
        {current != null && total != null ? ` (${current}/${total})` : ''}
      </span>
    </div>
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="rounded-md border border-border/60 bg-background px-3 py-2">
      <Skeleton className="mb-2 h-3 w-24" />
      <Skeleton className="h-5 w-32" />
    </div>
  );
}

export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <KpiCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex h-56 w-full items-end gap-1 rounded-md border border-border/60 bg-muted/20 p-3',
        className,
      )}
    >
      {Array.from({ length: 24 }).map((_, i) => (
        <Skeleton
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: `${20 + ((i * 13) % 70)}%`,
            animationDelay: `${(i % 8) * 80}ms`,
          }}
        />
      ))}
    </div>
  );
}

export function TableSkeleton({
  rows = 6,
  columns = 5,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-border/60',
        className,
      )}
    >
      <Table>
        <TableBody>
          {Array.from({ length: rows }).map((_, r) => (
            <TableRow key={r}>
              {Array.from({ length: columns }).map((__, c) => (
                <TableCell key={c}>
                  <Skeleton
                    className="h-4"
                    style={{
                      width: `${
                        c === 0
                          ? 70
                          : c === columns - 1
                            ? 40
                            : 50 + ((r * 7 + c * 11) % 30)
                      }%`,
                    }}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CardSkeleton({
  lines = 4,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'space-y-2 rounded-md border border-border/60 bg-background p-3',
        className,
      )}
    >
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          style={{ width: `${60 + ((i * 17) % 35)}%` }}
        />
      ))}
    </div>
  );
}
