'use client';

import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { decodeJwtClaims, readCookieValue } from '@/lib/auth';

export function AppShell({ children }: { children: React.ReactNode }) {
  const token = readCookieValue('accessToken') ?? readCookieValue('itom_accessToken');
  const claims = decodeJwtClaims(token);
  const email = String(claims?.email ?? 'user@tenant');
  const displayName = String(
    claims?.name ?? claims?.fullName ?? (email.includes('@') ? email.split('@')[0] : email),
  );
  const displayNameTitle =
    displayName.charAt(0).toUpperCase() + displayName.slice(1);
  const orgLabel = String(
    claims?.orgEmail ?? claims?.orgName ?? claims?.orgId ?? claims?.tenantId ?? 'Workspace',
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar email={email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar orgLabel={orgLabel} displayName={displayNameTitle} email={email} />
        <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-4 lg:px-5 lg:py-4">
          {children}
        </main>
      </div>
    </div>
  );
}
