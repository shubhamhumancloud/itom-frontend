/**
 * Parse a network-scanner-style "ranges" string into a list of CIDR
 * prefixes that our backend's active scanner can consume.
 *
 * Accepts a comma- or whitespace-separated list of any of:
 *   - CIDR:        192.168.1.0/24
 *   - last-octet:  192.168.1.1-254          → expanded to covering CIDRs
 *   - full range:  192.168.1.10-192.168.2.5 → expanded to covering CIDRs
 *   - single IP:   10.0.0.5                  → /32
 *
 * Returns { cidrs, errors } so the UI can show partial validation
 * results — one bad token doesn't disqualify the rest.
 */
export type ParsedRanges = {
  cidrs: string[];
  errors: Array<{ token: string; reason: string }>;
};

export function parseRanges(input: string): ParsedRanges {
  const out: ParsedRanges = { cidrs: [], errors: [] };
  if (!input?.trim()) return out;

  const tokens = input
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const token of tokens) {
    try {
      const cidrs = parseToken(token);
      out.cidrs.push(...cidrs);
    } catch (e: any) {
      out.errors.push({ token, reason: e?.message ?? String(e) });
    }
  }

  // De-dup: if the user wrote `10.0.0.0/24` twice or had overlap.
  out.cidrs = Array.from(new Set(out.cidrs));
  return out;
}

function parseToken(token: string): string[] {
  // CIDR — already correct form.
  if (token.includes('/')) {
    if (!isValidCIDR(token)) throw new Error('invalid CIDR');
    return [normaliseCIDR(token)];
  }

  // Range with dash anywhere → split start/end.
  if (token.includes('-')) {
    const [lhs, rhs] = token.split('-', 2).map((s) => s.trim());
    const start = parseStart(lhs);
    const end = parseEnd(rhs, lhs);
    if (start > end) throw new Error('range end < start');
    return rangeToCIDRs(start, end);
  }

  // Single IPv4 → /32.
  if (isValidIPv4(token)) return [`${token}/32`];

  throw new Error('not a CIDR, range, or IP');
}

/** "192.168.1.10" → 32-bit unsigned. */
function ipToInt(ip: string): number {
  if (!isValidIPv4(ip)) throw new Error(`invalid IPv4: ${ip}`);
  const o = ip.split('.').map(Number);
  return ((o[0] << 24) >>> 0) + (o[1] << 16) + (o[2] << 8) + o[3];
}

function intToIp(n: number): string {
  return [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
  ].join('.');
}

function parseStart(s: string): number {
  return ipToInt(s);
}

/**
 * Parse the RHS of a dash. Three accepted shapes:
 *   192.168.1.5  → full IP
 *   .5            → reuse leading octets from lhs
 *   254           → last-octet shorthand (Advanced IP Scanner style)
 */
function parseEnd(rhs: string, lhs: string): number {
  if (isValidIPv4(rhs)) return ipToInt(rhs);
  if (rhs.startsWith('.')) {
    const head = lhs.split('.').slice(0, -1).join('.');
    return ipToInt(`${head}${rhs}`);
  }
  if (/^\d{1,3}$/.test(rhs)) {
    const head = lhs.split('.').slice(0, 3).join('.');
    return ipToInt(`${head}.${rhs}`);
  }
  throw new Error('invalid range end');
}

function isValidIPv4(s: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return false;
  return s.split('.').every((o) => {
    const n = Number(o);
    return n >= 0 && n <= 255;
  });
}

function isValidCIDR(s: string): boolean {
  const [ip, bits] = s.split('/');
  if (!isValidIPv4(ip)) return false;
  const b = Number(bits);
  return Number.isInteger(b) && b >= 0 && b <= 32;
}

function normaliseCIDR(s: string): string {
  const [ip, bits] = s.split('/');
  const b = Number(bits);
  // Snap to network address so 192.168.1.5/24 → 192.168.1.0/24.
  const mask = b === 0 ? 0 : (-1 << (32 - b)) >>> 0;
  const net = ipToInt(ip) & mask;
  return `${intToIp(net)}/${b}`;
}

/**
 * Decompose an arbitrary contiguous IP range into the minimum set of
 * covering CIDRs.
 *
 * Standard algorithm: at each step pick the largest block size `n`
 * such that (a) `start` is 2^n-aligned and (b) `start + 2^n - 1` is
 * still ≤ end. Emit `start/(32-n)`, advance `start` by 2^n, repeat.
 */
function rangeToCIDRs(start: number, end: number): string[] {
  const out: string[] = [];
  let s = start >>> 0;
  const e = end >>> 0;
  while (s <= e) {
    // Largest n where s is 2^n-aligned == count of trailing zero bits.
    let maxAlignBits = 32;
    if (s !== 0) {
      maxAlignBits = 0;
      let v = s;
      while ((v & 1) === 0 && maxAlignBits < 32) {
        maxAlignBits++;
        v >>>= 1;
      }
    }
    // Largest n where 2^n ≤ remaining range (e - s + 1).
    // Using log2 via bit-shift: find the highest 2^k ≤ diff.
    const diff = e - s + 1;
    let maxRangeBits = 0;
    let d = diff;
    while (d > 1) {
      maxRangeBits++;
      d = Math.floor(d / 2);
    }
    const blockBits = Math.min(maxAlignBits, maxRangeBits);
    const prefixLen = 32 - blockBits;
    out.push(`${intToIp(s)}/${prefixLen}`);
    const advance = Math.pow(2, blockBits);
    if (s + advance > 0xffffffff) break;
    s = (s + advance) >>> 0;
  }
  return out;
}

/** Count of IPs covered by a list of CIDRs (de-dup not considered). */
export function countCidrs(cidrs: string[]): number {
  return cidrs.reduce((acc, c) => {
    const bits = Number(c.split('/')[1] ?? 32);
    return acc + Math.pow(2, 32 - bits);
  }, 0);
}
