'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Check, ChevronDown, Search, Server } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { InlineLoader } from '@/components/ui/loaders';
import { useAgents } from '@/hooks/use-itom';
import { agentLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

export const ALL_AGENTS_VALUE = '__all__';

const PAGE_SIZE = 50;

/**
 * Agent selector used by the sidebar Monitoring pages (/network, /disk,
 * /metrics). The earlier shadcn `Select`-based picker rendered the
 * agent UUID in the trigger because base-ui's `Select.Value` defaults
 * to showing the raw `value` of the selected item rather than its
 * displayed text. This implementation is a Popover + filtered list:
 *   - Trigger shows hostname (preferred) with the short OS-prefixed
 *     label as a secondary line.
 *   - Search filters by hostname, label, or UUID substring.
 *   - List paginates in chunks of PAGE_SIZE so fleets with hundreds of
 *     agents don't render the full set at once; scrolling near the
 *     bottom loads the next page.
 */
export function AgentPicker({
  value,
  onChange,
  placeholder = 'All agents',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const { data: agents = [], isLoading } = useAgents();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset paging when the query changes or the popup re-opens — otherwise
  // a stale visible-count from a previous open would leak through.
  useEffect(() => {
    setVisible(PAGE_SIZE);
    if (open) {
      // Scroll list back to top when reopening so the selected row isn't
      // randomly mid-scroll from the previous interaction.
      listRef.current?.scrollTo({ top: 0 });
    }
  }, [open, query]);

  const rows = useMemo(() => {
    const list = agents.map((a) => ({
      agentId: a.agentId,
      hostname: a.hostname || '',
      label: agentLabel(a.os, a.agentId),
      os: a.os,
    }));
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.hostname.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q) ||
        r.agentId.toLowerCase().includes(q),
    );
  }, [agents, query]);

  const visibleRows = rows.slice(0, visible);
  const hasMore = visible < rows.length;

  const handleScroll = () => {
    const container = listRef.current;
    if (!container || !hasMore) return;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      60;
    if (!nearBottom) return;
    setVisible((prev) => Math.min(prev + PAGE_SIZE, rows.length));
  };

  const selected = agents.find((a) => a.agentId === value);
  const isAll = value === ALL_AGENTS_VALUE;
  const primaryLabel = isAll
    ? 'All agents'
    : selected
      ? selected.hostname || agentLabel(selected.os, selected.agentId)
      : '';
  const secondaryLabel =
    !isAll && selected ? agentLabel(selected.os, selected.agentId) : '';

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(
          'flex h-9 w-[240px] max-w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors',
          'hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none',
          'dark:bg-input/30 dark:hover:bg-input/50',
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Server className="h-4 w-4 shrink-0 text-muted-foreground" />
          {primaryLabel ? (
            <div className="min-w-0 flex-1 text-left leading-tight">
              <div className="truncate text-sm font-medium">{primaryLabel}</div>
              {secondaryLabel ? (
                <div className="truncate text-[10px] text-muted-foreground">
                  {secondaryLabel}
                </div>
              ) : null}
            </div>
          ) : (
            <span className="truncate text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={4}>
          <Popover.Popup
            className={cn(
              'z-50 w-[300px] overflow-hidden rounded-lg border border-border/60 bg-popover text-popover-foreground shadow-md',
              'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
              'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            )}
          >
            <div className="border-b border-border/60 p-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Search by hostname…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-8 pl-7 text-xs"
                />
              </div>
            </div>
            <div
              ref={listRef}
              onScroll={handleScroll}
              className="max-h-[300px] overflow-y-auto p-1"
            >
              <button
                type="button"
                className={cn(
                  'flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent',
                  isAll && 'bg-accent/60',
                )}
                onClick={() => {
                  onChange(ALL_AGENTS_VALUE);
                  setOpen(false);
                }}
              >
                <span>All agents</span>
                {isAll ? <Check className="h-3.5 w-3.5" /> : null}
              </button>
              <div className="my-1 h-px bg-border/60" />
              {isLoading ? (
                <InlineLoader label="Loading agents…" className="px-2 py-2 text-xs" />
              ) : visibleRows.length === 0 ? (
                <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                  {query
                    ? `No agents match "${query}"`
                    : 'No agents registered yet.'}
                </div>
              ) : (
                visibleRows.map((r) => {
                  const isSel = r.agentId === value;
                  return (
                    <button
                      key={r.agentId}
                      type="button"
                      className={cn(
                        'flex w-full items-start justify-between gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent',
                        isSel && 'bg-accent/60',
                      )}
                      onClick={() => {
                        onChange(r.agentId);
                        setOpen(false);
                      }}
                    >
                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="truncate font-medium">
                          {r.hostname || r.label}
                        </div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {r.label}
                          {r.os ? ` · ${r.os}` : ''}
                        </div>
                      </div>
                      {isSel ? (
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      ) : null}
                    </button>
                  );
                })
              )}
              {hasMore ? (
                <div className="py-1 text-center text-[10px] text-muted-foreground">
                  Scroll for more ({visibleRows.length}/{rows.length})
                </div>
              ) : null}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
