"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  FileCode2,
  FileText,
  Pause,
  Play,
  Plus,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/use-api";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { formatClock, formatDateTime, formatDuration, relativeTime } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Skeleton,
  Textarea,
} from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { SESSION_STATUS, TASK_STATUS } from "@/lib/labels";
import { announceSessionChange } from "@/components/session-indicator";
import { useSessionClock } from "@/lib/use-session-clock";

interface SessionDetail {
  id: string;
  number: number;
  status: string;
  startedAt: string;
  endedAt: string | null;
  activeSeconds: number;
  durationSeconds: number;
  idle: boolean;
  idleTimeoutMinutes: number;
  summary: string | null;
  notes: string | null;
  currentTaskId: string | null;
  user: { id: string; displayName: string; email: string; avatarColor: string };
  tasks: Array<{ id: string; code: string; title: string; status: string; timeSpentSeconds: number }>;
  events: Array<{ id: string; type: string; message: string | null; createdAt: string }>;
  fileChanges: Array<{
    id: string;
    path: string;
    resource: string | null;
    changeType: string;
    createdAt: string;
    user: string | null;
    taskCode: string | null;
  }>;
  report: { id: string; number: number } | null;
}

const EVENT_LABELS: Record<string, string> = {
  START: "Demarrage",
  PAUSE: "Pause",
  RESUME: "Reprise",
  END: "Fin",
  NOTE: "Note",
  TASK_SWITCH: "Changement de tache",
  FILE_CHANGE: "Modification",
  IDLE_WARNING: "Inactivite",
  IDLE_ACK: "Confirmation",
  VALIDATION: "Validation",
};

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const session = useApi<{ session: SessionDetail }>(`/api/sessions/${params.id}`, {
    pollMs: 20_000,
  });
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [endOpen, setEndOpen] = React.useState(false);
  const [summary, setSummary] = React.useState("");
  const [report, setReport] = React.useState<{ id: string; summary: string } | null>(null);

  const data = session.data?.session;
  // Meme base de temps que l'indicateur de l'en-tete : mesure serveur + derive.
  const liveSeconds = useSessionClock(data?.activeSeconds ?? 0, data?.status === "ACTIVE");

  async function action(body: Record<string, unknown>, successMessage: string) {
    if (!data) return;
    setBusy(true);
    try {
      const result = await apiFetch<{ reportId?: string | null }>(`/api/sessions/${data.id}`, {
        method: "PATCH",
        body,
      });
      toast.success(successMessage);
      await session.refresh();
      announceSessionChange();
      if (result.reportId) {
        router.push(`/reports?highlight=${result.reportId}`);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function loadReport() {
    if (!data) return;
    try {
      const payload = await apiFetch<{ report: { id: string; summary: string } | null }>(
        `/api/sessions/${data.id}/report`,
      );
      if (payload.report) setReport(payload.report);
      else toast.info("Le rapport sera disponible en fin de session.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  if (session.loading) return <Skeleton className="h-96" />;
  if (session.error || !data) {
    return (
      <Card className="p-6 text-sm text-danger">
        {session.error ?? "Session introuvable"}
      </Card>
    );
  }

  const badge = SESSION_STATUS[data.status] ?? SESSION_STATUS.COMPLETED!;
  const running = data.status === "ACTIVE";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-xs text-muted">
        <Link href="/sessions" className="inline-flex items-center gap-1 hover:text-fg">
          <ArrowLeft className="h-3.5 w-3.5" /> Sessions
        </Link>
        <span>/</span>
        <span className="mono">#{(data.number ?? 0).toString().padStart(4, "0")}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">Session #{String(data.number).padStart(4, "0")}</h1>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {data.user.displayName} · {formatDateTime(data.startedAt)}
            {data.endedAt ? ` → ${formatDateTime(data.endedAt)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="mono rounded-lg border border-border bg-card px-3 py-1.5 text-sm tabular-nums">
            {formatClock(liveSeconds)}
          </div>
          {running ? (
            <Button variant="secondary" onClick={() => action({ action: "pause" }, "Session en pause")} loading={busy}>
              <Pause className="h-3.5 w-3.5" /> Pause
            </Button>
          ) : data.status === "PAUSED" ? (
            <Button variant="success" onClick={() => action({ action: "resume" }, "Session reprise")} loading={busy}>
              <Play className="h-3.5 w-3.5" /> Reprendre
            </Button>
          ) : null}
          {data.status !== "COMPLETED" ? (
            <Button variant="danger" onClick={() => setEndOpen(true)} loading={busy}>
              <Square className="h-3.5 w-3.5" /> Terminer
            </Button>
          ) : null}
          <Button variant="outline" onClick={loadReport}>
            <FileText className="h-3.5 w-3.5" /> Rapport
          </Button>
        </div>
      </div>

      {data.idle && running ? (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-2.5 text-xs text-warning">
          <AlertCircle className="h-4 w-4" />
          Inactivite detectee ({data.idleTimeoutMinutes} min). Confirmez votre temps ou mettez la
          session en pause — aucun temps n&apos;est retire automatiquement.
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => action({ action: "idle-ack" }, "Temps confirme")}>
            Confirmer mon temps
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">Taches</h3>
              <Badge variant="neutral">{data.tasks.length}</Badge>
            </CardHeader>
            <div className="divide-y divide-border/60">
              {data.tasks.length === 0 ? (
                <p className="px-5 py-6 text-center text-xs text-muted">Aucune tache associee.</p>
              ) : (
                data.tasks.map((task) => {
                  const status = TASK_STATUS[task.status] ?? TASK_STATUS.BACKLOG!;
                  return (
                    <div key={task.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="mono text-[11px] text-muted">{task.code}</span>
                      <span className="min-w-0 flex-1 truncate text-xs">{task.title}</span>
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <span className="mono text-[10px] text-muted">{formatDuration(task.timeSpentSeconds)}</span>
                      {data.currentTaskId === task.id ? <Badge variant="primary">Courante</Badge> : null}
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">Fichiers modifies</h3>
              <Badge variant="neutral">{data.fileChanges.length}</Badge>
            </CardHeader>
            <div className="max-h-[320px] divide-y divide-border/60 overflow-y-auto">
              {data.fileChanges.length === 0 ? (
                <p className="px-5 py-6 text-center text-xs text-muted">
                  Aucune modification detectee pour cette session.
                </p>
              ) : (
                data.fileChanges.map((change) => (
                  <div key={change.id} className="flex items-start gap-2 px-5 py-2.5">
                    <FileCode2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-300" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] text-fg">{change.path}</p>
                      <p className="text-[10px] text-muted">
                        {change.user ?? "Synchronisation"} · {relativeTime(change.createdAt)}
                        {change.taskCode ? ` · ${change.taskCode}` : ""}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {report ? (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold">Rapport genere</h3>
                <a
                  href={`/api/reports/${report.id}/pdf`}
                  className="text-[11px] text-primary-300 hover:underline"
                >
                  Exporter en PDF
                </a>
              </CardHeader>
              <CardBody>
                <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 font-mono text-[10.5px] leading-relaxed text-muted">
                  {report.summary}
                </pre>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">Metriques</h3>
            </CardHeader>
            <CardBody className="space-y-2 text-xs">
              <Row label="Duree totale" value={formatDuration(data.durationSeconds)} />
              <Row label="Temps actif" value={formatDuration(liveSeconds)} />
              <Row
                label="Ecart"
                value={formatDuration(Math.max(0, data.durationSeconds - liveSeconds))}
              />
              <Row label="Modifications" value={String(data.fileChanges.length)} />
              <Row label="Taches" value={String(data.tasks.length)} />
            </CardBody>
          </Card>

          {data.status !== "COMPLETED" ? (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold">Ajouter une note</h3>
              </CardHeader>
              <CardBody className="space-y-2">
                <Textarea
                  rows={3}
                  placeholder="Progression, difficultes, tests effectues..."
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!note.trim()}
                  onClick={async () => {
                    await action({ action: "note", message: note }, "Note ajoutee");
                    setNote("");
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> Ajouter
                </Button>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">Chronologie</h3>
            </CardHeader>
            <div className="max-h-[420px] overflow-y-auto px-5 py-3">
              <ol className="relative space-y-3 border-l border-border pl-4">
                {data.events.slice(-40).map((event) => (
                  <li key={event.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-border-strong" />
                    <p className="text-[11px] text-fg">{EVENT_LABELS[event.type] ?? event.type}</p>
                    {event.message ? <p className="text-[10px] text-muted">{event.message}</p> : null}
                    <p className="text-[10px] text-muted/60">{formatDateTime(event.createdAt)}</p>
                  </li>
                ))}
              </ol>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={endOpen}
        onClose={() => setEndOpen(false)}
        title="Terminer la session"
        description="Le rapport et les patch notes brouillon seront generes a partir des donnees enregistrees."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEndOpen(false)}>Annuler</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                await action({ action: "end", summary }, "Session terminee");
                setEndOpen(false);
              }}
            >
              Terminer la session
            </Button>
          </>
        }
      >
        <Field label="Resume de la session" hint="Optionnel, visible dans le rapport.">
          <Textarea
            rows={4}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Ce qui a ete fait, ce qui reste a faire..."
          />
        </Field>
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="mono tabular-nums">{value}</span>
    </div>
  );
}
