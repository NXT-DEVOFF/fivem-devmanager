"use client";

import * as React from "react";
import Link from "next/link";
import { Bug, ChevronRight, Plus, ScanSearch, Search } from "lucide-react";
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
  Textarea,
} from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { BUG_STATUS, SEVERITY } from "@/lib/labels";
import { relativeTime } from "@/lib/format";

interface BugRow {
  id: string;
  code: string;
  title: string;
  severity: string;
  status: string;
  resource: string | null;
  createdAt: string;
  reporter: { displayName: string; avatarColor: string };
  assignee: { displayName: string; avatarColor: string } | null;
  counts: { comments: number; changes: number };
}

export default function BugsPage() {
  const { can } = useRealtime();
  const [status, setStatus] = React.useState("");
  const [severity, setSeverity] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);

  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (severity) query.set("severity", severity);
  if (search) query.set("q", search);
  const bugs = useApi<{ bugs: BugRow[] }>(`/api/bugs?${query.toString()}`);
  const team = useApi<{ users: Array<{ id: string; displayName: string }> }>("/api/team");

  const rows = bugs.data?.bugs ?? [];
  async function scanConsole() {
    setScanning(true);
    try {
      const result = await apiFetch<{ created: number; duplicates: number; scanned: number }>(
        "/api/bugs/scan",
        { method: "POST", body: {} },
      );
      if (result.created > 0) {
        toast.success(
          `${result.created} bug(s) detecte(s) automatiquement sur ${result.scanned} lignes analysees.`,
        );
      } else if (result.duplicates > 0) {
        toast.info("Erreurs deja connues : aucun doublon cree.");
      } else {
        toast.info("Aucune nouvelle erreur detectee dans la console.");
      }
      await bugs.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setScanning(false);
    }
  }

  const stats = {
    open: rows.filter((bug) => !["FIXED", "CLOSED"].includes(bug.status)).length,
    critical: rows.filter((bug) => bug.severity === "CRITICAL" && bug.status !== "CLOSED").length,
    fixing: rows.filter((bug) => bug.status === "FIXING").length,
  };

  return (
    <div>
      <PageHeader
        title="Suivi des bugs"
        description="Signalement, analyse, correction et validation fonctionnelle avant fermeture."
        eyebrow="Qualite"
      >
        {can("bugs.create") ? (
          <Button variant="secondary" loading={scanning} onClick={() => void scanConsole()}>
            <ScanSearch className="h-4 w-4" /> Analyser la console
          </Button>
        ) : null}
        {can("bugs.create") ? (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Signaler un bug
          </Button>
        ) : null}
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Bugs ouverts</p>
          <p className="mt-1 text-xl font-semibold">{stats.open}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Critiques</p>
          <p className="mt-1 text-xl font-semibold text-danger">{stats.critical}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">En correction</p>
          <p className="mt-1 text-xl font-semibold text-primary-300">{stats.fixing}</p>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input
            className="pl-8"
            placeholder="Rechercher un bug..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-auto">
          <option value="">Tous les statuts</option>
          {Object.entries(BUG_STATUS).map(([value, meta]) => (
            <option key={value} value={value}>{meta.label}</option>
          ))}
        </Select>
        <Select value={severity} onChange={(event) => setSeverity(event.target.value)} className="w-auto">
          <option value="">Toutes severites</option>
          {Object.entries(SEVERITY).map(([value, meta]) => (
            <option key={value} value={value}>{meta.label}</option>
          ))}
        </Select>
      </div>

      <Card>
        {bugs.loading ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2].map((index) => <Skeleton key={index} className="h-14" />)}
          </div>
        ) : bugs.error ? (
          <p className="p-4 text-xs text-danger">{bugs.error}</p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Bug className="h-5 w-5" />}
            title="Aucun bug"
            description="Les bugs signales par l'equipe apparaitront ici."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Bug</th>
                  <th className="px-4 py-2.5 font-medium">Ressource</th>
                  <th className="px-4 py-2.5 font-medium">Gravite</th>
                  <th className="px-4 py-2.5 font-medium">Statut</th>
                  <th className="px-4 py-2.5 font-medium">Signale par</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((bug) => {
                  const statusMeta = BUG_STATUS[bug.status] ?? BUG_STATUS.NEW!;
                  const severityMeta = SEVERITY[bug.severity] ?? SEVERITY.MEDIUM!;
                  return (
                    <tr key={bug.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <span className="mono text-[10px] text-muted">{bug.code}</span>
                        <p className="max-w-[320px] truncate text-xs text-fg">{bug.title}</p>
                      </td>
                      <td className="px-4 py-3 text-muted">{bug.resource ?? "-"}</td>
                      <td className="px-4 py-3"><Badge variant={severityMeta.variant}>{severityMeta.label}</Badge></td>
                      <td className="px-4 py-3"><Badge variant={statusMeta.variant}>{statusMeta.label}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Avatar name={bug.reporter.displayName} color={bug.reporter.avatarColor} size="xs" />
                          <span className="text-muted">{bug.reporter.displayName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted">{relativeTime(bug.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/bugs/${bug.id}`} className="inline-flex items-center gap-1 text-[11px] text-primary-300 hover:underline">
                          Ouvrir <ChevronRight className="h-3 w-3" />
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

      <CreateBugDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        team={team.data?.users ?? []}
        onCreated={() => {
          setCreateOpen(false);
          void bugs.refresh();
        }}
      />
    </div>
  );
}

function CreateBugDialog({
  open,
  onClose,
  team,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  team: Array<{ id: string; displayName: string }>;
  onCreated: () => void;
}) {
  const [form, setForm] = React.useState({
    title: "",
    description: "",
    severity: "MEDIUM",
    resource: "",
    filePath: "",
    reproduceSteps: "",
    expectedResult: "",
    actualResult: "",
    logs: "",
    assigneeId: "",
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
      await apiFetch("/api/bugs", {
        method: "POST",
        body: {
          title: form.title,
          description: form.description,
          severity: form.severity,
          resource: form.resource || undefined,
          filePath: form.filePath || undefined,
          reproduceSteps: form.reproduceSteps || undefined,
          expectedResult: form.expectedResult || undefined,
          actualResult: form.actualResult || undefined,
          logs: form.logs || undefined,
          assigneeId: form.assigneeId || null,
        },
      });
      toast.success("Bug signale");
      setForm({ ...form, title: "", description: "", logs: "", reproduceSteps: "" });
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
      title="Signaler un bug"
      description="Plus le rapport est precis, plus la correction sera rapide."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={loading} onClick={submit} disabled={form.title.trim().length < 5 || form.description.trim().length < 10}>
            Signaler
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p> : null}
        <Field label="Titre">
          <Input value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Erreur de sauvegarde du vehicule" />
        </Field>
        <Field label="Description">
          <Textarea rows={3} value={form.description} onChange={(event) => update("description", event.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Gravite">
            <Select value={form.severity} onChange={(event) => update("severity", event.target.value)}>
              {Object.entries(SEVERITY).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Developpeur responsable">
            <Select value={form.assigneeId} onChange={(event) => update("assigneeId", event.target.value)}>
              <option value="">Non assigne</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>{member.displayName}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ressource">
            <Input value={form.resource} onChange={(event) => update("resource", event.target.value)} placeholder="[vehicles]/garage" />
          </Field>
          <Field label="Fichier">
            <Input value={form.filePath} onChange={(event) => update("filePath", event.target.value)} className="font-mono text-[11px]" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Etapes de reproduction">
            <Textarea rows={3} value={form.reproduceSteps} onChange={(event) => update("reproduceSteps", event.target.value)} />
          </Field>
          <Field label="Resultat attendu">
            <Textarea rows={3} value={form.expectedResult} onChange={(event) => update("expectedResult", event.target.value)} />
          </Field>
        </div>
        <Field label="Resultat obtenu">
          <Textarea rows={2} value={form.actualResult} onChange={(event) => update("actualResult", event.target.value)} />
        </Field>
        <Field label="Logs / traces">
          <Textarea rows={4} value={form.logs} onChange={(event) => update("logs", event.target.value)} className="font-mono text-[11px]" />
        </Field>
      </div>
    </Modal>
  );
}
