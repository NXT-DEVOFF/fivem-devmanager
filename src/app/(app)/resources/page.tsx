"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Boxes, FileCode2, RefreshCw, RotateCw, Search } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/use-api";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useRealtime } from "@/components/realtime-provider";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Skeleton,
} from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { formatBytes, formatDateTime, relativeTime } from "@/lib/format";

interface ResourceRow {
  id: string;
  name: string;
  folder: string;
  state: string;
  version: string | null;
  author: string | null;
  description: string | null;
  dependencies: string[];
  missingDependencies: string[];
  fileCount: number;
  sizeBytes: number;
  lastModifiedAt: string | null;
  lastDeployAt: string | null;
  lastRunState: string | null;
  owner: { displayName: string } | null;
}

interface ResourceDetail {
  resource: ResourceRow & { manifest: { clientScripts?: string[]; serverScripts?: string[]; fxVersion?: string; game?: string } | null };
  files: Array<{ name: string; path: string; isFile: boolean; size: number; modifiedAt: string }>;
  filesError: string | null;
  changes: Array<{ id: string; path: string; changeType: string; createdAt: string; user: string | null; taskCode: string | null }>;
  tasks: Array<{ id: string; code: string; title: string; status: string }>;
}

const STATE_LABELS: Record<string, { label: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  manifest_valide: { label: "Manifest valide", variant: "success" },
  manifest_absent: { label: "Manifest absent", variant: "danger" },
  unknown: { label: "Inconnu", variant: "neutral" },
};

export default function ResourcesPage() {
  const { can } = useRealtime();
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const resources = useApi<{ resources: ResourceRow[] }>(
    `/api/resources${search ? `?q=${encodeURIComponent(search)}` : ""}`,
  );
  const detail = useApi<ResourceDetail>(selected ? `/api/resources/${encodeURIComponent(selected)}` : null);

  const rows = resources.data?.resources ?? [];
  const missing = rows.filter((resource) => resource.missingDependencies.length > 0).length;
  const missingNames = Array.from(
    new Set(rows.flatMap((resource) => resource.missingDependencies)),
  ).sort();

  async function sync() {
    setSyncing(true);
    try {
      const result = await apiFetch<{ scanned: number; created: number; updated: number; missingDependencies: number }>(
        "/api/resources",
        { method: "POST" },
      );
      toast.success(
        `${result.scanned} ressource(s) analysees · ${result.created} creee(s) · ${result.updated} mise(s) a jour`,
      );
      await resources.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSyncing(false);
    }
  }

  async function restart(name: string) {
    try {
      await apiFetch("/api/terminal", {
        method: "POST",
        body: { action: "resource", resource: name, mode: "ensure" },
      });
      toast.success(`Commande ensure ${name} envoyee`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div>
      <PageHeader
        title="Ressources FiveM"
        description="Analyse des fxmanifest.lua, dependances et historique. Le statut du dossier ne remplace pas l'etat d'execution."
        eyebrow="Developpement"
      >
        {can("resources.manage") ? (
          <Button variant="primary" onClick={sync} loading={syncing}>
            <RefreshCw className="h-4 w-4" /> Synchroniser
          </Button>
        ) : null}
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Ressources analysees</p>
          <p className="mt-1 text-xl font-semibold">{rows.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Manifest manquant</p>
          <p className="mt-1 text-xl font-semibold text-danger">
            {rows.filter((resource) => resource.state === "manifest_absent").length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">
            Ressources avec dependances manquantes
          </p>
          <p className="mt-1 text-xl font-semibold text-warning">{missing}</p>
          {missingNames.length > 0 ? (
            <ul className="mt-1 flex max-h-20 flex-wrap gap-1 overflow-y-auto">
              {missingNames.map((dependency) => (
                <li
                  key={dependency}
                  className="mono rounded border border-danger/30 bg-danger/10 px-1.5 py-0.5 text-[10px] text-danger"
                >
                  {dependency}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input
            className="pl-8"
            placeholder="Rechercher une ressource..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button variant="ghost" size="sm" onClick={() => void resources.refresh()}>
          Rafraichir
        </Button>
      </div>

      <Card>
        {resources.loading ? (
          <div className="space-y-2 p-4">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-12" />)}</div>
        ) : resources.error ? (
          <p className="p-4 text-xs text-danger">{resources.error}</p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Boxes className="h-5 w-5" />}
            title="Aucune ressource synchronisee"
            description="Lancez une synchronisation pour analyser /resources et ses fxmanifest.lua."
            action={
              can("resources.manage") ? (
                <Button size="sm" variant="primary" onClick={sync} loading={syncing}>
                  Synchroniser maintenant
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Ressource</th>
                  <th className="px-4 py-2 font-medium">Manifest</th>
                  <th className="px-4 py-2 font-medium">Version</th>
                  <th className="px-4 py-2 font-medium">Fichiers</th>
                  <th className="px-4 py-2 font-medium">Dependances</th>
                  <th className="px-4 py-2 font-medium">Modifiee</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((resource) => {
                  const state = STATE_LABELS[resource.state] ?? STATE_LABELS.unknown!;
                  return (
                    <tr key={resource.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5">
                        <button onClick={() => setSelected(resource.name)} className="text-left text-fg hover:text-primary-200">
                          {resource.name}
                        </button>
                        <p className="mono text-[10px] text-muted">{resource.folder}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={state.variant}>{state.label}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted">{resource.version ?? "-"}</td>
                      <td className="px-4 py-2.5 text-muted">
                        {resource.fileCount} · {formatBytes(resource.sizeBytes)}
                      </td>
                      <td className="px-4 py-2.5">
                        {resource.missingDependencies.length > 0 ? (
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() => setSelected(resource.name)}
                              className="inline-flex items-center gap-1 rounded-md border border-danger/30 bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger transition-colors hover:bg-danger/20"
                              title={resource.missingDependencies.join(", ")}
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {resource.missingDependencies.length} manquante(s)
                            </button>
                            <ul className="max-h-24 space-y-0.5 overflow-y-auto pr-1">
                              {resource.missingDependencies.map((dependency) => (
                                <li
                                  key={dependency}
                                  className="mono break-all text-[10px] text-danger/80"
                                >
                                  {dependency}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : resource.dependencies.length > 0 ? (
                          <span className="text-muted">{resource.dependencies.length}</span>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted">{relativeTime(resource.lastModifiedAt)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/editor?file=${encodeURIComponent(`${resource.folder}/fxmanifest.lua`)}`}
                            className="rounded p-1 text-muted hover:bg-white/5 hover:text-fg"
                            title="Ouvrir fxmanifest"
                          >
                            <FileCode2 className="h-3.5 w-3.5" />
                          </Link>
                          {can("server.console.send") ? (
                            <button
                              onClick={() => void restart(resource.name)}
                              className="rounded p-1 text-muted hover:bg-white/5 hover:text-fg"
                              title="ensure"
                            >
                              <RotateCw className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ?? "Ressource"}
        description="Detail de la ressource, fichiers et historique des modifications."
        size="xl"
      >
        {detail.loading ? (
          <Skeleton className="h-40" />
        ) : detail.error ? (
          <p className="text-xs text-danger">{detail.error}</p>
        ) : detail.data ? (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <Info label="Dossier" value={detail.data.resource.folder} mono />
              <Info label="Version" value={detail.data.resource.version ?? "-"} />
              <Info label="Auteur" value={detail.data.resource.author ?? "-"} />
              <Info label="fx_version" value={detail.data.resource.manifest?.fxVersion ?? "-"} />
              <Info label="Game" value={detail.data.resource.manifest?.game ?? "-"} />
              <Info label="Dernier deploiement" value={formatDateTime(detail.data.resource.lastDeployAt)} />
            </div>

            {detail.data.resource.missingDependencies.length > 0 ? (
              <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2">
                <p className="text-[11px] font-medium text-danger">
                  {detail.data.resource.missingDependencies.length} dependance(s) introuvable(s)
                  dans /resources :
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1">
                  {detail.data.resource.missingDependencies.map((dependency) => (
                    <li
                      key={dependency}
                      className="mono rounded border border-danger/30 bg-danger/10 px-1.5 py-0.5 text-[10px] text-danger"
                    >
                      {dependency}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[10px] text-muted">
                  Declarees dans fxmanifest.lua mais absentes du dossier /resources (hors
                  ressources systeme FXServer).
                </p>
              </div>
            ) : null}

            <div>
              <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted">Fichiers</p>
              {detail.data.filesError ? (
                <p className="text-[11px] text-danger">{detail.data.filesError}</p>
              ) : (
                <div className="max-h-40 divide-y divide-border/60 overflow-y-auto rounded-lg border border-border">
                  {detail.data.files.map((file) => (
                    <div key={file.path} className="flex items-center justify-between px-3 py-1.5 text-[11px]">
                      <span className="truncate">{file.name}</span>
                      <span className="text-muted">{file.isFile ? formatBytes(file.size) : "dossier"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted">Historique</p>
              <div className="max-h-40 divide-y divide-border/60 overflow-y-auto rounded-lg border border-border">
                {detail.data.changes.length === 0 ? (
                  <p className="px-3 py-3 text-center text-[11px] text-muted">Aucune modification.</p>
                ) : (
                  detail.data.changes.map((change) => (
                    <div key={change.id} className="px-3 py-1.5 text-[11px]">
                      <p className="truncate">{change.path}</p>
                      <p className="text-[10px] text-muted">
                        {change.user ?? "Synchronisation"} · {relativeTime(change.createdAt)}
                        {change.taskCode ? ` · ${change.taskCode}` : ""}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/editor?file=${encodeURIComponent(`${detail.data.resource.folder}/fxmanifest.lua`)}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-[11px] text-muted hover:text-fg"
              >
                <FileCode2 className="h-3.5 w-3.5" /> Ouvrir fxmanifest.lua
              </Link>
              <Link
                href={`/files?path=${encodeURIComponent(detail.data.resource.folder)}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-[11px] text-muted hover:text-fg"
              >
                Parcourir les fichiers
              </Link>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface/60 px-3 py-2">
      <p className="text-[9px] uppercase tracking-wide text-muted">{label}</p>
      <p className={`truncate text-[11px] text-fg ${mono ? "mono" : ""}`}>{value}</p>
    </div>
  );
}
