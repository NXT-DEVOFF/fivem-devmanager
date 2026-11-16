"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronRight,
  Copy,
  FileCode2,
  FileWarning,
  Layers,
  Map as MapIcon,
  MousePointerClick,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/use-api";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { MappingMap } from "@/components/mappings/mapping-map";
import {
  MAPPING_POINT_LABELS,
  MAPPING_SOURCE_LABELS,
  formatMappingCoordinate,
  type MappingRecord,
  type MappingScan,
  type MappingSource,
} from "@/lib/mappings";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Stat,
  cn,
} from "@/components/ui/primitives";
import { formatBytes, formatDateTime, relativeTime } from "@/lib/format";

type SourceFilter = "all" | MappingSource;

const SOURCE_VARIANT: Record<MappingSource, "primary" | "success" | "info" | "warning"> = {
  ymap_xml: "primary",
  mlo_config: "success",
  meta: "info",
  ymap_binary: "warning",
};

const SOURCE_DOT: Record<MappingSource, string> = {
  ymap_xml: "bg-primary-400",
  mlo_config: "bg-success",
  meta: "bg-info",
  ymap_binary: "bg-warning",
};

function shortResource(resource: string): string {
  return resource.split("/").filter(Boolean).pop() ?? resource;
}

function copyToClipboard(value: string, message: string) {
  if (!navigator.clipboard?.writeText) {
    toast.error("Copie impossible : le presse-papiers n'est pas disponible.");
    return;
  }
  navigator.clipboard
    .writeText(value)
    .then(() => toast.success(message))
    .catch(() => toast.error("Copie impossible dans ce navigateur."));
}

function pointsToTsv(record: MappingRecord): string {
  const header = "label\ttype\tx\ty\tz";
  return [
    header,
    ...record.points.map(
      (point) =>
        `${point.label}\t${MAPPING_POINT_LABELS[point.kind]}\t${point.x.toFixed(3)}\t${point.y.toFixed(3)}\t${point.z.toFixed(3)}`,
    ),
  ].join("\n");
}

export default function MappingsPage() {
  const scan = useApi<MappingScan>("/api/mappings");
  const [query, setQuery] = React.useState("");
  const [source, setSource] = React.useState<SourceFilter>("all");
  const [resource, setResource] = React.useState("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [showPoints, setShowPoints] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const mappings = React.useMemo(() => scan.data?.mappings ?? [], [scan.data]);
  const resources = React.useMemo(
    () => Array.from(new Set(mappings.map((mapping) => mapping.resource))).sort(),
    [mappings],
  );

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return mappings.filter((mapping) => {
      if (source !== "all" && mapping.source !== source) return false;
      if (resource !== "all" && mapping.resource !== resource) return false;
      if (!needle) return true;
      return `${mapping.name} ${mapping.resource} ${mapping.file}`.toLowerCase().includes(needle);
    });
  }, [mappings, query, resource, source]);

  React.useEffect(() => {
    if (selectedId && !filtered.some((mapping) => mapping.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  const selected = selectedId ? mappings.find((mapping) => mapping.id === selectedId) ?? null : null;
  const located = filtered.filter((mapping) => mapping.center);
  const unreadable = filtered.filter((mapping) => mapping.source === "ymap_binary");
  const hasFilters = Boolean(query.trim()) || source !== "all" || resource !== "all";

  async function refresh() {
    setRefreshing(true);
    try {
      const payload = await apiFetch<MappingScan>("/api/mappings?refresh=1");
      scan.setData(payload);
      scan.setError(null);
      toast.success("Carte des mappings actualisee");
    } catch (error) {
      scan.setError(errorMessage(error));
      toast.error(errorMessage(error));
    } finally {
      setRefreshing(false);
    }
  }

  const loading = scan.loading && !scan.data;

  return (
    <div>
      <PageHeader
        eyebrow="FiveM Studio"
        title="Carte des mappings"
        description="Visualisez les MLO et mappings presents dans /resources, avec leurs coordonnees exactes sur la carte de GTA V. Scanner strictement en lecture seule."
      >
        <Badge variant="info">
          <MapIcon className="h-3 w-3" /> Lecture seule
        </Badge>
        <Link href="/mlo">
          <Button variant="secondary" size="sm">
            <Building2 className="h-3.5 w-3.5" /> Constructeur MLO
          </Button>
        </Link>
        <Button variant="primary" size="sm" onClick={refresh} loading={refreshing}>
          <RefreshCw className="h-3.5 w-3.5" /> Actualiser
        </Button>
      </PageHeader>

      <div className="mb-4 rounded-xl border border-info/25 bg-info/[0.05] px-4 py-3">
        <div className="flex gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-info" />
          <p className="text-[11.5px] leading-relaxed text-muted">
            <span className="font-medium text-fg">Coordonnees reelles, sources limitees.</span>{" "}
            Les points proviennent des <code className="mono text-info">.ymap.xml</code> et{" "}
            <code className="mono text-info">.xml</code> de mapping, des{" "}
            <code className="mono text-info">mlo.config.json</code> et des{" "}
            <code className="mono text-info">interiorproxies.meta</code>. Un{" "}
            <code className="mono text-warning">.ymap</code> binaire sans source XML est signale
            mais ne peut pas etre decode de facon fiable ici ; ouvrez-le dans CodeWalker pour
            exporter sa source.
          </p>
        </div>
      </div>

      {scan.error ? (
        <Card className="mb-4 border-danger/25 bg-danger/[0.04]">
          <CardBody className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-2.5">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <div>
                <p className="text-xs font-medium text-danger">Scan impossible</p>
                <p className="mt-1 text-[11px] text-muted">{scan.error}</p>
                <p className="mt-1 text-[10px] text-muted">
                  Verifiez la configuration Pterodactyl/SFTP dans{" "}
                  <Link href="/infrastructure" className="text-primary-300 underline-offset-2 hover:underline">
                    Infrastructure
                  </Link>
                  .
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={refresh} loading={refreshing}>
              Reessayer
            </Button>
          </CardBody>
        </Card>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Mappings detectes"
          value={String(scan.data?.mappingCount ?? 0)}
          hint="Toutes sources confondues"
          icon={<MapIcon className="h-4 w-4" />}
          accent="primary"
        />
        <Stat
          label="Positions exactes"
          value={String(scan.data?.pointCount ?? 0)}
          hint="Entites, pieces, portails et ancrages"
          icon={<Layers className="h-4 w-4" />}
          accent="success"
        />
        <Stat
          label="Ressources analysees"
          value={String(scan.data?.resourceCount ?? 0)}
          hint={`${scan.data?.fileCount ?? 0} fichier(s) cartographique(s)`}
          icon={<FileCode2 className="h-4 w-4" />}
          accent="info"
        />
        <Stat
          label="Binaires non lisibles"
          value={String(scan.data?.unreadableCount ?? 0)}
          hint="Sources XML absentes"
          icon={<FileWarning className="h-4 w-4" />}
          accent={scan.data?.unreadableCount ? "warning" : "success"}
        />
      </div>

      {scan.data?.warnings && scan.data.warnings.length > 0 ? (
        <details className="mb-4 rounded-xl border border-border bg-surface/60 px-4 py-3">
          <summary className="cursor-pointer text-[11px] font-medium text-warning">
            Avertissements du scan ({scan.data.warnings.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {scan.data.warnings.map((warning) => (
              <li key={warning} className="flex gap-2 text-[10.5px] text-muted">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,0.9fr)]">
        <div className="min-w-0 space-y-4">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
              <div className="relative min-w-[190px] flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher un mapping, une ressource, un fichier..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <Select
                value={source}
                onChange={(event) => setSource(event.target.value as SourceFilter)}
                className="h-8 w-auto min-w-[130px] text-xs"
                aria-label="Filtrer par source"
              >
                <option value="all">Toutes sources</option>
                {Object.entries(MAPPING_SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Select
                value={resource}
                onChange={(event) => setResource(event.target.value)}
                className="h-8 w-auto max-w-[210px] text-xs"
                aria-label="Filtrer par ressource"
              >
                <option value="all">Toutes ressources</option>
                {resources.map((item) => (
                  <option key={item} value={item}>
                    {shortResource(item)}
                  </option>
                ))}
              </Select>
              <Button
                variant={showPoints ? "primary" : "secondary"}
                size="sm"
                onClick={() => setShowPoints((value) => !value)}
                title="Afficher ou masquer tous les points exacts"
              >
                <Layers className="h-3.5 w-3.5" />
                {showPoints ? "Toutes les positions" : "Marqueurs seuls"}
              </Button>
              {hasFilters ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setSource("all");
                    setResource("all");
                  }}
                >
                  <X className="h-3.5 w-3.5" /> Effacer
                </Button>
              ) : null}
            </div>

            {loading ? (
              <div className="p-4">
                <Skeleton className="aspect-square w-full" />
              </div>
            ) : (
              <div className="p-3 sm:p-4">
                <MappingMap
                  mappings={filtered}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  showPoints={showPoints}
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border px-4 py-2.5 text-[10px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-400" /> YMAP XML
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Projet MLO
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-info" /> Meta interieur
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Binaire non lu
              </span>
              <span className="ml-auto">
                {located.length} mapping(s) localise(s) · {filtered.length} affiche(s)
              </span>
            </div>
          </Card>

          {selected ? (
            <MappingDetail record={selected} onClose={() => setSelectedId(null)} />
          ) : (
            <Card>
              <EmptyState
                icon={<MousePointerClick className="h-5 w-5" />}
                title="Selectionnez un mapping"
                description="Cliquez sur un marqueur ou sur une ligne de la liste pour afficher toutes ses coordonnees exactes, ses limites et ses avertissements."
              />
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <MapIcon className="h-4 w-4 text-primary-300" /> Mappings detectes
              </CardTitle>
              <Badge variant="neutral">{filtered.length}</Badge>
            </CardHeader>

            {loading ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2, 3].map((index) => (
                  <Skeleton key={index} className="h-16" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<MapIcon className="h-5 w-5" />}
                title={mappings.length === 0 ? "Aucun mapping detecte" : "Aucun resultat"}
                description={
                  mappings.length === 0
                    ? "Le scan n'a trouve aucune source XML de mapping (.ymap.xml ou .xml), mlo.config.json ou interiorproxies.meta dans /resources."
                    : "Modifiez la recherche ou les filtres pour retrouver un mapping."
                }
                action={
                  hasFilters ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setQuery("");
                        setSource("all");
                        setResource("all");
                      }}
                    >
                      Reinitialiser les filtres
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="max-h-[640px] divide-y divide-border/60 overflow-y-auto">
                {filtered.map((mapping) => (
                  <MappingRow
                    key={mapping.id}
                    mapping={mapping}
                    selected={mapping.id === selectedId}
                    onSelect={() => setSelectedId(mapping.id)}
                  />
                ))}
              </div>
            )}
          </Card>

          {unreadable.length > 0 ? (
            <Card>
              <CardHeader className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-warning">
                  <FileWarning className="h-4 w-4" /> Binaires non analyses
                </CardTitle>
                <Badge variant="warning">{unreadable.length}</Badge>
              </CardHeader>
              <CardBody className="space-y-2">
                {unreadable.slice(0, 8).map((mapping) => (
                  <button
                    key={mapping.id}
                    type="button"
                    onClick={() => setSelectedId(mapping.id)}
                    className="block w-full rounded-lg border border-warning/20 bg-warning/[0.04] px-2.5 py-2 text-left transition-colors hover:border-warning/40"
                  >
                    <p className="truncate text-[11px] font-medium text-fg">{mapping.name}</p>
                    <p className="truncate font-mono text-[9px] text-muted">{mapping.file}</p>
                  </button>
                ))}
                {unreadable.length > 8 ? (
                  <p className="text-[10px] text-muted">
                    Et {unreadable.length - 8} autre(s) fichier(s) binaire(s) dans la liste.
                  </p>
                ) : null}
                <p className="border-t border-border pt-2 text-[10px] leading-relaxed text-muted">
                  Ces fichiers sont bien presents sur le serveur, mais leur position exacte
                  necessite une source XML exportee depuis CodeWalker.
                </p>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardBody className="space-y-2 text-[10.5px] leading-relaxed text-muted">
              <p className="flex items-center gap-2 text-[11px] font-medium text-fg">
                <Check className="h-3.5 w-3.5 text-success" /> Scan non intrusif
              </p>
              <p>
                Aucun fichier n&apos;est modifie. Le scanner lit uniquement les sources cartographiques
                des ressources et met le resultat en cache deux minutes pour eviter de surcharger
                le panel.
              </p>
              {scan.data ? (
                <p className="text-[10px] text-muted/80">
                  Dernier scan : {formatDateTime(scan.data.scannedAt)} · backend{" "}
                  <span className="mono">{scan.data.backend}</span>
                  {scan.data.truncated ? " · resultat tronque" : ""}
                </p>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MappingRow({
  mapping,
  selected,
  onSelect,
}: {
  mapping: MappingRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  const center = mapping.center;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "block w-full px-3 py-3 text-left transition-colors hover:bg-white/[0.03]",
        selected && "bg-primary-500/[0.08]",
      )}
      title={mapping.file}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "mt-1 h-2 w-2 shrink-0 rounded-full",
            SOURCE_DOT[mapping.source],
            selected && "ring-2 ring-white/40 ring-offset-2 ring-offset-card",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium text-fg">{mapping.name}</p>
              <p className="truncate text-[10px] text-muted">{shortResource(mapping.resource)}</p>
            </div>
            <ChevronRight
              className={cn(
                "mt-0.5 h-3.5 w-3.5 shrink-0 text-muted transition-transform",
                selected && "rotate-90 text-primary-300",
              )}
            />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant={SOURCE_VARIANT[mapping.source]}>{MAPPING_SOURCE_LABELS[mapping.source]}</Badge>
            <span className="text-[10px] text-muted">
              {mapping.totalPoints} position(s)
            </span>
            {mapping.truncated ? (
              <span className="text-[10px] text-warning">tronque</span>
            ) : null}
          </div>
          <p className="mono mt-1 truncate text-[9.5px] text-muted/80">
            {center ? formatMappingCoordinate(center) : "Position indisponible"}
          </p>
        </div>
      </div>
    </button>
  );
}

function MappingDetail({ record, onClose }: { record: MappingRecord; onClose: () => void }) {
  const [copiedPoint, setCopiedPoint] = React.useState<string | null>(null);

  function copyPoint(id: string, point: MappingRecord["points"][number]) {
    copyToClipboard(formatMappingCoordinate(point), "Coordonnees copiees");
    setCopiedPoint(id);
    window.setTimeout(() => setCopiedPoint(null), 1500);
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="truncate">{record.name}</CardTitle>
            <Badge variant={SOURCE_VARIANT[record.source]}>{MAPPING_SOURCE_LABELS[record.source]}</Badge>
          </div>
          <p className="mono mt-1 break-all text-[10px] text-muted">{record.file}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(pointsToTsv(record), "Toutes les positions copiees")}
            disabled={record.points.length === 0}
          >
            <Copy className="h-3.5 w-3.5" /> Copier tout
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-fg"
            aria-label="Fermer le detail"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>

      <CardBody className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Ressource" value={shortResource(record.resource)} />
          <Info
            label="Centre"
            value={record.center ? formatMappingCoordinate(record.center) : "Indisponible"}
            mono
          />
          <Info
            label="Limites"
            value={
              record.bounds
                ? `${record.bounds.minX.toFixed(1)}, ${record.bounds.minY.toFixed(1)} → ${record.bounds.maxX.toFixed(1)}, ${record.bounds.maxY.toFixed(1)}`
                : "Indisponibles"
            }
            mono
          />
          <Info
            label="Fichier"
            value={`${formatBytes(record.sizeBytes)} · ${relativeTime(record.modifiedAt)}`}
          />
        </div>

        {record.warnings.length > 0 ? (
          <div className="space-y-1.5 rounded-lg border border-warning/25 bg-warning/[0.05] px-3 py-2.5">
            {record.warnings.map((warning) => (
              <p key={warning} className="flex gap-2 text-[10.5px] text-warning">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{warning}</span>
              </p>
            ))}
          </div>
        ) : null}

        {record.points.length > 0 ? (
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Positions exactes
              </p>
              <span className="text-[10px] text-muted">
                {record.points.length} affichee(s)
                {record.totalPoints > record.points.length
                  ? ` sur ${record.totalPoints} detectee(s)`
                  : ""}
              </span>
            </div>
            <div className="max-h-[380px] overflow-auto rounded-lg border border-border">
              <table className="w-full min-w-[560px] text-left text-[10.5px]">
                <thead className="sticky top-0 z-10 border-b border-border bg-card text-[9px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Libelle</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">X</th>
                    <th className="px-3 py-2 font-medium">Y</th>
                    <th className="px-3 py-2 font-medium">Z</th>
                    <th className="px-3 py-2 text-right font-medium">Copier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {record.points.map((point) => (
                    <tr key={point.id} className="hover:bg-white/[0.02]">
                      <td className="max-w-[180px] px-3 py-1.5">
                        <p className="truncate text-fg">{point.label}</p>
                        {point.model && point.model !== point.label ? (
                          <p className="mono truncate text-[9px] text-muted">{point.model}</p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-muted">
                        {MAPPING_POINT_LABELS[point.kind]}
                      </td>
                      <td className="mono whitespace-nowrap px-3 py-1.5 text-fg">{point.x.toFixed(3)}</td>
                      <td className="mono whitespace-nowrap px-3 py-1.5 text-fg">{point.y.toFixed(3)}</td>
                      <td className="mono whitespace-nowrap px-3 py-1.5 text-fg">{point.z.toFixed(3)}</td>
                      <td className="px-3 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => copyPoint(point.id, point)}
                          className="rounded p-1 text-muted transition-colors hover:bg-white/5 hover:text-fg"
                          title="Copier x, y, z"
                          aria-label={`Copier ${point.label}`}
                        >
                          {copiedPoint === point.id ? (
                            <Check className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-warning/25 bg-warning/[0.05] px-3 py-3">
            <p className="flex items-center gap-2 text-[11px] font-medium text-warning">
              <FileWarning className="h-4 w-4" /> Positions non extractibles
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
              Ce fichier est un <code className="mono">.ymap</code> binaire (RSC7). Sans source{" "}
              <code className="mono">.ymap.xml</code> ou fichier de projet MLO, ses coordonnees ne
              peuvent pas etre lues de facon fiable. Le fichier reste visible ici pour que vous
              sachiez qu&apos;il existe sur le serveur.
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface/60 px-3 py-2">
      <p className="text-[9px] uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("mt-0.5 break-words text-[10.5px] text-fg", mono && "mono")}>{value}</p>
    </div>
  );
}
