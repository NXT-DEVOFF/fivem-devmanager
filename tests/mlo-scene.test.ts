import { describe, expect, it } from "vitest";
import { parseEntities, parsePortals, parseRooms } from "@/lib/studio/mlo";
import {
  createSceneId,
  defaultSceneProject,
  moveSceneObject,
  normalizeSceneProject,
  sceneBounds,
  sceneToCsv,
  sceneToMloConfig,
  sceneToStudioInput,
  validateSceneProject,
} from "@/lib/studio/scene";

describe("Builder MLO - modele de scene", () => {
  it("cree des identifiants uniques", () => {
    const first = createSceneId("room");
    const second = createSceneId("room");
    expect(first).toMatch(/^room_/);
    expect(second).not.toBe(first);
  });

  it("normalise un mlo.config.json existant", () => {
    const project = normalizeSceneProject({
      resourceName: "test_mlo",
      mloName: "Test MLO",
      coords: "1, 2, 3",
      rooms: [{ name: "salon", minX: 0, minY: 0, minZ: 0, maxX: 8, maxY: 6, maxZ: 3 }],
      portals: [{ name: "porte", fromRoom: "salon", toRoom: "salon", x: 4, y: 6, z: 0 }],
      entities: [{ model: "prop_bench_01a", x: 1, y: 2, z: 0, heading: 90 }],
    });

    expect(project.resourceName).toBe("test_mlo");
    expect(project.coords).toEqual({ x: 1, y: 2, z: 3 });
    expect(project.rooms).toHaveLength(1);
    expect(project.rooms[0]?.id).toBeTruthy();
    expect(project.portals[0]?.width).toBe(2);
    expect(project.entities[0]?.heading).toBe(90);
  });

  it("inverse les volumes importes dans le desordre", () => {
    const project = normalizeSceneProject({
      rooms: [{ name: "inversee", minX: 10, minY: 12, minZ: 4, maxX: 2, maxY: 3, maxZ: 1 }],
    });
    expect(project.rooms[0]).toMatchObject({
      minX: 2,
      maxX: 10,
      minY: 3,
      maxY: 12,
      minZ: 1,
      maxZ: 4,
    });
  });

  it("produit des CSV compatibles avec les parseurs MLO", () => {
    const project = defaultSceneProject();
    const input = sceneToStudioInput(project);
    const csv = sceneToCsv(project);

    expect(parseRooms(csv.roomsCsv)).toHaveLength(3);
    expect(parsePortals(csv.portalsCsv)).toHaveLength(2);
    expect(parseEntities(csv.entitiesCsv)).toHaveLength(3);
    expect(input.resourceName).toBe(project.resourceName);
    expect(input.includeClient).toBe(true);
  });

  it("calcule les limites de la scene", () => {
    const bounds = sceneBounds(defaultSceneProject());
    expect(bounds.minX).toBe(-2);
    expect(bounds.maxX).toBe(18);
    expect(bounds.minY).toBe(0);
    expect(bounds.maxY).toBe(16);
  });

  it("deplace une piece sans modifier ses dimensions", () => {
    const project = defaultSceneProject();
    const room = project.rooms[0]!;
    const width = room.maxX - room.minX;
    const moved = moveSceneObject(project, { kind: "room", id: room.id }, 40, 50);
    const updated = moved.rooms.find((candidate) => candidate.id === room.id)!;

    expect(updated.minX).not.toBe(room.minX);
    expect(updated.maxX - updated.minX).toBe(width);
    expect((updated.minX + updated.maxX) / 2).toBe(40);
    expect((updated.minY + updated.maxY) / 2).toBe(50);
  });

  it("exporte une configuration sans identifiants UI", () => {
    const project = defaultSceneProject();
    const config = sceneToMloConfig(project);
    expect(config.rooms).toHaveLength(project.rooms.length);
    expect("id" in config.rooms[0]!).toBe(false);
    expect(config.portals[0]?.fromRoom).toBe("salon");
  });

  it("detecte un portail qui reference une piece inconnue", () => {
    const project = defaultSceneProject();
    project.portals[0] = { ...project.portals[0]!, toRoom: "inconnue" };
    const issues = validateSceneProject(project);
    expect(issues.some((issue) => issue.level === "error" && issue.message.includes("introuvable"))).toBe(true);
  });
});
