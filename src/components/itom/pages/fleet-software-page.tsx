'use client';

import { useEffect, useState } from 'react';
import { useAgents } from '@/hooks/use-itom';
import { AgentPicker } from '@/components/itom/agent-picker';
import { InlineLoader, LoadingOverlay, useColdLoad } from '@/components/ui/loaders';
import { AgentSoftwareTab } from './agent-software-tab';

/**
 * Sidebar Monitoring → Software page.
 *
 * Hosts the installed-software inventory scoped to one agent at a time.
 * Software lists are intrinsically per-host (you want to know what's on
 * a specific machine), so the page is shaped exactly like /metrics,
 * /processes and /hardware: an agent picker on top, the existing
 * AgentSoftwareTab below.
 */
export function FleetSoftwarePage() {
  const { data: agents = [], isLoading } = useAgents();
  const [agentId, setAgentId] = useState<string>('');
  const showOverlay = useColdLoad(isLoading, agents.length > 0);

  useEffect(() => {
    if (!agentId && agents.length > 0) {
      setAgentId(agents[0].agentId);
    }
  }, [agentId, agents]);

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <LoadingOverlay isLoading={showOverlay} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Software
          </h1>
          <p className="text-xs text-muted-foreground">
            Installed applications for the selected agent. Refreshed daily
            from the host package manager.
          </p>
        </div>
        <AgentPicker
          value={agentId}
          onChange={(v) => {
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
            collecting software inventory.
          </p>
        ) : agentId ? (
          <AgentSoftwareTab agentId={agentId} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Pick an agent above to see its installed software.
          </p>
        )}
      </div>
    </div>
  );
}
