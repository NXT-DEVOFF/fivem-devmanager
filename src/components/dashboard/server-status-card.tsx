"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Cpu,
  HardDrive,
  MemoryStick,
  Play,
  Power,
  RefreshCw,
  RotateCw,
  Square,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { Badge, Button, Progress, cn } from "@/components/ui/primitives";
import { formatBytes, relativeTime } from "@/lib/format";

interface InfrastructurePayload {
  configured: boolean;
  config: { panelUrl: string; serverId: string; name: string } | null;
  live?: {
    ok: boolean;
    error?: string;
    server?: { name: string; status: string | null; suspended: boolean };
    resources?: {
      state: string;
      cpu: number;
      memoryBytes: number;
      memoryLimitBytes: number;
      diskBytes: number;
      diskLimitBytes: number;
      uptimeMs: number;
      networkRx: number;
      networkTx: number;
    };
  };
}

export function ServerStatusCard({
  canPower,
  canOpenConsole,
  trend,
}: {
  canPower: boolean;
  canOpenConsole: boolean;
  trend?: { cpu: number[]; memory: number[] };
}) {
  const [data, setData] = React.useState<InfrastructurePayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [action, setAction] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const payload = await apiFetch<InfrastructurePayload>("/api/infrastructure");
      setData(payload);
      setError(payload.live?.error ?? null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 30_000);
    return () => clearInterval(interval);
  }, [load]);

  async function power(signal: "start" | "stop" | "restart") {
    setAction(signal);
    try {
      await apiFetch("/api/infrastructure/power", { method: "POST", body: { signal } });
      toast.success(`Signal ${signal} envoye`);
      setTimeout(() => void load(), 2500);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setAction(null);
    }
  }

  if (loading) {
    return <div className="panel h-[220px] animate-pulse" />;
  }

  if (!data?.configured) {
    return (
      <div className="panel flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-warning/30 bg-warning/10">
          <AlertTriangle className="h-5 w-5 text-warning" />
        </div>
        <div>
          <p className="text-sm font-medium">Pterodactyl non configure</p>
          <p className="mt-1 max-w-sm text-xs text-muted">
            Renseignez l&apos;URL du panel et les cles API pour superviser le serveur FiveM.
          </p>
        </div>
        <Link
          href="/infrastructure"
          className="text-xs text-primary-300 underline-offset-4 hover:underline"
        >
          Configurer l&apos;infrastructure
        </Link>
      </div>
    );
  }

  const resources = data.live?.resources;
  const state = resources?.state ?? "unknown";
  const online = state === "running";
  const memoryPercent = resources?.memoryLimitBytes
    ? (resources.memoryBytes / resources.memoryLimitBytes) * 100
    : 0;
  const diskPercent = resources?.diskLimitBytes
    ? (resources.diskBytes / resources.diskLimitBytes) * 100
    : 0;

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg border",
              online
                ? "border-success/30 bg-success/10 text-success"
                : state === "starting"
                  ? "border-warning/30 bg-warning/10 text-warning"
                  : "border-danger/30 bg-danger/10 text-danger",
            )}
          >
            <Power className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {data.live?.server?.name ?? data.config?.name ?? "Serveur FiveM"}
            </p>
            <div className="mt-0.5 flex items-center gap-2">
              <Badge variant={online ? "success" : state === "starting" ? "warning" : "danger"}>
                {online ? "Online" : state === "starting" ? "Demarrage" : state === "stopping" ? "Arret" : "Offline"}
              </Badge>
              <span className="text-[10px] text-muted">
                {data.config?.panelUrl?.replace(/^https?:\/\//, "")}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="icon" variant="ghost" onClick={() => void load()} title="Rafraichir">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          {canOpenConsole ? (
            <Link
              href="/console"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[11px] text-muted hover:border-border-strong hover:text-fg"
            >
              <Terminal className="h-3.5 w-3.5" /> Console
            </Link>
          ) : null}
          {canPower ? (
            <>
              {!online ? (
                <Button size="sm" variant="success" loading={action === "start"} onClick={() => power("start")}>
                  <Play className="h-3 w-3" /> Demarrer
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="secondary" loading={action === "restart"} onClick={() => power("restart")}>
                    <RotateCw className="h-3 w-3" /> Redemarrer
                  </Button>
                  <Button size="sm" variant="danger" loading={action === "stop"} onClick={() => power("stop")}>
                    <Square className="h-3 w-3" /> Arreter
                  </Button>
                </>
              )}
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 border-b border-danger/20 bg-danger/[0.06] px-5 py-2.5 text-[11px] text-danger">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
        <Metric
          icon={Cpu}
          label="CPU"
          value={resources ? `${resources.cpu.toFixed(1)} %` : "-"}
          spark={trend?.cpu}
        >
          <Progress value={Math.min(100, resources?.cpu ?? 0)} />
        </Metric>
        <Metric
          icon={MemoryStick}
          label="Memoire"
          value={
            resources
              ? `${formatBytes(resources.memoryBytes)} / ${formatBytes(resources.memoryLimitBytes)}`
              : "-"
          }
          spark={trend?.memory}
        >
          <Progress value={memoryPercent} />
        </Metric>
        <Metric
          icon={HardDrive}
          label="Disque"
          value={
            resources
              ? `${formatBytes(resources.diskBytes)} / ${formatBytes(resources.diskLimitBytes)}`
              : "-"
          }
        >
          <Progress value={diskPercent} />
        </Metric>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-2.5 text-[10px] text-muted">
        <span>
          Uptime :{" "}
          {resources
            ? `${Math.floor(resources.uptimeMs / 3600000)} h ${Math.floor((resources.uptimeMs % 3600000) / 60000)} min`
            : "-"}
        </span>
        <span>
          Reseau : {resources ? `${formatBytes(resources.networkRx)} recus / ${formatBytes(resources.networkTx)} envoyes` : "-"}
        </span>
        <span>Verifie {relativeTime(new Date().toISOString())}</span>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  children,
  spark,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  children?: React.ReactNode;
  spark?: number[];
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-surface/60 p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted">
          <Icon className="h-3 w-3" /> {label}
        </span>
        <span className="mono text-[11px] text-fg">{value}</span>
      </div>
      <div className="mt-2">{children}</div>
      {spark && spark.length > 1 ? <MiniSpark values={spark} /> : null}
    </div>
  );
}

function MiniSpark({ values }: { values: number[] }) {
  const width = 160;
  const height = 16;
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - (Math.max(0, value) / max) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-4 w-full opacity-70" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary-300"
      />
    </svg>
  );
}
