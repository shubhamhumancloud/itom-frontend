'use client';

import { Building2, ChevronDown } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function Topbar({
  orgLabel,
  displayName,
  email,
}: {
  orgLabel: string;
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
      <div className="flex h-16 items-center justify-between px-6">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground/85 transition-colors hover:bg-accent"
        >
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[260px] truncate">{orgLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

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
