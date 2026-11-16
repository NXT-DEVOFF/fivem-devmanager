"use client";

import Link from "next/link";

import * as React from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type { OnMount } from "@monaco-editor/react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileCode2,
  FilePlus2,
  Folder,
  FolderOpen,
  GitCompare,
  History,
  Loader2,
  Save,
  Search,
  TerminalSquare,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, errorMessage, ApiError } from "@/lib/api-client";
import { useRealtime } from "@/components/realtime-provider";
import { Badge, Button, Input, Select, Switch, cn } from "@/components/ui/primitives";
import { formatBytes, relativeTime } from "@/lib/format";
import { languageFromPath } from "@/components/editor/monaco-setup";
import { Modal } from "@/components/ui/modal";
import { FIELD_LABELS } from "@/lib/editor-labels";

interface Entry {
  name: string;
  path: string;
  isFile: boolean;
  size: number;
  modifiedAt: string;
  editable: boolean;
}

interface Tab {
  path: string;
  content: string;
  saved: string;
  hash: string;
  language: string;
  version: number;
  error?: string;
}

interface SearchResult {
  path: string;
  name: string;
  size: number;
  modifiedAt: string;
  snippet?: string;
}

const RECENT_KEY = "fdm:recent-files";

const MonacoEditorPane = dynamic(
  () =>
    import("@/components/editor/monaco-editor-pane").then((module) => ({
      default: module.MonacoEditorPane,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center gap-2 text-xs text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement de l&apos;editeur...
      </div>
    ),
  },
);

export default function EditorPage() {
  const searchParams = useSearchParams();
  const { can, socket } = useRealtime();
  const [tabs, setTabs] = React.useState<Tab[]>([]);
  const [activePath, setActivePath] = React.useState<string | null>(null);
  const [explorerOpen, setExplorerOpen] = React.useState(true);
  const [searchPanel, setSearchPanel] = React.useState(false);
  const [diffMode, setDiffMode] = React.useState(false);
  const [autosave, setAutosave] = React.useState(false);
  const [status, setStatus] = React.useState<string>("");
  const [cursor, setCursor] = React.useState({ line: 1, col: 1 });
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [sessionError, setSessionError] = React.useState(false);
  const [recent, setRecent] = React.useState<string[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchMode, setSearchMode] = React.useState<"name" | "content">("name");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newFile, setNewFile] = React.useState({ directory: "/resources", name: "new_file.lua", content: "" });
  const [saving, setSaving] = React.useState(false);
  const editorRef = React.useRef<Parameters<OnMount>[0] | null>(null);

  const active = tabs.find((tab) => tab.path === activePath) ?? null;
  const dirtyCount = tabs.filter((tab) => tab.content !== tab.saved).length;

  // Session active (le backend exige une session pour ecrire).
  React.useEffect(() => {
    apiFetch<{ session: { id: string; status: string } | null }>("/api/sessions/active")
      .then((payload) => {
        setSessionId(payload.session?.id ?? null);
        setSessionError(false);
      })
      .catch(() => undefined);
  }, []);

  React.useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
      setRecent(stored.slice(0, 8));
    } catch {
      setRecent([]);
    }
  }, []);

  React.useEffect(() => {
    const requested = searchParams.get("file");
    if (requested) void openFile(requested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function remember(path: string) {
    setRecent((current) => {
      const next = [path, ...current.filter((entry) => entry !== path)].slice(0, 8);
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function openFile(path: string) {
    const existing = tabs.find((tab) => tab.path === path);
    if (existing) {
      setActivePath(path);
      setDiffMode(false);
      return;
    }
    setStatus("Ouverture...");
    try {
      const payload = await apiFetch<{
        path: string;
        content: string;
        hash: string;
        version: number;
        lock: { userName: string } | null;
      }>(`/api/files/content?path=${encodeURIComponent(path)}`);
      setTabs((current) => [
        ...current,
        {
          path: payload.path,
          content: payload.content,
          saved: payload.content,
          hash: payload.hash,
          language: languageFromPath(payload.path),
          version: payload.version,
        },
      ]);
      setActivePath(payload.path);
      setDiffMode(false);
      remember(payload.path);
      setStatus("");
      if (payload.lock) {
        toast.warning(`Fichier verrouille par ${payload.lock.userName}`);
      }
    } catch (error) {
      toast.error(errorMessage(error));
      setStatus("");
    }
  }

  function closeTab(path: string) {
    const tab = tabs.find((entry) => entry.path === path);
    if (tab && tab.content !== tab.saved) {
      if (!window.confirm("Ce fichier contient des modifications non sauvegardees. Fermer ?")) return;
    }
    setTabs((current) => current.filter((entry) => entry.path !== path));
    if (activePath === path) {
      const remaining = tabs.filter((entry) => entry.path !== path);
      setActivePath(remaining.at(-1)?.path ?? null);
    }
  }

  async function save(tab?: Tab) {
    const target = tab ?? active;
    if (!target) return;
    if (!sessionId && !sessionError) {
      setSessionError(true);
      toast.error("Demarrez une session de developpement avant de sauvegarder.");
      return;
    }
    setSaving(true);
    setStatus("Sauvegarde...");
    try {
      const payload = await apiFetch<{
        hash: string;
        version: number;
        changeId: string;
        matchedTaskId: string | null;
        sessionId: string | null;
      }>("/api/files/content", {
        method: "PUT",
        body: {
          path: target.path,
          content: target.content,
          baseHash: target.hash,
          sessionId,
        },
      });
      setTabs((current) =>
        current.map((entry) =>
          entry.path === target.path
            ? { ...entry, saved: entry.content, hash: payload.hash, version: payload.version }
            : entry,
        ),
      );
      setStatus(`Sauvegarde ${new Date().toLocaleTimeString("fr-FR")}`);
      toast.success("Fichier sauvegarde", {
        description: payload.matchedTaskId
          ? "Modification associee automatiquement a une tache."
          : "Modification enregistree et detectee.",
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === "concurrent_modification") {
        toast.error("Conflit de modification", {
          description: "Le fichier a change sur le serveur. Rechargez-le avant de sauvegarder.",
          action: {
            label: "Recharger",
            onClick: () => {
              setTabs((current) => current.filter((entry) => entry.path !== target.path));
              void openFile(target.path);
            },
          },
        });
      } else if (error instanceof ApiError && error.code === "session_required") {
        setSessionError(true);
        toast.error("Session requise");
      } else {
        toast.error(errorMessage(error));
      }
      setStatus("Echec de sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  // Autosave configurable (30s).
  React.useEffect(() => {
    if (!autosave) return;
    const interval = setInterval(() => {
      const dirty = tabs.find((tab) => tab.content !== tab.saved);
      if (dirty) void save(dirty);
    }, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosave, tabs, sessionId]);

  // Raccourci Ctrl/Cmd+S.
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setSearchPanel(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, sessionId]);

  // Realtime : verifier les modifications concurrentes.
  React.useEffect(() => {
    if (!socket) return;
    const handler = (event: { detail?: string }) => {
      if (!event.detail) return;
      setTabs((current) =>
        current.map((tab) => {
          if (tab.path !== event.detail || tab.content === tab.saved) return tab;
          return { ...tab, error: "Modifie par un autre utilisateur" };
        }),
      );
    };
    socket.on("activity", (event: { type: string; detail?: string }) => {
      if (event.type === "file.changed") handler(event);
    });
    return () => {
      socket.off("activity");
    };
  }, [socket]);

  async function runSearch() {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      const payload = await apiFetch<{ results: SearchResult[] }>(
        `/api/files/search?q=${encodeURIComponent(searchQuery)}&mode=${searchMode}&root=/resources&limit=60`,
      );
      setResults(payload.results);
    } catch (error) {
      toast.error(errorMessage(error));
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
    editor.onDidChangeCursorPosition((event) => {
      setCursor({ line: event.position.lineNumber, col: event.position.column });
    });
  };

  function updateContent(value: string) {
    if (!activePath) return;
    setTabs((current) =>
      current.map((tab) => (tab.path === activePath ? { ...tab, content: value, error: undefined } : tab)),
    );
  }

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col overflow-hidden rounded-xl border border-border bg-surface/60">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <FileCode2 className="h-4 w-4 text-primary-300" />
        <span className="text-xs font-medium">Editeur</span>
        <Badge variant={sessionId ? "success" : "warning"}>
          {sessionId ? "Session active" : "Aucune session"}
        </Badge>
        {sessionError ? (
          <Link href="/sessions?start=1" className="text-[11px] text-warning underline">
            Demarrer une session
          </Link>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-muted">
            <Switch checked={autosave} onChange={setAutosave} /> Auto-save
          </label>
          <Button size="sm" variant="ghost" onClick={() => setSearchPanel((value) => !value)}>
            <Search className="h-3.5 w-3.5" /> Rechercher
          </Button>
          <Button
            size="sm"
            variant={diffMode ? "primary" : "ghost"}
            onClick={() => setDiffMode((value) => !value)}
            disabled={!active}
          >
            <GitCompare className="h-3.5 w-3.5" /> Comparer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)} disabled={!can("files.write")}>
            <FilePlus2 className="h-3.5 w-3.5" /> Nouveau
          </Button>
          <Button size="sm" variant="primary" onClick={() => save()} loading={saving} disabled={!active}>
            <Save className="h-3.5 w-3.5" /> Sauvegarder
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Explorer */}
        <aside className={cn("flex w-64 shrink-0 flex-col border-r border-border", !explorerOpen && "hidden")}>
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Explorateur</span>
            <button onClick={() => setExplorerOpen(false)} className="text-muted hover:text-fg" aria-label="Fermer l'explorateur">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            <FileTree root="/resources" onOpen={(path) => void openFile(path)} activePath={activePath} />
          </div>
          {recent.length > 0 ? (
            <div className="border-t border-border px-2 py-2">
              <p className="mb-1 px-1 text-[9px] uppercase tracking-wide text-muted">Recents</p>
              {recent.map((path) => (
                <button
                  key={path}
                  onClick={() => void openFile(path)}
                  className="block w-full truncate rounded px-1 py-0.5 text-left text-[10px] text-muted hover:bg-white/5 hover:text-fg"
                  title={path}
                >
                  {path.split("/").pop()}
                </button>
              ))}
            </div>
          ) : null}
        </aside>

        {!explorerOpen ? (
          <button
            onClick={() => setExplorerOpen(true)}
            className="flex w-6 items-center justify-center border-r border-border text-muted hover:text-fg"
            title="Ouvrir l'explorateur"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        ) : null}

        {/* Zone editeur */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-card/40 px-1 py-1">
            {tabs.length === 0 ? (
              <span className="px-2 py-1 text-[11px] text-muted">Aucun fichier ouvert</span>
            ) : (
              tabs.map((tab) => (
                <button
                  key={tab.path}
                  onClick={() => {
                    setActivePath(tab.path);
                    setDiffMode(false);
                  }}
                  className={cn(
                    "group flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px]",
                    activePath === tab.path ? "bg-white/[0.06] text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {tab.content !== tab.saved ? <span className="h-1.5 w-1.5 rounded-full bg-warning" /> : null}
                  <span className="max-w-[160px] truncate">{tab.path.split("/").pop()}</span>
                  <span
                    onClick={(event) => {
                      event.stopPropagation();
                      closeTab(tab.path);
                    }}
                    className="rounded p-0.5 text-muted opacity-0 hover:bg-white/10 hover:text-fg group-hover:opacity-100"
                  >
                    <X className="h-2.5 w-2.5" />
                  </span>
                </button>
              ))
            )}
          </div>

          {searchPanel ? (
            <div className="border-b border-border bg-card/30 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void runSearch();
                  }}
                  placeholder="Rechercher dans les fichiers..."
                  className="h-8 min-w-[200px] flex-1"
                />
                <Select
                  value={searchMode}
                  onChange={(event) => setSearchMode(event.target.value as "name" | "content")}
                  className="h-8 w-auto"
                >
                  <option value="name">Par nom</option>
                  <option value="content">Dans le contenu</option>
                </Select>
                <Button size="sm" variant="secondary" onClick={runSearch} loading={searching}>
                  Chercher
                </Button>
              </div>
              {results.length > 0 ? (
                <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto">
                  {results.map((result) => (
                    <li key={result.path}>
                      <button
                        onClick={() => void openFile(result.path)}
                        className="block w-full truncate rounded px-2 py-1 text-left text-[11px] text-muted hover:bg-white/5 hover:text-fg"
                      >
                        <span className="text-primary-200">{result.path}</span>
                        {result.snippet ? (
                          <span className="ml-2 text-[10px] text-muted/70">{result.snippet}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="min-h-0 flex-1">
            {!active ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <FileCode2 className="h-8 w-8 text-muted/40" />
                <div>
                  <p className="text-xs font-medium">Aucun fichier ouvert</p>
                  <p className="mt-1 text-[11px] text-muted">
                    Ouvrez un fichier depuis l&apos;explorateur, la recherche ou les recents.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setSearchPanel(true)}>
                    <Search className="h-3.5 w-3.5" /> Rechercher
                  </Button>
                  <a href="/files" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-[11px] text-muted hover:text-fg">
                    <Folder className="h-3.5 w-3.5" /> Gestionnaire de fichiers
                  </a>
                </div>
              </div>
            ) : (
              <MonacoEditorPane
                diffMode={diffMode}
                path={active.path}
                language={active.language}
                original={active.saved}
                value={active.content}
                onChange={updateContent}
                onMount={handleMount}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border bg-card/40 px-3 py-1 text-[10px] text-muted">
            <span className="mono truncate">{active?.path ?? "-"}</span>
            {active?.error ? (
              <span className="flex items-center gap-1 text-warning">
                <AlertTriangle className="h-3 w-3" /> {active.error}
              </span>
            ) : null}
            <span className="ml-auto">Ligne {cursor.line}, Col {cursor.col}</span>
            <span>{active?.language ?? "-"}</span>
            <span>{dirtyCount > 0 ? `${dirtyCount} non sauvegarde(s)` : "Synchronise"}</span>
            <span className="flex items-center gap-1">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              {status || "Pret"}
            </span>
            <a href="/console" className="flex items-center gap-1 hover:text-fg">
              <TerminalSquare className="h-3 w-3" /> Console
            </a>
            <a href="/terminal" className="flex items-center gap-1 hover:text-fg">
              <History className="h-3 w-3" /> Terminal
            </a>
          </div>
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nouveau fichier"
        description="Le fichier est cree directement sur le serveur FiveM via Pterodactyl."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  const path = `${newFile.directory.replace(/\/$/, "")}/${newFile.name}`;
                  await apiFetch("/api/files", {
                    method: "POST",
                    body: { action: "create-file", path, content: newFile.content },
                  });
                  toast.success("Fichier cree");
                  setCreateOpen(false);
                  await openFile(path);
                } catch (error) {
                  toast.error(errorMessage(error));
                }
              }}
            >
              Creer
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            value={newFile.directory}
            onChange={(event) => setNewFile({ ...newFile, directory: event.target.value })}
            placeholder="/resources/mon-script"
            className="font-mono text-xs"
          />
          <Input
            value={newFile.name}
            onChange={(event) => setNewFile({ ...newFile, name: event.target.value })}
            placeholder="client.lua"
            className="font-mono text-xs"
          />
          <p className="text-[10px] text-muted">
            Extensions supportees : {FIELD_LABELS.join(", ")}.
          </p>
        </div>
      </Modal>
    </div>
  );
}

function FileTree({
  root,
  onOpen,
  activePath,
  depth = 0,
}: {
  root: string;
  onOpen: (path: string) => void;
  activePath: string | null;
  depth?: number;
}) {
  const [expanded, setExpanded] = React.useState(depth === 0);
  const [entries, setEntries] = React.useState<Entry[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const payload = await apiFetch<{ entries: Entry[] }>(`/api/files?path=${encodeURIComponent(root)}`);
      setEntries(payload.entries);
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, [root]);

  React.useEffect(() => {
    if (expanded && !entries) void load();
  }, [expanded, entries, load]);

  return (
    <div>
      <button
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-1 rounded px-2 py-0.5 text-left text-[11px] text-muted hover:bg-white/5 hover:text-fg"
        style={{ paddingLeft: `${8 + depth * 10}px` }}
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {expanded ? <FolderOpen className="h-3 w-3 text-primary-300" /> : <Folder className="h-3 w-3 text-muted" />}
        <span className="truncate">{root.split("/").pop() || "racine"}</span>
      </button>
      {expanded ? (
        <div>
          {error ? <p className="px-4 py-1 text-[10px] text-danger">{error}</p> : null}
          {entries === null && !error ? (
            <p className="px-4 py-1 text-[10px] text-muted">Chargement...</p>
          ) : null}
          {entries?.map((entry) =>
            entry.isFile ? (
              <button
                key={entry.path}
                onClick={() => entry.editable && onOpen(entry.path)}
                disabled={!entry.editable}
                title={`${entry.path} · ${formatBytes(entry.size)} · ${relativeTime(entry.modifiedAt)}`}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded px-2 py-0.5 text-left text-[11px]",
                  activePath === entry.path
                    ? "bg-primary-500/10 text-primary-200"
                    : "text-muted hover:bg-white/5 hover:text-fg",
                  !entry.editable && "opacity-50",
                )}
                style={{ paddingLeft: `${18 + depth * 10}px` }}
              >
                <FileCode2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{entry.name}</span>
              </button>
            ) : (
              <FileTree
                key={entry.path}
                root={entry.path}
                onOpen={onOpen}
                activePath={activePath}
                depth={depth + 1}
              />
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
