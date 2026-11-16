import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

const ACCENTS = {
  primary: "border-primary-500/20 bg-primary-500/10 text-primary-300",
  success: "border-success/20 bg-success/10 text-success",
  warning: "border-warning/20 bg-warning/10 text-warning",
  danger: "border-danger/20 bg-danger/10 text-danger",
  info: "border-info/20 bg-info/10 text-info",
  neutral: "border-border bg-white/5 text-muted",
};

export function DashboardKpi({
  label,
  value,
  hint,
  icon,
  accent = "primary",
  spark,
  trend,
  meter,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
  icon: React.ReactNode;
  accent?: keyof typeof ACCENTS;
  spark?: number[];
  trend?: number | null;
  meter?: number;
}) {
  return (
    <div className="panel panel-interactive relative overflow-hidden p-4">
      <div className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-primary-500/[0.06] blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            {label}
          </p>
          <p className="mt-2 text-[24px] font-semibold leading-none tracking-tight text-fg">
            {value}
          </p>
        </div>
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", ACCENTS[accent])}>
          {icon}
        </div>
      </div>

      <div className="relative mt-3 flex items-end justify-between gap-3">
        <p className="min-w-0 truncate text-[10.5px] text-muted">{hint}</p>
        {meter !== undefined ? (
          <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-white/5">
            <div
              className={cn(
                "h-full rounded-full",
                meter >= 85 ? "bg-success" : meter >= 60 ? "bg-warning" : "bg-danger",
              )}
              style={{ width: `${Math.min(100, Math.max(0, meter))}%` }}
            />
          </div>
        ) : spark && spark.length > 1 ? (
          <Sparkline values={spark} />
        ) : null}
      </div>

      {trend !== undefined ? (
        <div className="relative mt-2 flex items-center gap-1 text-[10px]">
          {trend === null ? (
            <>
              <ArrowUpRight className="h-3 w-3 text-success" />
              <span className="text-success">Nouveau</span>
            </>
          ) : trend === 0 ? (
            <>
              <Minus className="h-3 w-3 text-muted" />
              <span className="text-muted">stable</span>
            </>
          ) : trend > 0 ? (
            <>
              <ArrowUpRight className="h-3 w-3 text-success" />
              <span className="text-success">+{trend} %</span>
            </>
          ) : (
            <>
              <ArrowDownRight className="h-3 w-3 text-danger" />
              <span className="text-danger">{trend} %</span>
            </>
          )}
          <span className="text-muted/60">vs 7 jours precedents</span>
        </div>
      ) : null}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const width = 96;
  const height = 26;
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * width;
      const y = height - (Math.max(0, value) / max) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-7 w-24 shrink-0 opacity-80"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary-300"
      />
      {values.length > 0 ? (
        <circle
          cx={width}
          cy={
            height -
            (Math.max(0, values[values.length - 1] ?? 0) / max) * (height - 4) -
            2
          }
          r="2"
          className="fill-primary-300"
        />
      ) : null}
    </svg>
  );
}
