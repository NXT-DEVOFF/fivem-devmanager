"use client";

import * as React from "react";
import { CheckCircle2, Clock, Eye, Plus, Send, Sparkles } from "lucide-react";
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
  Select,
  Skeleton,
  Textarea,
} from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { DiscordEmbedPreview, type DiscordEmbedData } from "@/components/discord/embed-preview";
import { PATCH_STATUS } from "@/lib/labels";
import { formatDateTime, relativeTime } from "@/lib/format";

interface PatchNoteRow {
  id: string;
  version: string;
  title: string;
  subtitle: string | null;
  publicBody: string;
  internalBody: string;
  status: string;
  aiGenerated: boolean;
  approvedBy: { displayName: string } | null;
  author: { displayName: string };
  session: { id: string; number: number } | null;
  createdAt: string;
  publishedAt: string | null;
  scheduledAt: string | null;
  deliveries: Array<{ status: string; createdAt: string; error: string | null }>;
}

export default function PatchNotesPage() {
  const { can } = useRealtime();
  const [statusFilter, setStatusFilter] = React.useState("");
  const notes = useApi<{ patchNotes: PatchNoteRow[] }>(
    `/api/patch-notes${statusFilter ? `?status=${statusFilter}` : ""}`,
  );
  const [selected, setSelected] = React.useState<PatchNoteRow | null>(null);
  const [mode, setMode] = React.useState<"edit" | "preview" | "internal">("edit");
  const [draft, setDraft] = React.useState({ title: "", subtitle: "", publicBody: "", internalBody: "", version: "" });
  const [embed, setEmbed] = React.useState<DiscordEmbedData | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [scheduleAt, setScheduleAt] = React.useState("");

  const rows = notes.data?.patchNotes ?? [];

  function open(note: PatchNoteRow) {
    setSelected(note);
    setDraft({
      title: note.title,
      subtitle: note.subtitle ?? "",
      publicBody: note.publicBody,
      internalBody: note.internalBody,
      version: note.version,
    });
    setEmbed(null);
    setMode("edit");
  }

  async function save() {
    if (!selected) return;
    setBusy(true);
    try {
      await apiFetch(`/api/patch-notes/${selected.id}`, { method: "PATCH", body: draft });
      toast.success("Brouillon enregistre");
      await notes.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function preview() {
    if (!selected) return;
    setBusy(true);
    try {
      const payload = await apiFetch<{ embed: DiscordEmbedData }>(`/api/patch-notes/${selected.id}/actions`, {
        method: "POST",
        body: { action: "preview" },
      });
      setEmbed(payload.embed);
      setMode("preview");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function action(kind: "submit" | "approve" | "reject" | "publish" | "schedule") {
    if (!selected) return;
    setBusy(true);
    try {
      if (!["publish", "approve", "reject"].includes(kind)) await save();
      await apiFetch(`/api/patch-notes/${selected.id}/actions`, {
        method: "POST",
        body:
          kind === "schedule"
            ? { action: "schedule", scheduledAt: new Date(scheduleAt).toISOString() }
            : kind === "reject"
              ? { action: "reject" }
              : { action: kind },
      });
      toast.success(
        kind === "publish"
          ? "Patch notes publiees sur Discord"
          : kind === "approve"
            ? "Patch notes approuvees"
            : kind === "schedule"
              ? "Publication planifiee"
              : "Statut mis a jour",
      );
      setSelected(null);
      await notes.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Patch notes"
        description="Preparees automatiquement a partir des taches et bugs reellement traites. Validation humaine avant publication Discord."
        eyebrow="Communication"
      >
        <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-auto">
          <option value="">Tous les statuts</option>
          {Object.entries(PATCH_STATUS).map(([value, meta]) => (
            <option key={value} value={value}>{meta.label}</option>
          ))}
        </Select>
        {can("patchnotes.create") ? (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Nouvelle note
          </Button>
        ) : null}
      </PageHeader>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {notes.loading ? (
          [0, 1, 2].map((index) => <Skeleton key={index} className="h-40" />)
        ) : rows.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <EmptyState
              icon={<Sparkles className="h-5 w-5" />}
              title="Aucune patch note"
              description="Terminez une session avec des taches ou bugs traites pour generer automatiquement un brouillon."
            />
          </Card>
        ) : (
          rows.map((note) => {
            const status = PATCH_STATUS[note.status] ?? PATCH_STATUS.DRAFT!;
            return (
              <Card key={note.id} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="mono text-[10px] text-muted">v{note.version}</p>
                    <h3 className="mt-0.5 text-sm font-medium text-fg">{note.title}</h3>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <p className="mt-2 line-clamp-3 flex-1 text-[11px] text-muted">
                  {note.subtitle || note.publicBody.replace(/[#-]/g, "").slice(0, 160)}
                </p>
                <div className="mt-3 flex items-center justify-between text-[10px] text-muted">
                  <span>{note.author.displayName} · {relativeTime(note.createdAt)}</span>
                  {note.aiGenerated ? <Badge variant="info">IA</Badge> : null}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => open(note)}>
                    Ouvrir
                  </Button>
                  {note.publishedAt ? (
                    <span className="text-[10px] text-success">Publiee {relativeTime(note.publishedAt)}</span>
                  ) : null}
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `v${selected.version} - ${selected.title}` : ""}
        description="Editez le contenu public et interne, previsualisez l'embed puis publiez."
        size="xl"
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {(["edit", "preview", "internal"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setMode(tab);
                    if (tab === "preview") void preview();
                  }}
                  className={`rounded-md px-2.5 py-1 text-[11px] ${
                    mode === tab ? "bg-primary-500/15 text-primary-200" : "text-muted hover:text-fg"
                  }`}
                >
                  {tab === "edit" ? "Contenu public" : tab === "preview" ? "Apercu Discord" : "Notes internes"}
                </button>
              ))}
              <Badge variant={(PATCH_STATUS[selected.status] ?? PATCH_STATUS.DRAFT!).variant} className="ml-auto">
                {(PATCH_STATUS[selected.status] ?? PATCH_STATUS.DRAFT!).label}
              </Badge>
            </div>

            {mode === "edit" ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Version">
                    <Input value={draft.version} onChange={(event) => setDraft({ ...draft, version: event.target.value })} className="font-mono text-xs" disabled={selected.status === "PUBLISHED"} />
                  </Field>
                  <Field label="Titre" className="sm:col-span-2">
                    <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} disabled={selected.status === "PUBLISHED"} />
                  </Field>
                </div>
                <Field label="Sous-titre">
                  <Input value={draft.subtitle} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} disabled={selected.status === "PUBLISHED"} />
                </Field>
                <Field
                  label="Contenu public"
                  hint="Markdown : '## Titre' puis '- element'. Les chemins et secrets sont nettoyes a la publication."
                >
                  <Textarea
                    rows={12}
                    value={draft.publicBody}
                    onChange={(event) => setDraft({ ...draft, publicBody: event.target.value })}
                    className="font-mono text-[11px]"
                    disabled={selected.status === "PUBLISHED"}
                  />
                </Field>
              </div>
            ) : mode === "internal" ? (
              <div className="space-y-3">
                <p className="rounded border border-warning/20 bg-warning/[0.06] px-3 py-2 text-[11px] text-warning">
                  Ces informations techniques ne sont jamais envoyees aux joueurs.
                </p>
                <Textarea
                  rows={14}
                  value={draft.internalBody}
                  onChange={(event) => setDraft({ ...draft, internalBody: event.target.value })}
                  className="font-mono text-[11px]"
                />
              </div>
            ) : (
              <div>
                {embed ? (
                  <DiscordEmbedPreview embed={embed} />
                ) : (
                  <p className="py-8 text-center text-xs text-muted">Chargement de l&apos;apercu...</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {selected.status !== "PUBLISHED" ? (
                <>
                  <Button size="sm" variant="secondary" onClick={save} loading={busy}>
                    Enregistrer
                  </Button>
                  <Button size="sm" variant="outline" onClick={preview} loading={busy}>
                    <Eye className="h-3.5 w-3.5" /> Apercu
                  </Button>
                  {selected.status === "DRAFT" ? (
                    <Button size="sm" variant="primary" onClick={() => action("submit")} loading={busy}>
                      <Send className="h-3.5 w-3.5" /> Soumettre
                    </Button>
                  ) : null}
                  {["DRAFT", "REVIEW"].includes(selected.status) && can("patchnotes.approve") ? (
                    <Button size="sm" variant="success" onClick={() => action("approve")} loading={busy}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approuver
                    </Button>
                  ) : null}
                  {["APPROVED", "SCHEDULED"].includes(selected.status) && can("patchnotes.publish") ? (
                    <>
                      <Button size="sm" variant="primary" onClick={() => action("publish")} loading={busy}>
                        <Send className="h-3.5 w-3.5" /> Publier sur Discord
                      </Button>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="datetime-local"
                          value={scheduleAt}
                          onChange={(event) => setScheduleAt(event.target.value)}
                          className="h-8 rounded-lg border border-border bg-surface px-2 text-[11px] text-fg"
                        />
                        <Button size="sm" variant="secondary" disabled={!scheduleAt} onClick={() => action("schedule")} loading={busy}>
                          <Clock className="h-3.5 w-3.5" /> Planifier
                        </Button>
                      </div>
                    </>
                  ) : null}
                </>
              ) : (
                <p className="text-[11px] text-success">
                  Publiee le {formatDateTime(selected.publishedAt)}
                  {selected.scheduledAt ? ` (planifiee : ${formatDateTime(selected.scheduledAt)})` : ""}
                </p>
              )}
              <a
                href="/discord"
                className="ml-auto text-[10px] text-muted underline-offset-4 hover:text-fg hover:underline"
              >
                Configurer les webhooks
              </a>
            </div>
          </div>
        ) : null}
      </Modal>

      <CreateNoteDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          setCreateOpen(false);
          await notes.refresh();
        }}
      />
    </div>
  );
}

function CreateNoteDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = React.useState({ title: "", version: "", subtitle: "", publicBody: "## 🆕 Nouveautes\n- ", internalBody: "" });
  const [busy, setBusy] = React.useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouvelle patch note"
      description="La version est generee automatiquement si elle est laissee vide."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={form.title.trim().length < 5 || !form.publicBody.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await apiFetch("/api/patch-notes", {
                  method: "POST",
                  body: {
                    title: form.title,
                    version: form.version || undefined,
                    subtitle: form.subtitle || undefined,
                    publicBody: form.publicBody,
                    internalBody: form.internalBody,
                  },
                });
                toast.success("Patch note creee en brouillon");
                onCreated();
              } catch (error) {
                toast.error(errorMessage(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            Creer
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Version" hint="Laissez vide : la prochaine version est generee automatiquement.">
            <Input value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} placeholder="Auto (ex. 1.4.2)" className="font-mono text-xs" />
          </Field>
          <Field label="Titre" className="sm:col-span-2">
            <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Mise a jour serveur" />
          </Field>
        </div>
        <Field label="Sous-titre">
          <Input value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} />
        </Field>
        <Field label="Contenu public">
          <Textarea rows={8} value={form.publicBody} onChange={(event) => setForm({ ...form, publicBody: event.target.value })} className="font-mono text-[11px]" />
        </Field>
        <Field label="Notes internes">
          <Textarea rows={4} value={form.internalBody} onChange={(event) => setForm({ ...form, internalBody: event.target.value })} className="font-mono text-[11px]" />
        </Field>
      </div>
    </Modal>
  );
}
