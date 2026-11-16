"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Info,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/use-api";
import { apiFetch, errorMessage } from "@/lib/api-client";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Select,
  Skeleton,
  Stat,
} from "@/components/ui/primitives";
import type {
  FindingSeverity,
  QualitySummary,
  ResourceFinding,
  ResourceQualityReport,
} from "@/lib/resource-quality";

interface QualityPayload {
  canSync: boolean;
  summary: QualitySummary;
  reports: ResourceQualityReport[];
}

type Filter = "all" | "error" | "warning" | "clean";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Toutes les ressources" },
  { id: "error", label: "Avec erreurs" },
  { id: "warning", label: "Avec alertes" },
  { id: "clean", label: "Conformes" },
];

function severityIcon(severity: FindingSeverity) {
  if (severity === "error") return <XCircle className="h-3.5 w-3.5 text-danger" />;
  if (severity === "warning") return <AlertTriangle className="h-3.5 w-3.5 text-warning" />;
  return <Info className="h-3.5 w-3.5 text-muted" />;
}

function scoreVariant(score: number): "success" | "warning" | "danger" {
  if (score >= 85) return "success";
  if (score >= 60) return "warning";
  return "danger";
}

export default function QualityPage() {
  const quality = useApi<QualityPayload>("/api/resources/quality");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [syncing, setSyncing] = React.useState(false);

  const reports = quality.data?.reports ?? [];
  const summary = quality.data?.summary ?? null;
  const missingResources = reports.filter((report) => report.missingDependencies.length > 0);
  const missingNames = Array.from(
    new Set(missingResources.flatMap((report) => report.missingDependencies)),
  ).sort();
  const filtered = reports.filter((report) => {
    if (filter === "clean") {
      return !report.findings.some(
        (finding) => finding.severity === "error" || finding.severity === "warning",
      );
    }
    if (filter === "all") return true;
    return report.findings.some((finding) => finding.severity === filter);
  });

  async function sync() {
    setSyncing(true);
    try {
      const result = await apiFetch<{ scanned: number }>("/api/resources", { method: "POST" });
      toast.success(`${result.scanned} ressource(s) analysee(s)`);
      await quality.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Qualite des ressources"
        description="Audit des fxmanifest synchronises : version, scripts, dependances et coherence des dossiers."
        eyebrow="Developpement"
      >
        <Badge variant={summary ? scoreVariant(summary.averageScore) : "neutral"}>
          <ShieldCheck className="h-3 w-3" />
          {summary ? `Score moyen ${summary.averageScore}/100` : "Analyse..."}
        </Badge>
        {quality.data?.canSync ? (
          <Button variant="primary" size="sm" onClick={() => void sync()} loading={syncing}>
            <RefreshCw className="h-3.5 w-3.5" /> Synchroniser
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => void quality.refresh()} loading={quality.loading}>
          Rafraichir
        </Button>
      </PageHeader>

      {quality.error ? (
        <Card className="p-6 text-sm text-danger">{quality.error}</Card>
      ) : quality.loading && !quality.data ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Boxes className="h-5 w-5" />}
            title="Aucune ressource synchronisee"
            description="Lancez une synchronisation depuis Ressources pour analyser les fxmanifest."
            action={
              quality.data?.canSync ? (
                <Button variant="primary" size="sm" onClick={() => void sync()} loading={syncing}>
                  Synchroniser maintenant
                </Button>
              ) : (
                <Link href="/resources" className="text-xs text-primary-300 underline-offset-4 hover:underline">
                  Ouvrir les ressources
                </Link>
              )
            }
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Ressources analysees"
              value={String(summary?.resources ?? 0)}
              icon={<Boxes className="h-4 w-4" />}
              accent="info"
            />
            <Stat
              label="Conformes"
              value={String(summary?.clean ?? 0)}
              icon={<CheckCircle2 className="h-4 w-4" />}
              accent="success"
            />
            <Stat
              label="Avec erreurs"
              value={String(summary?.errors ?? 0)}
              icon={<XCircle className="h-4 w-4" />}
              accent="danger"
            />
            <Stat
              label="Avec alertes"
              value={String(summary?.warnings ?? 0)}
              icon={<AlertTriangle className="h-4 w-4" />}
              accent="warning"
            />
          </div>

          {missingResources.length > 0 ? (
            <Card className="mb-4">
              <CardHeader>
                <h3 className="text-sm font-semibold">Dependances manquantes</h3>
                <span className="text-[10px] text-muted">
                  {missingNames.length} dependance(s) · {missingResources.length} ressource(s)
                </span>
              </CardHeader>
              <CardBody className="space-y-2">
                {missingResources.map((report) => (
                  <div key={report.folder} className="flex flex-wrap items-center gap-2 text-[11px]">
                    <Link
                      href={`/resources?resource=${encodeURIComponent(report.name)}`}
                      className="min-w-[120px] font-medium text-fg hover:text-primary-200"
                    >
                      {report.name}
                    </Link>
                    <span className="text-muted">→</span>
                    <span className="flex flex-wrap gap-1">
                      {report.missingDependencies.map((dependency) => (
                        <span
                          key={dependency}
                          className="mono rounded border border-danger/30 bg-danger/10 px-1.5 py-0.5 text-[10px] text-danger"
                        >
                          {dependency}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : null}

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Select
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
              className="w-auto"
            >
              {FILTERS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
            <p className="text-[11px] text-muted">
              {filtered.length} affichee(s) · les ressources les moins bien notees d&apos;abord
            </p>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {filtered.map((report) => (
              <ResourceCard key={report.folder} report={report} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ResourceCard({ report }: { report: ResourceQualityReport }) {
  const visibleFindings: ResourceFinding[] = report.findings;
  const conform = visibleFindings.length === 0;

  return (
    <Card>
      <CardBody className="space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">{report.name}</p>
            <p className="truncate font-mono text-[10px] text-muted">{report.folder}</p>
          </div>
          <Badge variant={scoreVariant(report.score)}>{report.score}/100</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
          <Badge variant="neutral">{report.fileCount} fichier(s)</Badge>
          <Badge variant={report.state === "manifest_valide" ? "success" : "danger"}>
            {report.state === "manifest_valide" ? "Manifeste valide" : "Manifeste absent"}
          </Badge>
        </div>

        {conform ? (
          <p className="flex items-center gap-1.5 text-[11px] text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Aucun probleme detecte
          </p>
        ) : (
          <ul className="space-y-1">
            {visibleFindings.map((finding) => (
              <li key={finding.code} className="flex items-start gap-1.5 text-[11px] text-muted">
                <span className="mt-0.5 shrink-0">{severityIcon(finding.severity)}</span>
                <div className="min-w-0">
                  <span>{finding.message}</span>
                  {finding.details?.length ? (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {finding.details.map((detail) => (
                        <span
                          key={detail}
                          className="mono rounded border border-danger/30 bg-danger/10 px-1.5 py-0.5 text-[10px] text-danger"
                        >
                          {detail}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
