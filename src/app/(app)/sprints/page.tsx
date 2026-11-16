"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Flag,
  Layers,
  Plus,
  Rocket,
  Target,
  Timer,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/use-api";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useRealtime } from "@/components/realtime-provider";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Progress,
  Select,
  Skeleton,
  Stat,
  Textarea,
  cn,
} from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { PRIORITY, SPRINT_STATUS, TASK_STATUS } from "@/lib/labels";
import { formatDate, relativeTime } from "@/lib/format";
import { daysUntil, type SprintView, type SprintsPayload } from "@/lib/sprints";

interface TaskOption {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  sprintId: string | null;
  assignee: { id: string; displayName: string; avatarColor: string } | null;
}

const DAY_MS = 86_400_000;

function dateInputValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export default function SprintsPage() {
  const { can } = useRealtime();
  const sprints = useApi<SprintsPayload>("/api/sprints");
  const tasks = useApi<{ tasks: TaskOption[] }>("/api/tasks");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [busyTask, setBusyTask] = React.useState<string | null>(null);

  const list = sprints.data?.sprints ?? [];
  const selected =
    list.find((sprint) => sprint.id === selectedId) ??
    list.find((sprint) => sprint.status === "ACTIVE") ??
    list[0] ??
    null;

  React.useEffect(() => {
    const available = sprints.data?.sprints ?? [];
    const next =
      available.find((sprint) => sprint.id === selectedId) ??
      available.find((sprint) => sprint.status === "ACTIVE") ??
      available[0];
    if (next && next.id !== selectedId) setSelectedId(next.id);
  }, [sprints.data, selectedId]);

  const active = list.find((sprint) => sprint.status === "ACTIVE") ?? null;
  const taskRows = tasks.data?.tasks ?? [];
  const candidates = taskRows.filter((task) => !task.sprintId && task.status !== "DONE");
  const totalTasks = list.reduce((sum, sprint) => sum + sprint.progress.total, 0);
  const totalDone = list.reduce((sum, sprint) => sum + sprint.progress.done, 0);

  async function updateStatus(sprint: SprintView, status: SprintView["status"]) {
    try {
      await apiFetch(`/api/sprints/${sprint.id}`, { method: "PATCH", body: { status } });
      toast.success(
        status === "ACTIVE"
          ? "Sprint demarre"
          : status === "COMPLETED"
            ? "Sprint termine"
            : "Sprint mis a jour",
      );
      await Promise.all([sprints.refresh(), tasks.refresh()]);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function addTask(taskId: string) {
    if (!selected) return;
    setBusyTask(taskId);
    try {
      await apiFetch(`/api/sprints/${selected.id}/tasks`, { method: "POST", body: { taskId } });
      toast.success("Tache ajoutee au sprint");
      await Promise.all([sprints.refresh(), tasks.refresh()]);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyTask(null);
    }
  }

  async function removeTask(taskId: string) {
    if (!selected) return;
    setBusyTask(taskId);
    try {
      await apiFetch(`/api/sprints/${selected.id}/tasks`, { method: "DELETE", body: { taskId } });
      toast.success("Tache retiree du sprint");
      await Promise.all([sprints.refresh(), tasks.refresh()]);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyTask(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Sprints & objectifs"
        description="Un cycle de travail lisible : objectif, echeance, taches engagees et progression reelle."
        eyebrow="Pilotage"
      >
        {active ? (
          <Badge variant="success">
            <span className="mr-1 h-1.5 w-1.5 rounded-full bg-success" /> {active.name} en cours
          </Badge>
        ) : (
          <Badge variant="neutral">Aucun sprint actif</Badge>
        )}
        {can("sprints.manage") ? (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Nouveau sprint
          </Button>
        ) : null}
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat
          label="Sprint actif"
          value={active?.name ?? "Aucun"}
          hint={active ? `${active.progress.done}/${active.progress.total} taches terminees` : "Creez le prochain cycle"}
          icon={<Target className="h-4 w-4" />}
          accent={active ? "primary" : "info"}
        />
        <Stat
          label="Progression globale"
          value={`${totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0} %`}
          hint={`${totalDone} taches livrees sur ${totalTasks}`}
          icon={<Layers className="h-4 w-4" />}
          accent="info"
        />
        <Stat
          label="Echeance du sprint"
          value={active ? formatDate(active.endsAt) : "-"}
          hint={
            active
              ? daysUntil(active.endsAt) >= 0
                ? `${daysUntil(active.endsAt)} jour(s) restant(s)`
                : `Depasse de ${Math.abs(daysUntil(active.endsAt))} jour(s)`
              : "Aucune echeance"
          }
          icon={<CalendarDays className="h-4 w-4" />}
          accent={active && daysUntil(active.endsAt) < 0 ? "danger" : "warning"}
        />
      </div>

      {sprints.error ? (
        <Card className="p-6 text-sm text-danger">{sprints.error}</Card>
      ) : sprints.loading && !sprints.data ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-[420px]" />
          <Skeleton className="h-[320px]" />
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Target className="h-6 w-6" />}
            title="Aucun sprint planifie"
            description="Un sprint relie un objectif clair a un ensemble de taches mesurables. Commencez par definir le prochain cycle de l'equipe."
            action={
              can("sprints.manage") ? (
                <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Creer le premier sprint
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            {selected ? (
              <SprintDetail
                sprint={selected}
                canManage={can("sprints.manage")}
                busyTask={busyTask}
                onStatus={(status) => void updateStatus(selected, status)}
                onRemoveTask={(taskId) => void removeTask(taskId)}
              />
            ) : null}

            {selected && selected.status !== "COMPLETED" ? (
              <Card>
                <CardHeader>
                  <div>
                    <h3 className="text-sm font-semibold">Ajouter une tache au sprint</h3>
                    <p className="text-[11px] text-muted">
                      Les taches sont visibles sur le Kanban et progressent ici automatiquement.
                    </p>
                  </div>
                  <Link href="/tasks" className="text-[11px] text-primary-300 hover:underline">
                    Ouvrir le Kanban
                  </Link>
                </CardHeader>
                <CardBody>
                  {!can("sprints.manage") ? (
                    <p className="text-xs text-muted">
                      Seuls les responsables de sprint peuvent modifier le perimetre.
                    </p>
                  ) : candidates.length === 0 ? (
                    <p className="text-xs text-muted">
                      Aucune tache ouverte non planifiee. Creez ou liberez une tache depuis le Kanban.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Select
                        value=""
                        onChange={(event) => {
                          if (event.target.value) void addTask(event.target.value);
                        }}
                        disabled={Boolean(busyTask)}
                      >
                        <option value="">Choisir une tache a engager...</option>
                        {candidates.map((task) => (
                          <option key={task.id} value={task.id}>
                            {task.code} · {task.title}
                          </option>
                        ))}
                      </Select>
                      <p className="shrink-0 self-center text-[10px] text-muted">
                        {candidates.length} tache(s) disponible(s)
                      </p>
                    </div>
                  )}
                </CardBody>
              </Card>
            ) : null}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold">Tous les cycles</h3>
                <span className="text-[10px] text-muted">{list.length} sprint(s)</span>
              </CardHeader>
              <div className="divide-y divide-border/60">
                {list.map((sprint) => {
                  const status = SPRINT_STATUS[sprint.status] ?? SPRINT_STATUS.PLANNED!;
                  const isSelected = sprint.id === selected?.id;
                  return (
                    <button
                      key={sprint.id}
                      type="button"
                      onClick={() => setSelectedId(sprint.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]",
                        isSelected && "bg-primary-500/[0.06]",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                          sprint.status === "ACTIVE"
                            ? "border-success/30 bg-success/10 text-success"
                            : "border-border bg-elevated text-muted",
                        )}
                      >
                        <Flag className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-fg">{sprint.name}</span>
                        <span className="mt-0.5 block text-[10px] text-muted">
                          {formatDate(sprint.startsAt)} → {formatDate(sprint.endsAt)}
                        </span>
                      </span>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs font-medium">
                <Rocket className="h-3.5 w-3.5 text-primary-300" /> Comment ca marche
              </div>
              <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-muted">
                <li>1. Definissez un objectif et une fenetre de temps.</li>
                <li>2. Engagez les taches du Kanban dans le sprint.</li>
                <li>3. La progression se met a jour quand une tache passe a Termine.</li>
                <li>4. Cloturez le cycle pour figer les resultats.</li>
              </ul>
            </Card>
          </div>
        </div>
      )}

      <CreateSprintDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(sprint) => {
          setCreateOpen(false);
          setSelectedId(sprint.id);
          void sprints.refresh();
          void tasks.refresh();
        }}
      />
    </div>
  );
}

function SprintDetail({
  sprint,
  canManage,
  busyTask,
  onStatus,
  onRemoveTask,
}: {
  sprint: SprintView;
  canManage: boolean;
  busyTask: string | null;
  onStatus: (status: SprintView["status"]) => void;
  onRemoveTask: (taskId: string) => void;
}) {
  const status = SPRINT_STATUS[sprint.status] ?? SPRINT_STATUS.PLANNED!;
  const remaining = daysUntil(sprint.endsAt);
  const durationDays = Math.max(
    1,
    Math.round((new Date(sprint.endsAt).getTime() - new Date(sprint.startsAt).getTime()) / DAY_MS),
  );

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border bg-gradient-to-r from-primary-500/[0.1] via-transparent to-transparent px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={status.variant}>{status.label}</Badge>
              <span className="text-[10px] text-muted">
                Cree par {sprint.createdBy.displayName} · {relativeTime(sprint.startsAt)}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">{sprint.name}</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
              {sprint.goal ?? "Aucun objectif detaille pour ce sprint."}
            </p>
          </div>
          {canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              {sprint.status === "PLANNED" ? (
                <Button size="sm" variant="success" onClick={() => onStatus("ACTIVE")}>
                  <Rocket className="h-3.5 w-3.5" /> Demarrer
                </Button>
              ) : null}
              {sprint.status === "ACTIVE" ? (
                <Button size="sm" variant="success" onClick={() => onStatus("COMPLETED")}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Terminer
                </Button>
              ) : null}
              {sprint.status === "COMPLETED" ? (
                <Button size="sm" variant="secondary" onClick={() => onStatus("ACTIVE")}>
                  Reouvrir
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <CardBody className="space-y-5">
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="text-muted">Progression du sprint</span>
            <span className="font-medium text-fg">
              {sprint.progress.done}/{sprint.progress.total} tache(s) · {sprint.progress.percent} %
            </span>
          </div>
          <Progress value={sprint.progress.percent} className="h-2" />
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-border/70 bg-surface/60 p-3">
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted">
              <CalendarDays className="h-3 w-3" /> Periode
            </p>
            <p className="mt-1 text-[11px] font-medium">
              {formatDate(sprint.startsAt)} → {formatDate(sprint.endsAt)}
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-surface/60 p-3">
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted">
              <Timer className="h-3 w-3" /> Duree
            </p>
            <p className="mt-1 text-[11px] font-medium">{durationDays} jours</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-surface/60 p-3">
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted">
              <Target className="h-3 w-3" /> Echeance
            </p>
            <p
              className={cn(
                "mt-1 text-[11px] font-medium",
                remaining < 0 ? "text-danger" : remaining <= 3 ? "text-warning" : "text-success",
              )}
            >
              {remaining < 0
                ? `Depasse de ${Math.abs(remaining)} j`
                : remaining === 0
                  ? "Dernier jour"
                  : `${remaining} jour(s) restant(s)`}
            </p>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium">Taches engagees</p>
            <span className="text-[10px] text-muted">{sprint.tasks.length} au total</span>
          </div>
          {sprint.tasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
              <Target className="mx-auto h-5 w-5 text-muted/50" />
              <p className="mt-2 text-xs text-muted">Aucune tache engagee dans ce sprint.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
              {sprint.tasks.map((task) => {
                const taskStatus = TASK_STATUS[task.status] ?? TASK_STATUS.BACKLOG!;
                const priority = PRIORITY[task.priority] ?? PRIORITY.MEDIUM!;
                return (
                  <li key={task.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                      {task.status === "DONE" ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-muted/50" />
                      )}
                    </span>
                    <Link
                      href={`/tasks/${task.id}`}
                      className="min-w-0 flex-1 truncate text-[11.5px] text-fg hover:text-primary-200"
                    >
                      <span className="mono mr-1.5 text-[10px] text-muted">{task.code}</span>
                      {task.title}
                    </Link>
                    <Badge variant={priority.variant}>{priority.label}</Badge>
                    <Badge variant={taskStatus.variant}>{taskStatus.label}</Badge>
                    {task.assignee ? (
                      <span className="flex items-center gap-1 text-[10px] text-muted">
                        <Avatar
                          name={task.assignee.displayName}
                          color={task.assignee.avatarColor}
                          size="xs"
                        />
                        <span className="hidden sm:inline">{task.assignee.displayName}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted">
                        <UserRound className="mr-1 inline h-3 w-3" /> Non assignee
                      </span>
                    )}
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => onRemoveTask(task.id)}
                        disabled={busyTask === task.id}
                        className="rounded p-1 text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                        title="Retirer du sprint"
                        aria-label={`Retirer ${task.code} du sprint`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function CreateSprintDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (sprint: SprintView) => void;
}) {
  const today = new Date();
  const [form, setForm] = React.useState({
    name: "",
    goal: "",
    status: "PLANNED",
    startsAt: dateInputValue(today),
    endsAt: dateInputValue(new Date(today.getTime() + 14 * DAY_MS)),
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch<{ sprint: SprintView }>("/api/sprints", {
        method: "POST",
        body: {
          name: form.name,
          goal: form.goal || undefined,
          status: form.status,
          startsAt: new Date(`${form.startsAt}T00:00:00`).toISOString(),
          endsAt: new Date(`${form.endsAt}T23:59:59`).toISOString(),
        },
      });
      toast.success("Sprint cree");
      onCreated(payload.sprint);
      setForm({
        name: "",
        goal: "",
        status: "PLANNED",
        startsAt: dateInputValue(new Date()),
        endsAt: dateInputValue(new Date(Date.now() + 14 * DAY_MS)),
      });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouveau sprint"
      description="Un objectif mesurable, une echeance et les taches qui comptent."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="primary"
            loading={loading}
            onClick={submit}
            disabled={form.name.trim().length < 3 || !form.startsAt || !form.endsAt}
          >
            Creer le sprint
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        ) : null}
        <Field label="Nom du sprint">
          <Input
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Sprint 4 · Stabilité serveur"
          />
        </Field>
        <Field label="Objectif" hint="Une phrase que l'equipe peut verifier en fin de cycle.">
          <Textarea
            rows={3}
            value={form.goal}
            onChange={(event) => update("goal", event.target.value)}
            placeholder="Reduire les erreurs runtime de 40 % et livrer le nouveau garage."
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Debut">
            <Input
              type="date"
              value={form.startsAt}
              onChange={(event) => update("startsAt", event.target.value)}
            />
          </Field>
          <Field label="Fin">
            <Input
              type="date"
              value={form.endsAt}
              onChange={(event) => update("endsAt", event.target.value)}
            />
          </Field>
          <Field label="Statut initial">
            <Select value={form.status} onChange={(event) => update("status", event.target.value)}>
              <option value="PLANNED">Planifie</option>
              <option value="ACTIVE">Demarrer maintenant</option>
            </Select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
