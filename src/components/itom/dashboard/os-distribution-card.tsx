'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OsDistributionChart } from '@/components/itom/charts/os-distribution-chart';
import type { OsDistributionEntry } from '@/lib/api';

/**
 * "OS Distribution" card — donut breakdown of agents by operating
 * system. Lives next to <IncidentsCard> on Row 3 so the operator
 * sees both "what's broken now" and "what does the fleet look like"
 * side-by-side.
 */
export function OsDistributionCard({
  data,
}: {
  data: OsDistributionEntry[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>OS Distribution</CardTitle>
        <p className="text-xs text-muted-foreground">
          Breakdown of agents by operating system
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <OsDistributionChart data={data} />
      </CardContent>
    </Card>
  );
}
