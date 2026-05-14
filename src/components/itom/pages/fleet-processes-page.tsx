'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAgents } from '@/hooks/use-itom';
import { AgentPicker } from '@/components/itom/agent-picker';
import { InlineLoader, LoadingOverlay, useColdLoad } from '@/components/ui/loaders';
import { AgentProcessesTab } from './agent-processes-tab';

/**
 * Sidebar Monitoring → Processes page.
 *
 * Hosts the Top-Processes table (per-process CPU / Memory / I/O with
 * sparklines) scoped to one agent at a time. The picker swaps which
 * agent's process list we render. Processes are intrinsically per-host —
 * there is no useful fleet-wide aggregation — so this page is structured
 * exactly like /metrics: pick an agent, show its data.
 */
export function FleetProcessesPage() {
  const { data: agents = [], isLoading } = useAgents();
  const [agentId, setAgentId] = useState<string>('');
  const showOverlay = useColdLoad(isLoading, agents.length > 0);

  // Auto-pick the first agent on first load so there's something to render.
  useEffect(() => {
    if (!agentId && agents.length > 0) {
      setAgentId(agents[0].agentId);
    }
  }, [agentId, agents]);

  // AgentProcessesTab needs `os` to decide whether to render the I/O Read /
  // I/O Write columns (hidden on darwin, shown elsewhere). Pull it from the
  // fleet list rather than firing a second per-agent query.
  const selectedOs = useMemo(
    () => agents.find((a) => a.agentId === agentId)?.os,
    [agents, agentId],
  );

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <LoadingOverlay isLoading={showOverlay} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Processes
          </h1>
          <p className="text-xs text-muted-foreground">
            Top processes by CPU and memory for the selected agent. Sampled
            once a minute.
          </p>
        </div>
        <AgentPicker
          value={agentId}
          onChange={(v) => {
            // "All agents" sentinel doesn't make sense for a per-host view.
            if (!v || v === '__all__') {
              setAgentId(agents[0]?.agentId ?? '');
              return;
            }
            setAgentId(v);
          }}
          placeholder="Select agent"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {isLoading ? (
          <InlineLoader label="Loading agents…" />
        ) : agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No agents registered yet. Install the agent on a host to start
            collecting process samples.
          </p>
        ) : agentId ? (
          <AgentProcessesTab agentId={agentId} os={selectedOs} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Pick an agent above to see its top processes.
          </p>
        )}
      </div>
    </div>
  );
}
