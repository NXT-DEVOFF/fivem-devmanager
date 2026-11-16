"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Boxes, Building2, Layers, Map as MapIcon, Play, RotateCcw, Wrench } from "lucide-react";
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
import { parseEntities, parsePortals, parseRooms } from "@/lib/studio/mlo";
import type { StudioResult } from "@/lib/studio/types";

interface RunResponse {
  result: StudioResult;
}

interface MloForm {
  resourceName: string;
  mloName: string;
  author: string;
  description: string;
  coords: string;
  interiorId: string;
  iplName: string;
  roomsCsv: string;
  portalsCsv: string;
  entitiesCsv: string;
  includeClient: boolean;
  includeProxies: boolean;
  includeReadme: boolean;
}

const DEFAULT_ROOMS = `salon,0,0,0,10,8,3
cuisine,10,0,0,18,8,3
chambre,0,8,0,10,16,3`;

const DEFAULT_PORTALS = `porte_salon_cuisine,salon,cuisine,9.8,4,0,2,2.2,0
porte_salon_chambre,salon,chambre,4,7.8,0,2,2.2,90`;

const DEFAULT_ENTITIES = `prop_table_01a,-2,4,1,0
prop_bench_01a,13,4,1,90
v_ilev_mp_bed_low,4,12,1,180`;

const DEFAULT_FORM: MloForm = {
  resourceName: "chicago_mlo_villa",
  mloName: "Villa Chicago",
  author: "ChicagoRP",
  description: "MLO genere avec FiveM DevManager",
  coords: "0, 0, 0",
  interiorId: "0",
  iplName: "chicago_mlo_villa",
  roomsCsv: DEFAULT_ROOMS,
  portalsCsv: DEFAULT_PORTALS,
  entitiesCsv: DEFAULT_ENTITIES,
  includeClient: true,
  includeProxies: false,
  includeReadme: true,
};

export default function MloPage() {
  const { can } = useRealtime();
  const canUse = can("studio.use");
  const [form, setForm] = React.useState<MloForm>(DEFAULT_FORM);
  const [result, setResult] = React.useState<StudioResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const rooms = React.useMemo(() => parseRooms(form.roomsCsv), [form.roomsCsv]);
  const portals = React.useMemo(() => parsePortals(form.portalsCsv), [form.portalsCsv]);
  const entities = React.useMemo(() => parseEntities(form.entitiesCsv), [form.entitiesCsv]);

  function update<K extends keyof MloForm>(key: K, value: MloForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function reset() {
    setForm(DEFAULT_FORM);
    setResult(null);
    setError(null);
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch<RunResponse>("/api/studio/mlo-scaffold", {
        method: "POST",
        body: form,
      });
      setResult(response.result);
      toast.success("Scaffold MLO genere");
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
        eyebrow="Constructeur MLO"
        title="Creer un MLO sans partir de zero"
        description="Definissez les pieces, portails et entites. Le generateur produit une ressource CodeWalker-ready avec sources ymap, manifeste, config et export ZIP."
      >
        <Link href="/studio">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-3.5 w-3.5" /> Studio
          </Button>
        </Link>
        <Link href="/mlo/builder">
          <Button variant="primary" size="sm">
            <Boxes className="h-3.5 w-3.5" /> Builder 3D
          </Button>
        </Link>
        <Link href="/mappings">
          <Button variant="secondary" size="sm">
            <MapIcon className="h-3.5 w-3.5" /> Carte des mappings
          </Button>
        </Link>
        <Link href="/studio/mlo-scaffold">
          <Button variant="secondary" size="sm">Version detaillee</Button>
        </Link>
        <Badge variant="info">
          <Layers className="h-3 w-3" /> {rooms.length} piece(s)
        </Badge>
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[minmax(340px,0.95fr)_minmax(0,1.3fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary-300" /> Identite du projet
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Ressource" hint="Minuscules, underscores.">
                  <Input value={form.resourceName} onChange={(event) => update("resourceName", event.target.value)} spellCheck={false} />
                </Field>
                <Field label="Nom du MLO">
                  <Input value={form.mloName} onChange={(event) => update("mloName", event.target.value)} />
                </Field>
                <Field label="Auteur">
                  <Input value={form.author} onChange={(event) => update("author", event.target.value)} />
                </Field>
                <Field label="Interior ID">
                  <Input value={form.interiorId} onChange={(event) => update("interiorId", event.target.value)} />
                </Field>
                <Field label="Coordonnees" hint="x, y, z">
                  <Input value={form.coords} onChange={(event) => update("coords", event.target.value)} className="mono text-xs" />
                </Field>
                <Field label="Nom IPL">
                  <Input value={form.iplName} onChange={(event) => update("iplName", event.target.value)} spellCheck={false} />
                </Field>
              </div>
              <Field label="Description">
                <Input value={form.description} onChange={(event) => update("description", event.target.value)} />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary-300" /> Volumes MLO
              </CardTitle>
              <Badge variant="neutral">{portals.length} portail(s)</Badge>
            </CardHeader>
            <CardBody className="space-y-3">
              <Field
                label="Pieces"
                hint="name,minX,minY,minZ,maxX,maxY,maxZ — une piece par ligne."
              >
                <Textarea
                  rows={6}
                  value={form.roomsCsv}
                  onChange={(event) => update("roomsCsv", event.target.value)}
                  className="mono text-[11px]"
                  spellCheck={false}
                />
              </Field>
              <Field
                label="Portails"
                hint="name,fromRoom,toRoom,x,y,z,width,height,direction"
              >
                <Textarea
                  rows={5}
                  value={form.portalsCsv}
                  onChange={(event) => update("portalsCsv", event.target.value)}
                  className="mono text-[11px]"
                  spellCheck={false}
                />
              </Field>
              <Field
                label="Entites"
                hint="model,x,y,z,heading — une entite par ligne."
              >
                <Textarea
                  rows={5}
                  value={form.entitiesCsv}
                  onChange={(event) => update("entitiesCsv", event.target.value)}
                  className="mono text-[11px]"
                  spellCheck={false}
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Options d&apos;export</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <ToggleRow
                label="client.lua de test"
                hint="Teleportation et chargement IPL."
                checked={form.includeClient}
                onChange={(value) => update("includeClient", value)}
              />
              <ToggleRow
                label="Modele interiorproxies.meta"
                hint="A remplacer par l'export CodeWalker."
                checked={form.includeProxies}
                onChange={(value) => update("includeProxies", value)}
              />
              <ToggleRow
                label="README de production"
                hint="Etapes d'export et avertissements."
                checked={form.includeReadme}
                onChange={(value) => update("includeReadme", value)}
              />
              {error ? (
                <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
              ) : null}
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                <Button variant="primary" loading={busy} onClick={run} disabled={!canUse || !form.resourceName.trim()}>
                  <Play className="h-4 w-4" /> Generer le MLO
                </Button>
                <Button variant="ghost" onClick={reset} disabled={busy}>
                  <RotateCcw className="h-3.5 w-3.5" /> Reinitialiser
                </Button>
              </div>
              {!canUse ? <p className="text-[11px] text-warning">Permission studio.use requise.</p> : null}
            </CardBody>
          </Card>
        </div>

        <div>
          {result ? (
            <StudioResultView result={result} />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniStat label="Pieces" value={String(rooms.length)} />
                <MiniStat label="Portails" value={String(portals.length)} />
                <MiniStat label="Entites" value={String(entities.length)} />
              </div>
              <Card className="min-h-[320px]">
                <EmptyState
                  icon={<Building2 className="h-5 w-5" />}
                  title="Votre MLO apparaitra ici"
                  description="Le generateur cree un scaffold CodeWalker avec sources .ymap.xml, rooms/portals/entities JSON, fxmanifest, mlo.config.json et README. Exportez ensuite le binaire manifest.ymf avec CodeWalker."
                />
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Guide de production</CardTitle>
                </CardHeader>
                <CardBody className="space-y-2 text-xs text-muted">
                  <p><span className="text-fg">1.</span> Generez le scaffold et telechargez le ZIP.</p>
                  <p><span className="text-fg">2.</span> Ouvrez les sources dans CodeWalker et creez le MLO.</p>
                  <p><span className="text-fg">3.</span> Exportez .ymap et .ymf, puis testez en jeu avec /mlo.</p>
                  <p className="text-warning">Ne diffusez jamais le dossier source ni un .ymap.xml tel quel.</p>
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2">
      <div>
        <p className="text-xs font-medium text-fg">{label}</p>
        <p className="text-[10px] text-muted">{hint}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-fg">{value}</p>
    </Card>
  );
}
