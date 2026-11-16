"use client";

import * as React from "react";
import { CheckCircle2, FileWarning, Rocket, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/use-api";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useRealtime } from "@/components/realtime-provider";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Skeleton,
  Textarea,
} from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { DEPLOYMENT_STATUS } from "@/lib/labels";
import { formatDateTime, relativeTime } from "@/lib/format";

interface DeploymentRow {
  id: string;
  resource: string;
  title: string;
  status: string;
  changes: { pendingChanges?: Array<{ path: string; type: string }>; snapshotFileCount?: number } | null;
  files: string[];
  logs: string | null;
  requestedBy: { displayName: string; avatarColor: string };
  approvedBy: { displayName: string } | null;
  createdAt: string;
  deployedAt: string | null;
}

export default function DeploymentsPage() {
  const { can } = useRealtime();
  const deployments = useApi<{ deployments: DeploymentRow[] }>("/api/deployments");
  const resources = useApi<{ resources: Array<{ name: string }> }>("/api/resources");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState({ resource: "", title: "", notes: "" });
  const [busy, setBusy] = React.useState<string | null>(null);
  const [logs, setLogs] = React.useState<{ title: string; content: string } | null>(null);
  const [restart, setRestart] = React.useState(false);

  const rows = deployments.data?.deployments ?? [];

  async function create() {
    setBusy("create");
    try {
      await apiFetch("/api/deployments", {
        method: "POST",
        body: { resource: form.resource, title: form.title, notes: form.notes || undefined },
      });
      toast.success("Deploiement soumis. Un responsable doit l'approuver.");
      setCreateOpen(false);
      setForm({ resource: "", title: "", notes: "" });
      await deployments.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function act(deployment: DeploymentRow, action: "approve" | "reject" | "execute" | "rollback") {
    if (action === "execute" && restart) {
      const confirmed = window.confirm(
        `Le redemarrage de la ressource ${deployment.resource} va interrompre son execution. Confirmer ?`,
      );
      if (!confirmed) return;
    }
    setBusy(deployment.id + action);
    try {
      const result = await apiFetch<{ logs?: string[] }>(`/api/deployments/${deployment.id}`, {
        method: "PATCH",
        body: { action, restartResource: restart },
      });
      toast.success(
        action === "approve"
          ? "Deploiement approuve"
          : action === "reject"
            ? "Deploiement refuse"
            : action === "execute"
              ? "Deploiement execute"
              : "Rollback effectue",
      );
      if (result.logs) setLogs({ title: "Journal du deploiement", content: result.logs.join("\n") });
      await deployments.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Deploiements"
        description="Validation des modifications, snapshot avant application et rollback. Aucun redemarrage automatique du serveur."
        eyebrow="Production"
      >
        {can("deployments.request") ? (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Rocket className="h-4 w-4" /> Proposer un deploiement
          </Button>
        ) : null}
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {["PENDING", "APPROVED", "DEPLOYED", "ROLLED_BACK"].map((status) => {
          const meta = DEPLOYMENT_STATUS[status]!;
          return (
            <Card key={status} className="p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted">{meta.label}</p>
              <p className="mt-1 text-xl font-semibold">{rows.filter((row) => row.status === status).length}</p>
            </Card>
          );
        })}
      </div>

      <Card>
        {deployments.loading ? (
          <div className="space-y-2 p-4">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-16" />)}</div>
        ) : deployments.error ? (
          <p className="p-4 text-xs text-danger">{deployments.error}</p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Rocket className="h-5 w-5" />}
            title="Aucun deploiement"
            description="Proposez un deploiement pour valider et tracer la mise en production d'une ressource."
          />
        ) : (
          <div className="divide-y divide-border/60">
            {rows.map((deployment) => {
              const status = DEPLOYMENT_STATUS[deployment.status] ?? DEPLOYMENT_STATUS.PENDING!;
              const pending = deployment.changes?.pendingChanges?.length ?? 0;
              return (
                <div key={deployment.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-fg">{deployment.resource}</span>
                        <Badge variant={status.variant}>{status.label}</Badge>
                        <span className="text-[10px] text-muted">
                          snapshot {deployment.changes?.snapshotFileCount ?? 0} fichier(s) · {pending} modif(s) en attente
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">{deployment.title}</p>
                      <p className="mt-0.5 text-[10px] text-muted/70">
                        Demande par {deployment.requestedBy.displayName} · {relativeTime(deployment.createdAt)}
                        {deployment.approvedBy ? ` · approuve par ${deployment.approvedBy.displayName}` : ""}
                        {deployment.deployedAt ? ` · deploye ${formatDateTime(deployment.deployedAt)}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {deployment.logs ? (
                        <Button size="sm" variant="ghost" onClick={() => setLogs({ title: `Journal - ${deployment.resource}`, content: deployment.logs ?? "" })}>
                          Journal
                        </Button>
                      ) : null}
                      {deployment.status === "PENDING" && can("deployments.approve") ? (
                        <>
                          <Button size="sm" variant="success" loading={busy === deployment.id + "approve"} onClick={() => act(deployment, "approve")}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approuver
                          </Button>
                          <Button size="sm" variant="danger" loading={busy === deployment.id + "reject"} onClick={() => act(deployment, "reject")}>
                            <XCircle className="h-3.5 w-3.5" /> Refuser
                          </Button>
                        </>
                      ) : null}
                      {deployment.status === "APPROVED" && can("deployments.execute") ? (
                        <Button size="sm" variant="primary" loading={busy === deployment.id + "execute"} onClick={() => act(deployment, "execute")}>
                          <Rocket className="h-3.5 w-3.5" /> Executer
                        </Button>
                      ) : null}
                      {["DEPLOYED", "FAILED"].includes(deployment.status) && can("deployments.rollback") ? (
                        <Button size="sm" variant="secondary" loading={busy === deployment.id + "rollback"} onClick={() => act(deployment, "rollback")}>
                          <RotateCcw className="h-3.5 w-3.5" /> Rollback
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <label className="mt-3 flex items-center gap-2 text-[11px] text-muted">
        <input
          type="checkbox"
          checked={restart}
          onChange={(event) => setRestart(event.target.checked)}
          className="h-3.5 w-3.5 rounded border-border bg-surface"
        />
        Redemarrer la ressource apres execution (commande <span className="mono">ensure</span>) — operation
        interruptive, demandee explicitement.
      </label>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Proposer un deploiement"
        description="Un snapshot complet de la ressource est cree avant toute action."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button
              variant="primary"
              loading={busy === "create"}
              onClick={create}
              disabled={!form.resource.trim() || form.title.trim().length < 3}
            >
              Creer la demande
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Ressource">
            <Input
              list="resource-options"
              value={form.resource}
              onChange={(event) => setForm({ ...form, resource: event.target.value })}
              placeholder="garage"
              className="font-mono text-xs"
            />
            <datalist id="resource-options">
              {(resources.data?.resources ?? []).map((resource) => (
                <option key={resource.name} value={resource.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Titre">
            <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Correction du systeme de garage" />
          </Field>
          <Field label="Notes" hint="Visible par les approbateurs.">
            <Textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </Field>
          <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/[0.06] px-3 py-2 text-[11px] text-warning">
            <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            L&apos;approbation d&apos;un deploiement puis son execution sont journalisees. Le serveur
            complet n&apos;est jamais redemarre automatiquement.
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(logs)} onClose={() => setLogs(null)} title={logs?.title ?? "Journal"} size="lg">
        <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 font-mono text-[10.5px] text-muted">
          {logs?.content}
        </pre>
      </Modal>
    </div>
  );
}
