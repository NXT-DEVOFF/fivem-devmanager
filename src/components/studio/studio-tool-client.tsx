"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Info, Play, RotateCcw, ShieldAlert, TerminalSquare } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useRealtime } from "@/components/realtime-provider";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Switch,
  Textarea,
} from "@/components/ui/primitives";
import { StudioResultView } from "@/components/studio/result-view";
import { ToolIcon } from "@/components/studio/tool-icon";
import { defaultFieldValue, defaultStudioInput } from "@/lib/studio/catalog";
import type {
  StudioCategory,
  StudioInput,
  StudioInputValue,
  StudioResult,
  StudioToolSummary,
} from "@/lib/studio/types";

interface RunResponse {
  result: StudioResult;
}

export function StudioToolClient({
  tool,
  category,
}: {
  tool: StudioToolSummary;
  category: StudioCategory;
}) {
  const { can } = useRealtime();
  const canUse = can("studio.use");

  const [values, setValues] = React.useState<StudioInput>(() =>
    defaultStudioInput(tool),
  );
  const [result, setResult] = React.useState<StudioResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setValues(defaultStudioInput(tool));
    setResult(null);
    setError(null);
  }, [tool]);

  function setValue(name: string, value: StudioInputValue) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function reset() {
    setValues(defaultStudioInput(tool));
    setResult(null);
    setError(null);
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch<RunResponse>(`/api/studio/${tool.slug}`, {
        method: "POST",
        body: values,
      });
      setResult(response.result);
      toast.success("Outil execute");
    } catch (caught) {
      const message = errorMessage(caught);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow={category.label}
        title={tool.name}
        description={tool.description}
      >
        <Link href="/studio">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-3.5 w-3.5" /> Catalogue
          </Button>
        </Link>
        <Badge variant={category.accent}>
          <ToolIcon name={tool.icon} className="h-3 w-3" /> {tool.fields.length} champ(s)
        </Badge>
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.4fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Parametres</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              {tool.fields.map((field) => {
                const value = values[field.name] ?? defaultFieldValue(field);
                return (
                  <Field key={field.name} label={field.label} hint={field.hint}>
                    {field.type === "textarea" ? (
                      <Textarea
                        rows={field.rows ?? 5}
                        value={String(value)}
                        onChange={(event) => setValue(field.name, event.target.value)}
                        placeholder={field.placeholder}
                        required={field.required}
                        spellCheck={false}
                        className="mono text-xs"
                      />
                    ) : field.type === "select" ? (
                      <Select
                        value={String(value)}
                        onChange={(event) => setValue(field.name, event.target.value)}
                      >
                        {(field.options ?? []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    ) : field.type === "switch" ? (
                      <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
                        <span className="text-xs text-muted">{value ? "Active" : "Desactive"}</span>
                        <Switch
                          checked={Boolean(value)}
                          onChange={(checked) => setValue(field.name, checked)}
                          label={field.label}
                        />
                      </div>
                    ) : (
                      <Input
                        type={field.type === "number" ? "number" : "text"}
                        value={String(value)}
                        onChange={(event) => setValue(field.name, event.target.value)}
                        placeholder={field.placeholder}
                        required={field.required}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        spellCheck={!field.required}
                        className={!field.required ? "mono text-xs" : undefined}
                      />
                    )}
                  </Field>
                );
              })}

              {error ? (
                <div className="flex gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button variant="primary" loading={busy} onClick={run} disabled={!canUse}>
                  <Play className="h-4 w-4" /> Executer
                </Button>
                <Button variant="ghost" onClick={reset} disabled={busy}>
                  <RotateCcw className="h-3.5 w-3.5" /> Reinitialiser
                </Button>
              </div>
              {!canUse ? (
                <p className="text-[11px] text-warning">
                  Votre role ne permet pas d&apos;executer les outils Studio.
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-2">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                <Info className="h-3.5 w-3.5" /> Bon a savoir
              </p>
              <p className="text-[11px] leading-relaxed text-muted">
                Les fichiers sont generes a partir de vos parametres. Verifiez toujours les
                identifiants, coordonnees et permissions avant de les integrer au serveur.
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                {tool.tags.map((tag) => (
                  <span key={tag} className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">
                    {tag}
                  </span>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        <div>
          {result ? (
            <StudioResultView result={result} />
          ) : (
            <Card className="min-h-[420px]">
              <EmptyState
                icon={<TerminalSquare className="h-5 w-5" />}
                title="Pret a generer"
                description="Renseignez les parametres puis cliquez sur Executer. Le resultat apparaitra ici avec les fichiers, diagnostics et exports ZIP."
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
