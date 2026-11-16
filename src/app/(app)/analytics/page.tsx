"use client";

import * as React from "react";
import { Bug, Clock, FileCode2, ListChecks } from "lucide-react";
import { useApi } from "@/lib/use-api";
import {
  Avatar,
  Card,
  CardHeader,
  PageHeader,
  Select,
  Skeleton,
  Stat,
} from "@/components/ui/primitives";
import { AnalyticsChartsLazy } from "@/components/analytics/analytics-charts-lazy";
import { formatDuration } from "@/lib/format";

interface AnalyticsPayload {
  range: { from: string; to: string; label: string };
  totals: {
    activeSeconds: number;
    sessions: number;
    averageSessionSeconds: number;
    tasks: number;
    bugs: number;
    changes: number;
    developers: number;
  };
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
  serie: Array<{ date: string; activeSeconds: number; changes: number; tasks: number }>;
  resources: Array<{ name: string; count: number }>;
  categories: Array<{ category: string; count: number }>;
  users: Array<{ id: string; displayName: string }>;
}

export default function AnalyticsPage() {
  const [preset, setPreset] = React.useState("30d");
  const [userId, setUserId] = React.useState("");
  const [resource, setResource] = React.useState("");
  const [custom, setCustom] = React.useState({ from: "", to: "" });

  const params = new URLSearchParams({ preset });
  if (userId) params.set("userId", userId);
  if (resource) params.set("resource", resource);
  if (preset === "custom") {
    if (custom.from) params.set("from", custom.from);
    if (custom.to) params.set("to", custom.to);
  }

  const analytics = useApi<AnalyticsPayload>(`/api/analytics?${params.toString()}`);
  const resources = useApi<{ resources: Array<{ name: string }> }>("/api/resources");
  const data = analytics.data;

  return (
    <div>
      <PageHeader
        title="Statistiques"
        description="Metriques calculees a partir des sessions, modifications, taches et bugs reellement enregistres."
        eyebrow="Analyse"
      >
        <Select value={preset} onChange={(event) => setPreset(event.target.value)} className="w-auto">
          <option value="today">Aujourd&apos;hui</option>
          <option value="7d">7 derniers jours</option>
          <option value="30d">30 derniers jours</option>
          <option value="90d">90 derniers jours</option>
          <option value="custom">Periode personnalisee</option>
        </Select>
        <Select value={userId} onChange={(event) => setUserId(event.target.value)} className="w-auto">
          <option value="">Tous les developpeurs</option>
          {(data?.users ?? []).map((user) => (
            <option key={user.id} value={user.id}>{user.displayName}</option>
          ))}
        </Select>
        <Select value={resource} onChange={(event) => setResource(event.target.value)} className="w-auto">
          <option value="">Toutes les ressources</option>
          {(resources.data?.resources ?? []).map((entry) => (
            <option key={entry.name} value={entry.name}>{entry.name}</option>
          ))}
        </Select>
      </PageHeader>

      {preset === "custom" ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <input
            type="date"
            value={custom.from}
            onChange={(event) => setCustom({ ...custom, from: event.target.value })}
            className="h-8 rounded-lg border border-border bg-surface px-2 text-xs"
          />
          <span className="text-muted">au</span>
          <input
            type="date"
            value={custom.to}
            onChange={(event) => setCustom({ ...custom, to: event.target.value })}
            className="h-8 rounded-lg border border-border bg-surface px-2 text-xs"
          />
        </div>
      ) : null}

      {analytics.loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-24" />)}
        </div>
      ) : analytics.error ? (
        <Card className="p-4 text-xs text-danger">{analytics.error}</Card>
      ) : data ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Temps actif" value={formatDuration(data.totals.activeSeconds)} hint={`${data.totals.sessions} session(s)`} icon={<Clock className="h-4 w-4" />} />
            <Stat label="Taches terminees" value={data.totals.tasks} hint="Sur la periode" icon={<ListChecks className="h-4 w-4" />} accent="success" />
            <Stat label="Bugs corriges" value={data.totals.bugs} hint="Corrections validees" icon={<Bug className="h-4 w-4" />} accent="warning" />
            <Stat label="Modifications" value={data.totals.changes} hint={`${data.totals.developers} dev actif(s)`} icon={<FileCode2 className="h-4 w-4" />} accent="info" />
          </div>

          <AnalyticsChartsLazy
            serie={data.serie}
            perUser={data.perUser}
            categories={data.categories}
            averageSessionSeconds={data.totals.averageSessionSeconds}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold">Ressources les plus travaillees</h3>
              </CardHeader>
              <div className="divide-y divide-border/60">
                {data.resources.length === 0 ? (
                  <p className="px-5 py-5 text-center text-xs text-muted">Aucune modification.</p>
                ) : (
                  data.resources.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2 px-5 py-2">
                      <span className="mono min-w-0 flex-1 truncate text-[11px]">{entry.name}</span>
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-primary-500"
                          style={{
                            width: `${Math.round((entry.count / Math.max(...data.resources.map((item) => item.count))) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="w-8 text-right text-[10px] text-muted">{entry.count}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold">Detail par developpeur</h3>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b border-border text-[9px] uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-2 font-medium">Developpeur</th>
                      <th className="px-4 py-2 text-right font-medium">Actif</th>
                      <th className="px-4 py-2 text-right font-medium">Sessions</th>
                      <th className="px-4 py-2 text-right font-medium">Taches</th>
                      <th className="px-4 py-2 text-right font-medium">Modifs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {data.perUser.map((entry) => (
                      <tr key={entry.userId}>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <Avatar name={entry.name} color={entry.color} size="xs" />
                            <span className="truncate">{entry.name}</span>
                          </div>
                        </td>
                        <td className="mono px-4 py-2 text-right">{formatDuration(entry.activeSeconds)}</td>
                        <td className="px-4 py-2 text-right text-muted">{entry.sessions}</td>
                        <td className="px-4 py-2 text-right text-muted">{entry.tasks}</td>
                        <td className="px-4 py-2 text-right text-muted">{entry.changes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
