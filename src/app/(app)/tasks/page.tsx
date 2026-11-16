"use client";

import * as React from "react";
import Link from "next/link";
import { ListChecks, Plus, Search, Timer } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/use-api";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useRealtime } from "@/components/realtime-provider";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Switch,
  Textarea,
} from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { CATEGORY, PRIORITY, TASK_COLUMNS, TASK_STATUS } from "@/lib/labels";
import { formatDuration, relativeTime } from "@/lib/format";
import { cn } from "@/components/ui/primitives";

interface TaskRow {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  resource: string | null;
  assignee: { id: string; displayName: string; avatarColor: string } | null;
  dueDate: string | null;
  estimatedMinutes: number | null;
  timeSpentSeconds: number;
  autoValidate: boolean;
  requiresReview: boolean;
  counts: { comments: number; fileChanges: number; checklist: number };
  checklistProgress: { done: number; total: number };
  tags: string[];
}

interface TeamMember {
  id: string;
  displayName: string;
  role: string;
}

export default function TasksPage() {
  const { can } = useRealtime();
  const [search, setSearch] = React.useState("");
  const [assignee, setAssignee] = React.useState("");
  const [resource, setResource] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [draggingOver, setDraggingOver] = React.useState<string | null>(null);

  const query = new URLSearchParams();
  if (search) query.set("q", search);
  if (assignee) query.set("assigneeId", assignee);
  if (resource) query.set("resource", resource);
  const tasks = useApi<{ tasks: TaskRow[] }>(`/api/tasks?${query.toString()}`);
  const team = useApi<{ users: TeamMember[] }>("/api/team");
  const resources = useApi<{ resources: Array<{ name: string }> }>("/api/resources");

  const rows = React.useMemo(() => tasks.data?.tasks ?? [], [tasks.data]);
  const grouped = React.useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    for (const column of TASK_COLUMNS) map.set(column, []);
    for (const task of rows) {
      if (!map.has(task.status)) map.set(task.status, []);
      map.get(task.status)!.push(task);
    }
    return map;
  }, [rows]);

  async function move(taskId: string, status: string) {
    const previous = tasks.data?.tasks ?? [];
    tasks.setData({
      tasks: previous.map((task) => (task.id === taskId ? { ...task, status } : task)),
    });
    try {
      await apiFetch(`/api/tasks/${taskId}`, { method: "PATCH", body: { status } });
      toast.success(`Statut mis a jour : ${TASK_STATUS[status]?.label ?? status}`);
      await tasks.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      await tasks.refresh();
    }
  }

  return (
    <div>
      <PageHeader
        title="Gestion des taches"
        description="Kanban specialise FiveM : ressources, fichiers, checklist, validation et temps mesure."
        eyebrow="Pilotage"
      >
        {can("tasks.create") ? (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Nouvelle tache
          </Button>
        ) : null}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Rechercher une tache, un code..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={assignee} onChange={(event) => setAssignee(event.target.value)} className="w-auto">
          <option value="">Tous les developpeurs</option>
          {(team.data?.users ?? []).map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName}
            </option>
          ))}
        </Select>
        <Select value={resource} onChange={(event) => setResource(event.target.value)} className="w-auto">
          <option value="">Toutes les ressources</option>
          {(resources.data?.resources ?? []).map((entry) => (
            <option key={entry.name} value={entry.name}>
              {entry.name}
            </option>
          ))}
        </Select>
        <Button variant="ghost" size="sm" onClick={() => void tasks.refresh()}>
          Rafraichir
        </Button>
      </div>

      {tasks.loading ? (
        <div className="grid gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-64" />
          ))}
        </div>
      ) : tasks.error ? (
        <Card className="p-6 text-sm text-danger">{tasks.error}</Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ListChecks className="h-5 w-5" />}
            title="Aucune tache"
            description="Creez une tache pour organiser le travail de l'equipe."
            action={
              can("tasks.create") ? (
                <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Creer une tache
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-4 2xl:grid-cols-7">
          {TASK_COLUMNS.map((column) => {
            const status = TASK_STATUS[column]!;
            const items = grouped.get(column) ?? [];
            return (
              <div
                key={column}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDraggingOver(column);
                }}
                onDragLeave={() => setDraggingOver(null)}
                onDrop={() => {
                  if (dragId) void move(dragId, column);
                  setDragId(null);
                  setDraggingOver(null);
                }}
                className={cn(
                  "flex min-h-[180px] flex-col rounded-xl border border-border/70 bg-surface/40 p-2 transition-colors",
                  draggingOver === column && "border-primary-500/50 bg-primary-500/[0.06]",
                )}
              >
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-[11px] font-medium text-muted">{status.label}</span>
                  <span className="rounded bg-white/5 px-1.5 text-[10px] text-muted">{items.length}</span>
                </div>

                <div className="flex-1 space-y-2">
                  {items.map((task) => {
                    const priority = PRIORITY[task.priority] ?? PRIORITY.MEDIUM!;
                    const checklistPercent =
                      task.checklistProgress.total > 0
                        ? Math.round(
                            (task.checklistProgress.done / task.checklistProgress.total) * 100,
                          )
                        : null;
                    return (
                      <div
                        key={task.id}
                        draggable={can("tasks.edit")}
                        onDragStart={() => setDragId(task.id)}
                        onDragEnd={() => setDragId(null)}
                        className={cn(
                          "group cursor-grab rounded-lg border border-border bg-card p-2.5 transition-colors hover:border-border-strong active:cursor-grabbing",
                          dragId === task.id && "opacity-50",
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between gap-1">
                          <Link href={`/tasks/${task.id}`} className="mono text-[10px] text-muted hover:text-fg">
                            {task.code}
                          </Link>
                          <Badge variant={priority.variant}>{priority.label}</Badge>
                        </div>
                        <Link href={`/tasks/${task.id}`} className="block text-[11.5px] font-medium leading-snug text-fg hover:text-primary-200">
                          {task.title}
                        </Link>
                        {task.resource ? (
                          <p className="mt-1 truncate text-[10px] text-muted">{task.resource}</p>
                        ) : null}

                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-muted">
                            {CATEGORY[task.category] ?? task.category}
                          </span>
                          {task.autoValidate ? (
                            <span className="rounded bg-success/10 px-1.5 py-0.5 text-[9px] text-success">
                              auto
                            </span>
                          ) : null}
                          {checklistPercent !== null ? (
                            <span className="text-[9px] text-muted">{checklistPercent}%</span>
                          ) : null}
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {task.assignee ? (
                              <Avatar name={task.assignee.displayName} color={task.assignee.avatarColor} size="xs" />
                            ) : (
                              <span className="text-[9px] text-muted">Non assignee</span>
                            )}
                            {task.timeSpentSeconds > 0 ? (
                              <span className="flex items-center gap-0.5 text-[9px] text-muted">
                                <Timer className="h-2.5 w-2.5" />
                                {formatDuration(task.timeSpentSeconds)}
                              </span>
                            ) : null}
                          </div>
                          <span className="text-[9px] text-muted/60">{relativeTime(task.dueDate ?? "")}</span>
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 ? (
                    <p className="px-1 py-4 text-center text-[10px] text-muted/50">Vide</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateTaskDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        team={team.data?.users ?? []}
        onCreated={() => {
          setCreateOpen(false);
          void tasks.refresh();
        }}
      />
    </div>
  );
}

function CreateTaskDialog({
  open,
  onClose,
  team,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  team: TeamMember[];
  onCreated: () => void;
}) {
  const [form, setForm] = React.useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    category: "SCRIPT",
    status: "TODO",
    assigneeId: "",
    resource: "",
    files: "",
    estimatedMinutes: "",
    checklist: "",
    autoValidate: false,
    requiresReview: true,
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function update(key: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/tasks", {
        method: "POST",
        body: {
          title: form.title,
          description: form.description || undefined,
          priority: form.priority,
          category: form.category,
          status: form.status,
          assigneeId: form.assigneeId || null,
          resource: form.resource || null,
          files: form.files
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : null,
          checklist: form.checklist
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          autoValidate: form.autoValidate,
          requiresReview: form.requiresReview,
        },
      });
      toast.success("Tache creee");
      setForm({ ...form, title: "", description: "", files: "", checklist: "" });
      onCreated();
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
      title="Nouvelle tache"
      description="Les fichiers listes servent au rapprochement automatique des modifications."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={loading} onClick={submit} disabled={form.title.trim().length < 3}>
            Creer la tache
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p> : null}
        <Field label="Titre">
          <Input value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Correction du systeme de garage" />
        </Field>
        <Field label="Description">
          <Textarea rows={3} value={form.description} onChange={(event) => update("description", event.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Priorite">
            <Select value={form.priority} onChange={(event) => update("priority", event.target.value)}>
              {Object.entries(PRIORITY).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Categorie">
            <Select value={form.category} onChange={(event) => update("category", event.target.value)}>
              {Object.entries(CATEGORY).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Statut initial">
            <Select value={form.status} onChange={(event) => update("status", event.target.value)}>
              {TASK_COLUMNS.map((column) => (
                <option key={column} value={column}>{TASK_STATUS[column]!.label}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Developpeur assigne">
            <Select value={form.assigneeId} onChange={(event) => update("assigneeId", event.target.value)}>
              <option value="">Non assignee</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>{member.displayName}</option>
              ))}
            </Select>
          </Field>
          <Field label="Ressource concernee">
            <Input value={form.resource} onChange={(event) => update("resource", event.target.value)} placeholder="[vehicles]/garage" />
          </Field>
        </div>
        <Field label="Fichiers concernes" hint="Un chemin absolu par ligne.">
          <Textarea rows={2} value={form.files} onChange={(event) => update("files", event.target.value)} placeholder="/resources/[vehicles]/garage/client.lua" className="font-mono text-[11px]" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Temps estime (minutes)">
            <Input type="number" min={0} value={form.estimatedMinutes} onChange={(event) => update("estimatedMinutes", event.target.value)} />
          </Field>
          <Field label="Checklist" hint="Un element par ligne.">
            <Textarea rows={2} value={form.checklist} onChange={(event) => update("checklist", event.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-surface/60 px-3 py-2.5">
          <label className="flex items-center gap-2 text-xs text-muted">
            <Switch checked={form.autoValidate} onChange={(value) => update("autoValidate", value)} />
            Auto-validation autorisee
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            <Switch checked={form.requiresReview} onChange={(value) => update("requiresReview", value)} />
            Validation humaine requise
          </label>
        </div>
      </div>
    </Modal>
  );
}
