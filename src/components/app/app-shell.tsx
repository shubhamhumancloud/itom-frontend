'use client';

import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { decodeJwtClaims, readCookieValue } from '@/lib/auth';

/**
 * App shell — mirrors the acai Hear admin layout pattern:
 *   [Sidebar] | [Topbar (h-16, border-b)]
 *             | [Page content — pt-8 px-6 pb-8 on bg-background]
 *
 * Sidebar sits on the bg-background canvas; the content well uses the
 * same warm off-white so the cards "float" on top with a faint shadow,
 * matching the Hear admin shell.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const token = readCookieValue('accessToken') ?? readCookieValue('itom_accessToken');
  const claims = decodeJwtClaims(token);
  const email = String(claims?.email ?? 'user@tenant');
  const displayName = String(
    claims?.name ?? claims?.fullName ?? (email.includes('@') ? email.split('@')[0] : email),
  );
  const displayNameTitle =
    displayName.charAt(0).toUpperCase() + displayName.slice(1);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <Sidebar email={email} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar displayName={displayNameTitle} email={email} />
        <main className="flex-1 overflow-auto bg-background px-6 pt-8 pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
