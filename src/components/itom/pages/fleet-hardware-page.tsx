'use client';

import { useEffect, useState } from 'react';
import { useAgents } from '@/hooks/use-itom';
import { AgentPicker } from '@/components/itom/agent-picker';
import { InlineLoader, LoadingOverlay, useColdLoad } from '@/components/ui/loaders';
import { AgentHardwareTab } from './agent-hardware-tab';

/**
 * Sidebar Monitoring → Hardware page.
 *
 * Hosts the battery / sensors / GPU cards scoped to one agent at a time.
 * Hardware readings are intrinsically per-host (one machine's CPU
 * temperatures don't aggregate with another's), so the page is shaped
 * exactly like /metrics and /processes: an agent picker on top, the
 * existing AgentHardwareTab below.
 */
export function FleetHardwarePage() {
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
            Hardware
          </h1>
          <p className="text-xs text-muted-foreground">
            Battery, sensors and GPU for the selected agent. Battery samples
            every five minutes; sensors and GPU every minute.
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
            collecting hardware readings.
          </p>
        ) : agentId ? (
          <AgentHardwareTab agentId={agentId} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Pick an agent above to see its hardware readings.
          </p>
        )}
      </div>
    </div>
  );
}
