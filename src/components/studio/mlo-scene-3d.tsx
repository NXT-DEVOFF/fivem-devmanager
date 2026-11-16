"use client";

import * as React from "react";
import { AlertTriangle, Focus, Grid3X3, MousePointer2 } from "lucide-react";
import type * as THREE from "three";
import { sceneBounds, type MloSceneProject, type SceneSelection } from "@/lib/studio/scene";
import { cn } from "@/components/ui/primitives";

type ThreeNamespace = typeof import("three");
type OrbitControlsInstance = import("three/examples/jsm/controls/OrbitControls.js").OrbitControls;

interface BuiltScene {
  group: THREE.Group;
  pickables: THREE.Mesh[];
  objects: Map<string, THREE.Object3D>;
}

function sceneKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    const renderable = object as THREE.Mesh;
    renderable.geometry?.dispose();
    const materials = Array.isArray(renderable.material)
      ? renderable.material
      : renderable.material
        ? [renderable.material]
        : [];
    for (const material of materials) material.dispose();
  });
}

function markPickable(mesh: THREE.Mesh, kind: string, id: string, baseColor: string) {
  mesh.userData.sceneKind = kind;
  mesh.userData.sceneId = id;
  mesh.userData.baseColor = baseColor;
}

function buildScene(three: ThreeNamespace, project: MloSceneProject): BuiltScene {
  const group = new three.Group();
  group.name = "mlo-scene";
  const pickables: THREE.Mesh[] = [];
  const objects = new Map<string, THREE.Object3D>();
  const toThree = (x: number, y: number, z: number) => new three.Vector3(x, z, -y);

  for (const room of project.rooms) {
    const width = Math.max(0.2, Math.abs(room.maxX - room.minX));
    const height = Math.max(0.2, Math.abs(room.maxZ - room.minZ));
    const depth = Math.max(0.2, Math.abs(room.maxY - room.minY));
    const geometry = new three.BoxGeometry(width, height, depth);
    const material = new three.MeshStandardMaterial({
      color: 0x4f7cff,
      transparent: true,
      opacity: 0.16,
      roughness: 0.75,
      metalness: 0.05,
      depthWrite: false,
    });
    const mesh = new three.Mesh(geometry, material);
    markPickable(mesh, "room", room.id, "#4f7cff");
    mesh.position.copy(
      toThree((room.minX + room.maxX) / 2, (room.minY + room.maxY) / 2, (room.minZ + room.maxZ) / 2),
    );
    const edges = new three.LineSegments(
      new three.EdgesGeometry(geometry),
      new three.LineBasicMaterial({ color: 0x9db0ff, transparent: true, opacity: 0.9 }),
    );
    mesh.add(edges);

    const objectGroup = new three.Group();
    objectGroup.userData.sceneKind = "room";
    objectGroup.userData.sceneId = room.id;
    objectGroup.add(mesh);
    group.add(objectGroup);
    pickables.push(mesh);
    objects.set(sceneKey("room", room.id), objectGroup);
  }

  for (const portal of project.portals) {
    const geometry = new three.PlaneGeometry(portal.width, portal.height);
    const material = new three.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.3,
      side: three.DoubleSide,
      depthWrite: false,
    });
    const mesh = new three.Mesh(geometry, material);
    markPickable(mesh, "portal", portal.id, "#38bdf8");
    const edges = new three.LineSegments(
      new three.EdgesGeometry(geometry),
      new three.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.95 }),
    );
    mesh.add(edges);

    const objectGroup = new three.Group();
    objectGroup.userData.sceneKind = "portal";
    objectGroup.userData.sceneId = portal.id;
    objectGroup.position.copy(toThree(portal.x, portal.y, portal.z + portal.height / 2));
    objectGroup.rotation.y = three.MathUtils.degToRad(-portal.direction);
    objectGroup.add(mesh);
    group.add(objectGroup);
    pickables.push(mesh);
    objects.set(sceneKey("portal", portal.id), objectGroup);
  }

  for (const entity of project.entities) {
    const geometry = new three.BoxGeometry(0.8, 1.5, 0.8);
    const material = new three.MeshStandardMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.72,
      roughness: 0.55,
      metalness: 0.1,
    });
    const mesh = new three.Mesh(geometry, material);
    markPickable(mesh, "entity", entity.id, "#22c55e");
    mesh.position.y = 0.75;
    const edges = new three.LineSegments(
      new three.EdgesGeometry(geometry),
      new three.LineBasicMaterial({ color: 0x86efac, transparent: true, opacity: 0.9 }),
    );
    mesh.add(edges);

    const direction = new three.Mesh(
      new three.BoxGeometry(0.12, 0.12, 0.7),
      new three.MeshBasicMaterial({ color: 0xd9f99d }),
    );
    direction.position.set(0, 1.56, 0.25);

    const objectGroup = new three.Group();
    objectGroup.userData.sceneKind = "entity";
    objectGroup.userData.sceneId = entity.id;
    objectGroup.position.copy(toThree(entity.x, entity.y, entity.z));
    objectGroup.rotation.y = three.MathUtils.degToRad(-entity.heading);
    objectGroup.add(mesh, direction);
    group.add(objectGroup);
    pickables.push(mesh);
    objects.set(sceneKey("entity", entity.id), objectGroup);
  }

  if (project.anchor) {
    const geometry = new three.SphereGeometry(0.55, 18, 12);
    const material = new three.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0x9a4b00,
      emissiveIntensity: 0.5,
      roughness: 0.4,
    });
    const mesh = new three.Mesh(geometry, material);
    markPickable(mesh, "anchor", project.anchor.id, "#f59e0b");
    const objectGroup = new three.Group();
    objectGroup.userData.sceneKind = "anchor";
    objectGroup.userData.sceneId = project.anchor.id;
    objectGroup.position.copy(toThree(project.anchor.x, project.anchor.y, project.anchor.z));
    objectGroup.add(mesh);
    group.add(objectGroup);
    pickables.push(mesh);
    objects.set(sceneKey("anchor", project.anchor.id), objectGroup);
  }

  return { group, pickables, objects };
}

function clearSelectionHelper(
  scene: THREE.Scene | null,
  helperRef: React.MutableRefObject<THREE.BoxHelper | null>,
) {
  const helper = helperRef.current;
  if (!helper) return;
  scene?.remove(helper);
  helper.geometry.dispose();
  helper.material.dispose();
  helperRef.current = null;
}

function applySelectionHelper(
  three: ThreeNamespace,
  scene: THREE.Scene,
  built: BuiltScene | null,
  selected: SceneSelection | null,
  helperRef: React.MutableRefObject<THREE.BoxHelper | null>,
) {
  clearSelectionHelper(scene, helperRef);
  if (!selected || !built) return;
  const object = built.objects.get(sceneKey(selected.kind, selected.id));
  if (!object) return;
  const helper = new three.BoxHelper(object, 0xf8fafc);
  helper.material.depthTest = false;
  helper.material.transparent = true;
  helper.material.opacity = 0.95;
  helper.renderOrder = 100;
  scene.add(helper);
  helperRef.current = helper;
}

function positionGround(
  project: MloSceneProject,
  grid: THREE.GridHelper | null,
  ground: THREE.Mesh | null,
) {
  const bounds = sceneBounds(project);
  const x = (bounds.minX + bounds.maxX) / 2;
  const y = (bounds.minY + bounds.maxY) / 2;
  const floor = bounds.minZ;
  grid?.position.set(x, floor, -y);
  ground?.position.set(x, floor - 0.02, -y);
}

function focusCamera(
  three: ThreeNamespace,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControlsInstance,
  project: MloSceneProject,
  top = false,
) {
  const bounds = sceneBounds(project);
  const center = new three.Vector3(
    (bounds.minX + bounds.maxX) / 2,
    (bounds.minZ + bounds.maxZ) / 2,
    -(bounds.minY + bounds.maxY) / 2,
  );
  const span = Math.max(
    bounds.maxX - bounds.minX,
    bounds.maxY - bounds.minY,
    bounds.maxZ - bounds.minZ,
    12,
  );
  const distance = span * 1.5 + 10;
  camera.up.set(0, top ? 0 : 1, top ? -1 : 0);
  if (top) {
    camera.position.set(center.x, center.y + distance, center.z + 0.01);
  } else {
    camera.position.set(center.x + distance * 0.74, center.y + distance * 0.72, center.z + distance * 0.74);
  }
  camera.near = 0.1;
  camera.far = Math.max(500, distance * 20);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}

export function MloScene3D({
  project,
  selected,
  onSelect,
  onMove,
}: {
  project: MloSceneProject;
  selected: SceneSelection | null;
  onSelect: (selection: SceneSelection | null) => void;
  onMove: (selection: SceneSelection, x: number, y: number) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const sceneRef = React.useRef<THREE.Scene | null>(null);
  const cameraRef = React.useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = React.useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = React.useRef<OrbitControlsInstance | null>(null);
  const threeRef = React.useRef<ThreeNamespace | null>(null);
  const builtRef = React.useRef<BuiltScene | null>(null);
  const selectionHelperRef = React.useRef<THREE.BoxHelper | null>(null);
  const gridRef = React.useRef<THREE.GridHelper | null>(null);
  const groundRef = React.useRef<THREE.Mesh | null>(null);
  const hasFittedRef = React.useRef(false);
  const projectRef = React.useRef(project);
  const selectedRef = React.useRef(selected);
  const onSelectRef = React.useRef(onSelect);
  const onMoveRef = React.useRef(onMove);

  const [ready, setReady] = React.useState(0);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = React.useState<string | null>(null);
  const [gridVisible, setGridVisible] = React.useState(true);

  projectRef.current = project;
  selectedRef.current = selected;
  onSelectRef.current = onSelect;
  onMoveRef.current = onMove;

  React.useEffect(() => {
    let disposed = false;
    const container = containerRef.current;
    if (!container) return;
    const host = container;

    async function init() {
      try {
        const three = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        if (disposed) return;

        threeRef.current = three;
        const scene = new three.Scene();
        scene.background = new three.Color("#070b12");
        scene.fog = new three.Fog("#070b12", 80, 240);
        const camera = new three.PerspectiveCamera(48, 1, 0.1, 1000);
        const renderer = new three.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
        renderer.domElement.className = "block h-full w-full";
        renderer.domElement.setAttribute("aria-label", "Scene 3D du MLO");
        host.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.maxPolarAngle = Math.PI / 2 - 0.03;
        controls.minDistance = 2;
        controls.maxDistance = 400;

        scene.add(new three.HemisphereLight(0xdbeafe, 0x111827, 2.1));
        const sun = new three.DirectionalLight(0xffffff, 2.2);
        sun.position.set(22, 38, 18);
        scene.add(sun);
        const fill = new three.DirectionalLight(0x7299ff, 0.8);
        fill.position.set(-18, 14, -12);
        scene.add(fill);

        const ground = new three.Mesh(
          new three.PlaneGeometry(220, 220),
          new three.MeshStandardMaterial({
            color: 0x0c1522,
            roughness: 0.98,
            metalness: 0,
          }),
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.02;
        scene.add(ground);
        groundRef.current = ground;

        const grid = new three.GridHelper(120, 120, 0x385075, 0x18263b);
        grid.position.y = 0;
        scene.add(grid);
        gridRef.current = grid;

        const axes = new three.AxesHelper(4);
        axes.position.y = 0.02;
        scene.add(axes);

        const built = buildScene(three, projectRef.current);
        scene.add(built.group);
        builtRef.current = built;
        positionGround(projectRef.current, grid, ground);

        const raycaster = new three.Raycaster();
        const pointer = new three.Vector2();
        const groundPlane = new three.Plane(new three.Vector3(0, 1, 0), 0);
        const groundPoint = new three.Vector3();
        let down: { x: number; y: number; hit: boolean } | null = null;
        let drag: {
          selection: SceneSelection;
          object: THREE.Object3D;
          offsetX: number;
          offsetZ: number;
          startX: number;
          startY: number;
          moved: boolean;
        } | null = null;

        const setPointer = (event: PointerEvent) => {
          const rect = renderer.domElement.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        };

        const pick = (event: PointerEvent) => {
          setPointer(event);
          raycaster.setFromCamera(pointer, camera);
          return raycaster.intersectObjects(builtRef.current?.pickables ?? [], false)[0] ?? null;
        };

        const groundPosition = (event: PointerEvent) => {
          setPointer(event);
          raycaster.setFromCamera(pointer, camera);
          return raycaster.ray.intersectPlane(groundPlane, groundPoint)
            ? groundPoint.clone()
            : null;
        };

        const pointerDown = (event: PointerEvent) => {
          if (event.button !== 0) return;
          const hit = pick(event);
          down = { x: event.clientX, y: event.clientY, hit: Boolean(hit) };
          if (!hit) return;
          const kind = hit.object.userData.sceneKind as SceneSelection["kind"] | undefined;
          const id = hit.object.userData.sceneId as string | undefined;
          if (!kind || !id) return;

          event.stopPropagation();
          event.preventDefault();
          onSelectRef.current({ kind, id });
          const object = builtRef.current?.objects.get(sceneKey(kind, id));
          const point = groundPosition(event);
          if (object && point) {
            drag = {
              selection: { kind, id },
              object,
              offsetX: object.position.x - point.x,
              offsetZ: object.position.z - point.z,
              startX: event.clientX,
              startY: event.clientY,
              moved: false,
            };
            controls.enabled = false;
            try {
              renderer.domElement.setPointerCapture(event.pointerId);
            } catch {
              // Le navigateur peut refuser la capture si le pointeur n'est plus actif.
            }
          }
        };

        const pointerMove = (event: PointerEvent) => {
          if (!drag) return;
          if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 3) {
            drag.moved = true;
          }
          const point = groundPosition(event);
          if (!point) return;
          drag.object.position.x = point.x + drag.offsetX;
          drag.object.position.z = point.z + drag.offsetZ;
          selectionHelperRef.current?.update();
        };

        const pointerUp = (event: PointerEvent) => {
          if (drag) {
            if (drag.moved) {
              onMoveRef.current(drag.selection, drag.object.position.x, -drag.object.position.z);
            }
            drag = null;
            controls.enabled = true;
            if (renderer.domElement.hasPointerCapture(event.pointerId)) {
              renderer.domElement.releasePointerCapture(event.pointerId);
            }
          } else if (down && !down.hit && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 4) {
            onSelectRef.current(null);
          }
          down = null;
        };

        const pointerCancel = () => {
          if (drag) {
            if (drag.moved) {
              onMoveRef.current(drag.selection, drag.object.position.x, -drag.object.position.z);
            }
            drag = null;
            controls.enabled = true;
          }
          down = null;
        };

        renderer.domElement.addEventListener("pointerdown", pointerDown, true);
        renderer.domElement.addEventListener("pointermove", pointerMove);
        renderer.domElement.addEventListener("pointerup", pointerUp);
        renderer.domElement.addEventListener("pointercancel", pointerCancel);

        const observer = new ResizeObserver(() => {
          const width = Math.max(1, host.clientWidth);
          const height = Math.max(1, host.clientHeight);
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        });
        observer.observe(host);

        renderer.setAnimationLoop(() => {
          controls.update();
          renderer.render(scene, camera);
        });

        sceneRef.current = scene;
        cameraRef.current = camera;
        rendererRef.current = renderer;
        controlsRef.current = controls;
        setStatus("ready");
        setReady((value) => value + 1);

        return () => {
          observer.disconnect();
          renderer.domElement.removeEventListener("pointerdown", pointerDown, true);
          renderer.domElement.removeEventListener("pointermove", pointerMove);
          renderer.domElement.removeEventListener("pointerup", pointerUp);
          renderer.domElement.removeEventListener("pointercancel", pointerCancel);
        };
      } catch (caught) {
        if (!disposed) {
          setStatus("error");
          setError(caught instanceof Error ? caught.message : "WebGL indisponible");
        }
      }
    }

    let cleanupScene: (() => void) | undefined;
    void init().then((cleanup) => {
      cleanupScene = cleanup;
      if (disposed) cleanup?.();
    });

    return () => {
      disposed = true;
      cleanupScene?.();
      const renderer = rendererRef.current;
      renderer?.setAnimationLoop(null);
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
      const scene = sceneRef.current;
      clearSelectionHelper(scene, selectionHelperRef);
      if (scene && builtRef.current) {
        scene.remove(builtRef.current.group);
        disposeObject(builtRef.current.group);
      }
      controlsRef.current?.dispose();
      gridRef.current?.geometry.dispose();
      const gridMaterial = gridRef.current?.material;
      if (Array.isArray(gridMaterial)) gridMaterial.forEach((material) => material.dispose());
      else gridMaterial?.dispose();
      groundRef.current?.geometry.dispose();
      const groundMaterial = groundRef.current?.material;
      if (Array.isArray(groundMaterial)) groundMaterial.forEach((material) => material.dispose());
      else groundMaterial?.dispose();
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
      builtRef.current = null;
      gridRef.current = null;
      groundRef.current = null;
      threeRef.current = null;
      hasFittedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    const three = threeRef.current;
    const scene = sceneRef.current;
    if (!three || !scene || ready === 0) return;

    if (builtRef.current) {
      scene.remove(builtRef.current.group);
      disposeObject(builtRef.current.group);
    }
    const built = buildScene(three, project);
    scene.add(built.group);
    builtRef.current = built;
    positionGround(project, gridRef.current, groundRef.current);
    applySelectionHelper(three, scene, built, selectedRef.current, selectionHelperRef);
    if (!hasFittedRef.current) {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (camera && controls) focusCamera(three, camera, controls, project);
      hasFittedRef.current = true;
    }
  }, [project, ready]);

  React.useEffect(() => {
    const three = threeRef.current;
    const scene = sceneRef.current;
    if (!three || !scene) return;
    applySelectionHelper(three, scene, builtRef.current, selected, selectionHelperRef);
  }, [selected, ready]);

  function recenter(top: boolean) {
    const three = threeRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!three || !camera || !controls) return;
    focusCamera(three, camera, controls, projectRef.current, top);
  }

  function toggleGrid() {
    setGridVisible((value) => {
      const next = !value;
      if (gridRef.current) gridRef.current.visible = next;
      return next;
    });
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[460px] w-full overflow-hidden bg-[#070b12]"
    >
      {status === "loading" ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#070b12]">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary-400" />
            Initialisation de la scene 3D...
          </div>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#070b12] p-6">
          <div className="max-w-sm rounded-xl border border-warning/30 bg-warning/[0.06] p-4 text-center">
            <AlertTriangle className="mx-auto h-5 w-5 text-warning" />
            <p className="mt-2 text-xs font-medium text-warning">Scene 3D indisponible</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              {error ?? "WebGL n'est pas disponible dans ce navigateur."}
            </p>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/75 backdrop-blur-sm">
        Scene MLO · GTA V
      </div>

      <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-lg border border-white/10 bg-black/50 p-1 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => recenter(false)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white"
          title="Recentrer la camera"
          aria-label="Recentrer la camera"
        >
          <Focus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => recenter(true)}
          className="flex h-7 items-center justify-center rounded-md px-2 text-[10px] text-white/75 transition-colors hover:bg-white/10 hover:text-white"
          title="Vue du dessus"
          aria-label="Vue du dessus"
        >
          Dessus
        </button>
        <button
          type="button"
          onClick={toggleGrid}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            gridVisible
              ? "bg-primary-500/25 text-primary-200"
              : "text-white/55 hover:bg-white/10 hover:text-white",
          )}
          title="Afficher la grille"
          aria-label="Afficher la grille"
        >
          <Grid3X3 className="h-3.5 w-3.5" />
        </button>
      </div>

      {status === "ready" && project.rooms.length === 0 && project.entities.length === 0 && project.portals.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-center backdrop-blur-sm">
            <MousePointer2 className="mx-auto h-4 w-4 text-primary-300" />
            <p className="mt-1 text-xs text-white/80">Ajoutez une piece pour commencer</p>
            <p className="mt-0.5 text-[10px] text-white/45">ou importez un mlo.config.json existant</p>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-md bg-black/45 px-2 py-1 text-[9px] leading-relaxed text-white/55 backdrop-blur-sm">
        Clic : selectionner · Glisser : deplacer au sol · Molette : zoom
      </div>
    </div>
  );
}
