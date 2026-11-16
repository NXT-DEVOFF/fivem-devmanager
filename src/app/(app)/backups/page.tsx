"use client";

import * as React from "react";
import {
  Archive,
  Download,
  HardDriveDownload,
  Lock,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
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
import { formatBytes, formatDateTime, relativeTime } from "@/lib/format";

interface BackupRow {
  uuid: string;
  name: string;
  bytes: number;
  created_at: string;
  completed_at: string | null;
  is_successful: boolean;
  is_locked: boolean;
  checksum: string | null;
}

export default function BackupsPage() {
  const { can } = useRealtime();
  const backups = useApi<{ backups: BackupRow[] }>("/api/backups", { pollMs: 20_000 });
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  const rows = React.useMemo(
    () =>
      [...(backups.data?.backups ?? [])].sort((a, b) =>
        a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
      ),
    [backups.data],
  );

  async function create() {
    setBusy("create");
    try {
      await apiFetch("/api/backups", {
        method: "POST",
        body: name.trim() ? { name: name.trim() } : {},
      });
      toast.success("Sauvegarde lancee. Le panel indique sa progression.");
      setName("");
      await backups.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function download(row: BackupRow) {
    setBusy(row.uuid + "download");
    try {
      const payload = await apiFetch<{ url: string }>(`/api/backups/${row.uuid}`);
      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function restore(row: BackupRow) {
    if (
      !window.confirm(
        `Restaurer « ${row.name} » ? Tous les fichiers actuels du serveur seront remplaces par ceux de la sauvegarde.`,
      )
    ) {
      return;
    }
    setBusy(row.uuid + "restore");
    try {
      await apiFetch(`/api/backups/${row.uuid}`, { method: "POST", body: { action: "restore" } });
      toast.success("Restauration lancee par le panel.");
      await backups.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function remove(row: BackupRow) {
    if (!window.confirm(`Supprimer definitivement la sauvegarde « ${row.name} » ?`)) return;
    setBusy(row.uuid + "delete");
    try {
      await apiFetch(`/api/backups/${row.uuid}`, { method: "DELETE" });
      toast.success("Sauvegarde supprimee");
      await backups.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  const totalBytes = rows.reduce((sum, row) => sum + (row.bytes || 0), 0);

  return (
    <div>
      <PageHeader
        title="Sauvegardes"
        description="Archives completes du serveur gerees par Pterodactyl. La creation et la restauration se font cote panel, jamais dans le navigateur."
        eyebrow="Systeme"
      >
        <Button size="icon" variant="ghost" onClick={() => void backups.refresh()} title="Rafraichir">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </PageHeader>

      {backups.error ? (
        <Card className="mb-4 p-4 text-xs text-danger">
          {backups.error}{" "}
          <Link href="/infrastructure" className="underline">
            Configurer Pterodactyl
          </Link>
        </Card>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Sauvegardes</p>
          <p className="mt-1 text-xl font-semibold">{rows.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Espace occupe</p>
          <p className="mt-1 text-xl font-semibold">{formatBytes(totalBytes)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Derniere</p>
          <p className="mt-1 text-sm font-medium">
            {rows[0] ? relativeTime(rows[0].created_at) : "Aucune"}
          </p>
        </Card>
      </div>

      {can("backups.manage") ? (
        <Card className="mb-4 flex flex-wrap items-end gap-2 p-4">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              Nom de la sauvegarde
            </label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void create();
              }}
              placeholder="Avant mise a jour garage"
              maxLength={120}
              className="h-9"
            />
          </div>
          <Button variant="primary" loading={busy === "create"} onClick={() => void create()}>
            <HardDriveDownload className="h-4 w-4" /> Creer une sauvegarde
          </Button>
        </Card>
      ) : null}

      <Card>
        {backups.loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-16" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Archive className="h-5 w-5" />}
            title="Aucune sauvegarde"
            description="Creez une archive avant une mise a jour sensible : elle pourra etre restauree en un clic depuis cette page."
          />
        ) : (
          <div className="divide-y divide-border/60">
            {rows.map((row) => (
              <div
                key={row.uuid}
                className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-elevated text-muted">
                  <Archive className="h-4 w-4" />
                </div>

                <div className="min-w-[180px] flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {row.name || "Sans nom"}
                    {row.is_locked ? (
                      <Lock className="h-3 w-3 text-muted" aria-label="Verrouillee" />
                    ) : null}
                  </p>
                  <p className="text-[11px] text-muted">
                    {formatDateTime(row.created_at)} · {formatBytes(row.bytes)}
                    {row.checksum ? ` · sha256 ${row.checksum.slice(0, 10)}…` : ""}
                  </p>
                </div>

                <Badge
                  variant={
                    row.is_successful ? "success" : row.completed_at ? "danger" : "warning"
                  }
                >
                  {row.is_successful ? "Terminee" : row.completed_at ? "Echec" : "En cours"}
                </Badge>

                {can("backups.manage") ? (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busy === row.uuid + "download"}
                      onClick={() => void download(row)}
                      title="Telecharger l'archive"
                    >
                      <Download className="h-3.5 w-3.5" /> Telecharger
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!row.is_successful}
                      loading={busy === row.uuid + "restore"}
                      onClick={() => void restore(row)}
                      title="Restaurer cette sauvegarde"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restaurer
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={row.is_locked}
                      loading={busy === row.uuid + "delete"}
                      onClick={() => void remove(row)}
                      title={row.is_locked ? "Sauvegarde verrouillee" : "Supprimer"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="mt-3 text-[11px] text-muted">
        Chaque operation est journalisee dans le journal d&apos;audit. La restauration remplace
        l&apos;integralite des fichiers du serveur : elle est reservee au role Administrateur.
      </p>
    </div>
  );
}
