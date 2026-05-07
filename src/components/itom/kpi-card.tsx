'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type KpiTone = 'violet' | 'emerald' | 'rose' | 'orange' | 'indigo' | 'teal';

const toneStyles: Record<KpiTone, { chip: string; icon: string; descriptor: string }> = {
  violet: {
    chip: 'bg-violet-100 dark:bg-violet-500/15',
    icon: 'text-violet-600 dark:text-violet-300',
    descriptor: 'text-violet-600 dark:text-violet-300',
  },
  emerald: {
    chip: 'bg-emerald-100 dark:bg-emerald-500/15',
    icon: 'text-emerald-600 dark:text-emerald-300',
    descriptor: 'text-emerald-600 dark:text-emerald-300',
  },
  rose: {
    chip: 'bg-rose-100 dark:bg-rose-500/15',
    icon: 'text-rose-600 dark:text-rose-300',
    descriptor: 'text-rose-600 dark:text-rose-300',
  },
  orange: {
    chip: 'bg-orange-100 dark:bg-orange-500/15',
    icon: 'text-orange-600 dark:text-orange-300',
    descriptor: 'text-orange-600 dark:text-orange-300',
  },
  indigo: {
    chip: 'bg-indigo-100 dark:bg-indigo-500/15',
    icon: 'text-indigo-600 dark:text-indigo-300',
    descriptor: 'text-indigo-600 dark:text-indigo-300',
  },
  teal: {
    chip: 'bg-teal-100 dark:bg-teal-500/15',
    icon: 'text-teal-600 dark:text-teal-300',
    descriptor: 'text-teal-600 dark:text-teal-300',
  },
};

export function KpiCard({
  label,
  value,
  descriptor,
  tone,
  icon: Icon,
  descriptorTone,
}: {
  label: string;
  value: string | number;
  descriptor?: string;
  tone: KpiTone;
  icon: LucideIcon;
  descriptorTone?: KpiTone | 'muted';
}) {
  const styles = toneStyles[tone];
  const descClass =
    descriptorTone === 'muted'
      ? 'text-muted-foreground'
      : descriptorTone
      ? toneStyles[descriptorTone].descriptor
      : styles.descriptor;

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-(--shadow-soft) transition-shadow hover:shadow-(--shadow-elevated)">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', styles.chip)}>
          <Icon className={cn('h-4 w-4', styles.icon)} />
        </div>
      </div>
      <div className="mt-2 text-[1.6rem] font-bold leading-none tracking-tight text-foreground">
        {value}
      </div>
      {descriptor && (
        <div className={cn('mt-1.5 text-xs font-medium', descClass)}>{descriptor}</div>
      )}
    </div>
  );
}
