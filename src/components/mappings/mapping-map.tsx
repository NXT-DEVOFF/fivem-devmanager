"use client";

import * as React from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import {
  GTA_MAP,
  isInsideGtaMap,
  projectGtaPoint,
  type MappingPointKind,
  type MappingRecord,
  type MappingSource,
} from "@/lib/mappings";
import { cn } from "@/components/ui/primitives";

const VIEW_SIZE = GTA_MAP.imageWidth;
const MIN_VIEW = 150;
const LABELS: Array<{ name: string; x: number; y: number; size?: number }> = [
  { name: "Paleto Bay", x: -100, y: 6500 },
  { name: "Grapeseed", x: 1700, y: 4800 },
  { name: "Sandy Shores", x: 1700, y: 3250 },
  { name: "Fort Zancudo", x: -2100, y: 3200 },
  { name: "Los Santos", x: 300, y: -700, size: 18 },
  { name: "LSIA", x: -1000, y: -2800 },
  { name: "Vinewood", x: 400, y: 1200 },
];

const SOURCE_COLORS: Record<MappingSource, string> = {
  ymap_xml: "#8189F6",
  mlo_config: "#22C55E",
  meta: "#38BDF8",
  ymap_binary: "#F59E0B",
};

const POINT_COLORS: Record<MappingPointKind, string> = {
  entity: "#A6AEF9",
  room: "#22C55E",
  portal: "#F59E0B",
  anchor: "#38BDF8",
  proxy: "#38BDF8",
  position: "#94A3B8",
};

interface ViewBox {
  x: number;
  y: number;
  w: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampView(view: ViewBox): ViewBox {
  const w = clamp(view.w, MIN_VIEW, VIEW_SIZE);
  return {
    w,
    x: clamp(view.x, 0, VIEW_SIZE - w),
    y: clamp(view.y, 0, VIEW_SIZE - w),
  };
}

export function MappingMap({
  mappings,
  selectedId,
  onSelect,
  showPoints,
}: {
  mappings: MappingRecord[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  showPoints: boolean;
}) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [view, setView] = React.useState<ViewBox>({ x: 0, y: 0, w: VIEW_SIZE });
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const viewRef = React.useRef(view);
  const dragRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = React.useRef(false);

  viewRef.current = view;

  const selected = mappings.find((mapping) => mapping.id === selectedId) ?? null;

  const zoomAt = React.useCallback((clientX: number, clientY: number, factor: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const current = viewRef.current;
    const ratioX = clamp((clientX - rect.left) / rect.width, 0, 1);
    const ratioY = clamp((clientY - rect.top) / rect.height, 0, 1);
    const nextWidth = clamp(current.w * factor, MIN_VIEW, VIEW_SIZE);
    const worldX = current.x + ratioX * current.w;
    const worldY = current.y + ratioY * current.w;
    setView(
      clampView({
        w: nextWidth,
        x: worldX - ratioX * nextWidth,
        y: worldY - ratioY * nextWidth,
      }),
    );
  }, []);

  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomAt(event.clientX, event.clientY, event.deltaY > 0 ? 1.16 : 0.86);
    };
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [zoomAt]);

  function zoomFromCenter(factor: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  }

  const center = selected?.center;
  const centerX = center?.x;
  const centerY = center?.y;

  React.useEffect(() => {
    if (centerX === undefined || centerY === undefined) return;
    if (!isInsideGtaMap(centerX, centerY)) return;
    const pixel = projectGtaPoint(centerX, centerY);
    const width = 340;
    setView(
      clampView({
        w: width,
        x: pixel.x - width / 2,
        y: pixel.y - width / 2,
      }),
    );
  }, [selectedId, centerX, centerY]);

  const zoomRatio = view.w / VIEW_SIZE;
  const markerRadius = Math.max(2.6, 6 * zoomRatio);
  const labelSize = Math.max(4, 15 * zoomRatio);
  const pointRadius = Math.max(1.25, 2.4 * zoomRatio);

  const visiblePoints = mappings.filter(
    (mapping) => showPoints || mapping.id === selectedId,
  );
  const selectedBounds = selected?.bounds
    ? (() => {
        const topLeft = projectGtaPoint(selected.bounds.minX, selected.bounds.maxY);
        const bottomRight = projectGtaPoint(selected.bounds.maxX, selected.bounds.minY);
        return {
          x: Math.min(topLeft.x, bottomRight.x),
          y: Math.min(topLeft.y, bottomRight.y),
          width: Math.abs(bottomRight.x - topLeft.x),
          height: Math.abs(bottomRight.y - topLeft.y),
        };
      })()
    : null;

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if ((event.target as Element).closest("[data-map-marker]")) return;
    const svg = svgRef.current;
    if (!svg) return;
    svg.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y,
      moved: false,
    };
    suppressClickRef.current = false;
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    const svg = svgRef.current;
    if (!drag || !svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0) return;
    const dx = ((event.clientX - drag.startX) / rect.width) * view.w;
    const dy = ((event.clientY - drag.startY) / rect.height) * view.w;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      drag.moved = true;
      suppressClickRef.current = true;
    }
    setView(clampView({ w: view.w, x: drag.originX - dx, y: drag.originY - dy }));
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (svg?.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDragging(false);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  function handleClick(event: React.MouseEvent<SVGSVGElement>) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if ((event.target as Element).closest("[data-map-marker]")) return;
    onSelect(null);
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-[#0b2230]">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.w}`}
        className={cn(
          "h-full w-full touch-none select-none",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
        role="img"
        aria-label="Carte GTA V des mappings du serveur"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
      >
        <defs>
          <linearGradient id="mapping-map-shade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#07111c" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#07111c" stopOpacity="0.55" />
          </linearGradient>
          <filter id="mapping-marker-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <image
          href={GTA_MAP.imagePath}
          x="0"
          y="0"
          width={VIEW_SIZE}
          height={VIEW_SIZE}
          preserveAspectRatio="none"
        />
        <rect width={VIEW_SIZE} height={VIEW_SIZE} fill="url(#mapping-map-shade)" />

        {LABELS.map((label) => {
          if (!isInsideGtaMap(label.x, label.y)) return null;
          const pixel = projectGtaPoint(label.x, label.y);
          return (
            <text
              key={label.name}
              x={pixel.x}
              y={pixel.y}
              textAnchor="middle"
              fill="#F8FAFC"
              fillOpacity={0.72}
              stroke="#07111c"
              strokeWidth={Math.max(1.5, 3 * zoomRatio)}
              paintOrder="stroke"
              fontSize={Math.max(5, (label.size ?? 14) * zoomRatio)}
              fontWeight={600}
              pointerEvents="none"
            >
              {label.name}
            </text>
          );
        })}

        {selectedBounds ? (
          <rect
            x={selectedBounds.x}
            y={selectedBounds.y}
            width={selectedBounds.width}
            height={selectedBounds.height}
            fill="none"
            stroke="#F8FAFC"
            strokeOpacity={0.7}
            strokeWidth={Math.max(0.8, 1.5 * zoomRatio)}
            strokeDasharray={`${Math.max(2, 6 * zoomRatio)} ${Math.max(1, 3 * zoomRatio)}`}
            pointerEvents="none"
          />
        ) : null}

        {visiblePoints.map((mapping) =>
          mapping.points.map((point) => {
            if (!isInsideGtaMap(point.x, point.y)) return null;
            const pixel = projectGtaPoint(point.x, point.y);
            return (
              <circle
                key={`${mapping.id}-${point.id}`}
                cx={pixel.x}
                cy={pixel.y}
                r={pointRadius}
                fill={POINT_COLORS[point.kind]}
                fillOpacity={mapping.id === selectedId ? 0.92 : 0.5}
                stroke="#07111c"
                strokeWidth={Math.max(0.4, 0.7 * zoomRatio)}
                pointerEvents="none"
              />
            );
          }),
        )}

        {mappings
          .filter((mapping) => mapping.center)
          .map((mapping) => {
            const centerPoint = mapping.center!;
            if (!isInsideGtaMap(centerPoint.x, centerPoint.y)) return null;
            const pixel = projectGtaPoint(centerPoint.x, centerPoint.y);
            const isSelected = mapping.id === selectedId;
            const isHovered = hovered === mapping.id;
            const color = SOURCE_COLORS[mapping.source];
            return (
              <g
                key={mapping.id}
                data-map-marker="true"
                className="cursor-pointer"
                onPointerDown={(event) => event.stopPropagation()}
                onMouseEnter={() => setHovered(mapping.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(mapping.id);
                }}
              >
                <title>{`${mapping.name} — ${mapping.totalPoints} position(s)`}</title>
                {isSelected ? (
                  <circle
                    cx={pixel.x}
                    cy={pixel.y}
                    r={markerRadius * 2.1}
                    fill={color}
                    fillOpacity={0.16}
                    stroke={color}
                    strokeOpacity={0.55}
                    strokeWidth={Math.max(0.6, 1 * zoomRatio)}
                  />
                ) : null}
                <circle
                  cx={pixel.x}
                  cy={pixel.y}
                  r={isSelected ? markerRadius * 1.35 : markerRadius}
                  fill={color}
                  stroke="#F8FAFC"
                  strokeWidth={Math.max(0.7, 1.4 * zoomRatio)}
                  filter={isSelected ? "url(#mapping-marker-glow)" : undefined}
                />
                {isSelected || isHovered ? (
                  <text
                    x={pixel.x + markerRadius * 1.8}
                    y={pixel.y + labelSize * 0.35}
                    fill="#F8FAFC"
                    stroke="#07111c"
                    strokeWidth={Math.max(1.5, 3 * zoomRatio)}
                    paintOrder="stroke"
                    fontSize={labelSize}
                    fontWeight={600}
                    pointerEvents="none"
                  >
                    {mapping.name}
                  </text>
                ) : null}
              </g>
            );
          })}
      </svg>

      <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-white/10 bg-black/35 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/80 backdrop-blur-sm">
        Atlas GTA V · lecture seule
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-white/10 bg-black/50 p-1 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => zoomFromCenter(1.22)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Zoomer"
          title="Zoomer"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => zoomFromCenter(0.8)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Dezoomer"
          title="Dezoomer"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setView({ x: 0, y: 0, w: VIEW_SIZE })}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Recentrer la carte"
          title="Recentrer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 max-w-[65%] rounded-md bg-black/45 px-2 py-1 text-[9px] leading-relaxed text-white/60 backdrop-blur-sm">
        Fond : GTA V UHD Map / Rockstar Games. Molette pour zoomer, glisser pour deplacer.
      </div>
    </div>
  );
}
