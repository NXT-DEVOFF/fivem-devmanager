"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  FileCode2,
  MessageSquare,
  Paperclip,
  ShieldCheck,
  Upload,
  Trash2,
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
  Field,
  Select,
  Skeleton,
  Textarea,
} from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/modal";
import { CATEGORY, PRIORITY, TASK_COLUMNS, TASK_STATUS } from "@/lib/labels";
import { formatDateTime, formatDuration, relativeTime } from "@/lib/format";

interface TaskDetail {
  id: string;
  code: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  resource: string | null;
  files: string[];
  tags: string[];
  dueDate: string | null;
  estimatedMinutes: number | null;
  timeSpentSeconds: number;
  autoValidate: boolean;
  requiresReview: boolean;
  completedAt: string | null;
  validatedAt: string | null;
  validationKind: string | null;
  assignee: { id: string; displayName: string; avatarColor: string } | null;
  creator: { id: string; displayName: string };
  checklist: Array<{ id: string; label: string; done: boolean }>;
  comments: Array<{ id: string; body: string; createdAt: string; author: { displayName: string; avatarColor: string } }>;
  attachments: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: number;
    createdAt: string;
    uploadedBy: { displayName: string; avatarColor: string };
  }>;
  fileChanges: Array<{ id: string; path: string; changeType: string; createdAt: string; user: { displayName: string } | null }>;
  sessions: Array<{ id: string; number: number; startedAt: string; status: string }>;
  dependencies: Array<{ dependsOn: { id: string; code: string; title: string; status: string } }>;
  subtasks: Array<{ id: string; code: string; title: string; status: string }>;
}

interface Readiness {
  ready: boolean;
  autoEligible: boolean;
  criteria: Array<{ key: string; label: string; satisfied: boolean; detail?: string }>;
}

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useRealtime();
  const task = useApi<{ task: TaskDetail; readiness: Readiness }>(`/api/tasks/${params.id}`);
  const team = useApi<{ users: Array<{ id: string; displayName: string }> }>("/api/team");
  const [comment, setComment] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [validationNote, setValidationNote] = React.useState("");
  const [uploading, setUploading] = React.useState(false);

  const data = task.data?.task;
  const readiness = task.data?.readiness;

  async function patch(body: Record<string, unknown>, message: string) {
    if (!data) return;
    setBusy(true);
    try {
      await apiFetch(`/api/tasks/${data.id}`, { method: "PATCH", body });
      toast.success(message);
      await task.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function toggleChecklist(itemId: string, done: boolean) {
    if (!data) return;
    await patch(
      {
        checklist: data.checklist.map((item) => ({
          id: item.id,
          label: item.label,
          done: item.id === itemId ? done : item.done,
        })),
      },
      done ? "Element coche" : "Element decoche",
    );
  }

  async function validate(decision: "approve" | "reject") {
    if (!data) return;
    setBusy(true);
    try {
      await apiFetch(`/api/tasks/${data.id}/validate`, {
        method: "POST",
        body: { decision, note: validationNote || undefined, force: decision === "approve" && !readiness?.ready },
      });
      toast.success(decision === "approve" ? "Tache validee" : "Validation refusee");
      setValidationNote("");
      await task.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function uploadAttachment(file: File) {
    if (!data) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await apiFetch(`/api/tasks/${data.id}/attachments`, { method: "POST", body: form });
      toast.success("Piece jointe ajoutee");
      await task.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  async function deleteAttachment(attachmentId: string) {
    if (!data) return;
    if (!window.confirm("Supprimer cette piece jointe ?")) return;
    try {
      await apiFetch(`/api/tasks/${data.id}/attachments/${attachmentId}`, { method: "DELETE" });
      toast.success("Piece jointe supprimee");
      await task.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function remove() {
    if (!data) return;
    setBusy(true);
    try {
      await apiFetch(`/api/tasks/${data.id}`, { method: "DELETE" });
      toast.success("Tache supprimee");
      router.push("/tasks");
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  if (task.loading) return <Skeleton className="h-96" />;
  if (task.error || !data) return <Card className="p-6 text-sm text-danger">{task.error ?? "Tache introuvable"}</Card>;

  const status = TASK_STATUS[data.status] ?? TASK_STATUS.BACKLOG!;
  const priority = PRIORITY[data.priority] ?? PRIORITY.MEDIUM!;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-xs text-muted">
        <Link href="/tasks" className="inline-flex items-center gap-1 hover:text-fg">
          <ArrowLeft className="h-3.5 w-3.5" /> Taches
        </Link>
        <span>/</span>
        <span className="mono">{data.code}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{data.title}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
            <Badge variant={priority.variant}>{priority.label}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            {data.code} · creee par {data.creator.displayName} ·{" "}
            {CATEGORY[data.category] ?? data.category}
            {data.resource ? ` · ${data.resource}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can("tasks.validate") || can("tasks.edit") ? (
            <>
              <Button size="sm" variant="outline" onClick={() => validate("approve")} loading={busy}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Valider
              </Button>
              {can("tasks.validate") ? (
                <Button size="sm" variant="danger" onClick={() => validate("reject")} loading={busy}>
                  <X className="h-3.5 w-3.5" /> Refuser
                </Button>
              ) : null}
            </>
          ) : null}
          {can("tasks.delete") ? (
            <Button size="icon" variant="ghost" onClick={() => setDeleteOpen(true)} title="Supprimer">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">Description</h3>
            </CardHeader>
            <CardBody>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted">
                {data.description ?? "Aucune description."}
              </p>
              {data.files.length > 0 ? (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted">Fichiers concernes</p>
                  <ul className="space-y-1">
                    {data.files.map((file) => (
                      <li key={file} className="mono flex items-center gap-1.5 text-[11px] text-primary-200">
                        <FileCode2 className="h-3 w-3" /> {file}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">Checklist</h3>
              <Badge variant="neutral">
                {data.checklist.filter((item) => item.done).length}/{data.checklist.length}
              </Badge>
            </CardHeader>
            <div className="divide-y divide-border/60">
              {data.checklist.length === 0 ? (
                <p className="px-5 py-5 text-center text-xs text-muted">Aucun element.</p>
              ) : (
                data.checklist.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => void toggleChecklist(item.id, !item.done)}
                    disabled={busy || !can("tasks.edit")}
                    className="flex w-full items-center gap-2.5 px-5 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border ${
                        item.done ? "border-success bg-success/20 text-success" : "border-border-strong"
                      }`}
                    >
                      {item.done ? <Check className="h-2.5 w-2.5" /> : null}
                    </span>
                    <span className={`text-xs ${item.done ? "text-muted line-through" : "text-fg"}`}>
                      {item.label}
                    </span>
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <MessageSquare className="h-3.5 w-3.5" /> Commentaires
              </h3>
              <Badge variant="neutral">{data.comments.length}</Badge>
            </CardHeader>
            <div className="max-h-[320px] divide-y divide-border/60 overflow-y-auto">
              {data.comments.map((entry) => (
                <div key={entry.id} className="flex gap-2.5 px-5 py-3">
                  <Avatar name={entry.author.displayName} color={entry.author.avatarColor} size="sm" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium">
                      {entry.author.displayName}
                      <span className="ml-1.5 text-[10px] font-normal text-muted">
                        {relativeTime(entry.createdAt)}
                      </span>
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted">{entry.body}</p>
                  </div>
                </div>
              ))}
              {data.comments.length === 0 ? (
                <p className="px-5 py-5 text-center text-xs text-muted">Aucun commentaire.</p>
              ) : null}
            </div>
            <div className="border-t border-border p-3">
              <Textarea
                rows={2}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Ajouter un commentaire..."
              />
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!comment.trim() || busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await apiFetch(`/api/tasks/${data.id}/comments`, {
                        method: "POST",
                        body: { body: comment },
                      });
                      setComment("");
                      await task.refresh();
                    } catch (error) {
                      toast.error(errorMessage(error));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Publier
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <Paperclip className="h-3.5 w-3.5" /> Pieces jointes
              </h3>
              <Badge variant="neutral">{data.attachments.length}</Badge>
            </CardHeader>
            <div className="divide-y divide-border/60">
              {data.attachments.length === 0 ? (
                <p className="px-5 py-5 text-center text-xs text-muted">Aucune piece jointe.</p>
              ) : (
                data.attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center gap-2 px-5 py-2.5">
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-primary-300" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] text-fg">{attachment.name}</p>
                      <p className="text-[10px] text-muted">
                        {formatAttachmentSize(attachment.size)} · {attachment.uploadedBy.displayName} ·{" "}
                        {relativeTime(attachment.createdAt)}
                      </p>
                    </div>
                    <a
                      href={`/api/tasks/${data.id}/attachments/${attachment.id}`}
                      download
                      className="rounded p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-fg"
                      title="Telecharger"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    {can("tasks.edit") ? (
                      <button
                        type="button"
                        onClick={() => void deleteAttachment(attachment.id)}
                        className="rounded p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
            {can("tasks.edit") ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
                <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-elevated px-3 text-xs text-fg transition-colors hover:border-border-strong">
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? "Envoi..." : "Ajouter un fichier"}
                  <input
                    type="file"
                    className="hidden"
                    accept=".png,.jpg,.jpeg,.gif,.webp,.txt,.log,.md,.json,.pdf"
                    disabled={uploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void uploadAttachment(file);
                    }}
                  />
                </label>
                <span className="text-[10px] text-muted">Images, logs et PDF · 8 Mo max</span>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">Modifications detectees</h3>
              <Badge variant="neutral">{data.fileChanges.length}</Badge>
            </CardHeader>
            <div className="max-h-[260px] divide-y divide-border/60 overflow-y-auto">
              {data.fileChanges.length === 0 ? (
                <p className="px-5 py-5 text-center text-xs text-muted">
                  Aucune modification associee a cette tache.
                </p>
              ) : (
                data.fileChanges.map((change) => (
                  <div key={change.id} className="flex items-center gap-2 px-5 py-2">
                    <FileCode2 className="h-3 w-3 shrink-0 text-primary-300" />
                    <span className="min-w-0 flex-1 truncate text-[11px]">{change.path}</span>
                    <span className="text-[10px] text-muted">{relativeTime(change.createdAt)}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">Validation</h3>
              {readiness?.ready ? (
                <Badge variant="success"><ShieldCheck className="h-3 w-3" /> Prete</Badge>
              ) : (
                <Badge variant="warning">Criteres incomplets</Badge>
              )}
            </CardHeader>
            <CardBody className="space-y-2">
              {readiness?.criteria.map((criterion) => (
                <div key={criterion.key} className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ${
                      criterion.satisfied ? "bg-success/20 text-success" : "bg-white/5 text-muted"
                    }`}
                  >
                    {criterion.satisfied ? <Check className="h-2 w-2" /> : null}
                  </span>
                  <div>
                    <p className="text-[11px] text-fg">{criterion.label}</p>
                    {criterion.detail ? <p className="text-[10px] text-muted">{criterion.detail}</p> : null}
                  </div>
                </div>
              ))}
              <Field label="Note de validation">
                <Textarea
                  rows={2}
                  value={validationNote}
                  onChange={(event) => setValidationNote(event.target.value)}
                  placeholder="Commentaire pour le developpeur..."
                />
              </Field>
              {data.validatedAt ? (
                <p className="text-[10px] text-success">
                  Validee le {formatDateTime(data.validatedAt)} ({data.validationKind ?? "humaine"})
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">Proprietes</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              <Field label="Statut">
                <Select
                  value={data.status}
                  onChange={(event) => void patch({ status: event.target.value }, "Statut mis a jour")}
                  disabled={!can("tasks.edit") || busy}
                >
                  {TASK_COLUMNS.map((column) => (
                    <option key={column} value={column}>{TASK_STATUS[column]!.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Priorite">
                <Select
                  value={data.priority}
                  onChange={(event) => void patch({ priority: event.target.value }, "Priorite mise a jour")}
                  disabled={!can("tasks.edit") || busy}
                >
                  {Object.entries(PRIORITY).map(([value, meta]) => (
                    <option key={value} value={value}>{meta.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Assigne a">
                <Select
                  value={data.assignee?.id ?? ""}
                  onChange={(event) => void patch({ assigneeId: event.target.value || null }, "Assignation mise a jour")}
                  disabled={!can("tasks.assign") || busy}
                >
                  <option value="">Non assignee</option>
                  {(team.data?.users ?? []).map((member) => (
                    <option key={member.id} value={member.id}>{member.displayName}</option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded border border-border bg-surface px-2.5 py-2">
                  <p className="text-[9px] uppercase text-muted">Estime</p>
                  <p>{data.estimatedMinutes ? `${data.estimatedMinutes} min` : "-"}</p>
                </div>
                <div className="rounded border border-border bg-surface px-2.5 py-2">
                  <p className="text-[9px] uppercase text-muted">Reel</p>
                  <p>{formatDuration(data.timeSpentSeconds)}</p>
                </div>
              </div>
              {data.dueDate ? (
                <p className="text-[10px] text-muted">Echeance : {formatDateTime(data.dueDate)}</p>
              ) : null}
              {data.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {data.tags.map((tag) => (
                    <Badge key={tag} variant="neutral">{tag}</Badge>
                  ))}
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">Sessions liees</h3>
            </CardHeader>
            <div className="divide-y divide-border/60">
              {data.sessions.length === 0 ? (
                <p className="px-5 py-4 text-center text-xs text-muted">Aucune session.</p>
              ) : (
                data.sessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/sessions/${session.id}`}
                    className="flex items-center justify-between px-5 py-2 text-[11px] hover:bg-white/[0.02]"
                  >
                    <span>#{String(session.number).padStart(4, "0")}</span>
                    <span className="text-muted">{formatDateTime(session.startedAt)}</span>
                  </Link>
                ))
              )}
            </div>
          </Card>

          {data.dependencies.length > 0 ? (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold">Dependances</h3>
              </CardHeader>
              <div className="divide-y divide-border/60">
                {data.dependencies.map((dependency) => (
                  <Link
                    key={dependency.dependsOn.id}
                    href={`/tasks/${dependency.dependsOn.id}`}
                    className="flex items-center justify-between px-5 py-2 text-[11px] hover:bg-white/[0.02]"
                  >
                    <span className="mono text-muted">{dependency.dependsOn.code}</span>
                    <span>{dependency.dependsOn.title}</span>
                  </Link>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        title="Supprimer la tache"
        description="Cette action est definitive. L'historique d'audit est conserve."
        confirmLabel="Supprimer"
        dangerous
        loading={busy}
      />
    </div>
  );
}

function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
