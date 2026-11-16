"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUp,
  ChevronRight,
  Code2,
  Download,
  FileCode2,
  Folder,
  FolderPlus,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
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
  cn,
} from "@/components/ui/primitives";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { formatBytes, formatDateTime } from "@/lib/format";

interface Entry {
  name: string;
  path: string;
  isFile: boolean;
  size: number;
  modifiedAt: string;
  editable: boolean;
}

export default function FilesPage() {
  const { can } = useRealtime();
  const [path, setPath] = React.useState("/resources");
  const [search, setSearch] = React.useState("");
  const [mode, setMode] = React.useState<"name" | "content">("name");
  const [searchResults, setSearchResults] = React.useState<Array<{ path: string; name: string; size: number; modifiedAt: string; snippet?: string }> | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createKind, setCreateKind] = React.useState<"file" | "folder">("file");
  const [createName, setCreateName] = React.useState("");
  const [renameTarget, setRenameTarget] = React.useState<Entry | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<Entry | null>(null);
  const [busy, setBusy] = React.useState(false);
  const uploadRef = React.useRef<HTMLInputElement>(null);

  const listing = useApi<{ path: string; backend: string; entries: Entry[] }>(
    `/api/files?path=${encodeURIComponent(path)}`,
  );

  const entries = listing.data?.entries ?? [];
  const crumbs = path.split("/").filter(Boolean);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const form = new FormData();
    form.append("directory", path);
    Array.from(files).forEach((file) => form.append("files", file));
    setBusy(true);
    try {
      await apiFetch("/api/files/upload", { method: "POST", body: form });
      toast.success(`${files.length} fichier(s) televerse(s)`);
      await listing.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }

  async function create() {
    setBusy(true);
    try {
      if (createKind === "folder") {
        await apiFetch("/api/files", {
          method: "POST",
          body: { action: "create-folder", root: path, name: createName },
        });
      } else {
        await apiFetch("/api/files", {
          method: "POST",
          body: { action: "create-file", path: `${path}/${createName}`, content: "" },
        });
      }
      toast.success(createKind === "folder" ? "Dossier cree" : "Fichier cree");
      setCreateOpen(false);
      setCreateName("");
      await listing.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function rename() {
    if (!renameTarget) return;
    setBusy(true);
    try {
      await apiFetch("/api/files", {
        method: "POST",
        body: { action: "rename", path: renameTarget.path, newName: renameValue },
      });
      toast.success("Renomme");
      setRenameTarget(null);
      await listing.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await apiFetch("/api/files", {
        method: "POST",
        body: { action: "delete", paths: [deleteTarget.path], confirmation: "SUPPRIMER" },
      });
      toast.success("Element supprime");
      setDeleteTarget(null);
      await listing.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function runSearch() {
    if (search.trim().length < 2) return;
    setSearching(true);
    try {
      const payload = await apiFetch<{ results: typeof searchResults }>(
        `/api/files/search?q=${encodeURIComponent(search)}&mode=${mode}&root=/resources&limit=80`,
      );
      setSearchResults(payload.results ?? []);
    } catch (error) {
      toast.error(errorMessage(error));
      setSearchResults(null);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Gestionnaire de fichiers"
        description="Arborescence du serveur FiveM via l'API Files de Pterodactyl. Toute action est journalisee."
        eyebrow="Developpement"
      >
        {can("files.write") ? (
          <>
            <Button variant="secondary" onClick={() => { setCreateKind("folder"); setCreateOpen(true); }}>
              <FolderPlus className="h-4 w-4" /> Dossier
            </Button>
            <Button variant="secondary" onClick={() => { setCreateKind("file"); setCreateOpen(true); }}>
              <FileCode2 className="h-4 w-4" /> Fichier
            </Button>
          </>
        ) : null}
        {can("files.upload") ? (
          <>
            <input
              ref={uploadRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => void upload(event.target.files)}
            />
            <Button variant="primary" onClick={() => uploadRef.current?.click()} loading={busy}>
              <Upload className="h-4 w-4" /> Televerser
            </Button>
          </>
        ) : null}
      </PageHeader>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input
            className="pl-8"
            placeholder="Rechercher un nom de fichier ou un contenu..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void runSearch();
            }}
          />
        </div>
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value as "name" | "content")}
          className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-fg"
        >
          <option value="name">Par nom</option>
          <option value="content">Dans le contenu (SFTP)</option>
        </select>
        <Button variant="secondary" size="sm" onClick={runSearch} loading={searching}>
          Chercher
        </Button>
        {searchResults ? (
          <Button variant="ghost" size="sm" onClick={() => setSearchResults(null)}>
            Effacer
          </Button>
        ) : null}
      </div>

      {searchResults ? (
        <Card className="mb-4">
          <div className="panel-header">
            <h3 className="text-sm font-semibold">Resultats ({searchResults.length})</h3>
          </div>
          <div className="max-h-72 divide-y divide-border/60 overflow-y-auto">
            {searchResults.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted">Aucun resultat.</p>
            ) : (
              searchResults.map((result) => (
                <div key={result.path} className="flex items-center gap-2 px-4 py-2">
                  <FileCode2 className="h-3.5 w-3.5 shrink-0 text-primary-300" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px]">{result.path}</p>
                    {result.snippet ? (
                      <p className="truncate text-[10px] text-muted">{result.snippet}</p>
                    ) : null}
                  </div>
                  <Link href={`/editor?file=${encodeURIComponent(result.path)}`} className="text-[10px] text-primary-300 hover:underline">
                    Editer
                  </Link>
                </div>
              ))
            )}
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2.5 text-[11px]">
          <button
            onClick={() => setPath("/resources")}
            className="rounded px-1.5 py-0.5 text-muted hover:bg-white/5 hover:text-fg"
          >
            resources
          </button>
          {crumbs.slice(1).map((crumb, index) => {
            const target = `/${crumbs.slice(0, index + 2).join("/")}`;
            return (
              <React.Fragment key={target}>
                <ChevronRight className="h-3 w-3 text-muted/50" />
                <button
                  onClick={() => setPath(target)}
                  className="rounded px-1.5 py-0.5 text-muted hover:bg-white/5 hover:text-fg"
                >
                  {crumb}
                </button>
              </React.Fragment>
            );
          })}
          <div className="ml-auto flex items-center gap-1.5">
            <Badge variant="neutral">{listing.data?.backend ?? "-"}</Badge>
            <Badge variant="neutral">{entries.length} elements</Badge>
            <Button size="icon" variant="ghost" onClick={() => void listing.refresh()} title="Rafraichir">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {listing.loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-8" />)}
          </div>
        ) : listing.error ? (
          <div className="p-4">
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {listing.error}
            </p>
          </div>
        ) : entries.length === 0 ? (
          <EmptyState icon={<Folder className="h-5 w-5" />} title="Dossier vide" description="Creez un fichier ou televersez des elements." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Nom</th>
                  <th className="px-4 py-2 font-medium">Taille</th>
                  <th className="px-4 py-2 font-medium">Modifie</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {path !== "/" ? (
                  <tr className="hover:bg-white/[0.02]">
                    <td colSpan={4} className="px-4 py-2">
                      <button
                        onClick={() => setPath(path.split("/").slice(0, -1).join("/") || "/")}
                        className="flex items-center gap-2 text-muted hover:text-fg"
                      >
                        <ArrowUp className="h-3.5 w-3.5" /> Dossier parent
                      </button>
                    </td>
                  </tr>
                ) : null}
                {entries.map((entry) => (
                  <tr key={entry.path} className="group hover:bg-white/[0.02]">
                    <td className="px-4 py-2">
                      {entry.isFile ? (
                        <Link
                          href={`/editor?file=${encodeURIComponent(entry.path)}`}
                          className={cn("flex items-center gap-2", entry.editable ? "text-fg hover:text-primary-200" : "text-muted")}
                        >
                          <FileCode2 className="h-3.5 w-3.5 text-primary-300" />
                          <span className="truncate">{entry.name}</span>
                        </Link>
                      ) : (
                        <button
                          onClick={() => setPath(entry.path)}
                          className="flex items-center gap-2 text-fg hover:text-primary-200"
                        >
                          <Folder className="h-3.5 w-3.5 text-info" />
                          <span className="truncate">{entry.name}</span>
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted">{entry.isFile ? formatBytes(entry.size) : "-"}</td>
                    <td className="px-4 py-2 text-muted">{formatDateTime(entry.modifiedAt)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                        {entry.isFile && entry.editable ? (
                          <Link
                            href={`/editor?file=${encodeURIComponent(entry.path)}`}
                            className="rounded p-1 text-muted hover:bg-white/5 hover:text-fg"
                            title="Editer"
                          >
                            <Code2 className="h-3.5 w-3.5" />
                          </Link>
                        ) : null}
                        {entry.isFile && can("files.download") ? (
                          <a
                            href={`/api/files/download?path=${encodeURIComponent(entry.path)}`}
                            className="rounded p-1 text-muted hover:bg-white/5 hover:text-fg"
                            title="Telecharger"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        {can("files.write") ? (
                          <>
                            <button
                              onClick={() => { setRenameTarget(entry); setRenameValue(entry.name); }}
                              className="rounded p-1 text-muted hover:bg-white/5 hover:text-fg"
                              title="Renommer"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(entry)}
                              className="rounded p-1 text-muted hover:bg-danger/10 hover:text-danger"
                              title="Supprimer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={createKind === "folder" ? "Nouveau dossier" : "Nouveau fichier"}
        description={`Dans ${path}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button variant="primary" onClick={create} loading={busy} disabled={!createName.trim()}>
              Creer
            </Button>
          </>
        }
      >
        <Field label="Nom">
          <Input
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            placeholder={createKind === "folder" ? "ma-ressource" : "client.lua"}
            className="font-mono text-xs"
            autoFocus
          />
        </Field>
      </Modal>

      <Modal
        open={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        title="Renommer"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>Annuler</Button>
            <Button variant="primary" onClick={rename} loading={busy} disabled={!renameValue.trim()}>
              Renommer
            </Button>
          </>
        }
      >
        <Field label="Nouveau nom">
          <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} className="font-mono text-xs" autoFocus />
        </Field>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        title="Supprimer cet element"
        description={`${deleteTarget?.path ?? ""} sera supprime du serveur. Cette action est irreversible.`}
        confirmLabel="Supprimer definitivement"
        dangerous
        loading={busy}
      />
    </div>
  );
}
