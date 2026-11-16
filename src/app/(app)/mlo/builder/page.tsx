"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  Building2,
  Check,
  Download,
  Loader2,
  Play,
  Plus,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useRealtime } from "@/components/realtime-provider";
import { MloBuilderInspector } from "@/components/studio/mlo-builder-inspector";
import { MloScene3D } from "@/components/studio/mlo-scene-3d";
import { StudioResultView } from "@/components/studio/result-view";
import { Modal } from "@/components/ui/modal";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/components/ui/primitives";
import { apiFetch, errorMessage } from "@/lib/api-client";
import {
  MLO_BUILDER_STORAGE_KEY,
  createSceneId,
  defaultSceneProject,
  moveSceneObject,
  normalizeSceneProject,
  sceneBounds,
  sceneStats,
  sceneToMloConfig,
  sceneToStudioInput,
  validateSceneProject,
  type MloSceneProject,
  type SceneSelection,
} from "@/lib/studio/scene";
import type { StudioResult } from "@/lib/studio/types";

interface RunResponse {
  result: StudioResult;
}

type SaveState = "saved" | "saving" | "error";

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function MloBuilderPage() {
  const { can } = useRealtime();
  const canGenerate = can("studio.use");
  const [project, setProject] = React.useState<MloSceneProject>(defaultSceneProject);
  const [selected, setSelected] = React.useState<SceneSelection | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [saveState, setSaveState] = React.useState<SaveState>("saved");
  const [generating, setGenerating] = React.useState(false);
  const [result, setResult] = React.useState<StudioResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MLO_BUILDER_STORAGE_KEY);
      if (raw) setProject(normalizeSceneProject(JSON.parse(raw)));
    } catch {
      toast.error("La sauvegarde locale du builder est illisible.");
    } finally {
      setLoaded(true);
    }
  }, []);

  React.useEffect(() => {
    if (!loaded) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          MLO_BUILDER_STORAGE_KEY,
          JSON.stringify(sceneToMloConfig(project)),
        );
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [loaded, project]);

  const stats = sceneStats(project);
  const issues = validateSceneProject(project);
  const errors = issues.filter((issue) => issue.level === "error");

  function addObject(kind: "room" | "entity" | "portal" | "anchor") {
    if (kind === "anchor") {
      if (project.anchor) {
        setSelected({ kind: "anchor", id: project.anchor.id });
        return;
      }
      const anchor = {
        id: createSceneId("anchor"),
        x: project.coords.x,
        y: project.coords.y,
        z: project.coords.z,
      };
      setProject((current) => ({ ...current, anchor }));
      setSelected({ kind: "anchor", id: anchor.id });
      return;
    }

    const bounds = sceneBounds(project);
    const centerX = round((bounds.minX + bounds.maxX) / 2);
    const centerY = round((bounds.minY + bounds.maxY) / 2);

    if (kind === "room") {
      const width = Math.max(4, Math.min(12, (bounds.maxX - bounds.minX) / 3 || 6));
      const depth = Math.max(3, Math.min(10, (bounds.maxY - bounds.minY) / 3 || 5));
      const room = {
        id: createSceneId("room"),
        name: `piece_${project.rooms.length + 1}`,
        minX: round(centerX - width / 2),
        minY: round(centerY - depth / 2),
        minZ: 0,
        maxX: round(centerX + width / 2),
        maxY: round(centerY + depth / 2),
        maxZ: 3,
      };
      setProject((current) => ({ ...current, rooms: [...current.rooms, room] }));
      setSelected({ kind: "room", id: room.id });
      return;
    }

    if (kind === "entity") {
      const entity = {
        id: createSceneId("entity"),
        model: "prop_bench_01a",
        x: centerX,
        y: centerY,
        z: 0,
        heading: 0,
      };
      setProject((current) => ({ ...current, entities: [...current.entities, entity] }));
      setSelected({ kind: "entity", id: entity.id });
      return;
    }

    const fromRoom = project.rooms[0]?.name ?? "room_a";
    const toRoom = project.rooms[1]?.name ?? fromRoom;
    const portal = {
      id: createSceneId("portal"),
      name: `portail_${project.portals.length + 1}`,
      fromRoom,
      toRoom,
      x: centerX,
      y: centerY,
      z: 0,
      width: 2,
      height: 2.2,
      direction: 0,
    };
    setProject((current) => ({ ...current, portals: [...current.portals, portal] }));
    setSelected({ kind: "portal", id: portal.id });
  }

  function deleteObject(selection: SceneSelection) {
    const labels: Record<SceneSelection["kind"], string> = {
      room: "cette piece et les portails qui la referencent",
      entity: "cette entite",
      portal: "ce portail",
      anchor: "cet ancrage",
    };
    if (!window.confirm(`Supprimer ${labels[selection.kind]} ?`)) return;
    setProject((current) => {
      if (selection.kind === "room") {
        const room = current.rooms.find((candidate) => candidate.id === selection.id);
        const name = room?.name;
        return {
          ...current,
          rooms: current.rooms.filter((candidate) => candidate.id !== selection.id),
          portals: name
            ? current.portals.filter(
                (portal) => portal.fromRoom !== name && portal.toRoom !== name,
              )
            : current.portals,
        };
      }
      if (selection.kind === "entity") {
        return {
          ...current,
          entities: current.entities.filter((entity) => entity.id !== selection.id),
        };
      }
      if (selection.kind === "portal") {
        return {
          ...current,
          portals: current.portals.filter((portal) => portal.id !== selection.id),
        };
      }
      return current.anchor?.id === selection.id ? { ...current, anchor: null } : current;
    });
    setSelected(null);
  }

  function duplicateObject(selection: SceneSelection) {
    if (selection.kind === "room") {
      const room = project.rooms.find((candidate) => candidate.id === selection.id);
      if (!room) return;
      const copy = {
        ...room,
        id: createSceneId("room"),
        name: `${room.name}_copie`,
        minX: room.minX + 2,
        maxX: room.maxX + 2,
        minY: room.minY + 2,
        maxY: room.maxY + 2,
      };
      setProject((current) => ({ ...current, rooms: [...current.rooms, copy] }));
      setSelected({ kind: "room", id: copy.id });
      return;
    }
    if (selection.kind === "entity") {
      const entity = project.entities.find((candidate) => candidate.id === selection.id);
      if (!entity) return;
      const copy = {
        ...entity,
        id: createSceneId("entity"),
        x: round(entity.x + 2),
        y: round(entity.y + 2),
      };
      setProject((current) => ({ ...current, entities: [...current.entities, copy] }));
      setSelected({ kind: "entity", id: copy.id });
      return;
    }
    if (selection.kind === "portal") {
      const portal = project.portals.find((candidate) => candidate.id === selection.id);
      if (!portal) return;
      const copy = {
        ...portal,
        id: createSceneId("portal"),
        name: `${portal.name}_copie`,
        x: round(portal.x + 2),
        y: round(portal.y + 2),
      };
      setProject((current) => ({ ...current, portals: [...current.portals, copy] }));
      setSelected({ kind: "portal", id: copy.id });
      return;
    }
    if (project.anchor) {
      const copy = {
        ...project.anchor,
        id: createSceneId("anchor"),
        x: round(project.anchor.x + 2),
        y: round(project.anchor.y + 2),
      };
      setProject((current) => ({ ...current, anchor: copy }));
      setSelected({ kind: "anchor", id: copy.id });
    }
  }

  function moveObject(selection: SceneSelection, x: number, y: number) {
    setProject((current) =>
      moveSceneObject(current, selection, round(x, 3), round(y, 3)),
    );
  }

  async function generate() {
    if (!canGenerate) {
      toast.error("Permission studio.use requise.");
      return;
    }
    if (errors.length > 0) {
      setError(errors[0]!.message);
      toast.error(errors[0]!.message);
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const response = await apiFetch<RunResponse>("/api/studio/mlo-scaffold", {
        method: "POST",
        body: sceneToStudioInput(project),
      });
      setResult(response.result);
      toast.success("Ressource MLO generee");
    } catch (caught) {
      const message = errorMessage(caught);
      setError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  }

  function exportJson() {
    downloadJson(
      sceneToMloConfig(project),
      `${project.resourceName || "mlo"}.config.json`,
    );
    toast.success("mlo.config.json telecharge");
  }

  async function importFile(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const record =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
      if (
        !Array.isArray(record.rooms) &&
        !Array.isArray(record.portals) &&
        !Array.isArray(record.entities)
      ) {
        throw new Error("Ce fichier ne contient pas de listes rooms/portals/entities.");
      }
      const next = normalizeSceneProject(parsed);
      setProject(next);
      setSelected(null);
      setResult(null);
      setError(null);
      toast.success("Projet MLO importe");
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  function resetProject() {
    if (!window.confirm("Remplacer le projet actuel par le projet de demonstration ?")) return;
    setProject(defaultSceneProject());
    setSelected(null);
    setResult(null);
    setError(null);
    toast.success("Nouveau projet MLO");
  }

  return (
    <div>
      <PageHeader
        eyebrow="FiveM Studio · MLO"
        title="Builder MLO 3D"
        description="Construisez le blockout de votre interieur en trois dimensions : volumes, portails, entites et coordonnees exactes. Exportez ensuite une ressource CodeWalker-ready."
      >
        <Badge variant="info">
          <Box className="h-3 w-3" /> Scene 3D
        </Badge>
        <Link href="/mlo">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-3.5 w-3.5" /> Constructeur simple
          </Button>
        </Link>
        <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> Importer
        </Button>
        <Button variant="secondary" size="sm" onClick={exportJson}>
          <Download className="h-3.5 w-3.5" /> mlo.config.json
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={generate}
          loading={generating}
          disabled={!canGenerate}
        >
          <Play className="h-3.5 w-3.5" /> Generer la ressource
        </Button>
      </PageHeader>

      <div className="mb-4 rounded-xl border border-info/25 bg-info/[0.05] px-4 py-3">
        <div className="flex gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-info" />
          <p className="text-[11.5px] leading-relaxed text-muted">
            <span className="font-medium text-fg">Blockout MLO, pas un editeur d&apos;assets GTA.</span>{" "}
            Les volumes et coordonnees sont reels et exportables. Les meshes, materiaux et
            collisions finales se creent dans Blender/CodeWalker puis s&apos;exportent en
            <code className="mono text-info"> .ymap </code> et{" "}
            <code className="mono text-info">manifest.ymf</code>. Le telechargement JSON permet de
            reprendre le projet plus tard.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-danger/30 bg-danger/[0.06] px-4 py-3">
          <div className="flex gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <p className="text-[11.5px] text-danger">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs text-muted hover:text-fg"
          >
            Fermer
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,0.85fr)]">
        <div className="min-w-0 space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary-500/25 bg-primary-500/10 text-primary-300">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle>{project.mloName || "Nouveau MLO"}</CardTitle>
                  <p className="text-[10px] text-muted">
                    {project.resourceName || "ressource"} · {stats.rooms} piece(s) ·{" "}
                    {stats.portals} portail(s)
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button variant="secondary" size="sm" onClick={() => addObject("room")}>
                  <Plus className="h-3.5 w-3.5" /> Piece
                </Button>
                <Button variant="secondary" size="sm" onClick={() => addObject("entity")}>
                  <Plus className="h-3.5 w-3.5" /> Entite
                </Button>
                <Button variant="secondary" size="sm" onClick={() => addObject("portal")}>
                  <Plus className="h-3.5 w-3.5" /> Portail
                </Button>
                <Button variant="secondary" size="sm" onClick={() => addObject("anchor")}>
                  <Plus className="h-3.5 w-3.5" /> Ancrage
                </Button>
              </div>
            </CardHeader>
            <div className="h-[560px] sm:h-[640px]">
              <MloScene3D
                project={project}
                selected={selected}
                onSelect={setSelected}
                onMove={moveObject}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border px-3 py-2.5 text-[10px] text-muted">
              <span>
                <span className="text-fg">{stats.rooms}</span> pieces ·{" "}
                <span className="text-fg">{stats.entities}</span> entites ·{" "}
                <span className="text-fg">{stats.portals}</span> portails
              </span>
              <span className="ml-auto flex items-center gap-1.5">
                {saveState === "saved" ? (
                  <>
                    <Check className="h-3 w-3 text-success" /> Sauvegarde locale
                  </>
                ) : saveState === "saving" ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Sauvegarde...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3 text-warning" /> Stockage local indisponible
                  </>
                )}
              </span>
            </div>
          </Card>

          <Card>
            <CardBody className="space-y-2 text-[10.5px] leading-relaxed text-muted">
              <p className="flex items-center gap-2 text-[11px] font-medium text-fg">
                <Check className="h-3.5 w-3.5 text-success" /> Workflow de production
              </p>
              <p>
                <span className="text-fg">1.</span> Placez les volumes et portails avec des
                coordonnees exactes. <span className="text-fg">2.</span> Generez la ressource pour
                obtenir les sources JSON/XML et le scaffold.{" "}
                <span className="text-fg">3.</span> Ouvrez les sources dans CodeWalker pour la
                geometrie, les collisions et les LODs, puis exportez le binaire.
              </p>
              {issues.length > 0 ? (
                <p className="text-warning">
                  {issues.length} point(s) a verifier avant export. Les erreurs bloquent la
                  generation ; les avertissements restent exportables.
                </p>
              ) : (
                <p className="text-muted/80">Aucun probleme de structure detecte.</p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0">
          <MloBuilderInspector
            project={project}
            selected={selected}
            canGenerate={canGenerate}
            generating={generating}
            onSelect={(selection) => setSelected(selection)}
            onChangeProject={(updater) => setProject(updater)}
            onAdd={addObject}
            onDelete={deleteObject}
            onDuplicate={duplicateObject}
            onGenerate={generate}
            onImport={() => fileInputRef.current?.click()}
            onExportJson={exportJson}
            onReset={resetProject}
          />
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importFile(file);
          event.target.value = "";
        }}
      />

      <Modal
        open={result !== null}
        onClose={() => setResult(null)}
        title="Ressource MLO generee"
        description="Fichiers sources et scaffold prets a telecharger."
        size="xl"
      >
        {result ? <StudioResultView result={result} /> : null}
      </Modal>
    </div>
  );
}
