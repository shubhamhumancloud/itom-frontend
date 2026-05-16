'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Globe,
  Hash,
  Mail,
  MapPin,
  Shield,
  User,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/app/page-header';
import { decodeJwtClaims, readCookieValue } from '@/lib/auth';

/**
 * Profile page — mirrors the Hear "My Profile" layout.
 *
 *   ┌──────────────────────────────────────────┐
 *   │ Avatar  Name + email + Admin badge       │
 *   ├──────────────────────────────────────────┤
 *   │ Personal Information │  Organization     │
 *   │ (full name, email,   │  (company, domain,│
 *   │  location, dept,     │   suid, jurisd.,  │
 *   │  member since)       │   email domains)  │
 *   └──────────────────────────────────────────┘
 *
 * Most fields are derived from the JWT (email, name) or are tenant
 * placeholders — wire them to a real /v1/me + /v1/tenant endpoint
 * when those exist.
 */
type ProfileInfo = {
  email: string;
  displayName: string;
  initials: string;
  tenant: string;
  tenantId: string;
  domain: string;
  memberSince: string;
};

export function ProfilePageContent() {
  // Reading cookies during SSR returns null (no `document` on the
  // server), which would render the fallback initials "U" before
  // client-side hydration replaced them with real initials — causing
  // the visible flash on reload. Defer cookie/claim parsing to a
  // useEffect so the first paint already reflects real data.
  const [info, setInfo] = useState<ProfileInfo | null>(null);

  useEffect(() => {
    const token =
      readCookieValue('accessToken') ?? readCookieValue('itom_accessToken');
    const claims = decodeJwtClaims(token);
    const email = String(claims?.email ?? 'user@tenant');
    const rawName = String(
      claims?.name ?? claims?.fullName ?? (email.includes('@') ? email.split('@')[0] : email),
    );
    const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const initials = displayName
      .split(/[\s@]/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    const tenant = email.includes('@') ? email.split('@')[1].split('.')[0] : 'tenant';
    const tenantId = String(claims?.tenantId ?? tenant);
    const domain = email.includes('@') ? email.split('@')[1] : 'tenant.com';
    const memberSince = claims?.iat
      ? new Date(Number(claims.iat) * 1000).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
    setInfo({ email, displayName, initials, tenant, tenantId, domain, memberSince });
  }, []);

  // Until cookies parse on the client, render a stable shell with
  // empty strings so the layout doesn't jump and the avatar fallback
  // doesn't flash a placeholder letter.
  const email = info?.email ?? '';
  const displayName = info?.displayName ?? '';
  const initials = info?.initials ?? '';
  const tenant = info?.tenant ?? '';
  const tenantId = info?.tenantId ?? '';
  const domain = info?.domain ?? '';
  const memberSince = info?.memberSince ?? '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="View your personal and organization information"
      />

      {/* Identity header card — large avatar + name + email + role badge.
          Soft blue gradient wash on the surface mirrors the Hear profile
          header (subtle brand-tinted background that anchors the name). */}
      <Card
        className="bg-no-repeat"
        style={{
          // Reference card from DevTools was 629 × 116 px. Sizing the
          // gradient to 100% × 58px (half the card height) puts the
          // visible edge near the avatar's mid-line, matching the Hear
          // profile header proportions.
          backgroundImage:
            'linear-gradient(to right, rgba(8,107,255,0.18), rgba(8,107,255,0.08) 50%, transparent 100%)',
          backgroundSize: '100% 70px',
        }}
      >
        <CardContent className="flex flex-col items-start gap-3 py-3 pr-3 pl-6 sm:flex-row sm:items-center">
          <Avatar className="h-[64px] w-[64px] border-2 border-[#dbeafe] shadow-sm ring-2 ring-white">
            <AvatarFallback className="bg-[#086BFF] !text-[20px] font-semibold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-[24px] font-bold leading-tight text-foreground">
              {displayName}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {email}
              </span>
            </div>
            <Badge className="mt-1 !h-[22px] !rounded-[5px] !border !border-[#086BFF]/30 !px-2 !py-0.5 text-xs bg-[#086BFF]/10 text-[#086BFF] hover:bg-[#086BFF]/15">
              <User className="!h-3 !w-3" />
              Admin
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Personal + Organization two-column grid. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="!gap-0 !py-2">
          <SectionHeader icon={User} label="Personal Information" />
          <CardContent className="divide-y divide-border/60 p-0 text-sm">
            <Field icon={User} label="Full Name" value={displayName} />
            <Field icon={Mail} label="Email" value={email} />
            <Field icon={MapPin} label="Location" value="—" />
            <Field icon={Building2} label="Department" value="—" />
            <Field icon={Calendar} label="Member Since" value={memberSince} />
          </CardContent>
        </Card>

        <Card className="!gap-0 !py-2">
          <SectionHeader icon={Building2} label="Organization" />
          <CardContent className="divide-y divide-border/60 p-0 text-sm">
            <Field icon={Building2} label="Company" value={tenant} />
            <Field icon={Globe} label="Domain" value={domain} />
            <Field
              icon={Hash}
              label="Tenant ID"
              value={
                <span className="break-all" title={tenantId}>
                  {tenantId}
                </span>
              }
            />
            <Field
              icon={Mail}
              label="Allowed Email Domains"
              value={
                <div className="flex flex-wrap justify-end gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {domain}
                  </Badge>
                </div>
              }
            />
            <Field
              icon={Shield}
              label="Compliance"
              value={
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Enabled
                </span>
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  label,
}: {
  icon: typeof User;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border/60 px-6 py-3">
      <Icon className="h-4 w-4 text-[#086BFF]" />
      <h3 className="text-sm font-semibold text-foreground">{label}</h3>
    </div>
  );
}

// Hear-style row: icon in a tinted rounded tile on the left, then a
// stacked label (uppercase muted) + value (bold foreground) on the
// right. Replaces the previous label-left / value-right inline row.
function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 px-6 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#086BFF]/[0.04]">
        <Icon className="h-4 w-4 text-[#086BFF]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 break-words text-sm font-semibold text-foreground">
          {value}
        </div>
      </div>
    </div>
  );
}
