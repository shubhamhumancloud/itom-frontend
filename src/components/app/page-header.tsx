import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Shared page header — Hear DS spec §4:
 *   - Title: 32px / Medium / leading-9 / #0c0c0c
 *   - Description: 16px / Regular / leading-6 / muted-foreground
 *   - Optional right-aligned `action` slot (e.g. agent picker, button)
 *
 * Sits at the top of every page so the navigation/page area shares one
 * vertical rhythm regardless of which screen the user is on.
 */
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-end justify-between gap-3',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
