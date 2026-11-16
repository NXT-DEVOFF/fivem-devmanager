"use client";

import * as React from "react";
import { Check, MessagesSquare, Plus, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/use-api";
import { apiFetch, errorMessage } from "@/lib/api-client";
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
  Switch,
} from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { WEBHOOK_KIND } from "@/lib/labels";
import { formatDateTime, relativeTime } from "@/lib/format";

interface WebhookRow {
  id: string;
  name: string;
  kind: string;
  enabled: boolean;
  username: string | null;
  lastUsedAt: string | null;
  lastError: string | null;
  createdAt: string;
  deliveryCount: number;
  lastDelivery: { status: string; createdAt: string; error: string | null } | null;
}

export default function DiscordPage() {
  const webhooks = useApi<{ webhooks: WebhookRow[] }>("/api/discord/webhooks");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<WebhookRow | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<WebhookRow | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ name: "", kind: "PATCH_NOTES", url: "", username: "" });

  const rows = webhooks.data?.webhooks ?? [];

  async function create() {
    setBusy("create");
    try {
      await apiFetch("/api/discord/webhooks", {
        method: "POST",
        body: {
          name: form.name,
          kind: form.kind,
          url: form.url,
          username: form.username || undefined,
        },
      });
      toast.success("Webhook enregistre et chiffre");
      setCreateOpen(false);
      setForm({ name: "", kind: "PATCH_NOTES", url: "", username: "" });
      await webhooks.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function toggle(webhook: WebhookRow, enabled: boolean) {
    setBusy(webhook.id);
    try {
      await apiFetch(`/api/discord/webhooks/${webhook.id}`, { method: "PATCH", body: { enabled } });
      await webhooks.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function test(webhook: WebhookRow) {
    setBusy(webhook.id + "test");
    try {
      await apiFetch(`/api/discord/webhooks/${webhook.id}/test`, { method: "POST" });
      toast.success("Message de test envoye");
      await webhooks.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy("delete");
    try {
      await apiFetch(`/api/discord/webhooks/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Webhook supprime");
      setDeleteTarget(null);
      await webhooks.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Integration Discord"
        description="Webhooks chiffres cote backend. Les URL ne sont jamais exposees au navigateur."
        eyebrow="Communication"
      >
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Ajouter un webhook
        </Button>
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Webhooks</p>
          <p className="mt-1 text-xl font-semibold">{rows.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Actifs</p>
          <p className="mt-1 text-xl font-semibold text-success">{rows.filter((row) => row.enabled).length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Envois</p>
          <p className="mt-1 text-xl font-semibold">{rows.reduce((sum, row) => sum + row.deliveryCount, 0)}</p>
        </Card>
      </div>

      {webhooks.loading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<MessagesSquare className="h-5 w-5" />}
            title="Aucun webhook"
            description="Ajoutez un webhook Discord pour publier les patch notes, rapports et notifications."
            action={<Button size="sm" variant="primary" onClick={() => setCreateOpen(true)}>Ajouter</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((webhook) => (
            <Card key={webhook.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-medium">{webhook.name}</h3>
                    <Badge variant="neutral">{WEBHOOK_KIND[webhook.kind] ?? webhook.kind}</Badge>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted">
                    Cree {relativeTime(webhook.createdAt)} · {webhook.deliveryCount} envoi(s)
                  </p>
                </div>
                <Switch checked={webhook.enabled} onChange={(value) => void toggle(webhook, value)} disabled={busy === webhook.id} />
              </div>

              {webhook.lastError ? (
                <p className="mt-2 rounded border border-danger/20 bg-danger/[0.06] px-2 py-1 text-[10px] text-danger">
                  {webhook.lastError}
                </p>
              ) : webhook.lastDelivery ? (
                <p className="mt-2 flex items-center gap-1 text-[10px] text-muted">
                  {webhook.lastDelivery.status === "SENT" ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <X className="h-3 w-3 text-danger" />
                  )}
                  Dernier envoi {formatDateTime(webhook.lastDelivery.createdAt)}
                </p>
              ) : (
                <p className="mt-2 text-[10px] text-muted">Aucun envoi.</p>
              )}

              <div className="mt-3 flex items-center gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => void test(webhook)} loading={busy === webhook.id + "test"}>
                  <Send className="h-3 w-3" /> Test
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditTarget(webhook);
                    setForm({ name: webhook.name, kind: webhook.kind, url: "", username: webhook.username ?? "" });
                  }}
                >
                  Modifier
                </Button>
                <Button size="icon" variant="ghost" className="ml-auto text-muted hover:text-danger" onClick={() => setDeleteTarget(webhook)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ajouter un webhook Discord"
        description="L'URL est chiffree (AES-256-GCM) avant stockage. Seul le backend peut la dechiffrer."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button variant="primary" loading={busy === "create"} onClick={create} disabled={!form.name || !form.url}>
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Nom">
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Patch notes serveur" />
          </Field>
          <Field label="Type">
            <Select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
              {Object.entries(WEBHOOK_KIND).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="URL du webhook" hint="https://discord.com/api/webhooks/<id>/<token>">
            <Input type="password" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} className="font-mono text-[11px]" />
          </Field>
          <Field label="Nom affiche (optionnel)">
            <Input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="FiveM DevManager" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={`Modifier ${editTarget?.name ?? ""}`}
        description="Laisser le champ URL vide pour conserver l'URL existante."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditTarget(null)}>Annuler</Button>
            <Button
              variant="primary"
              loading={busy === "edit"}
              onClick={async () => {
                if (!editTarget) return;
                setBusy("edit");
                try {
                  await apiFetch(`/api/discord/webhooks/${editTarget.id}`, {
                    method: "PATCH",
                    body: {
                      ...(form.url ? { url: form.url } : {}),
                      ...(form.name ? { name: form.name } : {}),
                      ...(form.username ? { username: form.username } : {}),
                    },
                  });
                  toast.success("Webhook mis a jour");
                  setEditTarget(null);
                  setForm({ name: "", kind: "PATCH_NOTES", url: "", username: "" });
                  await webhooks.refresh();
                } catch (error) {
                  toast.error(errorMessage(error));
                } finally {
                  setBusy(null);
                }
              }}
            >
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="URL (optionnel)">
            <Input type="password" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} className="font-mono text-[11px]" />
          </Field>
          <Field label="Nom affiche">
            <Input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer le webhook"
        description={`${deleteTarget?.name ?? ""} ne recevra plus de messages. L'historique d'envoi est supprime.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="danger" onClick={remove} loading={busy === "delete"}>Supprimer</Button>
          </>
        }
      >
        <p className="text-xs text-muted">Cette action est irreversible.</p>
      </Modal>
    </div>
  );
}
