"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, FileClock, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRealtime } from "@/components/realtime-provider";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Skeleton,
  Stat,
} from "@/components/ui/primitives";
import { formatBytes, relativeTime } from "@/lib/format";

type SyncState = "synced" | "stale" | "deleted";

interface SyncFile {
  id: string;
  path: string;
  resource: string | null;
  size: number;
  version: number;
  lastCheckedAt: string;
  remoteModifiedAt: string | null;
  state: SyncState;
}

interface SyncPayload {
  configured: boolean;
  intervalSeconds: number;
  summary: {
    tracked: number;
    checked: number;
    stale: number;
    deleted: number;
    lastCheckedAt: string | null;
  };
  files: SyncFile[];
  changes: Array<{
    id: string;
    path: string;
    changeType: string;
    createdAt: string;
    taskCode: string | null;
  }>;
}

const STATE_META: Record<SyncState, { label: string; variant: "success" | "warning" | "danger" }> = {
  synced: { label: "A jour", variant: "success" },
  stale: { label: "A verifier", variant: "warning" },
  deleted: { label: "Supprime", variant: "danger" },
};

const CHANGE_LABEL: Record<string, string> = {
  FILE_CREATED: "Fichier cree",
  FILE_MODIFIED: "Fichier modifie",
  FILE_DELETED: "Fichier supprime",
  FILE_RENAMED: "Fichier renomme",
};

export default function SyncPage() {
  const { can } = useRealtime();
  const sync = useApi<SyncPayload>("/api/sync", { pollMs: 30_000 });
  const [busy, setBusy] = React.useState(false);

  const data = sync.data;
  const summary = data?.summary;

  async function runSync() {
    setBusy(true);
    try {
      const result = await apiFetch<{ detected: number }>("/api/sync", { method: "POST" });
      toast.success(
        result.detected > 0
          ? `${result.detected} modification(s) distante(s) detectee(s).`
          : "Aucune nouvelle modification detectee.",
      );
      await sync.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Synchronisation"
        description="Compare les fichiers suivis avec le serveur FiveM : fraicheur, taille, version et suppressions distantes."
        eyebrow="Developpement"
      >
        <Badge variant={data?.configured ? "success" : "warning"}>
          {data?.configured ? "Pterodactyl connecte" : "Non configure"}
        </Badge>
        {can("sync.manage") ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => void runSync()}
            loading={busy}
            disabled={!data?.configured}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Synchroniser maintenant
          </Button>
        ) : null}
      </PageHeader>

      {sync.error ? (
        <Card className="mb-4 p-4 text-xs text-danger">{sync.error}</Card>
      ) : null}

      {data && !data.configured ? (
        <Card className="mb-4 p-4 text-xs text-warning">
          Pterodactyl n&apos;est pas configure : la synchronisation automatique ne peut pas comparer
          les fichiers distants.{" "}
          <Link href="/infrastructure" className="underline hover:text-fg">
            Configurer l&apos;infrastructure
          </Link>
          .
        </Card>
      ) : null}

      {sync.loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Fichiers suivis"
              value={summary?.tracked ?? 0}
              hint="Journalisation des modifications"
              icon={<FileClock className="h-4 w-4" />}
            />
            <Stat
              label="A jour"
              value={summary?.checked ?? 0}
              hint={`Verifies dans les ${Math.round((data?.intervalSeconds ?? 180) / 60)} dernieres minutes`}
              icon={<CheckCircle2 className="h-4 w-4" />}
              accent="success"
            />
            <Stat
              label="A verifier"
              value={summary?.stale ?? 0}
              hint="Dernier controle ancien"
              icon={<Clock3 className="h-4 w-4" />}
              accent={summary && summary.stale > 0 ? "warning" : "success"}
            />
            <Stat
              label="Supprimes"
              value={summary?.deleted ?? 0}
              hint={summary?.lastCheckedAt ? `Dernier controle ${relativeTime(summary.lastCheckedAt)}` : "Aucun controle"}
              icon={<Trash2 className="h-4 w-4" />}
              accent={summary && summary.deleted > 0 ? "danger" : "primary"}
            />
          </div>

          <Card>
            <CardHeader>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <FileClock className="h-4 w-4 text-primary-300" /> Fichiers suivis
              </h3>
              <span className="text-[10px] text-muted">
                Synchronisation automatique toutes les {Math.round((data?.intervalSeconds ?? 180) / 60)} min
              </span>
            </CardHeader>
            <CardBody>
              {data?.files.length === 0 ? (
                <EmptyState
                  icon={<FileClock className="h-5 w-5" />}
                  title="Aucun fichier suivi"
                  description="Les fichiers lus ou modifies depuis l'editeur sont ajoutes ici automatiquement."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border text-[10px] uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">Fichier</th>
                        <th className="px-3 py-2 font-medium">Ressource</th>
                        <th className="px-3 py-2 font-medium">Taille</th>
                        <th className="px-3 py-2 font-medium">Version</th>
                        <th className="px-3 py-2 font-medium">Dernier controle</th>
                        <th className="px-3 py-2 font-medium">Etat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {data?.files.map((file) => {
                        const meta = STATE_META[file.state];
                        return (
                          <tr key={file.id} className="hover:bg-white/[0.02]">
                            <td className="max-w-[420px] px-3 py-2.5">
                              <p className="mono truncate text-fg" title={file.path}>
                                {file.path}
                              </p>
                              {file.remoteModifiedAt ? (
                                <p className="text-[10px] text-muted">
                                  distant {relativeTime(file.remoteModifiedAt)}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-3 py-2.5 text-muted">{file.resource ?? "-"}</td>
                            <td className="px-3 py-2.5 text-muted">
                              {file.state === "deleted" ? "-" : formatBytes(file.size)}
                            </td>
                            <td className="px-3 py-2.5 text-muted">v{file.version}</td>
                            <td className="px-3 py-2.5 text-muted">{relativeTime(file.lastCheckedAt)}</td>
                            <td className="px-3 py-2.5">
                              <Badge variant={meta.variant}>{meta.label}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-warning" /> Dernieres modifications detectees
              </h3>
            </CardHeader>
            <CardBody>
              {data?.changes.length === 0 ? (
                <p className="text-xs text-muted">Aucune modification distante detectee.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {data?.changes.map((change) => (
                    <li key={change.id} className="flex flex-wrap items-center gap-2 py-2 text-xs">
                      <span className="text-muted">{CHANGE_LABEL[change.changeType] ?? change.changeType}</span>
                      <span className="mono min-w-0 flex-1 truncate text-fg">{change.path}</span>
                      {change.taskCode ? <Badge variant="primary">{change.taskCode}</Badge> : null}
                      <span className="text-[10px] text-muted">{relativeTime(change.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </>
      )}

      <p className="mt-3 text-[11px] text-muted">
        Les suppressions distantes sont journalisees une seule fois. Les fichiers recreees sont
        detectes au passage suivant. Le bouton manuel est reserve aux responsables et administrateurs.
      </p>
    </div>
  );
}
