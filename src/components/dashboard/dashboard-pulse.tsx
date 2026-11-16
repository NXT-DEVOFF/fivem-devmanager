"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Bug, CheckSquare2, FileCode2, Timer } from "lucide-react";
import { cn } from "@/components/ui/primitives";
import { formatDuration } from "@/lib/format";

export interface PulsePoint {
  date: string;
  activeSeconds: number;
  changes: number;
  tasks: number;
  fixes: number;
}

type MetricKey = "activeSeconds" | "changes" | "tasks" | "fixes";

const METRICS = [
  { id: "activeSeconds" as const, label: "Temps actif", icon: Timer, color: "#8189F6" },
  { id: "changes" as const, label: "Modifications", icon: FileCode2, color: "#38BDF8" },
  { id: "tasks" as const, label: "Taches livrees", icon: CheckSquare2, color: "#22C55E" },
  { id: "fixes" as const, label: "Bugs corriges", icon: Bug, color: "#F59E0B" },
];

const CHART_STYLE = {
  background: "#151B26",
  border: "1px solid #252D3B",
  borderRadius: 8,
  fontSize: 11,
};

function formatValue(metric: MetricKey, value: number): string {
  if (metric === "activeSeconds") return formatDuration(value);
  return String(Math.round(value));
}

export function DashboardPulse({ data }: { data: PulsePoint[] }) {
  const [metric, setMetric] = React.useState<MetricKey>("activeSeconds");
  const [range, setRange] = React.useState<7 | 14>(7);

  const visible = range === 14 ? data : data.slice(-7);
  const meta = METRICS.find((entry) => entry.id === metric) ?? METRICS[0]!;
  const total = visible.reduce((sum, point) => sum + point[metric], 0);
  const hasActivity = visible.some((point) => point[metric] > 0);

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-primary-300" /> Pouls de l&apos;equipe
          </h3>
          <p className="mt-0.5 text-[11px] text-muted">
            Le rythme reel du travail sur les {range} derniers jours.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface/60 p-0.5">
          {[7, 14].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value as 7 | 14)}
              className={cn(
                "rounded-md px-2 py-1 text-[10px] transition-colors",
                range === value
                  ? "bg-elevated text-fg shadow-sm"
                  : "text-muted hover:text-fg",
              )}
            >
              {value} j
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <div className="flex flex-wrap gap-1">
          {METRICS.map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setMetric(entry.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10.5px] transition-colors",
                  metric === entry.id
                    ? "bg-white/[0.07] text-fg"
                    : "text-muted hover:bg-white/[0.03] hover:text-fg",
                )}
              >
                <Icon className="h-3 w-3" style={{ color: entry.color }} />
                {entry.label}
              </button>
            );
          })}
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted">Total sur la periode</p>
          <p className="text-lg font-semibold tracking-tight text-fg">
            {formatValue(metric, total)}
          </p>
        </div>
      </div>

      <div className="h-[230px] px-2 pb-2 pt-3">
        {hasActivity ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={visible} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`pulse-${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={meta.color} stopOpacity={0.26} />
                  <stop offset="100%" stopColor={meta.color} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1c2432" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "#94A3B8", fontSize: 9 }}
                tickFormatter={(value: string) => value.slice(5).replace("-", "/")}
                axisLine={false}
                tickLine={false}
                minTickGap={22}
              />
              <YAxis
                tick={{ fill: "#94A3B8", fontSize: 9 }}
                tickFormatter={(value: number) =>
                  metric === "activeSeconds" ? `${Math.round(value / 3600)}h` : String(value)
                }
                axisLine={false}
                tickLine={false}
                width={42}
              />
              <Tooltip
                contentStyle={CHART_STYLE}
                labelFormatter={(value: string) => `Le ${value.slice(8)}/${value.slice(5, 7)}`}
                formatter={(value: number) => [formatValue(metric, value), meta.label]}
              />
              <Area
                type="monotone"
                dataKey={metric}
                stroke={meta.color}
                strokeWidth={2}
                fill={`url(#pulse-${metric})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Activity className="h-5 w-5 text-muted/40" />
            <p className="text-xs text-muted">Pas encore d&apos;activite sur cette periode.</p>
            <p className="text-[10px] text-muted/60">
              Demarrez une session ou terminez une tache pour alimenter ce pouls.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-2.5 text-[10px] text-muted">
        <span>
          {visible.length} jours · sessions, modifications, taches livrees et bugs corriges
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
          {meta.label}
        </span>
      </div>
    </div>
  );
}
