"use client";

import * as React from "react";
import { Braces, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { useRealtime } from "@/components/realtime-provider";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
} from "@/components/ui/primitives";

interface Snippet {
  id: string;
  title: string;
  description: string | null;
  language: string;
  code: string;
  tags: string[];
  author: { id: string; displayName: string; avatarColor: string } | null;
  createdAt: string;
  updatedAt: string;
}

const LANGUAGES = [
  { value: "lua", label: "Lua" },
  { value: "sql", label: "SQL" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "json", label: "JSON" },
  { value: "bash", label: "Bash" },
  { value: "ini", label: "INI / cfg" },
  { value: "text", label: "Autre" },
];

const EMPTY_FORM = { title: "", language: "lua", tags: "", description: "", code: "" };

/** Copie compatible avec les origines HTTP (navigator.clipboard y est absent). */
async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export default function SnippetsPage() {
  const { can } = useRealtime();
  const canManage = can("snippets.manage");
  const list = useApi<{ snippets: Snippet[] }>("/api/snippets");

  const [query, setQuery] = React.useState("");
  const [language, setLanguage] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Snippet | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [busy, setBusy] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Snippet | null>(null);

  const snippets = React.useMemo(() => list.data?.snippets ?? [], [list.data]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return snippets.filter((snippet) => {
      if (language && snippet.language !== language) return false;
      if (!needle) return true;
      return (
        snippet.title.toLowerCase().includes(needle) ||
        (snippet.description ?? "").toLowerCase().includes(needle) ||
        snippet.code.toLowerCase().includes(needle) ||
        snippet.tags.some((tag) => tag.toLowerCase().includes(needle))
      );
    });
  }, [snippets, query, language]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(snippet: Snippet) {
    setEditing(snippet);
    setForm({
      title: snippet.title,
      language: snippet.language,
      tags: snippet.tags.join(", "),
      description: snippet.description ?? "",
      code: snippet.code,
    });
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    try {
      const payload = {
        title: form.title.trim(),
        language: form.language,
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        description: form.description.trim() || undefined,
        code: form.code,
      };
      if (editing) {
        await apiFetch(`/api/snippets/${editing.id}`, { method: "PATCH", body: payload });
        toast.success("Snippet mis a jour");
      } else {
        await apiFetch("/api/snippets", { method: "POST", body: payload });
        toast.success("Snippet cree");
      }
      setOpen(false);
      await list.refresh();
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
      await apiFetch(`/api/snippets/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Snippet supprime");
      setDeleteTarget(null);
      await list.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function copy(snippet: Snippet) {
    const ok = await copyToClipboard(snippet.code);
    if (ok) toast.success("Snippet copie dans le presse-papiers");
    else toast.error("Copie impossible sur ce navigateur");
  }

  return (
    <div>
      <PageHeader
        eyebrow="Developpement"
        title="Snippets"
        description="Bibliotheque de code partagee : extraits reutilisables, commandes et requetes, accessibles a toute l'equipe."
      >
        {canManage ? (
          <Button variant="primary" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouveau snippet
          </Button>
        ) : null}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher par titre, tag ou contenu..."
          className="max-w-sm"
        />
        <Select
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          className="max-w-[180px]"
        >
          <option value="">Tous les langages</option>
          {LANGUAGES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
        <span className="text-xs text-muted">
          {filtered.length} / {snippets.length} snippet(s)
        </span>
      </div>

      {list.loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      ) : null}

      {!list.loading && list.error ? (
        <Card>
          <CardBody>
            <p className="text-sm text-danger">{list.error}</p>
          </CardBody>
        </Card>
      ) : null}

      {!list.loading && !list.error && filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Braces className="h-5 w-5" />}
            title={snippets.length === 0 ? "Aucun snippet" : "Aucun resultat"}
            description={
              snippets.length === 0
                ? "Enregistrez vos extraits de code, commandes ou requetes pour les retrouver et les reutiliser."
                : "Aucun snippet ne correspond a cette recherche."
            }
            action={
              canManage && snippets.length === 0 ? (
                <Button variant="primary" size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Creer le premier snippet
                </Button>
              ) : null
            }
          />
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((snippet) => (
          <Card key={snippet.id} className="flex flex-col">
            <CardBody className="flex flex-1 flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-fg">{snippet.title}</h3>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {snippet.author?.displayName ?? "Inconnu"} ·{" "}
                    {new Date(snippet.updatedAt).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <Badge variant="primary">{snippet.language}</Badge>
              </div>

              {snippet.description ? (
                <p className="text-xs text-muted">{snippet.description}</p>
              ) : null}

              <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-surface p-3 font-mono text-[11px] leading-relaxed text-muted scrollbar-thin">
                {snippet.code.split("\n").slice(0, 14).join("\n")}
              </pre>

              {snippet.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {snippet.tags.map((tag) => (
                    <Badge key={tag} variant="neutral">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                <Button size="sm" variant="secondary" onClick={() => copy(snippet)}>
                  <Copy className="h-3.5 w-3.5" />
                  Copier
                </Button>
                {canManage ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(snippet)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="ml-auto"
                      onClick={() => setDeleteTarget(snippet)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Supprimer
                    </Button>
                  </>
                ) : null}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Modifier le snippet" : "Nouveau snippet"}
        description="Le contenu est stocke en base et partage avec l'equipe autorisee."
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={save}
              disabled={form.title.trim().length < 3 || form.code.trim().length === 0}
            >
              {editing ? "Enregistrer" : "Creer"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <Field label="Titre">
              <Input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ex: Commande de spawn vehicule"
                maxLength={160}
              />
            </Field>
            <Field label="Langage">
              <Select
                value={form.language}
                onChange={(event) =>
                  setForm((current) => ({ ...current, language: event.target.value }))
                }
              >
                {LANGUAGES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Tags" hint="Separes par des virgules (max 12).">
            <Input
              value={form.tags}
              onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
              placeholder="vehicule, commande, admin"
            />
          </Field>

          <Field label="Description">
            <Input
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="A quoi sert cet extrait ?"
              maxLength={2000}
            />
          </Field>

          <Field label="Code">
            <Textarea
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
              rows={14}
              spellCheck={false}
              className="font-mono text-xs"
              placeholder="-- votre code ici"
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        title="Supprimer ce snippet ?"
        description={`« ${deleteTarget?.title ?? ""} » sera definitivement supprime pour toute l'equipe.`}
        confirmLabel="Supprimer"
        dangerous
        loading={busy}
      />
    </div>
  );
}
