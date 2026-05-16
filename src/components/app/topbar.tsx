'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Top navigation bar — Hear-style:
 *   - h-16 (matches sidebar header)
 *   - bg-card with a solid bottom border (no backdrop blur)
 *   - Right-clustered: workspace switcher + user identity + avatar
 *
 * The workspace switcher mirrors the Hear "tcs's Workspace ▾" pattern:
 * small org avatar + workspace name + chevron, opens a popover listing
 * the orgs the user has access to. Backend isn't wired yet, so the
 * options below are seeded from the email tenant; replace with a real
 * memberships endpoint when one exists.
 */
type Workspace = { id: string; name: string; subtitle?: string };

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
      <WorkspaceSwitcher email={email} />
      {/* User identity moved inside an avatar-triggered popover —
          clicking the avatar reveals the name + email (and is a
          natural anchor for future profile / sign-out actions). */}
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-full outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/50">
          <Avatar className="h-9 w-9 border border-border">
            <AvatarFallback className="bg-[#086BFF] text-sm font-semibold text-white">
              {initials || 'U'}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="!w-64 p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-border">
              <AvatarFallback className="bg-[#086BFF] text-sm font-semibold text-white">
                {initials || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold text-foreground">
                {displayName}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {email}
              </div>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

function WorkspaceSwitcher({ email }: { email: string }) {
  // Seed the workspace list from the email domain so the default tile
  // reflects the signed-in tenant. Additional rows are placeholders
  // until a real /v1/memberships endpoint lands; swap `WORKSPACES`
  // out for the API response when available.
  const tenant = email.includes('@') ? email.split('@')[1].split('.')[0] : 'default';
  const WORKSPACES: Workspace[] = [
    { id: 'default', name: `${tenant}'s Workspace`, subtitle: 'default' },
    { id: 'staging', name: `${tenant} staging`, subtitle: `${tenant}-staging` },
    { id: 'sandbox', name: `${tenant} sandbox`, subtitle: `${tenant}-sandbox` },
  ];
  const [active, setActive] = useState<string>(WORKSPACES[0].id);
  const current = WORKSPACES.find((w) => w.id === active) ?? WORKSPACES[0];
  const tag = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hidden items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm transition-colors hover:bg-muted/60 md:inline-flex">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#086BFF] text-[11px] font-semibold text-white">
          {tag(current.name)}
        </span>
        <span className="max-w-[160px] truncate text-foreground">{current.name}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="!w-64 p-2">
        <p className="px-2 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Organizations
        </p>
        <div className="flex flex-col gap-0.5">
          {WORKSPACES.map((w) => {
            const isActive = w.id === active;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => setActive(w.id)}
                className={
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60'
                }
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#086BFF] text-[11px] font-semibold text-white">
                  {tag(w.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">
                    {w.name}
                  </span>
                  {w.subtitle && (
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {w.subtitle}
                    </span>
                  )}
                </span>
                {isActive && (
                  <Check className="h-4 w-4 shrink-0 text-[#086BFF]" />
                )}
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
