"use client";

import * as React from "react";
import { BookOpen, Pencil, Pin, PinOff, Plus, Search, Trash2 } from "lucide-react";
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
  Switch,
  Textarea,
} from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";
import {
  knowledgeCategories,
  knowledgeExcerpt,
  type KnowledgeArticle,
} from "@/lib/knowledge";

interface EditorForm {
  title: string;
  category: string;
  summary: string;
  tags: string;
  content: string;
  pinned: boolean;
}

const EMPTY_FORM: EditorForm = {
  title: "",
  category: "Général",
  summary: "",
  tags: "",
  content: "",
  pinned: false,
};

export default function KnowledgePage() {
  const { can } = useRealtime();
  const canManage = can("knowledge.manage");
  const list = useApi<{ articles: KnowledgeArticle[] }>("/api/knowledge");

  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<KnowledgeArticle | null>(null);
  const [viewing, setViewing] = React.useState<KnowledgeArticle | null>(null);
  const [form, setForm] = React.useState<EditorForm>(EMPTY_FORM);
  const [busy, setBusy] = React.useState(false);
  const [pinBusy, setPinBusy] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<KnowledgeArticle | null>(null);

  const articles = React.useMemo(() => list.data?.articles ?? [], [list.data]);
  const categories = React.useMemo(() => knowledgeCategories(articles), [articles]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return articles.filter((article) => {
      if (category && article.category !== category) return false;
      if (!needle) return true;
      return (
        article.title.toLowerCase().includes(needle) ||
        article.category.toLowerCase().includes(needle) ||
        (article.summary ?? "").toLowerCase().includes(needle) ||
        article.content.toLowerCase().includes(needle) ||
        article.tags.some((tag) => tag.toLowerCase().includes(needle))
      );
    });
  }, [articles, category, query]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, category: category || "Général" });
    setEditorOpen(true);
  }

  function openEdit(article: KnowledgeArticle) {
    setEditing(article);
    setViewing(null);
    setForm({
      title: article.title,
      category: article.category,
      summary: article.summary ?? "",
      tags: article.tags.join(", "),
      content: article.content,
      pinned: article.pinned,
    });
    setEditorOpen(true);
  }

  async function save() {
    setBusy(true);
    try {
      const payload = {
        title: form.title.trim(),
        category: form.category.trim() || "Général",
        summary: form.summary.trim() || null,
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        content: form.content,
        pinned: form.pinned,
      };

      if (editing) {
        await apiFetch(`/api/knowledge/${editing.id}`, { method: "PATCH", body: payload });
        toast.success("Article mis à jour");
      } else {
        await apiFetch("/api/knowledge", { method: "POST", body: payload });
        toast.success("Article créé");
      }

      setEditorOpen(false);
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
      await apiFetch(`/api/knowledge/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Article supprimé");
      setDeleteTarget(null);
      await list.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function togglePin(article: KnowledgeArticle) {
    setPinBusy(article.id);
    try {
      await apiFetch(`/api/knowledge/${article.id}`, {
        method: "PATCH",
        body: { pinned: !article.pinned },
      });
      await list.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPinBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Équipe"
        title="Base de connaissances"
        description="Centralisez les procédures, les décisions techniques et les guides utiles au serveur. Les articles sont partagés avec l'équipe autorisée."
      >
        {canManage ? (
          <Button variant="primary" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouvel article
          </Button>
        ) : null}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input
            className="pl-8"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher dans les titres, tags et contenus..."
          />
        </div>
        <Select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="w-auto min-w-[170px]"
        >
          <option value="">Toutes les catégories</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <span className="text-xs text-muted">
          {filtered.length} / {articles.length} article(s)
        </span>
      </div>

      {list.loading ? (
        <div className="grid gap-4 xl:grid-cols-2">
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
            icon={<BookOpen className="h-5 w-5" />}
            title={articles.length === 0 ? "Aucun article" : "Aucun résultat"}
            description={
              articles.length === 0
                ? "Documentez une procédure, une commande ou une décision pour éviter de la rechercher à nouveau."
                : "Modifiez la recherche ou la catégorie pour retrouver un article."
            }
            action={
              canManage && articles.length === 0 ? (
                <Button variant="primary" size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Créer le premier article
                </Button>
              ) : null
            }
          />
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {filtered.map((article) => (
          <Card key={article.id} className="flex flex-col">
            <CardBody className="flex flex-1 flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="primary">{article.category}</Badge>
                    {article.pinned ? (
                      <Badge variant="info">
                        <Pin className="h-3 w-3" /> Épinglé
                      </Badge>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewing(article)}
                    className="mt-2 block max-w-full text-left text-sm font-semibold text-fg hover:text-primary-300"
                  >
                    <span className="line-clamp-2">{article.title}</span>
                  </button>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => void togglePin(article)}
                    disabled={pinBusy === article.id}
                    className="rounded p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-fg disabled:opacity-50"
                    title={article.pinned ? "Désépingler" : "Épingler"}
                    aria-label={article.pinned ? "Désépingler" : "Épingler"}
                  >
                    {article.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </button>
                ) : null}
              </div>

              <p className="line-clamp-3 text-xs leading-relaxed text-muted">
                {article.summary?.trim() || knowledgeExcerpt(article.content, 220)}
              </p>

              {article.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {article.tags.map((tag) => (
                    <Badge key={tag} variant="neutral">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
                <span className="text-[10px] text-muted">
                  {article.author.displayName} · maj {formatDate(article.updatedAt)}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setViewing(article)}>
                    <BookOpen className="h-3.5 w-3.5" /> Lire
                  </Button>
                  {canManage ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(article)}>
                        <Pencil className="h-3.5 w-3.5" /> Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(article)}
                        className="text-danger hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.title ?? ""}
        description={
          viewing
            ? `${viewing.category} · ${viewing.author.displayName} · mis à jour le ${formatDate(viewing.updatedAt)}`
            : undefined
        }
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setViewing(null)}>
              Fermer
            </Button>
            {viewing && canManage ? (
              <Button variant="primary" onClick={() => openEdit(viewing)}>
                <Pencil className="h-4 w-4" /> Modifier
              </Button>
            ) : null}
          </>
        }
      >
        {viewing ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="primary">{viewing.category}</Badge>
              {viewing.tags.map((tag) => (
                <Badge key={tag} variant="neutral">
                  {tag}
                </Badge>
              ))}
            </div>
            {viewing.summary ? (
              <p className="border-l-2 border-primary-500/40 pl-3 text-sm leading-relaxed text-muted">
                {viewing.summary}
              </p>
            ) : null}
            <ArticleContent content={viewing.content} />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[10px] text-muted">
              <span>Créé par {viewing.author.displayName}</span>
              <span>
                Dernière modification par {viewing.updatedBy?.displayName ?? viewing.author.displayName}
              </span>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? "Modifier l'article" : "Nouvel article"}
        description="Structurez le contenu avec des titres (#), des listes (-) et des blocs de code."
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={save}
              disabled={form.title.trim().length < 3 || form.content.trim().length === 0}
            >
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <Field label="Titre">
              <Input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ex : Procédure de redémarrage d'une ressource"
                maxLength={160}
              />
            </Field>
            <Field label="Catégorie">
              <Input
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({ ...current, category: event.target.value }))
                }
                placeholder="Général"
                maxLength={80}
                list="knowledge-categories"
              />
              <datalist id="knowledge-categories">
                {categories.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Field>
          </div>

          <Field label="Résumé" hint="Visible dans la liste, sans le contenu complet.">
            <Input
              value={form.summary}
              onChange={(event) =>
                setForm((current) => ({ ...current, summary: event.target.value }))
              }
              placeholder="Un résumé court de ce que couvre cet article..."
              maxLength={2000}
            />
          </Field>

          <Field label="Tags" hint="Séparés par des virgules (max 12).">
            <Input
              value={form.tags}
              onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
              placeholder="procédure, redémarrage, ressource"
            />
          </Field>

          <Field
            label="Contenu"
            hint="Titres avec #, listes avec -, blocs de code avec ```. Le rendu est sécurisé, sans HTML."
          >
            <Textarea
              value={form.content}
              onChange={(event) =>
                setForm((current) => ({ ...current, content: event.target.value }))
              }
              rows={16}
              spellCheck={false}
              className="font-mono text-xs"
              placeholder={"# Titre\n\n## Étapes\n\n- Vérifier la console\n- Redémarrer la ressource\n\n```lua\nprint('ok')\n```"}
            />
          </Field>

          <div className="flex items-center justify-between rounded-lg border border-border bg-surface/60 px-3 py-2">
            <div>
              <p className="text-xs font-medium text-fg">Épingler l&apos;article</p>
              <p className="text-[10px] text-muted">Les articles épinglés apparaissent en premier.</p>
            </div>
            <Switch
              checked={form.pinned}
              onChange={(pinned) => setForm((current) => ({ ...current, pinned }))}
              label="Épingler l'article"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        title="Supprimer cet article ?"
        description={`« ${deleteTarget?.title ?? ""} » sera définitivement supprimé pour toute l'équipe.`}
        confirmLabel="Supprimer"
        dangerous
        loading={busy}
      />
    </div>
  );
}

function ArticleContent({ content }: { content: string }) {
  const blocks = React.useMemo(() => {
    const output: React.ReactNode[] = [];
    const lines = content.split(/\r?\n/);
    let codeLines: string[] | null = null;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";

      if (line.trim().startsWith("```")) {
        if (codeLines === null) {
          codeLines = [];
        } else {
          output.push(
            <pre
              key={`code-${index}`}
              className="overflow-auto rounded-lg border border-border bg-surface p-3 font-mono text-[11px] leading-relaxed text-muted scrollbar-thin"
            >
              <code>{codeLines.join("\n")}</code>
            </pre>,
          );
          codeLines = null;
        }
        continue;
      }

      if (codeLines !== null) {
        codeLines.push(line);
        continue;
      }

      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith("### ")) {
        output.push(
          <h3 key={`h3-${index}`} className="text-sm font-semibold text-fg">
            {trimmed.slice(4)}
          </h3>,
        );
        continue;
      }
      if (trimmed.startsWith("## ")) {
        output.push(
          <h2 key={`h2-${index}`} className="text-base font-semibold text-fg">
            {trimmed.slice(3)}
          </h2>,
        );
        continue;
      }
      if (trimmed.startsWith("# ")) {
        output.push(
          <h2 key={`h1-${index}`} className="text-lg font-semibold text-fg">
            {trimmed.slice(2)}
          </h2>,
        );
        continue;
      }
      if (/^[-*]\s+/.test(trimmed)) {
        output.push(
          <div key={`li-${index}`} className="flex gap-2">
            <span className="mt-[3px] text-primary-300">•</span>
            <span>{trimmed.replace(/^[-*]\s+/, "")}</span>
          </div>,
        );
        continue;
      }

      output.push(
        <p key={`p-${index}`} className="whitespace-pre-wrap">
          {trimmed}
        </p>,
      );
    }

    if (codeLines !== null) {
      output.push(
        <pre
          key="code-last"
          className="overflow-auto rounded-lg border border-border bg-surface p-3 font-mono text-[11px] leading-relaxed text-muted scrollbar-thin"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
    }

    return output;
  }, [content]);

  return <div className="space-y-3 text-[13px] leading-relaxed text-fg/90">{blocks}</div>;
}
