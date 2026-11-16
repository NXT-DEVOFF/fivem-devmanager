"use client";

import * as React from "react";
import {
  AlertTriangle,
  Anchor,
  Box,
  Boxes,
  Building2,
  ChevronRight,
  Copy,
  DoorOpen,
  Download,
  MapPin,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
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
  Select,
  Switch,
  cn,
} from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import {
  sceneStats,
  validateSceneProject,
  type MloSceneProject,
  type SceneSelection,
} from "@/lib/studio/scene";

type BuilderTab = "scene" | "selection" | "project";

interface InspectorProps {
  project: MloSceneProject;
  selected: SceneSelection | null;
  canGenerate: boolean;
  generating: boolean;
  onSelect: (selection: SceneSelection) => void;
  onChangeProject: (updater: (project: MloSceneProject) => MloSceneProject) => void;
  onAdd: (kind: "room" | "entity" | "portal" | "anchor") => void;
  onDelete: (selection: SceneSelection) => void;
  onDuplicate: (selection: SceneSelection) => void;
  onGenerate: () => void;
  onImport: () => void;
  onExportJson: () => void;
  onReset: () => void;
}

const KIND_ICON = {
  room: Building2,
  portal: DoorOpen,
  entity: Box,
  anchor: Anchor,
} as const;

export function MloBuilderInspector({
  project,
  selected,
  canGenerate,
  generating,
  onSelect,
  onChangeProject,
  onAdd,
  onDelete,
  onDuplicate,
  onGenerate,
  onImport,
  onExportJson,
  onReset,
}: InspectorProps) {
  const [tab, setTab] = React.useState<BuilderTab>("scene");
  const stats = sceneStats(project);
  const issues = validateSceneProject(project);
  const errors = issues.filter((issue) => issue.level === "error");

  React.useEffect(() => {
    if (selected) setTab("selection");
  }, [selected]);

  const selectedRoom =
    selected?.kind === "room" ? project.rooms.find((room) => room.id === selected.id) ?? null : null;
  const selectedPortal =
    selected?.kind === "portal"
      ? project.portals.find((portal) => portal.id === selected.id) ?? null
      : null;
  const selectedEntity =
    selected?.kind === "entity"
      ? project.entities.find((entity) => entity.id === selected.id) ?? null
      : null;
  const selectedAnchor =
    selected?.kind === "anchor" && project.anchor?.id === selected.id ? project.anchor : null;
  const selectedObject = selectedRoom ?? selectedPortal ?? selectedEntity ?? selectedAnchor;

  function updateRoom(patch: Partial<NonNullable<typeof selectedRoom>>) {
    if (!selectedRoom) return;
    onChangeProject((current) => ({
      ...current,
      rooms: current.rooms.map((room) =>
        room.id === selectedRoom.id ? { ...room, ...patch } : room,
      ),
    }));
  }

  function updatePortal(patch: Partial<NonNullable<typeof selectedPortal>>) {
    if (!selectedPortal) return;
    onChangeProject((current) => ({
      ...current,
      portals: current.portals.map((portal) =>
        portal.id === selectedPortal.id ? { ...portal, ...patch } : portal,
      ),
    }));
  }

  function updateEntity(patch: Partial<NonNullable<typeof selectedEntity>>) {
    if (!selectedEntity) return;
    onChangeProject((current) => ({
      ...current,
      entities: current.entities.map((entity) =>
        entity.id === selectedEntity.id ? { ...entity, ...patch } : entity,
      ),
    }));
  }

  function updateAnchor(patch: Partial<NonNullable<typeof selectedAnchor>>) {
    if (!selectedAnchor) return;
    onChangeProject((current) =>
      current.anchor
        ? { ...current, anchor: { ...current.anchor, ...patch } }
        : current,
    );
  }

  const selectionLabel = selectedRoom?.name ?? selectedPortal?.name ?? selectedEntity?.model ?? "Ancrage";
  const KindIcon = selected ? KIND_ICON[selected.kind] : null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-primary-300" /> Inspecteur
        </CardTitle>
        <div className="flex items-center gap-1.5">
          <Badge variant="neutral">{stats.rooms} piece(s)</Badge>
          <Badge variant="neutral">{stats.entities} entite(s)</Badge>
        </div>
      </CardHeader>

      <Tabs
        value={tab}
        onChange={(value) => setTab(value as BuilderTab)}
        tabs={[
          { id: "scene", label: "Scene", count: stats.rooms + stats.portals + stats.entities },
          { id: "selection", label: "Selection" },
          { id: "project", label: "Projet" },
        ]}
        className="px-3"
      />

      {tab === "scene" ? (
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-1.5">
            <AddButton icon={Building2} label="Piece" onClick={() => onAdd("room")} />
            <AddButton icon={Box} label="Entite" onClick={() => onAdd("entity")} />
            <AddButton icon={DoorOpen} label="Portail" onClick={() => onAdd("portal")} />
            <AddButton icon={Anchor} label="Ancrage" onClick={() => onAdd("anchor")} />
          </div>

          <SceneGroup
            title="Pieces"
            count={project.rooms.length}
            onAdd={() => onAdd("room")}
            empty="Aucune piece. Un MLO a besoin d'au moins un volume."
          >
            {project.rooms.map((room) => (
              <SceneRow
                key={room.id}
                kind="room"
                label={room.name}
                detail={`${room.minX}, ${room.minY}, ${room.minZ} → ${room.maxX}, ${room.maxY}, ${room.maxZ}`}
                selected={selected?.kind === "room" && selected.id === room.id}
                onClick={() => onSelect({ kind: "room", id: room.id })}
              />
            ))}
          </SceneGroup>

          <SceneGroup
            title="Entites"
            count={project.entities.length}
            onAdd={() => onAdd("entity")}
            empty="Aucune entite pour le moment."
          >
            {project.entities.map((entity) => (
              <SceneRow
                key={entity.id}
                kind="entity"
                label={entity.model}
                detail={`${entity.x}, ${entity.y}, ${entity.z} · ${entity.heading}°`}
                selected={selected?.kind === "entity" && selected.id === entity.id}
                onClick={() => onSelect({ kind: "entity", id: entity.id })}
              />
            ))}
          </SceneGroup>

          <SceneGroup
            title="Portails"
            count={project.portals.length}
            onAdd={() => onAdd("portal")}
            empty="Ajoutez un portail pour relier deux pieces."
          >
            {project.portals.map((portal) => (
              <SceneRow
                key={portal.id}
                kind="portal"
                label={portal.name}
                detail={`${portal.fromRoom} → ${portal.toRoom}`}
                selected={selected?.kind === "portal" && selected.id === portal.id}
                onClick={() => onSelect({ kind: "portal", id: portal.id })}
              />
            ))}
          </SceneGroup>

          {project.anchor ? (
            <SceneGroup title="Ancrage" count={1} empty="">
              <SceneRow
                kind="anchor"
                label="Point d'ancrage"
                detail={`${project.anchor.x}, ${project.anchor.y}, ${project.anchor.z}`}
                selected={selected?.kind === "anchor" && selected.id === project.anchor?.id}
                onClick={() => onSelect({ kind: "anchor", id: project.anchor!.id })}
              />
            </SceneGroup>
          ) : null}

          <div className="border-t border-border pt-3">
            <Button variant="secondary" size="sm" className="w-full" onClick={() => setTab("project")}>
              <Save className="h-3.5 w-3.5" /> Informations du projet
            </Button>
          </div>
        </CardBody>
      ) : null}

      {tab === "selection" ? (
        <CardBody>
          {!selectedObject ? (
            <EmptyState
              icon={<MapPin className="h-5 w-5" />}
              title="Aucune selection"
              description="Cliquez sur un objet dans la scene 3D ou dans la liste pour modifier ses coordonnees exactes."
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-300">
                    {KindIcon ? <KindIcon className="h-3 w-3" /> : null}
                    {selected?.kind}
                  </p>
                  <p className="mt-1 truncate text-sm font-medium text-fg">{selectionLabel}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => selected && onDuplicate(selected)}
                    className="rounded-md p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-fg"
                    title="Dupliquer"
                    aria-label="Dupliquer"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => selected && onDelete(selected)}
                    className="rounded-md p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    title="Supprimer"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {selectedRoom ? (
                <div className="space-y-3">
                  <Field label="Nom de la piece">
                    <Input value={selectedRoom.name} onChange={(event) => updateRoom({ name: event.target.value })} />
                  </Field>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Volume</p>
                  <div className="grid grid-cols-3 gap-2">
                    <NumberInput label="Min X" value={selectedRoom.minX} onChange={(value) => updateRoom({ minX: value })} />
                    <NumberInput label="Min Y" value={selectedRoom.minY} onChange={(value) => updateRoom({ minY: value })} />
                    <NumberInput label="Min Z" value={selectedRoom.minZ} onChange={(value) => updateRoom({ minZ: value })} />
                    <NumberInput label="Max X" value={selectedRoom.maxX} onChange={(value) => updateRoom({ maxX: value })} />
                    <NumberInput label="Max Y" value={selectedRoom.maxY} onChange={(value) => updateRoom({ maxY: value })} />
                    <NumberInput label="Max Z" value={selectedRoom.maxZ} onChange={(value) => updateRoom({ maxZ: value })} />
                  </div>
                  <p className="rounded-lg border border-border bg-surface px-2.5 py-2 text-[10px] text-muted">
                    Dimensions :{" "}
                    <span className="mono text-fg">
                      {(selectedRoom.maxX - selectedRoom.minX).toFixed(2)} ×{" "}
                      {(selectedRoom.maxY - selectedRoom.minY).toFixed(2)} ×{" "}
                      {(selectedRoom.maxZ - selectedRoom.minZ).toFixed(2)} m
                    </span>
                  </p>
                </div>
              ) : null}

              {selectedEntity ? (
                <div className="space-y-3">
                  <Field label="Modele (archetypeName)">
                    <Input
                      value={selectedEntity.model}
                      onChange={(event) => updateEntity({ model: event.target.value })}
                      spellCheck={false}
                      className="mono text-xs"
                    />
                  </Field>
                  <div className="grid grid-cols-3 gap-2">
                    <NumberInput label="X" value={selectedEntity.x} onChange={(value) => updateEntity({ x: value })} />
                    <NumberInput label="Y" value={selectedEntity.y} onChange={(value) => updateEntity({ y: value })} />
                    <NumberInput label="Z" value={selectedEntity.z} onChange={(value) => updateEntity({ z: value })} />
                  </div>
                  <NumberInput
                    label="Heading (degres)"
                    value={selectedEntity.heading}
                    onChange={(value) => updateEntity({ heading: value })}
                    step={1}
                  />
                </div>
              ) : null}

              {selectedPortal ? (
                <div className="space-y-3">
                  <Field label="Nom du portail">
                    <Input value={selectedPortal.name} onChange={(event) => updatePortal({ name: event.target.value })} />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Piece source">
                      <Select value={selectedPortal.fromRoom} onChange={(event) => updatePortal({ fromRoom: event.target.value })}>
                        {project.rooms.some((room) => room.name === selectedPortal.fromRoom) ? null : (
                          <option value={selectedPortal.fromRoom}>{selectedPortal.fromRoom} (inconnue)</option>
                        )}
                        {project.rooms.map((room) => (
                          <option key={room.id} value={room.name}>{room.name}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Piece cible">
                      <Select value={selectedPortal.toRoom} onChange={(event) => updatePortal({ toRoom: event.target.value })}>
                        {project.rooms.some((room) => room.name === selectedPortal.toRoom) ? null : (
                          <option value={selectedPortal.toRoom}>{selectedPortal.toRoom} (inconnue)</option>
                        )}
                        {project.rooms.map((room) => (
                          <option key={room.id} value={room.name}>{room.name}</option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <NumberInput label="X" value={selectedPortal.x} onChange={(value) => updatePortal({ x: value })} />
                    <NumberInput label="Y" value={selectedPortal.y} onChange={(value) => updatePortal({ y: value })} />
                    <NumberInput label="Z" value={selectedPortal.z} onChange={(value) => updatePortal({ z: value })} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <NumberInput label="Largeur" value={selectedPortal.width} onChange={(value) => updatePortal({ width: Math.max(0.1, value) })} />
                    <NumberInput label="Hauteur" value={selectedPortal.height} onChange={(value) => updatePortal({ height: Math.max(0.1, value) })} />
                    <NumberInput label="Direction" value={selectedPortal.direction} onChange={(value) => updatePortal({ direction: value })} step={1} />
                  </div>
                </div>
              ) : null}

              {selectedAnchor ? (
                <div className="space-y-3">
                  <p className="rounded-lg border border-info/25 bg-info/[0.05] px-2.5 py-2 text-[10px] leading-relaxed text-muted">
                    L&apos;ancrage represente le point de reference du MLO. Il est independant du centre
                    des volumes et peut etre deplace librement.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <NumberInput label="X" value={selectedAnchor.x} onChange={(value) => updateAnchor({ x: value })} />
                    <NumberInput label="Y" value={selectedAnchor.y} onChange={(value) => updateAnchor({ y: value })} />
                    <NumberInput label="Z" value={selectedAnchor.z} onChange={(value) => updateAnchor({ z: value })} />
                  </div>
                </div>
              ) : null}

              <div className="flex gap-2 border-t border-border pt-3">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => selected && onDuplicate(selected)}>
                  <Copy className="h-3.5 w-3.5" /> Dupliquer
                </Button>
                <Button variant="danger" size="sm" onClick={() => selected && onDelete(selected)}>
                  <Trash2 className="h-3.5 w-3.5" /> Supprimer
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      ) : null}

      {tab === "project" ? (
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ressource">
              <Input
                value={project.resourceName}
                onChange={(event) => onChangeProject((current) => ({ ...current, resourceName: event.target.value }))}
                spellCheck={false}
              />
            </Field>
            <Field label="Nom du MLO">
              <Input
                value={project.mloName}
                onChange={(event) => onChangeProject((current) => ({ ...current, mloName: event.target.value }))}
              />
            </Field>
            <Field label="Auteur">
              <Input
                value={project.author}
                onChange={(event) => onChangeProject((current) => ({ ...current, author: event.target.value }))}
              />
            </Field>
            <Field label="Interior ID">
              <Input
                value={project.interiorId}
                onChange={(event) => onChangeProject((current) => ({ ...current, interiorId: event.target.value }))}
              />
            </Field>
            <Field label="Nom IPL">
              <Input
                value={project.iplName}
                onChange={(event) => onChangeProject((current) => ({ ...current, iplName: event.target.value }))}
                spellCheck={false}
              />
            </Field>
            <Field label="Description">
              <Input
                value={project.description}
                onChange={(event) => onChangeProject((current) => ({ ...current, description: event.target.value }))}
              />
            </Field>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">Coordonnees projet</p>
            <div className="grid grid-cols-3 gap-2">
              <NumberInput
                label="X"
                value={project.coords.x}
                onChange={(value) =>
                  onChangeProject((current) => ({ ...current, coords: { ...current.coords, x: value } }))
                }
              />
              <NumberInput
                label="Y"
                value={project.coords.y}
                onChange={(value) =>
                  onChangeProject((current) => ({ ...current, coords: { ...current.coords, y: value } }))
                }
              />
              <NumberInput
                label="Z"
                value={project.coords.z}
                onChange={(value) =>
                  onChangeProject((current) => ({ ...current, coords: { ...current.coords, z: value } }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <ToggleRow
              checked={project.includeClient}
              onChange={(value) => onChangeProject((current) => ({ ...current, includeClient: value }))}
              label="client.lua de test"
              hint="Teleportation et chargement IPL."
            />
            <ToggleRow
              checked={project.includeProxies}
              onChange={(value) => onChangeProject((current) => ({ ...current, includeProxies: value }))}
              label="Modele interiorproxies.meta"
              hint="A remplacer par l'export CodeWalker."
            />
            <ToggleRow
              checked={project.includeReadme}
              onChange={(value) => onChangeProject((current) => ({ ...current, includeReadme: value }))}
              label="README de production"
              hint="Guide d'export et avertissements."
            />
          </div>

          {issues.length > 0 ? (
            <div className="space-y-1.5 rounded-lg border border-warning/25 bg-warning/[0.05] px-2.5 py-2">
              {issues.map((issue) => (
                <p
                  key={`${issue.level}-${issue.message}`}
                  className={cn(
                    "flex gap-1.5 text-[10px]",
                    issue.level === "error" ? "text-danger" : "text-warning",
                  )}
                >
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  {issue.message}
                </p>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
            <Button variant="secondary" size="sm" onClick={onImport}>
              <Upload className="h-3.5 w-3.5" /> Importer
            </Button>
            <Button variant="secondary" size="sm" onClick={onExportJson}>
              <Download className="h-3.5 w-3.5" /> mlo.config.json
            </Button>
            <Button variant="ghost" size="sm" onClick={onReset} className="col-span-1">
              <RotateCcw className="h-3.5 w-3.5" /> Nouveau
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="col-span-1"
              onClick={onGenerate}
              loading={generating}
              disabled={!canGenerate || errors.length > 0}
            >
              Generer
            </Button>
          </div>
          {!canGenerate ? (
            <p className="text-[10px] text-warning">Permission studio.use requise pour generer la ressource.</p>
          ) : null}
        </CardBody>
      ) : null}
    </Card>
  );
}

function SceneGroup({
  title,
  count,
  onAdd,
  empty,
  children,
}: {
  title: string;
  count: number;
  onAdd?: () => void;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</p>
        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-muted">{count}</span>
        {onAdd ? (
          <button
            type="button"
            onClick={onAdd}
            className="ml-auto rounded p-0.5 text-muted transition-colors hover:bg-white/5 hover:text-fg"
            title={`Ajouter ${title.toLowerCase()}`}
            aria-label={`Ajouter ${title.toLowerCase()}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <div className="space-y-1">
        {count === 0 && empty ? <p className="rounded-lg border border-dashed border-border px-2.5 py-2 text-[10px] text-muted">{empty}</p> : children}
      </div>
    </section>
  );
}

function SceneRow({
  kind,
  label,
  detail,
  selected,
  onClick,
}: {
  kind: "room" | "portal" | "entity" | "anchor";
  label: string;
  detail: string;
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = KIND_ICON[kind];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
        selected
          ? "border-primary-500/40 bg-primary-500/10"
          : "border-transparent hover:border-border hover:bg-white/[0.03]",
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", selected ? "text-primary-300" : "text-muted")} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium text-fg">{label}</span>
        <span className="block truncate text-[9.5px] text-muted">{detail}</span>
      </span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
    </button>
  );
}

function AddButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5 text-[10px] font-medium text-muted transition-colors hover:border-primary-500/40 hover:bg-primary-500/10 hover:text-primary-200"
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  step = 0.1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="mono h-8 text-xs"
      />
    </Field>
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
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-2.5 py-2">
      <div className="min-w-0">
        <p className="text-[10.5px] font-medium text-fg">{label}</p>
        <p className="text-[9.5px] text-muted">{hint}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
