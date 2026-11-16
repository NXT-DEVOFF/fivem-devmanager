"use client";

import * as React from "react";
import Link from "next/link";
import { Bot, FileText, Sparkles, Wand2 } from "lucide-react";
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
  Field,
  PageHeader,
  Select,
  Skeleton,
} from "@/components/ui/primitives";
import { formatDateTime, formatDuration } from "@/lib/format";

interface AssistantSession {
  id: string;
  number: number;
  developer: string;
  endedAt: string | null;
  activeSeconds: number;
  report: { id: string; aiSummary: boolean } | null;
  patchNote: { id: string; version: string; status: string } | null;
}

interface AssistantPayload {
  aiConfigured: boolean;
  canCreatePatchNotes: boolean;
  sessions: AssistantSession[];
}

interface GeneratedResult {
  kind: "report" | "patchnote";
  text: string;
  link?: string;
}

export default function AssistantPage() {
  const assistant = useApi<AssistantPayload>("/api/assistant");
  const [sessionId, setSessionId] = React.useState("");
  const [busy, setBusy] = React.useState<"report" | "patchnote" | null>(null);
  const [result, setResult] = React.useState<GeneratedResult | null>(null);

  const sessions = React.useMemo(() => assistant.data?.sessions ?? [], [assistant.data]);
  const current = sessions.find((session) => session.id === sessionId) ?? sessions[0];

  React.useEffect(() => {
    if (!sessionId && sessions[0]) setSessionId(sessions[0].id);
  }, [sessionId, sessions]);

  async function generate(kind: "report" | "patchnote") {
    if (!current) return;
    setBusy(kind);
    setResult(null);
    try {
      const payload = await apiFetch<{
        summary?: string | null;
        patchNote?: { id: string; version: string; publicBody?: string; internalBody?: string; status?: string };
        alreadyExists?: boolean;
      }>("/api/assistant", {
        method: "POST",
        body: { action: kind, sessionId: current.id },
      });

      if (kind === "report") {
        setResult({ kind, text: payload.summary ?? "Bilan genere." });
        toast.success("Bilan IA genere");
      } else {
        const note = payload.patchNote;
        setResult({
          kind,
          text: note?.publicBody ?? note?.internalBody ?? "Patch note generee.",
          link: "/patch-notes",
        });
        toast.success(payload.alreadyExists ? `Patch note deja existante (v${note?.version})` : `Patch note v${note?.version} creee`);
      }
      await assistant.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Assistant IA"
        description="Genere un bilan de session ou une patch note complete a partir des modifications reellement enregistrees."
        eyebrow="Pilotage"
      >
        <Badge variant={assistant.data?.aiConfigured ? "success" : "warning"}>
          <Bot className="h-3 w-3" /> {assistant.data?.aiConfigured ? "IA configuree" : "IA non configuree"}
        </Badge>
        <Button variant="ghost" size="sm" onClick={() => void assistant.refresh()}>
          Rafraichir
        </Button>
      </PageHeader>

      {assistant.data && !assistant.data.aiConfigured ? (
        <Card className="mb-4 p-4 text-xs text-warning">
          Aucune cle IA detectee. Renseignez <code className="mono">AI_API_KEY</code> (et
          <code className="mono"> AI_MODEL</code>) dans le panel ou le fichier <code className="mono">.env</code>.
          Les rapports deterministes et les patch notes restent generes sans IA.
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold">Session source</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            {assistant.loading ? (
              <Skeleton className="h-24" />
            ) : sessions.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-5 w-5" />}
                title="Aucune session terminee"
                description="Terminez une session de developpement pour generer un bilan."
              />
            ) : (
              <>
                <Field label="Session" hint="Seules les sessions terminees sont proposees.">
                  <Select value={current?.id ?? ""} onChange={(event) => setSessionId(event.target.value)}>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        #DEV-{String(session.number).padStart(4, "0")} · {session.developer} ·{" "}
                        {session.endedAt ? formatDateTime(session.endedAt) : "-"}
                      </option>
                    ))}
                  </Select>
                </Field>

                {current ? (
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                    <Badge variant="neutral">{formatDuration(current.activeSeconds)} actives</Badge>
                    <Badge variant={current.report ? "info" : "neutral"}>
                      Rapport {current.report ? (current.report.aiSummary ? "IA" : "deterministe") : "absent"}
                    </Badge>
                    <Badge variant={current.patchNote ? "success" : "neutral"}>
                      {current.patchNote ? `Patch note v${current.patchNote.version}` : "Sans patch note"}
                    </Badge>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    variant="primary"
                    onClick={() => void generate("report")}
                    loading={busy === "report"}
                    disabled={!current || !assistant.data?.aiConfigured}
                  >
                    <Wand2 className="h-3.5 w-3.5" /> Generer le bilan IA
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void generate("patchnote")}
                    loading={busy === "patchnote"}
                    disabled={!current || !assistant.data?.canCreatePatchNotes}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Generer la patch note
                  </Button>
                </div>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold">Resultat</h3>
          </CardHeader>
          <CardBody>
            {result ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] text-muted">
                  <Badge variant="primary">{result.kind === "report" ? "Bilan" : "Patch note"}</Badge>
                  {result.link ? (
                    <Link href={result.link} className="underline-offset-4 hover:text-fg hover:underline">
                      Ouvrir les patch notes
                    </Link>
                  ) : null}
                </div>
                <pre className="max-h-[46vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 font-mono text-[10.5px] leading-relaxed text-muted">
                  {result.text}
                </pre>
              </div>
            ) : (
              <p className="py-10 text-center text-xs text-muted">
                Choisissez une session puis lancez une generation. Le resultat s&apos;affiche ici.
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
