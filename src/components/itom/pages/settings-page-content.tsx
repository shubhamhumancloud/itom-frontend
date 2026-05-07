'use client';

import { useState } from 'react';
import { Building2, Check, Copy, Link2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { agentsApi } from '@/lib/api';
import { decodeJwtClaims, readCookieValue } from '@/lib/auth';

function CopyableCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="relative">
      <pre className="overflow-auto rounded-md border border-border bg-muted/50 p-4 pr-12 text-xs leading-relaxed">
        <code>{command}</code>
      </pre>
      <Button
        size="sm"
        variant="ghost"
        onClick={onCopy}
        className="absolute right-2 top-2 h-7 w-7 p-0"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

export function SettingsPageContent() {
  const token = readCookieValue('accessToken') ?? readCookieValue('itom_accessToken');
  const claims = decodeJwtClaims(token);
  const tenantId = String(claims?.tenantId ?? claims?.tid ?? '');
  const queryClient = useQueryClient();

  const claim = useMutation({
    mutationFn: agentsApi.claimOrphans,
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
        return;
      }
      toast.success(
        data.updatedAgents
          ? `Claimed ${data.updatedAgents} agent${data.updatedAgents === 1 ? '' : 's'}`
          : 'No orphan agents found',
      );
      queryClient.invalidateQueries();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Claim failed'),
  });

  const serverUrl = 'http://182.168.1.239:3007';

  const unixCommand = tenantId
    ? `curl -fsSL ${serverUrl}/v1/agents/install.sh | ITOM_SERVER_URL=${serverUrl} ITOM_TENANT_ID=${tenantId} sh
ITOM_SERVER_URL=${serverUrl} ITOM_TENANT_ID=${tenantId} ~/.local/bin/itom-agent`
    : `curl -fsSL ${serverUrl}/v1/agents/install.sh | ITOM_SERVER_URL=${serverUrl} sh
ITOM_SERVER_URL=${serverUrl} ~/.local/bin/itom-agent`;

  const windowsCommand = tenantId
    ? `$d="$HOME\\.local\\bin"; mkdir $d -Force | Out-Null
iwr ${serverUrl}/v1/agents/download/itom-agent-windows-amd64.exe -OutFile "$d\\itom-agent.exe"
$env:ITOM_SERVER_URL="${serverUrl}"; $env:ITOM_TENANT_ID="${tenantId}"
& "$d\\itom-agent.exe"`
    : `$d="$HOME\\.local\\bin"; mkdir $d -Force | Out-Null
iwr ${serverUrl}/v1/agents/download/itom-agent-windows-amd64.exe -OutFile "$d\\itom-agent.exe"
$env:ITOM_SERVER_URL="${serverUrl}"
& "$d\\itom-agent.exe"`;

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground">
          Install ITOM agents and bind them to your tenant
        </p>
      </div>

      {tenantId && (
        <Card className="border-border/90 shadow-(--shadow-soft)">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Building2 className="h-4 w-4 text-violet-600" />
              Your tenant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-sm">{tenantId}</div>
            <p className="mt-2 text-xs text-muted-foreground">
              Agents installed with the commands below will register against this tenant
              and only show up on this dashboard.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/90 shadow-(--shadow-soft)">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Link2 className="h-4 w-4 text-emerald-600" />
            Claim orphan agents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Bind every agent in the database that isn&apos;t bound to a tenant yet to your
            tenant. Use this once for agents installed before the tenant binding was wired up.
          </p>
          <Button
            onClick={() => claim.mutate()}
            disabled={!tenantId || claim.isPending}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {claim.isPending ? 'Claiming…' : 'Claim orphan agents'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/90 shadow-(--shadow-soft)">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Install on Linux / macOS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Run on the host you want to monitor. The script auto-detects OS/arch.
          </p>
          <CopyableCommand command={unixCommand} />
        </CardContent>
      </Card>

      <Card className="border-border/90 shadow-(--shadow-soft)">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Install on Windows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Run in PowerShell on the host you want to monitor.
          </p>
          <CopyableCommand command={windowsCommand} />
        </CardContent>
      </Card>
    </div>
  );
}
