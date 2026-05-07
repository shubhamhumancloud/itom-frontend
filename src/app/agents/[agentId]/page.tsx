import { AppShell } from '@/components/app/app-shell';
import { AgentDetailPage } from '@/components/itom/pages/agent-detail-page';

export default async function AgentDetailRoute({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  return (
    <AppShell>
      <AgentDetailPage agentId={agentId} />
    </AppShell>
  );
}
