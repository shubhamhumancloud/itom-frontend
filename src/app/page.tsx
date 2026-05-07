import { AppShell } from '@/components/app/app-shell';
import { DashboardOverview } from '@/components/itom/dashboard-overview';

export default function HomePage() {
  return (
    <AppShell>
      <DashboardOverview />
    </AppShell>
  );
}
