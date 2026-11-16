"use client";

import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileArchive,
  Info,
  TerminalSquare,
} from "lucide-react";
import { zipSync, strToU8 } from "fflate";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  cn,
} from "@/components/ui/primitives";
import type { StudioDiagnostic, StudioResult } from "@/lib/studio/types";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function diagnosticStyles(level: StudioDiagnostic["level"]) {
  if (level === "error") return { icon: AlertCircle, className: "border-danger/30 bg-danger/10 text-danger" };
  if (level === "warning") return { icon: AlertTriangle, className: "border-warning/30 bg-warning/10 text-warning" };
  return { icon: Info, className: "border-info/30 bg-info/10 text-info" };
}

export function StudioResultView({ result }: { result: StudioResult }) {
  const [activePath, setActivePath] = React.useState<string | null>(result.files[0]?.path ?? null);
  const [copied, setCopied] = React.useState<string | null>(null);

  React.useEffect(() => {
    setActivePath(result.files[0]?.path ?? null);
  }, [result]);

  const activeFile = result.files.find((item) => item.path === activePath) ?? result.files[0] ?? null;

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Copie impossible dans ce navigateur.");
    }
  }

  function downloadFile(path: string, content: string) {
    downloadBlob(new Blob([content], { type: "text/plain;charset=utf-8" }), path.split("/").pop() ?? "fichier.txt");
  }

  function downloadZip() {
    if (result.files.length === 0) return;
    const archive = zipSync(
      Object.fromEntries(result.files.map((item) => [item.path, strToU8(item.content)])),
    );
    downloadBlob(new Blob([new Uint8Array(archive)], { type: "application/zip" }), "fivem-studio.zip");
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary-500/25 bg-gradient-to-br from-primary-500/[0.08] to-transparent">
        <CardBody className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary-500/30 bg-primary-500/15 text-primary-300">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary-300">Resultat</p>
              <p className="mt-1 text-sm text-fg">{result.summary}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {result.files.length > 0 ? (
              <Button size="sm" variant="primary" onClick={downloadZip}>
                <FileArchive className="h-3.5 w-3.5" /> ZIP
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => copy(JSON.stringify(result, null, 2), "all")}
            >
              {copied === "all" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              JSON
            </Button>
          </div>
        </CardBody>
      </Card>

      {result.stats && result.stats.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {result.stats.map((item) => (
            <Card key={`${item.label}-${item.value}`} className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{item.label}</p>
              <p
                className={cn(
                  "mt-1 text-lg font-semibold",
                  item.tone === "success" && "text-success",
                  item.tone === "warning" && "text-warning",
                  item.tone === "danger" && "text-danger",
                  item.tone === "info" && "text-info",
                )}
              >
                {item.value}
              </p>
            </Card>
          ))}
        </div>
      ) : null}

      {result.diagnostics && result.diagnostics.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TerminalSquare className="h-4 w-4 text-primary-300" /> Diagnostics
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {result.diagnostics.map((diagnostic, index) => {
              const style = diagnosticStyles(diagnostic.level);
              const Icon = style.icon;
              return (
                <div key={`${diagnostic.message}-${index}`} className={cn("flex gap-2 rounded-lg border px-3 py-2 text-xs", style.className)}>
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{diagnostic.message}</span>
                </div>
              );
            })}
          </CardBody>
        </Card>
      ) : null}

      {result.warnings && result.warnings.length > 0 ? (
        <Card>
          <CardBody className="space-y-2">
            {result.warnings.map((warning) => (
              <p key={warning} className="flex gap-2 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {warning}
              </p>
            ))}
          </CardBody>
        </Card>
      ) : null}

      {result.notes && result.notes.length > 0 ? (
        <Card>
          <CardBody className="space-y-2">
            {result.notes.map((note) => (
              <p key={note} className="flex gap-2 text-xs text-muted">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {note}
              </p>
            ))}
          </CardBody>
        </Card>
      ) : null}

      {result.files.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Fichiers generes</CardTitle>
            <Badge variant="primary">{result.files.length} fichier(s)</Badge>
          </CardHeader>
          <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2">
            {result.files.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => setActivePath(item.path)}
                className={cn(
                  "mono shrink-0 rounded-md px-2 py-1 text-[11px] transition-colors",
                  activeFile?.path === item.path
                    ? "bg-primary-500/15 text-primary-200"
                    : "text-muted hover:bg-white/5 hover:text-fg",
                )}
              >
                {item.path}
              </button>
            ))}
          </div>
          {activeFile ? (
            <CardBody className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="mono text-xs text-muted">{activeFile.path}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => copy(activeFile.content, activeFile.path)}>
                    {copied === activeFile.path ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    Copier
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => downloadFile(activeFile.path, activeFile.content)}>
                    <Download className="h-3.5 w-3.5" /> Telecharger
                  </Button>
                </div>
              </div>
              <pre className="mono max-h-[420px] overflow-auto rounded-lg border border-border bg-[#080b12] p-3 text-[11px] leading-relaxed text-fg/90">
                {activeFile.content}
              </pre>
            </CardBody>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
