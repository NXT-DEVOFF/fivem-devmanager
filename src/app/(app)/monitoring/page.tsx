"use client";

import * as React from "react";
import { Activity, Cpu, Database, HardDrive, MemoryStick, RefreshCw, ServerOff, Timer } from "lucide-react";
import { useApi } from "@/lib/use-api";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Select,
  Skeleton,
  Stat,
} from "@/components/ui/primitives";
import { formatBytes, formatDuration, formatTime, relativeTime } from "@/lib/format";

interface MetricPoint {
  t: string;
  cpu: number;
  memory: number;
  memoryLimit: number;
  disk: number;
  diskLimit: number;
  state: string;
  uptime: number;
}

interface MetricsPayload {
  configured: boolean;
  retentionDays: number;
  intervalSeconds: number;
  range: { id: string; label: string; bucketMs: number };
  points: MetricPoint[];
  summary: {
    samples: number;
    avgCpu: number;
    maxCpu: number;
    avgMemory: number;
    maxMemory: number;
    memoryLimit: number;
    disk: number;
    diskLimit: number;
    uptime: number;
  } | null;
  latest: {
    state: string;
    cpu: number;
    memory: number;
    memoryLimit: number;
    disk: number;
    diskLimit: number;
    uptime: number;
    recordedAt: string;
  } | null;
}

const RANGES = [
  { id: "1h", label: "1 heure" },
  { id: "6h", label: "6 heures" },
  { id: "24h", label: "24 heures" },
  { id: "7d", label: "7 jours" },
];

export default function MonitoringPage() {
  const [range, setRange] = React.useState("24h");
  const metrics = useApi<MetricsPayload>(`/api/metrics?range=${range}`, { pollMs: 60_000 });

  const points = metrics.data?.points ?? [];
  const latest = metrics.data?.latest ?? null;
  const summary = metrics.data?.summary ?? null;
  const running = latest?.state === "running";
  const memoryPercent =
    latest && latest.memoryLimit > 0 ? (latest.memory / latest.memoryLimit) * 100 : 0;

  return (
    <div>
      <PageHeader
        title="Surveillance"
        description="Historique reel du CPU, de la RAM et du disque du serveur, echantillonne depuis l'API Pterodactyl."
        eyebrow="Systeme"
      >
        <Badge variant={running ? "success" : latest ? "warning" : "neutral"}>
          {latest?.state ?? "aucune donnee"}
        </Badge>
        <Button variant="ghost" size="sm" onClick={() => void metrics.refresh()} loading={metrics.loading}>
          <RefreshCw className="h-3.5 w-3.5" /> Rafraichir
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={range} onChange={(event) => setRange(event.target.value)} className="w-auto">
          {RANGES.map((option) => (
            <option key={option.id} value={option.id}>
              Dernieres {option.label}
            </option>
          ))}
        </Select>
        <p className="text-[11px] text-muted">
          Un echantillon toutes les {metrics.data?.intervalSeconds ?? 60} s · conservation{" "}
          {metrics.data?.retentionDays ?? 14} jours
        </p>
      </div>

      {metrics.loading && !metrics.data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      ) : metrics.error ? (
        <Card className="p-6 text-sm text-danger">{metrics.error}</Card>
      ) : !metrics.data?.configured ? (
        <Card>
          <EmptyState
            icon={<ServerOff className="h-5 w-5" />}
            title="Pterodactyl non configure"
            description="Renseignez le panel dans Infrastructure pour demarrer la collecte des ressources."
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="CPU"
              value={latest ? `${latest.cpu.toFixed(1)} %` : "-"}
              hint={summary ? `moyenne ${summary.avgCpu.toFixed(1)} % · max ${summary.maxCpu.toFixed(1)} %` : undefined}
              icon={<Cpu className="h-4 w-4" />}
              accent={latest && latest.cpu >= 85 ? "danger" : "primary"}
            />
            <Stat
              label="Memoire"
              value={latest ? formatBytes(latest.memory) : "-"}
              hint={latest ? `${memoryPercent.toFixed(0)} % de ${formatBytes(latest.memoryLimit)}` : undefined}
              icon={<MemoryStick className="h-4 w-4" />}
              accent={memoryPercent >= 90 ? "danger" : memoryPercent >= 75 ? "warning" : "success"}
            />
            <Stat
              label="Disque"
              value={latest ? formatBytes(latest.disk) : "-"}
              hint={latest ? `limite ${formatBytes(latest.diskLimit)}` : undefined}
              icon={<HardDrive className="h-4 w-4" />}
            />
            <Stat
              label="Uptime"
              value={latest ? formatDuration(latest.uptime) : "-"}
              hint={latest ? `releve ${relativeTime(latest.recordedAt)}` : undefined}
              icon={<Timer className="h-4 w-4" />}
              accent="info"
            />
          </div>

          <Card>
            <CardHeader>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <Activity className="h-4 w-4 text-primary-300" /> Historique ({metrics.data.range?.label})
              </h3>
              <span className="text-[10px] text-muted">{summary?.samples ?? 0} echantillons</span>
            </CardHeader>
            <CardBody>
              {points.length < 2 ? (
                <EmptyState
                  icon={<Database className="h-5 w-5" />}
                  title="Pas encore assez d'echantillons"
                  description="Le premier releve arrive dans quelques secondes apres le demarrage de l'application. Revenez dans une minute."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => void metrics.refresh()}>
                      Verifier maintenant
                    </Button>
                  }
                />
              ) : (
                <SeriesChart points={points} />
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

function SeriesChart({ points }: { points: MetricPoint[] }) {
  const width = 760;
  const height = 240;
  const padding = { top: 12, right: 10, bottom: 20, left: 26 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const cpu = points.map((point) => Math.min(100, Math.max(0, point.cpu)));
  const ram = points.map((point) =>
    point.memoryLimit > 0 ? Math.min(100, Math.max(0, (point.memory / point.memoryLimit) * 100)) : 0,
  );

  const x = (index: number) =>
    padding.left + (index / Math.max(1, points.length - 1)) * plotWidth;
  const y = (value: number) => padding.top + (1 - value / 100) * plotHeight;

  const path = (values: number[]) =>
    values
      .map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`)
      .join(" ");

  const area = (values: number[]) => {
    if (values.length === 0) return "";
    return `${path(values)} L${x(values.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  };

  const ticks = [0, 25, 50, 75, 100];
  const labels = [0, Math.floor(points.length / 2), points.length - 1].filter(
    (index, position, all) => all.indexOf(index) === position,
  );

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-60 w-full" role="img" aria-label="Historique CPU et memoire">
        <defs>
          <linearGradient id="fdm-cpu-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7C8CFF" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#7C8CFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="fdm-ram-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3DDC97" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#3DDC97" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="rgba(255,255,255,0.07)"
              strokeWidth={1}
            />
            <text x={4} y={y(tick) + 3} fontSize={9} fill="rgba(255,255,255,0.38)">
              {tick}
            </text>
          </g>
        ))}

        <path d={area(cpu)} fill="url(#fdm-cpu-fill)" />
        <path d={path(cpu)} fill="none" stroke="#7C8CFF" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />

        <path d={area(ram)} fill="url(#fdm-ram-fill)" />
        <path d={path(ram)} fill="none" stroke="#3DDC97" strokeWidth={1.5} strokeDasharray="4 3" strokeLinejoin="round" />

        {labels.map((index) => (
          <text
            key={index}
            x={x(index)}
            y={height - 6}
            fontSize={9}
            fill="rgba(255,255,255,0.38)"
            textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
          >
            {formatTime(points[index]?.t)}
          </text>
        ))}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-4 text-[10.5px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-[#7C8CFF]" /> CPU (%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-[#3DDC97]" /> Memoire (% de la limite)
        </span>
        <span className="ml-auto text-muted/70">
          pic CPU {Math.max(...cpu).toFixed(1)} % · pic memoire {Math.max(...ram).toFixed(1)} %
        </span>
      </div>
    </div>
  );
}
