import { cn } from '@/lib/utils';
import type { AlertSeverity, IncidentStatus } from '@/lib/api';

/**
 * Badges for the alerts/incidents module.
 *
 * The evaluator emits a two-level severity scale (`warning` / `critical`),
 * narrower than the categorical SeverityBadge — so this is its own small
 * badge rather than a remap onto that component.
 */
export function AlertSeverityBadge({
  severity,
  className,
}: {
  severity: AlertSeverity;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-md px-3 text-xs font-medium capitalize text-white',
        severity === 'critical' ? 'bg-severity-critical' : 'bg-severity-high',
        className,
      )}
    >
      {severity}
    </span>
  );
}

export function IncidentStatusBadge({
  status,
  className,
}: {
  status: IncidentStatus;
  className?: string;
}) {
  const tone =
    status === 'open'
      ? 'bg-rose-100 text-rose-700'
      : status === 'acknowledged'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-emerald-100 text-emerald-700';
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-3 text-xs font-medium capitalize',
        tone,
        className,
      )}
    >
      {status}
    </span>
  );
}
