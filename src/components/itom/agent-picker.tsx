'use client';

import { Server } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAgents } from '@/hooks/use-itom';
import { agentLabel } from '@/lib/format';

export const ALL_AGENTS_VALUE = '__all__';

export function AgentPicker({
  value,
  onChange,
  placeholder = 'All agents',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const { data: agents = [], isLoading } = useAgents();

  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? '')}>
      <SelectTrigger className="w-[240px] max-w-full">
        <div className="flex min-w-0 items-center gap-2">
          <Server className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-left">
            <SelectValue placeholder={placeholder} />
          </span>
        </div>
      </SelectTrigger>
      <SelectContent className="max-w-[320px]">
        <SelectItem value={ALL_AGENTS_VALUE}>All agents</SelectItem>
        {isLoading ? (
          <SelectItem value="__loading__" disabled>
            Loading…
          </SelectItem>
        ) : (
          agents.map((a) => (
            <SelectItem key={a.agentId} value={a.agentId}>
              <span className="block max-w-[260px] truncate">
                {agentLabel(a.os, a.agentId)}
              </span>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
