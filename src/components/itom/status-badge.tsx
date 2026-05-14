import { cn } from '@/lib/utils';

/**
 * Connection-state badge for an agent. Pill shape with a dot, distinct
 * from the categorical SeverityBadge so the two read at a glance.
 *
 * Sizing follows Hear DS badge spec (h-6, text-xs, medium weight).
 */
export function StatusBadge({ status }: { status: string }) {
  const normalized = (status || 'unknown').toLowerCase();
  const tone =
    normalized === 'online'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
      : normalized === 'offline'
        ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300';

  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-3 text-xs font-medium capitalize',
        tone,
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          normalized === 'online'
            ? 'bg-emerald-500'
            : normalized === 'offline'
              ? 'bg-rose-500'
              : 'bg-slate-400',
        )}
      />
      {normalized}
    </span>
  );
}
