'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';

/**
 * Top navigation bar — Hear-style:
 *   - h-16 (matches sidebar header)
 *   - bg-card with a solid bottom border (no backdrop blur)
 *   - Right-clustered user identity (name + email + avatar)
 *
 * Kept lean: the right-cluster width hugs its content so the leftover
 * space is available for org/workspace switchers or page-level
 * actions if a future iteration needs them.
 */
export function Topbar({
  displayName,
  email,
}: {
  displayName: string;
  email: string;
}) {
  const initials = (displayName || email || 'U')
    .split(/[\s@]/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="z-20 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card px-6">
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <div className="hidden text-right leading-tight md:block">
          <div className="text-sm font-semibold text-foreground">{displayName}</div>
          <div className="text-xs text-muted-foreground">{email}</div>
        </div>
        <Avatar className="h-9 w-9 border border-border">
          <AvatarFallback className="bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-semibold text-white">
            {initials || 'U'}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
