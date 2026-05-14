import { cn } from '@/lib/utils';

/**
 * Categorical severity badge, per Hear DS:
 *   critical → solid red
 *   high     → solid amber
 *   medium   → solid teal
 *   low      → solid gray
 * All four use white text on a saturated fill. h-6 / 12px text /
 * medium weight / rounded-md to match the rest of the badge family.
 *
 * The colors come from CSS vars (`--severity-*`) so dark mode adapts
 * automatically (saturated shifts in `.dark` keep the badges legible
 * against the darker card backgrounds).
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low';

const toneByLevel: Record<Severity, string> = {
  critical: 'bg-severity-critical text-white',
  high: 'bg-severity-high text-white',
  medium: 'bg-severity-medium text-white',
  low: 'bg-severity-low text-white',
};

export function SeverityBadge({
  level,
  className,
}: {
  level: Severity;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-md px-3 text-xs font-medium capitalize',
        toneByLevel[level],
        className,
      )}
    >
      {level}
    </span>
  );
}
