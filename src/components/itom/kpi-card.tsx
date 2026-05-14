'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Hear DS-style metric card.
 *
 *   ┌────────────────────────────────────┐
 *   │ Label                       [icon] │   <- tinted icon tile, 44×44
 *   │                                    │
 *   │ 42                                 │   <- 36–40px SemiBold metric
 *   │ +6 from last week                  │   <- 14px Medium, green/red
 *   └────────────────────────────────────┘
 *
 * Spec (from DESIGN_SYSTEM 3.md §5, §12):
 *   - p-5/p-6, rounded-2xl, white card, drop-shadow-metric-card
 *   - Icon box: 44×44, rounded-lg (8px), pastel tint background,
 *     saturated foreground for the icon stroke/fill
 *   - Number: ~36–42px / SemiBold / leading-none / text-foreground
 *   - Label: 14 / Regular / muted-foreground
 *   - Change: 14 / Medium / emerald-600 (positive) or rose-600 (negative)
 *
 * Color tones map to Hear's metric tints — purple/teal/green/yellow are
 * borrowed verbatim; rose and orange added for offline/warn KPIs.
 */
export type KpiTone =
  | 'purple'
  | 'teal'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'rose'
  | 'indigo';

const tones: Record<KpiTone, { bg: string; fg: string }> = {
  // Hear DS metric-tint defaults
  purple: { bg: 'bg-[#f1eeff] dark:bg-[#35268b]/25', fg: 'text-[#35268b] dark:text-[#c8c4f1]' },
  teal: { bg: 'bg-[#e4fcf9] dark:bg-[#14b8a6]/25', fg: 'text-[#14b8a6] dark:text-[#5eead4]' },
  green: { bg: 'bg-[#d1fae5] dark:bg-[#22c55e]/25', fg: 'text-[#22c55e] dark:text-[#86efac]' },
  yellow: { bg: 'bg-[#fef3c7] dark:bg-[#f59e0b]/25', fg: 'text-[#f59e0b] dark:text-[#fcd34d]' },
  // Extensions for ITOM (offline / warn / queued)
  orange: { bg: 'bg-[#ffedd5] dark:bg-[#f97316]/25', fg: 'text-[#ea580c] dark:text-[#fdba74]' },
  rose: { bg: 'bg-[#fee2e2] dark:bg-[#ef4444]/25', fg: 'text-[#dc2626] dark:text-[#fca5a5]' },
  indigo: { bg: 'bg-[#e0e7ff] dark:bg-[#6366f1]/25', fg: 'text-[#4338ca] dark:text-[#a5b4fc]' },
};

export type KpiDescriptorTone = 'muted' | 'success' | 'warning' | 'danger';
const descriptorTones: Record<KpiDescriptorTone, string> = {
  muted: 'text-muted-foreground',
  success: 'text-[#22c55e]',
  warning: 'text-[#f59e0b]',
  danger: 'text-[#dc2626]',
};

export function KpiCard({
  label,
  value,
  descriptor,
  tone,
  icon: Icon,
  descriptorTone = 'muted',
}: {
  label: string;
  value: string | number;
  descriptor?: string;
  tone: KpiTone;
  icon: LucideIcon;
  descriptorTone?: KpiDescriptorTone;
}) {
  const t = tones[tone];
  return (
    <div className="flex flex-col justify-between gap-3 rounded-sm border border-border bg-card p-6 shadow-(--shadow-metric-card) transition-shadow hover:shadow-(--shadow-content-card)">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[15px] leading-5 text-muted-foreground">{label}</span>
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
            t.bg,
          )}
        >
          <Icon className={cn('h-[18px] w-[18px]', t.fg)} strokeWidth={2.25} />
        </span>
      </div>
      <div className="space-y-0.5">
        <div className="text-3xl font-semibold leading-none tracking-tight text-foreground">
          {value}
        </div>
        {descriptor ? (
          <div className={cn('text-sm mt-2 font-medium', descriptorTones[descriptorTone])}>
            {descriptor}
          </div>
        ) : null}
      </div>
    </div>
  );
}
