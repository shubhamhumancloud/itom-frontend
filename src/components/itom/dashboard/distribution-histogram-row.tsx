'use client';

import { Cpu, HardDrive, MemoryStick } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DistributionHistogram } from '@/components/itom/charts/distribution-histogram';
import type { FleetStats } from '@/hooks/use-itom';

/**
 * Row 4 — CPU / Memory / Disk distribution histograms.
 *
 * Ten-bar histograms scale to any fleet size: the chart shape stays
 * legible whether there are 10 agents or 10k. Each card shares the
 * same Hear-style content-card shell so the whole row reads as a
 * single comparable unit.
 */
export function DistributionHistogramRow({
  stats,
}: {
  stats: FleetStats;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            CPU usage distribution
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Agents bucketed by their latest CPU% sample
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <DistributionHistogram buckets={stats.cpu.buckets} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <MemoryStick className="h-4 w-4 text-primary" />
            Memory usage distribution
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Agents bucketed by their latest memory% sample
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <DistributionHistogram buckets={stats.memory.buckets} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary" />
            Disk usage distribution
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Agents bucketed by their highest mountpoint usage
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <DistributionHistogram buckets={stats.disk.buckets} />
        </CardContent>
      </Card>
    </div>
  );
}
