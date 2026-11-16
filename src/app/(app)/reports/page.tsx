"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, FileText, Timer } from "lucide-react";
import { useApi } from "@/lib/use-api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Select,
  Skeleton,
} from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { formatDateTime, formatDuration, relativeTime } from "@/lib/format";

interface ReportRow {
  id: string;
  number: number;
  developer: { displayName: string; avatarColor: string };
  sessionId: string;
  sessionNumber: number;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  activeSeconds: number;
  createdAt: string;
  summary: string | null;
}

export default function ReportsPage() {
  const searchParams = useSearchParams();
  const [scope, setScope] = React.useState<"own" | "all">("own");
  const [selected, setSelected] = React.useState<ReportRow | null>(null);
  const reports = useApi<{ reports: ReportRow[]; scope: string }>(`/api/reports?scope=${scope}&limit=100`);

  const rows = reports.data?.reports ?? [];
  const totalActive = rows.reduce((sum, report) => sum + report.activeSeconds, 0);

  React.useEffect(() => {
    const highlight = searchParams.get("highlight");
    if (!highlight || !reports.data) return;
    const match = reports.data.reports.find((report) => report.id === highlight);
    if (match) setSelected(match);
  }, [searchParams, reports.data]);

  return (
    <div>
      <PageHeader
        title="Rapports de session"
        description="Generes automatiquement en fin de session a partir des evenements, fichiers, taches et bugs enregistres."
        eyebrow="Pilotage"
      >
        <Select value={scope} onChange={(event) => setScope(event.target.value as "own" | "all")} className="w-auto">
          <option value="own">Mes rapports</option>
          <option value="all">Toute l&apos;equipe</option>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => void reports.refresh()}>
          Rafraichir
        </Button>
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Rapports</p>
          <p className="mt-1 text-xl font-semibold">{rows.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Temps actif cumule</p>
          <p className="mt-1 text-xl font-semibold">{formatDuration(totalActive)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Duree moyenne</p>
          <p className="mt-1 text-xl font-semibold">
            {rows.length > 0 ? formatDuration(Math.round(totalActive / rows.length)) : "-"}
          </p>
        </Card>
      </div>

      <Card>
        {reports.loading ? (
          <div className="space-y-2 p-4">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-12" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="Aucun rapport"
            description="Terminez une session pour generer automatiquement son rapport."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Rapport</th>
                  <th className="px-4 py-2 font-medium">Developpeur</th>
                  <th className="px-4 py-2 font-medium">Periode</th>
                  <th className="px-4 py-2 text-right font-medium">Actif</th>
                  <th className="px-4 py-2 font-medium">Genere</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((report) => (
                  <tr key={report.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <button onClick={() => setSelected(report)} className="mono text-[11px] text-primary-300 hover:underline">
                        #DEV-{String(report.number).padStart(4, "0")}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] text-white"
                          style={{ backgroundColor: report.developer.avatarColor }}
                        >
                          {report.developer.displayName.slice(0, 2).toUpperCase()}
                        </span>
                        {report.developer.displayName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDateTime(report.startedAt)}</td>
                    <td className="mono px-4 py-3 text-right">{formatDuration(report.activeSeconds)}</td>
                    <td className="px-4 py-3 text-muted">{relativeTime(report.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/sessions/${report.sessionId}`} className="rounded px-1.5 py-1 text-[10px] text-muted hover:text-fg">
                          Session
                        </Link>
                        <a
                          href={`/api/reports/${report.id}/pdf`}
                          className="rounded p-1 text-muted hover:bg-white/5 hover:text-fg"
                          title="Telecharger le PDF"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
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
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Rapport #DEV-${String(selected.number).padStart(4, "0")}` : "Rapport"}
        size="xl"
        footer={
          selected ? (
            <>
              <Link href={`/sessions/${selected.sessionId}`} className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-xs text-muted hover:text-fg">
                Voir la session
              </Link>
              <a
                href={`/api/reports/${selected.id}/pdf`}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-500 px-4 text-xs font-medium text-white hover:bg-primary-600"
              >
                <Download className="h-3.5 w-3.5" /> Exporter en PDF
              </a>
            </>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <Badge variant="primary">{selected.developer.displayName}</Badge>
              <Badge variant="neutral">
                <Timer className="h-3 w-3" /> {formatDuration(selected.durationSeconds)}
              </Badge>
              <span className="text-muted">{formatDateTime(selected.startedAt)}</span>
            </div>
            <pre className="max-h-[52vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 font-mono text-[10.5px] leading-relaxed text-muted">
              {selected.summary ?? "Rapport indisponible."}
            </pre>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
