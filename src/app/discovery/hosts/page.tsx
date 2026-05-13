import { AppShell } from '@/components/app/app-shell';
import { HostsPage } from '@/components/itom/pages/hosts-page';

export default function DiscoveryHostsRoute() {
  return (
    <AppShell>
      <HostsPage />
    </AppShell>
  );
}
