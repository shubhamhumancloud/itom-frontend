'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';

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
    <header className="sticky top-0 z-20 border-b border-border bg-card/85 backdrop-blur-md">
      <div className="flex h-16 items-center justify-end px-6">
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
      </div>
    </header>
  );
}
