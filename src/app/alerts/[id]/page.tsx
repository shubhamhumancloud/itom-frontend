import { AppShell } from '@/components/app/app-shell';
import { IncidentDetailPage } from '@/components/itom/pages/incident-detail-page';

export default async function IncidentDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell>
      <IncidentDetailPage incidentId={id} />
    </AppShell>
  );
}
