export type JwtClaims = {
  sub?: string;
  email?: string;
  tenantId?: string;
  orgId?: string;
  orgName?: string;
  roles?: string[];
  [key: string]: unknown;
};

export function decodeJwtClaims(token: string | null | undefined): JwtClaims | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized);
    return JSON.parse(decoded) as JwtClaims;
  } catch {
    return null;
  }
}

export function readCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

