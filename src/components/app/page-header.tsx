import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Shared page header — mirrors the acai Hear page-header spec:
 *   - Title: 26px / Bold / 32px line-height / tight tracking
 *   - Description: 15px / Regular / 22px line-height / muted-foreground
 *   - Optional right-aligned `action` slot (e.g. agent picker, button)
 *   - Min height 64px so single-line headers still feel balanced
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
        'flex min-h-[64px] items-center justify-between gap-4',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h2
          className="font-display font-bold tracking-tight text-foreground"
          style={{ fontSize: 26, lineHeight: '32px', letterSpacing: '-0.01em' }}
        >
          {title}
        </h2>
        {description ? (
          <p
            className="text-muted-foreground"
            style={{ fontSize: 15, lineHeight: '22px' }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
