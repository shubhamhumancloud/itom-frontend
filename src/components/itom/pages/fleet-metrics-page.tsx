'use client';

import { useEffect, useState } from 'react';
import { useAgents } from '@/hooks/use-itom';
import { AgentPicker } from '@/components/itom/agent-picker';
import { InlineLoader, LoadingOverlay, useColdLoad } from '@/components/ui/loaders';
import { PageHeader } from '@/components/app/page-header';
import { AgentPerformanceTab } from './agent-performance-tab';

/**
 * Sidebar Monitoring → Metrics page.
 *
 * Hosts the Task-Manager-style Performance view (CPU / Memory / per-mount
 * disk / per-interface network / per-GPU) scoped to one agent at a time.
 * The view itself lives in <AgentPerformanceTab/>; this page is the
 * agent-picker wrapper + landing-state copy.
 *
 * Why not a fleet-wide chart? Per-disk and per-interface readouts only
 * make sense for one host — and the page used to interleave fleet vs.
 * single-host modes with confusing semantics. Pinning this page to one
 * agent is the simpler, more useful default. The agent-table page is
 * still the right place for fleet-wide aggregates.
 */
export function FleetMetricsPage() {
  const { data: agents = [], isLoading } = useAgents();
  const [agentId, setAgentId] = useState<string>('');
  const showOverlay = useColdLoad(isLoading, agents.length > 0);

  // Auto-pick the first agent so the Performance view has something to
  // render on first load. The user can swap via the picker anytime.
  useEffect(() => {
    if (!agentId && agents.length > 0) {
      setAgentId(agents[0].agentId);
    }
  }, [agentId, agents]);

  return (
    // Full-height page: header on top, content fills the rest. `min-h-0`
    // on the content lane lets internal overflow areas (the left rail
    // and the right-pane chart/table) scroll within the available space
    // instead of pushing the page taller.
    <div className="flex h-full w-full flex-col gap-4">
      <LoadingOverlay isLoading={showOverlay} />
      <PageHeader
        title="Metrics"
        description="CPU, memory, disk, network and GPU for the selected agent. Pick a resource on the left to dive in."
        action={
          <AgentPicker
            value={agentId}
            onChange={(v) => {
              // AgentPicker's "All agents" sentinel doesn't make sense here
              // — fall back to the first concrete agent if the user picks it.
              if (!v || v === '__all__') {
                setAgentId(agents[0]?.agentId ?? '');
                return;
              }
              setAgentId(v);
            }}
            placeholder="Select agent"
          />
        }
      />

      <div className="flex min-h-0 flex-1 flex-col">
        {isLoading ? (
          <InlineLoader label="Loading agents…" />
        ) : agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No agents registered yet. Install the agent on a host to start
            collecting metrics.
          </p>
        ) : agentId ? (
          <AgentPerformanceTab agentId={agentId} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Pick an agent above to see its Performance view.
          </p>
        )}
      </div>
    </div>
  );
}
