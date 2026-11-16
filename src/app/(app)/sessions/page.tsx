"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarRange, ChevronRight, Pause, Play, Timer } from "lucide-react";
import { useApi } from "@/lib/use-api";
import { formatDateTime, formatDuration, relativeTime } from "@/lib/format";
import { Badge, Button, Card, EmptyState, PageHeader, SectionTitle, Select, Skeleton } from "@/components/ui/primitives";
import { SESSION_STATUS } from "@/lib/labels";
import { StartSessionButton } from "@/components/dashboard/start-session-dialog";
import { SessionIndicator } from "@/components/session-indicator";

interface SessionRow {
  id: string;
  number: number;
  status: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  activeSeconds: number;
  user: { id: string; displayName: string; avatarColor: string };
  tasks: Array<{ id: string; code: string; title: string; status: string }>;
  fileChangeCount: number;
  summary: string | null;
  reportId: string | null;
  reportNumber: number | null;
}

interface SessionsPayload {
  scope: "own" | "all";
  sessions: SessionRow[];
  active: { id: string; status: string } | null;
}

export default function SessionsPage() {
  const searchParams = useSearchParams();
  const [scope, setScope] = React.useState<"own" | "all">("own");
  const [status, setStatus] = React.useState("");
  const sessions = useApi<SessionsPayload>(
    `/api/sessions?scope=${scope}${status ? `&status=${status}` : ""}&limit=100`,
  );
  const tasks = useApi<{ tasks: Array<{ id: string; code: string; title: string; status: string; priority: string; resource: string | null }> }>(
    "/api/tasks?scope=mine",
  );

  const rows = sessions.data?.sessions ?? [];
  const totalActive = rows.reduce((sum, session) => sum + session.activeSeconds, 0);

  return (
    <div>
      <PageHeader
        title="Sessions de developpement"
        description="Chaque session est horodatee cote serveur. Les rapports sont generes automatiquement a la cloture."
        eyebrow="Pilotage"
      >
        <SessionIndicator />
        {!sessions.data?.active ? (
          <StartSessionButton
            tasks={(tasks.data?.tasks ?? [])
              .filter((task) => task.status !== "DONE")
              .map((task) => ({
                id: task.id,
                code: task.code,
                title: task.title,
                status: task.status,
                priority: task.priority,
                resource: task.resource,
              }))}
            defaultOpen={searchParams.get("start") === "1"}
          />
        ) : null}
      </PageHeader>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Sessions affichees</p>
          <p className="mt-1 text-xl font-semibold">{rows.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Temps actif cumule</p>
          <p className="mt-1 text-xl font-semibold">{formatDuration(totalActive)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">En cours</p>
          <p className="mt-1 flex items-center gap-2 text-xl font-semibold">
            {rows.filter((row) => row.status === "ACTIVE").length}
            <span className="text-[11px] font-normal text-muted">
              {rows.filter((row) => row.status === "PAUSED").length} en pause
            </span>
          </p>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={scope} onChange={(event) => setScope(event.target.value as "own" | "all")} className="w-auto">
          <option value="own">Mes sessions</option>
          <option value="all">Toute l&apos;equipe</option>
        </Select>
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-auto">
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">En cours</option>
          <option value="PAUSED">En pause</option>
          <option value="COMPLETED">Terminees</option>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => void sessions.refresh()}>
          Rafraichir
        </Button>
      </div>

      <Card>
        <SectionTitle
          title="Historique"
          description="Temps actif mesure a partir des intervalles demarrer / pause / reprise."
          action={<span className="text-[11px] text-muted">{rows.length} session(s)</span>}
        />
        {sessions.loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-16" />
            ))}
          </div>
        ) : sessions.error ? (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {sessions.error}
          </p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Timer className="h-5 w-5" />}
            title="Aucune session"
            description="Demarrez votre premiere session pour commencer a suivre votre temps de travail."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Session</th>
                  <th className="px-4 py-2.5 font-medium">Developpeur</th>
                  <th className="px-4 py-2.5 font-medium">Taches</th>
                  <th className="px-4 py-2.5 font-medium">Debut</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actif</th>
                  <th className="px-4 py-2.5 font-medium">Statut</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((session) => {
                  const badge = SESSION_STATUS[session.status] ?? SESSION_STATUS.COMPLETED!;
                  return (
                    <tr key={session.id} className="group transition-colors hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <span className="mono text-[11px] text-muted">
                          #{(session.number ?? 0).toString().padStart(4, "0")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                            style={{ backgroundColor: session.user.avatarColor }}
                          >
                            {session.user.displayName.slice(0, 2).toUpperCase()}
                          </span>
                          <span>{session.user.displayName}</span>
                        </div>
                      </td>
                      <td className="max-w-[220px] px-4 py-3">
                        {session.tasks.length === 0 ? (
                          <span className="text-muted/60">-</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {session.tasks.slice(0, 2).map((task) => (
                              <Badge key={task.id} variant="neutral">
                                {task.code}
                              </Badge>
                            ))}
                            {session.tasks.length > 2 ? (
                              <Badge variant="neutral">+{session.tasks.length - 2}</Badge>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {formatDateTime(session.startedAt)}
                        <span className="ml-1 text-muted/50">({relativeTime(session.startedAt)})</span>
                      </td>
                      <td className="mono px-4 py-3 text-right tabular-nums">
                        {formatDuration(session.activeSeconds)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={badge.variant}>
                          {session.status === "ACTIVE" ? <Pause className="h-2.5 w-2.5" /> : null}
                          {session.status === "COMPLETED" ? null : null}
                          {badge.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/sessions/${session.id}`}
                          className="inline-flex items-center gap-1 text-[11px] text-primary-300 hover:underline"
                        >
                          Details <ChevronRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-card/50 px-4 py-3 text-[11px] text-muted">
        <CalendarRange className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-300" />
        Le temps est calcule exclusivement cote serveur a partir des timestamps. Un rafraichissement
        ou une fermeture du navigateur n&apos;affecte pas le chronometre. L&apos;inactivite declenche
        un rappel, jamais une deduction automatique.
        <Play className="ml-auto hidden h-3.5 w-3.5" />
      </div>
    </div>
  );
}
