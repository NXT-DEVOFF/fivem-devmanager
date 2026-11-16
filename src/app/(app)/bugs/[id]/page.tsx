"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, ClipboardList, FileCode2, MessageSquare, ShieldAlert } from "lucide-react";
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
  Switch,
  Textarea,
} from "@/components/ui/primitives";
import { BUG_STATUS, SEVERITY } from "@/lib/labels";
import { formatDateTime, relativeTime } from "@/lib/format";

interface BugDetail {
  id: string;
  code: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  resource: string | null;
  filePath: string | null;
  reproduceSteps: string | null;
  expectedResult: string | null;
  actualResult: string | null;
  logs: string | null;
  screenshots: string[];
  fixValidated: boolean;
  fixedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  reporter: { displayName: string; avatarColor: string };
  assignee: { id: string; displayName: string; avatarColor: string } | null;
  task: { id: string; code: string; title: string } | null;
  comments: Array<{ id: string; body: string; createdAt: string; author: { displayName: string; avatarColor: string } }>;
  changes: Array<{ id: string; path: string; changeType: string; createdAt: string; user: string | null }>;
}

export default function BugDetailPage() {
  const params = useParams<{ id: string }>();
  const { can } = useRealtime();
  const bug = useApi<{ bug: BugDetail }>(`/api/bugs/${params.id}`);
  const team = useApi<{ users: Array<{ id: string; displayName: string }> }>("/api/team");
  const [comment, setComment] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const data = bug.data?.bug;

  async function patch(body: Record<string, unknown>, message: string) {
    if (!data) return;
    setBusy(true);
    try {
      await apiFetch(`/api/bugs/${data.id}`, { method: "PATCH", body });
      toast.success(message);
      await bug.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (bug.loading) return <Skeleton className="h-96" />;
  if (bug.error || !data) return <Card className="p-6 text-sm text-danger">{bug.error ?? "Bug introuvable"}</Card>;

  const status = BUG_STATUS[data.status] ?? BUG_STATUS.NEW!;
  const severity = SEVERITY[data.severity] ?? SEVERITY.MEDIUM!;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-xs text-muted">
        <Link href="/bugs" className="inline-flex items-center gap-1 hover:text-fg">
          <ArrowLeft className="h-3.5 w-3.5" /> Bugs
        </Link>
        <span>/</span>
        <span className="mono">{data.code}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{data.title}</h1>
            <Badge variant={severity.variant}>{severity.label}</Badge>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            {data.code} · signale par {data.reporter.displayName} · {relativeTime(data.createdAt)}
            {data.resource ? ` · ${data.resource}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can("bugs.edit") ? (
            <Select
              value={data.status}
              onChange={(event) => void patch({ status: event.target.value }, "Statut mis a jour")}
              disabled={busy}
              className="w-auto"
            >
              {Object.entries(BUG_STATUS).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </Select>
          ) : null}
          {can("bugs.close") && !data.closedAt ? (
            <Button
              size="sm"
              variant="success"
              onClick={() => void patch({ status: "CLOSED", fixValidated: true }, "Bug ferme")}
              loading={busy}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Fermer
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><h3 className="text-sm font-semibold">Description</h3></CardHeader>
            <CardBody className="space-y-3">
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted">{data.description}</p>
              {data.filePath ? (
                <p className="mono flex items-center gap-1.5 text-[11px] text-primary-200">
                  <FileCode2 className="h-3 w-3" /> {data.filePath}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader><h3 className="text-sm font-semibold">Reproduction</h3></CardHeader>
              <CardBody>
                <p className="whitespace-pre-wrap text-xs text-muted">
                  {data.reproduceSteps ?? "Non renseigne."}
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardHeader><h3 className="text-sm font-semibold">Attendu / obtenu</h3></CardHeader>
              <CardBody className="space-y-2 text-xs">
                <p><span className="text-muted">Attendu :</span> {data.expectedResult ?? "-"}</p>
                <p><span className="text-muted">Obtenu :</span> {data.actualResult ?? "-"}</p>
              </CardBody>
            </Card>
          </div>

          {data.logs ? (
            <Card>
              <CardHeader><h3 className="text-sm font-semibold">Logs</h3></CardHeader>
              <CardBody>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 font-mono text-[10px] text-muted">
                  {data.logs}
                </pre>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <MessageSquare className="h-3.5 w-3.5" /> Discussion
              </h3>
            </CardHeader>
            <div className="divide-y divide-border/60">
              {data.comments.map((entry) => (
                <div key={entry.id} className="flex gap-2.5 px-5 py-3">
                  <Avatar name={entry.author.displayName} color={entry.author.avatarColor} size="sm" />
                  <div>
                    <p className="text-[11px] font-medium">
                      {entry.author.displayName}
                      <span className="ml-1.5 text-[10px] font-normal text-muted">{relativeTime(entry.createdAt)}</span>
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted">{entry.body}</p>
                  </div>
                </div>
              ))}
              {data.comments.length === 0 ? (
                <p className="px-5 py-5 text-center text-xs text-muted">Aucun message.</p>
              ) : null}
            </div>
            <div className="border-t border-border p-3">
              <Textarea rows={2} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Ajouter un message..." />
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!comment.trim() || busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await apiFetch(`/api/bugs/${data.id}/comments`, { method: "POST", body: { body: comment } });
                      setComment("");
                      await bug.refresh();
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
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <ClipboardList className="h-3.5 w-3.5" /> Proprietes
              </h3>
            </CardHeader>
            <CardBody className="space-y-3">
              <Field label="Gravite">
                <Select
                  value={data.severity}
                  onChange={(event) => void patch({ severity: event.target.value }, "Gravite mise a jour")}
                  disabled={!can("bugs.edit") || busy}
                >
                  {Object.entries(SEVERITY).map(([value, meta]) => (
                    <option key={value} value={value}>{meta.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Responsable">
                <Select
                  value={data.assignee?.id ?? ""}
                  onChange={(event) => void patch({ assigneeId: event.target.value || null }, "Assignation mise a jour")}
                  disabled={!can("bugs.assign") || busy}
                >
                  <option value="">Non assigne</option>
                  {(team.data?.users ?? []).map((member) => (
                    <option key={member.id} value={member.id}>{member.displayName}</option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
                <div>
                  <p className="text-[11px] text-fg">Correction validee</p>
                  <p className="text-[10px] text-muted">Requis avant fermeture</p>
                </div>
                <Switch
                  checked={data.fixValidated}
                  onChange={(value) => void patch({ fixValidated: value }, value ? "Correction validee" : "Validation retiree")}
                  disabled={!can("bugs.edit") || busy}
                />
              </div>
              {data.fixedAt ? <p className="text-[10px] text-success">Corrige le {formatDateTime(data.fixedAt)}</p> : null}
              {data.closedAt ? <p className="text-[10px] text-muted">Ferme le {formatDateTime(data.closedAt)}</p> : null}
              {data.task ? (
                <Link href={`/tasks/${data.task.id}`} className="block text-[11px] text-primary-300 hover:underline">
                  Tache liee : {data.task.code}
                </Link>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <ShieldAlert className="h-3.5 w-3.5" /> Modifications liees
              </h3>
            </CardHeader>
            <div className="divide-y divide-border/60">
              {data.changes.length === 0 ? (
                <p className="px-5 py-4 text-center text-xs text-muted">
                  Aucune modification associee. Le statut ne change pas automatiquement.
                </p>
              ) : (
                data.changes.map((change) => (
                  <div key={change.id} className="px-4 py-2">
                    <p className="truncate text-[11px]">{change.path}</p>
                    <p className="text-[10px] text-muted">
                      {change.user ?? "Synchronisation"} · {relativeTime(change.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
