'use client';

import { useEffect, useMemo, useState } from 'react';
import { Package, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAgentSoftware } from '@/hooks/use-itom';
import { useBottomObserver } from '@/hooks/use-bottom-observer';
import { formatBytes } from '@/lib/format';

export function AgentSoftwareTab({ agentId }: { agentId: string }) {
  const [rawSearch, setRawSearch] = useState('');
  const [search, setSearch] = useState('');

  // Debounce 250ms — keeps backend pressure low without UI lag.
  useEffect(() => {
    const t = setTimeout(() => setSearch(rawSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [rawSearch]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useAgentSoftware(agentId, search);

  const items = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  const sentinelRef = useBottomObserver(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  });

  const totalLoaded = items.length;

  return (
    <Card className="border-border/90 shadow-(--shadow-soft)">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Package className="h-4 w-4 text-emerald-600" />
            Installed software
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Refreshed daily from the host package manager
          </p>
        </div>
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-7"
            placeholder="Search by name, version, publisher"
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading software…
          </p>
        ) : totalLoaded === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {search
                ? `No software matches "${search}".`
                : 'No software inventory yet. The agent reports it once per day.'}
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Publisher</TableHead>
                  <TableHead>Installed</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead className="text-right">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => (
                  <TableRow key={`${s.name}::${s.version}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <SoftwareIcon name={s.name} />
                        <span>{s.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {s.version || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.publisher ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.installedAt ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {s.sizeBytes != null ? formatBytes(s.sizeBytes) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-[10px]">
                        {s.source}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div ref={sentinelRef} className="h-4" />
            {isFetchingNextPage && (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Loading more…
              </p>
            )}
            {!hasNextPage && totalLoaded > 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Showing {totalLoaded.toLocaleString()} apps
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const FALLBACK_COLORS = [
  'bg-emerald-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
];

// Slugify drops product-line suffixes / editions / version blurbs so
// "Docker Desktop" maps to the `docker` slug, not `dockerdesktop` (which 404s).
const STRIP_TOKENS = new Set([
  'desktop',
  'edition',
  'community',
  'professional',
  'enterprise',
  'ultimate',
  'standard',
  'pro',
  'plus',
  'browser',
  'app',
  'application',
  'client',
  'server',
  'sdk',
  'jdk',
  'jre',
  'cli',
  'launcher',
  'helper',
  'agent',
  'installer',
  'bootstrapper',
  'inc',
  'corp',
  'corporation',
  'ltd',
  'llc',
  'gmbh',
  'tools',
  'tool',
  'framework',
  'package',
  'packages',
  'templates',
  'template',
  'language',
  'programming',
  'kit',
]);

// Known cases where the obvious slug isn't the Simple Icons brand slug.
// Verified against https://cdn.simpleicons.org — keys are space-separated
// tokens AFTER our slugify cleanup (so dots/parens/strip-tokens already gone).
const KNOWN_SLUGS: Record<string, string> = {
  'visual studio code': 'visualstudiocode',
  'vs code': 'visualstudiocode',
  'google chrome': 'googlechrome',
  'mozilla firefox': 'firefoxbrowser',
  'firefox': 'firefoxbrowser',
  'intellij idea': 'intellijidea',
  'java': 'openjdk',
  'jdk': 'openjdk',
  'eclipse temurin': 'eclipseide',
  'microsoft net': 'dotnet',
  'dotnet': 'dotnet',
  'microsoft edge': 'microsoftedge',
  'ms office': 'microsoftoffice',
  'microsoft office': 'microsoftoffice',
  'go': 'go',
  'github desktop': 'github',
  'citrix workspace': 'citrix',
};

// Direct URL overrides for apps where my default slug rule doesn't hit a
// real icon, OR where a different source (Iconify logos:, vscode-icons:)
// has better coverage than Simple Icons. First match wins.
const ICON_OVERRIDES: Array<{ pattern: RegExp; url: string }> = [
  // Microsoft Office suite — Simple Icons removed all MS trademarks.
  { pattern: /^microsoft\s+word\b/i,       url: 'https://api.iconify.design/vscode-icons:file-type-word.svg' },
  { pattern: /^microsoft\s+excel\b/i,      url: 'https://api.iconify.design/vscode-icons:file-type-excel.svg' },
  { pattern: /^microsoft\s+powerpoint\b/i, url: 'https://api.iconify.design/vscode-icons:file-type-powerpoint.svg' },
  { pattern: /^microsoft\s+outlook\b/i,    url: 'https://api.iconify.design/vscode-icons:file-type-outlook.svg' },
  { pattern: /^microsoft\s+onenote\b/i,    url: 'https://api.iconify.design/vscode-icons:file-type-onenote.svg' },
  { pattern: /^microsoft\s+access\b/i,     url: 'https://api.iconify.design/vscode-icons:file-type-access.svg' },
  { pattern: /^microsoft\s+teams\b/i,      url: 'https://api.iconify.design/logos:microsoft-teams.svg' },
  { pattern: /^microsoft\s+onedrive\b/i,   url: 'https://api.iconify.design/logos:microsoft-onedrive.svg' },
  { pattern: /^microsoft\s+edge\b/i,       url: 'https://api.iconify.design/logos:microsoft-edge.svg' },
  { pattern: /^(microsoft\s+)?visual\s+studio\s+code\b/i, url: 'https://api.iconify.design/logos:visual-studio-code.svg' },
  { pattern: /^(microsoft\s+)?visual\s+studio\b/i, url: 'https://api.iconify.design/logos:visual-studio.svg' },
  // Other trademarked products Simple Icons doesn't host.
  { pattern: /\b(java|jdk|jre)\b/i,         url: 'https://api.iconify.design/logos:java.svg' },
  { pattern: /^skype\b/i,                   url: 'https://api.iconify.design/logos:skype.svg' },
  { pattern: /^zoom\b/i,                    url: 'https://api.iconify.design/logos:zoom-icon.svg' },
  // Simple Icons has these but our slug derivation doesn't always land cleanly.
  { pattern: /^google\s+chrome\b/i,            url: 'https://cdn.simpleicons.org/googlechrome' },
  { pattern: /^(mozilla\s+)?firefox\b/i,       url: 'https://api.iconify.design/logos:firefox.svg' },
  { pattern: /^intellij\s+idea\b/i,            url: 'https://cdn.simpleicons.org/intellijidea' },
  { pattern: /^eclipse\b/i,                    url: 'https://cdn.simpleicons.org/eclipseide' },
  { pattern: /^citrix\s+workspace\b/i,         url: 'https://cdn.simpleicons.org/citrix' },
  { pattern: /^github\s+desktop\b/i,           url: 'https://cdn.simpleicons.org/github' },
  { pattern: /^(microsoft\s+)?\.net\b|^dotnet\b/i, url: 'https://cdn.simpleicons.org/dotnet' },
];

// Apple-internal binaries from /System/* don't have individual brand logos.
// Catch the common prefixes and route them all to the Apple logo.
const APPLE_PATTERN =
  /^(apple|air(drop|play|port|scan|usm)|addressbook|app\s?(store|sso)|aqua|archive\s+utility|finder|safari|facetime|imessage|icloud|itunes|keynote|launchpad|mission\s+control|photo\s+booth|preview|quicktime|reminders|spotlight|stickies|time\s+machine|voiceover|xcode|core\s|system\s)/i;

// Microsoft tools/services not specifically overridden above — render the
// inline four-square Microsoft logo so the row still looks branded.
const MICROSOFT_GENERIC_PATTERN =
  /^(microsoft|ms\s|windows|xbox|hyper-v|sql\s+server|copilot|bing|azure|sharepoint|publisher|project|visio|todo|powershell|cmd|win\d)/i;

function softwareSlug(name: string): string {
  if (APPLE_PATTERN.test(name)) return 'apple';

  // Lowercase, drop parenthesised noise like "(x64)" / "(TM)" / "(Inside)".
  const cleaned = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\.app$/, ' ')
    .replace(/[™®©]/g, ' ');

  // Tokenise on non-alphanum, drop strip-list words and pure-numeric tokens.
  const tokens = cleaned
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STRIP_TOKENS.has(t) && !/^[0-9.]+$/.test(t));

  // Try progressively shorter prefixes against the known map.
  for (let i = tokens.length; i > 0; i--) {
    const phrase = tokens.slice(0, i).join(' ');
    if (KNOWN_SLUGS[phrase]) return KNOWN_SLUGS[phrase];
  }

  // Default: first 1–2 tokens joined. Single brand words (docker, slack, zoom)
  // hit directly; two-word brands (google chrome) compose correctly.
  return tokens.slice(0, 2).join('');
}

function SoftwareIcon({ name }: { name: string }) {
  // Generic-Microsoft check happens before useState so we don't waste a
  // render on the chain-fallback path for things we know are pure inline.
  // Specific Microsoft products are handled by ICON_OVERRIDES below.
  const isGenericMS =
    !ICON_OVERRIDES.some((o) => o.pattern.test(name)) &&
    !APPLE_PATTERN.test(name) &&
    MICROSOFT_GENERIC_PATTERN.test(name);

  const sources = useMemo(
    () => (isGenericMS ? [] : buildIconSources(name)),
    [name, isGenericMS],
  );
  const [idx, setIdx] = useState(0);

  if (isGenericMS) return <MicrosoftLogo />;

  if (sources.length === 0 || idx >= sources.length) {
    const ch = (name[0] || '?').toUpperCase();
    const color = FALLBACK_COLORS[name.charCodeAt(0) % FALLBACK_COLORS.length];
    return (
      <div
        className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-medium text-white ${color}`}
      >
        {ch}
      </div>
    );
  }

  return (
    <img
      src={sources[idx]}
      alt=""
      className="h-5 w-5 rounded"
      onError={() => setIdx(idx + 1)}
    />
  );
}

function buildIconSources(name: string): string[] {
  for (const { pattern, url } of ICON_OVERRIDES) {
    if (pattern.test(name)) return [url];
  }
  if (APPLE_PATTERN.test(name)) {
    return ['https://api.iconify.design/logos:apple.svg'];
  }
  const slug = softwareSlug(name);
  if (!slug) return [];
  return [
    `https://cdn.simpleicons.org/${slug}`,
    `https://api.iconify.design/logos:${slug}-icon.svg`,
    `https://api.iconify.design/logos:${slug}.svg`,
  ];
}

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 23 23" className="h-5 w-5" aria-hidden="true">
      <rect width="10" height="10" fill="#F25022" />
      <rect x="13" width="10" height="10" fill="#7FBA00" />
      <rect y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}
