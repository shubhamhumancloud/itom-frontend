'use client';

import { useState } from 'react';
import { Building2, Check, Copy, Download, Link2, RefreshCw, Timer } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { agentsApi, InstallTokenResponse } from '@/lib/api';
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

function ExpiryHint({ expiresAt }: { expiresAt: string }) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) {
    return <span className="text-rose-600">expired — generate a new command</span>;
  }
  const mins = Math.round(ms / 60000);
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Timer className="h-3 w-3" />
      Valid for {mins} more minute{mins === 1 ? '' : 's'}
    </span>
  );
}

export function SettingsPageContent() {
  const token = readCookieValue('accessToken') ?? readCookieValue('itom_accessToken');
  const claims = decodeJwtClaims(token);
  const tenantId = String(claims?.tenantId ?? claims?.tid ?? '');
  const queryClient = useQueryClient();

  const [installToken, setInstallToken] = useState<InstallTokenResponse | null>(null);

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

  const mintToken = useMutation({
    mutationFn: agentsApi.createInstallToken,
    onSuccess: (data) => {
      setInstallToken(data);
      toast.success('Install command ready. The token expires in about an hour.');
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Could not generate install command'),
  });

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
              Every agent installed with the commands below has this tenant id baked into
              its binary at download time. The agents can only register against this tenant —
              they will never appear on another customer&apos;s dashboard.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/90 shadow-(--shadow-soft)">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Download className="h-4 w-4 text-emerald-600" />
            Add an agent
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Click &quot;Generate install command&quot; to mint a fresh, short-lived install token.
            Each command is good for about an hour and can be used to install on as many hosts
            as you like during that window. The agent registers itself as a system service and
            keeps running after you close the terminal.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => mintToken.mutate()}
              disabled={!tenantId || mintToken.isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {mintToken.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Generating…
                </>
              ) : installToken ? (
                <>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Regenerate install command
                </>
              ) : (
                'Generate install command'
              )}
            </Button>
            {installToken && (
              <span className="text-xs">
                <ExpiryHint expiresAt={installToken.expiresAt} />
              </span>
            )}
          </div>

          {installToken ? (
            <div className="space-y-4 pt-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Linux / macOS</h3>
                <p className="mb-2 text-xs text-muted-foreground">
                  Run on the host you want to monitor. Requires <code>sudo</code> because the agent
                  registers as a system service.
                </p>
                <CopyableCommand command={installToken.commands.sh} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Windows (run as administrator)</h3>
                <p className="mb-2 text-xs text-muted-foreground">
                  Right-click the Start menu and choose <strong>Windows Terminal (Admin)</strong> or
                  <strong> PowerShell (Admin)</strong>, then paste the command below.
                  The command uses a <code>powershell</code> launcher so it also works if pasted into
                  <code> cmd.exe</code>, but you still need an elevated session — running unelevated
                  errors out before any changes are made.
                </p>
                <CopyableCommand command={installToken.commands.ps1} />
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No active install command yet. Click the button above to generate one.
            </p>
          )}
        </CardContent>
      </Card>

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
            {claim.isPending ? (
              <>
                <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                Claiming…
              </>
            ) : (
              'Claim orphan agents'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
