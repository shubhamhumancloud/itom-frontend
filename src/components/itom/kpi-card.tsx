'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Hear-style KPI metric card.
 *
 *   ┌────────────────────────────────────┐
 *   │ LABEL                       [icon] │  <- uppercase 13px, tinted 44×44 tile
 *   │                                    │
 *   │ 42                                 │  <- 36px Bold display, tabular nums
 *   │ +6 from last week                  │  <- 14px Medium, green / red / muted
 *   └────────────────────────────────────┘
 *
 * Spec (mirrors acai Hear admin dashboard):
 *   - p-6, rounded-lg, white card, shadow-soft → shadow-elevated on hover
 *   - Hover lifts 1px so the row reads as interactive without being noisy
 *   - Icon tile: 44×44, rounded-xl, pastel KPI-tint background driven by
 *     CSS vars in globals.css (--kpi-*-bg / --kpi-*-fg)
 *   - Number: 36px / font-display / Bold / tabular-nums / tight tracking
 *   - Label: 13px / SemiBold / UPPERCASE / wider letter-spacing
 *   - Descriptor: 14px / Medium / token-driven colour
 */
export type KpiTone =
  | 'peach'
  | 'purple'
  | 'teal'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'rose'
  | 'indigo';

const tones: Record<KpiTone, { bg: string; fg: string }> = {
  peach: { bg: 'bg-[var(--kpi-peach-bg)]', fg: 'text-[var(--kpi-peach-fg)]' },
  purple: { bg: 'bg-[var(--kpi-purple-bg)]', fg: 'text-[var(--kpi-purple-fg)]' },
  teal: { bg: 'bg-[var(--kpi-teal-bg)]', fg: 'text-[var(--kpi-teal-fg)]' },
  green: { bg: 'bg-[var(--kpi-green-bg)]', fg: 'text-[var(--kpi-green-fg)]' },
  yellow: { bg: 'bg-[var(--kpi-yellow-bg)]', fg: 'text-[var(--kpi-yellow-fg)]' },
  orange: { bg: 'bg-[var(--kpi-orange-bg)]', fg: 'text-[var(--kpi-orange-fg)]' },
  rose: { bg: 'bg-[var(--kpi-rose-bg)]', fg: 'text-[var(--kpi-rose-fg)]' },
  indigo: { bg: 'bg-[var(--kpi-indigo-bg)]', fg: 'text-[var(--kpi-indigo-fg)]' },
};

export type KpiDescriptorTone = 'muted' | 'success' | 'warning' | 'danger';
const descriptorTones: Record<KpiDescriptorTone, string> = {
  muted: 'text-muted-foreground',
  success: 'text-[#059669]',
  warning: 'text-[#d97706]',
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
    <div className="group relative flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            t.bg,
          )}
        >
          <Icon className={cn('h-[22px] w-[22px]', t.fg)} strokeWidth={2} />
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="font-display text-[36px] font-bold leading-none tracking-tight tabular-nums text-foreground">
          {value}
        </div>
        {descriptor ? (
          <div
            className={cn('text-sm font-medium', descriptorTones[descriptorTone])}
          >
            {descriptor}
          </div>
        ) : null}
      </div>
    </div>
  );
}
