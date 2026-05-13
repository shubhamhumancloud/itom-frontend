'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  GitBranch,
  HardDrive,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Network,
  Radar,
  Server,
  Settings,
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
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { href: '/metrics', label: 'Metrics', icon: BarChart3 },
      { href: '/network', label: 'Network', icon: Network },
      { href: '/disk', label: 'Disk', icon: HardDrive },
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
    items: [{ href: '/settings', label: 'Settings', icon: Settings }],
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
    <aside className="flex min-h-[calc(100vh-0px)] w-[240px] flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center border-b border-sidebar-border px-5 py-5 text-sidebar-foreground">
        <AcaiOpsLogo className="h-8 w-auto" />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group, idx) => (
          <div key={idx} className={cn(idx > 0 && 'mt-6')}>
            {group.label && (
              <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
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
                    className={cn(
                      'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                        : 'text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-[18px] w-[18px]',
                        active ? 'text-sidebar-primary-foreground' : 'text-sidebar-foreground/70',
                      )}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-5 py-4">
        <div className="mb-3 truncate text-xs text-muted-foreground" title={email}>
          {email}
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-card px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
