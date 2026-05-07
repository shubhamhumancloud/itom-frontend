export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return '-';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`;
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (value == null || Number.isNaN(value)) return '-';
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatRelativeTime(input: string | Date | null | undefined): string {
  if (!input) return '-';
  const date = input instanceof Date ? input : new Date(input);
  const diffMs = Date.now() - date.getTime();
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
    ['second', 1_000],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(diffMs) >= size || unit === 'second') {
      return rtf.format(-Math.round(diffMs / size), unit);
    }
  }
  return '-';
}

export function truncateMiddle(value: string, left = 8, right = 6): string {
  if (value.length <= left + right + 3) return value;
  return `${value.slice(0, left)}...${value.slice(-right)}`;
}

// agentLabel produces a short, OS-prefixed label for an agent, e.g.
//   WIN-3f2a9c81
//   Linux-7c2eab40
//   MacOS-1a8fbe95
// The suffix is the first 8 hex chars of the agentId (UUID dashes stripped),
// which is stable for the lifetime of the agent.
export function agentLabel(
  os: string | null | undefined,
  agentId: string | null | undefined,
): string {
  if (!agentId) return '-';
  const slug = agentId.replace(/-/g, '').slice(0, 8);
  return `${osPrefix(os)}-${slug}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatNumber(n: number | string | null | undefined): string {
  if (n == null) return '-';
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (!Number.isFinite(v)) return '-';
  return v.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

export function toNumber(v: number | string | null | undefined): number {
  if (v == null) return 0;
  return typeof v === 'string' ? parseFloat(v) || 0 : v;
}

function osPrefix(os: string | null | undefined): string {
  const o = (os ?? '').toLowerCase().trim();
  // Check darwin/mac before windows because "darwin" contains "win".
  if (o === 'darwin' || o.startsWith('darwin') || o.includes('mac')) return 'MacOS';
  if (o === 'linux' || o.startsWith('linux')) return 'Linux';
  if (o === 'windows' || o.startsWith('windows') || o.startsWith('win')) return 'WIN';
  return 'Agent';
}
