"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Car,
  Gauge,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
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
  Switch,
  Textarea,
} from "@/components/ui/primitives";
import { StudioResultView } from "@/components/studio/result-view";
import {
  DEFAULT_HANDLING_XML,
  VEHICLE_PRESET_OPTIONS,
  parseHandlingXml,
} from "@/lib/studio/vehicles";
import type { StudioResult } from "@/lib/studio/types";
import { cn } from "@/lib/cn";

interface RunResponse {
  result: StudioResult;
}

export default function VehiclesPage() {
  const { can } = useRealtime();
  const canUse = can("studio.use");
  const [xml, setXml] = React.useState(DEFAULT_HANDLING_XML);
  const [model, setModel] = React.useState("sultan");
  const [preset, setPreset] = React.useState("custom");
  const [applyPreset, setApplyPreset] = React.useState(false);
  const [make, setMake] = React.useState("Declasse");
  const [vehicleClass, setVehicleClass] = React.useState("VC_SPORT");
  const [seats, setSeats] = React.useState("2");
  const [result, setResult] = React.useState<StudioResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const parsed = React.useMemo(() => parseHandlingXml(xml), [xml]);

  function choosePreset(value: string) {
    setPreset(value);
    setApplyPreset(value !== "custom");
  }

  function reset() {
    setXml(DEFAULT_HANDLING_XML);
    setModel("sultan");
    setPreset("custom");
    setApplyPreset(false);
    setMake("Declasse");
    setVehicleClass("VC_SPORT");
    setSeats("2");
    setResult(null);
    setError(null);
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch<RunResponse>("/api/studio/vehicle-debug", {
        method: "POST",
        body: {
          xml,
          model,
          preset,
          applyPreset,
          make,
          vehicleClass,
          seats,
          command: "veh",
          plate: "DEV 001",
        },
      });
      setResult(response.result);
      toast.success("Analyse terminee");
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
        eyebrow="Debug vehicules"
        title="Analyser et corriger un handling"
        description="Collez un handling.meta, choisissez un preset et obtenez un diagnostic complet, un score, les fichiers corriges et une commande de spawn."
      >
        <Link href="/studio">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-3.5 w-3.5" /> Studio
          </Button>
        </Link>
        <Badge variant={parsed.found ? "success" : "warning"}>
          {parsed.found ? "CHandlingData detecte" : "Aucun handling detecte"}
        </Badge>
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[minmax(340px,0.95fr)_minmax(0,1.3fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Car className="h-4 w-4 text-primary-300" /> Source handling.meta
              </CardTitle>
              <Badge variant="neutral">{xml.split(/\r?\n/).length} lignes</Badge>
            </CardHeader>
            <CardBody className="space-y-3">
              <Textarea
                rows={16}
                value={xml}
                onChange={(event) => setXml(event.target.value)}
                spellCheck={false}
                className="mono text-[11px]"
                placeholder="<CHandlingDataMgr>..."
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setXml(DEFAULT_HANDLING_XML)}
                >
                  <Upload className="h-3.5 w-3.5" /> Exemple Sultan
                </Button>
                <Button size="sm" variant="ghost" onClick={reset}>
                  <RotateCcw className="h-3.5 w-3.5" /> Reinitialiser
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary-300" /> Presets
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {VEHICLE_PRESET_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => choosePreset(option.value)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                      preset === option.value
                        ? "border-primary-500/40 bg-primary-500/10 text-primary-200"
                        : "border-border bg-surface text-muted hover:border-border-strong hover:text-fg",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
                <span className="text-xs text-muted">Appliquer le preset au vehicule</span>
                <Switch checked={applyPreset} onChange={setApplyPreset} label="Appliquer le preset" />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Parametres meta</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Modele">
                  <Input value={model} onChange={(event) => setModel(event.target.value)} />
                </Field>
                <Field label="Marque">
                  <Input value={make} onChange={(event) => setMake(event.target.value)} />
                </Field>
                <Field label="Classe">
                  <Input value={vehicleClass} onChange={(event) => setVehicleClass(event.target.value)} />
                </Field>
                <Field label="Places">
                  <Input type="number" min={1} max={8} value={seats} onChange={(event) => setSeats(event.target.value)} />
                </Field>
              </div>
              {error ? (
                <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
              ) : null}
              <Button variant="primary" loading={busy} onClick={run} disabled={!canUse || !xml.trim()}>
                <Play className="h-4 w-4" /> Analyser le vehicule
              </Button>
              {!canUse ? <p className="text-[11px] text-warning">Permission studio.use requise.</p> : null}
            </CardBody>
          </Card>
        </div>

        <div>
          {result ? (
            <StudioResultView result={result} />
          ) : (
            <div className="space-y-4">
              <Card className="min-h-[300px]">
                <EmptyState
                  icon={<Gauge className="h-5 w-5" />}
                  title="Pret a analyser"
                  description="Le debugger verifie la masse, la force motrice, le freinage, les vitesses, la suspension, le braquage et les flags. Il produit ensuite un score et des fichiers prets a tester."
                />
              </Card>
              <div className="grid gap-3 sm:grid-cols-3">
                <InfoCard title="Detection" text="HandlingName, CHandlingData et valeurs numeriques." />
                <InfoCard title="Diagnostic" text="Erreurs bloquantes, avertissements et valeurs hors plage." />
                <InfoCard title="Export" text="handling.meta, vehicles.meta, spawn.lua et rapport Markdown." />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-300">{title}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{text}</p>
    </Card>
  );
}
