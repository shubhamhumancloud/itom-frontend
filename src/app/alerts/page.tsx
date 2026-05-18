import { AppShell } from '@/components/app/app-shell';
import { IncidentsPage } from '@/components/itom/pages/incidents-page';

export default function AlertsRoute() {
  return (
    <AppShell>
      <IncidentsPage />
    </AppShell>
  );
}
