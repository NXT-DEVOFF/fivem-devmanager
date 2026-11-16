"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Users } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { CATEGORY } from "@/lib/labels";
import { formatDuration } from "@/lib/format";

const COLORS = ["#5865F2", "#22C55E", "#F59E0B", "#38BDF8", "#EF4444", "#A6AEF9", "#94A3B8"];

const TOOLTIP_STYLE = {
  background: "#151B26",
  border: "1px solid #252D3B",
  borderRadius: 8,
  fontSize: 11,
};

export interface AnalyticsChartsProps {
  serie: Array<{ date: string; activeSeconds: number; changes: number; tasks: number }>;
  perUser: Array<{
    userId: string;
    name: string;
    color: string;
    activeSeconds: number;
    sessions: number;
    tasks: number;
    bugs: number;
    changes: number;
  }>;
  categories: Array<{ category: string; count: number }>;
  averageSessionSeconds: number;
}

export function AnalyticsCharts({
  serie,
  perUser,
  categories,
  averageSessionSeconds,
}: AnalyticsChartsProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <h3 className="text-sm font-semibold">Evolution de l&apos;activite</h3>
            <p className="text-[11px] text-muted">Temps actif et modifications par jour</p>
          </div>
          <span className="text-[10px] text-muted">
            duree moyenne : {formatDuration(averageSessionSeconds)}
          </span>
        </CardHeader>
        <CardBody className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serie}>
              <defs>
                <linearGradient id="activeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5865F2" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#5865F2" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1c2432" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "#94A3B8", fontSize: 10 }}
                tickFormatter={(value: string) => value.slice(5)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#94A3B8", fontSize: 10 }}
                tickFormatter={(value: number) => `${Math.round(value / 3600)}h`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: number) => [formatDuration(value), "Temps actif"]}
              />
              <Area
                type="monotone"
                dataKey="activeSeconds"
                stroke="#8189F6"
                strokeWidth={2}
                fill="url(#activeGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold">Temps par developpeur</h3>
            <Users className="h-3.5 w-3.5 text-muted" />
          </CardHeader>
          <CardBody className="h-[260px]">
            {perUser.length === 0 ? (
              <p className="flex h-full items-center justify-center text-xs text-muted">
                Aucune donnee.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perUser} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid stroke="#1c2432" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: "#94A3B8", fontSize: 10 }}
                    tickFormatter={(value: number) => `${Math.round(value / 3600)}h`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fill: "#cbd5e1", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number) => [formatDuration(value), "Temps actif"]}
                  />
                  <Bar dataKey="activeSeconds" radius={[0, 4, 4, 0]}>
                    {perUser.map((entry, index) => (
                      <Cell
                        key={entry.userId}
                        fill={entry.color || COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold">Repartition par categorie</h3>
            <BarChart3 className="h-3.5 w-3.5 text-muted" />
          </CardHeader>
          <CardBody className="h-[260px]">
            {categories.length === 0 ? (
              <p className="flex h-full items-center justify-center text-xs text-muted">
                Aucune tache terminee.
              </p>
            ) : (
              <div className="flex h-full items-center gap-4">
                <div className="h-full flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categories}
                        dataKey="count"
                        nameKey="category"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {categories.map((entry, index) => (
                          <Cell
                            key={entry.category}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value: number, name: string) => [
                          value,
                          CATEGORY[name] ?? name,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="w-36 space-y-1">
                  {categories.slice(0, 6).map((entry, index) => (
                    <li
                      key={entry.category}
                      className="flex items-center gap-1.5 text-[10px] text-muted"
                    >
                      <span
                        className="h-2 w-2 rounded-sm"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="truncate">
                        {CATEGORY[entry.category] ?? entry.category}
                      </span>
                      <span className="ml-auto">{entry.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
