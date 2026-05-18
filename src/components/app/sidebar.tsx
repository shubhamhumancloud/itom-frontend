'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BellRing,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  Radar,
  Server,
  Settings,
  User,
} from 'lucide-react';
import { AcaiOpsLogo } from '@/components/app/acai-ops-logo';
import { cn } from '@/lib/utils';

type NavItem = { href: string; label: string; icon: typeof Server };

type NavGroup = { label?: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/agents', label: 'Agents', icon: Server },
      { href: '/alerts', label: 'Alerts & Incidents', icon: BellRing },
    ],
  },
  {
    label: 'Discovery',
    items: [
      { href: '/discovery/scan', label: 'Network Scan', icon: Radar },
      { href: '/discovery/hosts', label: 'Hosts', icon: ListChecks },
      { href: '/discovery/topology', label: 'Topology', icon: GitBranch },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/profile', label: 'Profile', icon: User },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = () => {
    document.cookie = 'accessToken=; path=/; max-age=0';
    document.cookie = 'itom_accessToken=; path=/; max-age=0';
    router.push('/login');
  };

  return (
    <aside className="sticky top-0 flex h-screen w-[240px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Header band — height matches Topbar (h-16) so the bottom border
          forms one continuous horizontal divider across the viewport.
          Logo sized to ~40px tall to match the acai dashboard mark. */}
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-6 text-sidebar-foreground">
        <AcaiOpsLogo className="h-10 w-auto" />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group, idx) => (
          <div key={idx} className={cn(idx > 0 && 'mt-5')}>
            {group.label && (
              <div className="px-2 pb-2 text-xs text-[#9ca3af] mt-8 font-semibold uppercase tracking-wider">
                {group.label}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      // Acai-style menu item: h-10, px-3, rounded-lg.
                      // Active state is SemiBold so the contrast on the
                      // peach pill matches the reference.
                      'group flex h-10 items-center gap-3 rounded-sm px-3 text-[15px] transition-colors',
                      active
                        ? 'bg-sidebar-primary font-semibold text-sidebar-primary-foreground'
                        : 'font-medium text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        active ? 'text-sidebar-primary-foreground' : 'text-muted-foreground',
                      )}
                      strokeWidth={2}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Logout pinned to the bottom of the sidebar — styled as a nav
          item (h-10, gap-3, text-[15px]) so it reads as one more tab,
          matching the reference. Thin top divider sets it apart from
          the scrolling nav above. */}
      <div className="border-t border-sidebar-border px-3 py-3">
        <button
          onClick={signOut}
          title={email}
          className="group flex h-10 w-full items-center gap-3 rounded-sm px-3 text-[15px] font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-muted-foreground"
            aria-hidden="true"
          >
            <path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" />
            <path d="M9 12h12l-3 -3" />
            <path d="M18 15l3 -3" />
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
