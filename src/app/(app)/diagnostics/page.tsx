"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCopy,
  MinusCircle,
  RefreshCw,
  Stethoscope,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/use-api";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  Progress,
  Skeleton,
  Stat,
} from "@/components/ui/primitives";
import {
  diagnosticCounts,
  groupDiagnostics,
  type DiagnosticCheck,
  type DiagnosticStatus,
} from "@/lib/diagnostics";
import { relativeTime } from "@/lib/format";

interface DiagnosticsPayload {
  generatedAt: string;
  score: number;
  overall: DiagnosticStatus;
  counts: Record<DiagnosticStatus, number>;
  checks: DiagnosticCheck[];
}

const STATUS_LABEL: Record<DiagnosticStatus, string> = {
  ok: "OK",
  warn: "A surveiller",
  fail: "Bloquant",
  skip: "Non applicable",
};

function StatusIcon({ status, className }: { status: DiagnosticStatus; className?: string }) {
  const props = { className: className ?? "h-4 w-4" };
  if (status === "ok") return <CheckCircle2 {...props} />;
  if (status === "warn") return <AlertTriangle {...props} />;
  if (status === "fail") return <XCircle {...props} />;
  return <MinusCircle {...props} />;
}

function statusClass(status: DiagnosticStatus): string {
  if (status === "ok") return "text-success";
  if (status === "warn") return "text-warning";
  if (status === "fail") return "text-danger";
  return "text-muted";
}

function badgeVariant(status: DiagnosticStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "ok") return "success";
  if (status === "warn") return "warning";
  if (status === "fail") return "danger";
  return "neutral";
}

export default function DiagnosticsPage() {
  const diagnostics = useApi<DiagnosticsPayload>("/api/diagnostics", { pollMs: 60_000 });
  const checks = diagnostics.data?.checks ?? [];
  const counts = diagnostics.data ? diagnosticCounts(checks) : null;
  const score = diagnostics.data?.score ?? 0;
  const groups = groupDiagnostics(checks);
  const tone = score >= 85 ? "success" : score >= 60 ? "warning" : "danger";

  async function copyReport() {
    if (!diagnostics.data) return;
    const text = [
      `Diagnostic FiveM DevManager — ${new Date(diagnostics.data.generatedAt).toLocaleString("fr-FR")}`,
      `Score : ${diagnostics.data.score}/100`,
      "",
      ...checks.map((check) => `[${STATUS_LABEL[check.status]}] ${check.label} — ${check.detail}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Diagnostic copie dans le presse-papiers");
    } catch {
      toast.error("Copie impossible dans ce navigateur");
    }
  }

  return (
    <div>
      <PageHeader
        title="Diagnostic"
        description="Verification reelle de la base, du panel, de Wings, du SFTP, de l'IA et de l'activite de l'equipe."
        eyebrow="Systeme"
      >
        <Badge variant={badgeVariant(diagnostics.data?.overall ?? "skip")}>
          <Stethoscope className="h-3 w-3" />
          {diagnostics.data ? STATUS_LABEL[diagnostics.data.overall] : "Analyse..."}
        </Badge>
        <Button variant="ghost" size="sm" onClick={() => void diagnostics.refresh()} loading={diagnostics.loading}>
          <RefreshCw className="h-3.5 w-3.5" /> Relancer
        </Button>
        <Button variant="secondary" size="sm" onClick={() => void copyReport()} disabled={!diagnostics.data}>
          <ClipboardCopy className="h-3.5 w-3.5" /> Copier
        </Button>
      </PageHeader>

      {diagnostics.error ? (
        <Card className="p-6 text-sm text-danger">{diagnostics.error}</Card>
      ) : diagnostics.loading && !diagnostics.data ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-56" />
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Score global"
              value={`${score}/100`}
              hint={diagnostics.data ? `Analyse ${relativeTime(diagnostics.data.generatedAt)}` : undefined}
              icon={<Stethoscope className="h-4 w-4" />}
              accent={tone}
            />
            <Stat
              label="Controles OK"
              value={String(counts?.ok ?? 0)}
              hint="Fonctionnement nominal"
              icon={<CheckCircle2 className="h-4 w-4" />}
              accent="success"
            />
            <Stat
              label="Alertes"
              value={String(counts?.warn ?? 0)}
              hint="A corriger sans urgence"
              icon={<AlertTriangle className="h-4 w-4" />}
              accent="warning"
            />
            <Stat
              label="Bloquants"
              value={String(counts?.fail ?? 0)}
              hint="Empechent le fonctionnement"
              icon={<XCircle className="h-4 w-4" />}
              accent="danger"
            />
          </div>

          <Card className="mb-4">
            <CardBody className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>Sante globale</span>
                <span className="font-mono">{score} %</span>
              </div>
              <Progress value={score} />
              <p className="text-[10.5px] text-muted/70">
                Les controles non applicables (integration optionnelle absente) ne font pas baisser le score.
              </p>
            </CardBody>
          </Card>

          <div className="space-y-4">
            {groups.map((group) => (
              <Card key={group.id}>
                <CardHeader>
                  <h3 className="text-sm font-semibold">{group.label}</h3>
                  <span className="text-[10px] text-muted">{group.checks.length} controle(s)</span>
                </CardHeader>
                <CardBody className="divide-y divide-border p-0">
                  {group.checks.map((check) => (
                    <div key={check.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                      <StatusIcon status={check.status} className={`mt-0.5 h-4 w-4 shrink-0 ${statusClass(check.status)}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[12.5px] font-medium">{check.label}</p>
                          <Badge variant={badgeVariant(check.status)}>{STATUS_LABEL[check.status]}</Badge>
                          {check.latencyMs !== undefined ? (
                            <span className="text-[10px] text-muted">{check.latencyMs} ms</span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 break-words text-[11px] text-muted">{check.detail}</p>
                        {check.hint ? <p className="mt-0.5 text-[10.5px] text-muted/70">{check.hint}</p> : null}
                      </div>
                      {check.fixHref ? (
                        <Link
                          href={check.fixHref}
                          className="flex shrink-0 items-center gap-1 text-[10.5px] text-primary-300 hover:text-primary-200"
                        >
                          Corriger <ArrowRight className="h-3 w-3" />
                        </Link>
                      ) : null}
                    </div>
                  ))}
                </CardBody>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
