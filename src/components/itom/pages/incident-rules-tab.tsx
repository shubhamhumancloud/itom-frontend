'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/loaders';
import { useAlertRuleActions, useAlertRules } from '@/hooks/use-itom';
import { cn } from '@/lib/utils';
import type { AlertRulePatch, AlertRuleRow } from '@/lib/api';

/** Human labels for the rule `metric` enum. */
const METRIC_LABEL: Record<string, string> = {
  cpu: 'CPU utilisation',
  memory: 'Memory utilisation',
  disk: 'Disk usage',
  gpu_temp: 'GPU temperature',
  cpu_temp: 'System temperature',
  battery: 'Battery level',
  process_cpu: 'Process CPU',
  net_throughput: 'Network throughput',
  agent_offline: 'Agent offline',
  agent_flapping: 'Agent flapping',
};

/** Metrics with no numeric thresholds to tune — only enable + window. */
const THRESHOLDLESS = new Set(['agent_offline']);

/**
 * Rules tab — the effective threshold rule set for the tenant. Editing a
 * shared "Global" rule transparently forks a tenant-scoped override; the
 * Reset action drops that override and reverts to the global default.
 */
export function IncidentRulesTab() {
  const { data: rules = [], isLoading } = useAlertRules();
  const { update, reset } = useAlertRuleActions();

  if (isLoading) return <TableSkeleton rows={6} columns={7} />;
  if (rules.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">No alert rules defined.</p>
      </div>
    );
  }

  return (
    <Card className="!p-0">
      <CardContent className="!p-0">
        <div className="max-h-[calc(100vh-320px)] min-h-[320px] overflow-y-auto">
          <Table className="table-fixed">
            <TableHeader className="!bg-card [&_th]:!border-b-0">
              <TableRow>
                <TableHead className="w-[24%]">Rule</TableHead>
                <TableHead className="w-[12%] text-right">Warning</TableHead>
                <TableHead className="w-[12%] text-right">Critical</TableHead>
                <TableHead className="w-[12%] text-right">Recovery</TableHead>
                <TableHead className="w-[12%] text-right">For (s)</TableHead>
                <TableHead className="w-[10%]">State</TableHead>
                <TableHead className="w-[18%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  saving={update.isPending}
                  onSave={(patch) => update.mutate({ id: rule.id, patch })}
                  onReset={() => reset.mutate(rule.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/** One editable rule row with a local draft committed via Save. */
function RuleRow({
  rule,
  saving,
  onSave,
  onReset,
}: {
  rule: AlertRuleRow;
  saving: boolean;
  onSave: (patch: AlertRulePatch) => void;
  onReset: () => void;
}) {
  const [warning, setWarning] = useState(numStr(rule.warningThreshold));
  const [critical, setCritical] = useState(numStr(rule.criticalThreshold));
  const [recovery, setRecovery] = useState(numStr(rule.recoveryThreshold));
  const [forSeconds, setForSeconds] = useState(String(rule.forSeconds));
  const [enabled, setEnabled] = useState(rule.enabled);

  const dirty =
    warning !== numStr(rule.warningThreshold) ||
    critical !== numStr(rule.criticalThreshold) ||
    recovery !== numStr(rule.recoveryThreshold) ||
    forSeconds !== String(rule.forSeconds) ||
    enabled !== rule.enabled;

  const thresholdless = THRESHOLDLESS.has(rule.metric);

  const save = () =>
    onSave({
      warningThreshold: parseStr(warning),
      criticalThreshold: parseStr(critical),
      recoveryThreshold: parseStr(recovery),
      forSeconds: parseInt(forSeconds, 10) || 0,
      enabled,
    });

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium text-foreground">{rule.name}</div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{METRIC_LABEL[rule.metric] ?? rule.metric}</span>
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium',
              rule.scope === 'tenant'
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {rule.scope === 'tenant' ? 'Custom' : 'Global'}
          </span>
        </div>
      </TableCell>

      <TableCell className="text-right">
        <NumCell
          value={warning}
          onChange={setWarning}
          disabled={thresholdless}
        />
      </TableCell>
      <TableCell className="text-right">
        <NumCell
          value={critical}
          onChange={setCritical}
          disabled={thresholdless}
        />
      </TableCell>
      <TableCell className="text-right">
        <NumCell
          value={recovery}
          onChange={setRecovery}
          disabled={thresholdless}
        />
      </TableCell>
      <TableCell className="text-right">
        <NumCell value={forSeconds} onChange={setForSeconds} />
      </TableCell>

      <TableCell>
        <button
          type="button"
          onClick={() => setEnabled((v) => !v)}
          className={cn(
            'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium capitalize transition-colors',
            enabled
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-600',
          )}
        >
          {enabled ? 'Enabled' : 'Disabled'}
        </button>
      </TableCell>

      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          {rule.scope === 'tenant' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-muted-foreground"
              title="Revert to global default"
              onClick={onReset}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            size="sm"
            className="h-8"
            disabled={!dirty || saving}
            onClick={save}
          >
            Save
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function NumCell({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  if (disabled) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <Input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full text-right tabular-nums"
    />
  );
}

/** Empty string for a null threshold so the input renders blank. */
function numStr(v: number | null): string {
  return v == null ? '' : String(v);
}

/** Parse an input back to a number, or null when blank. */
function parseStr(v: string): number | null {
  const t = v.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
