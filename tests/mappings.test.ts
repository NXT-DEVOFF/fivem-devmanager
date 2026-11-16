import { describe, expect, it } from "vitest";
import {
  centerOfPoints,
  formatMappingCoordinate,
  isInsideGtaMap,
  parseMloConfig,
  parseYmapXml,
  looksLikeMappingXml,
  projectGtaPoint,
} from "@/lib/mappings";

const YMAP = `<?xml version="1.0" encoding="UTF-8"?>
<CMapData>
  <name>chicago_villa</name>
  <streamingExtentsMin x="-100" y="-200" z="0" />
  <streamingExtentsMax x="100" y="200" z="30" />
  <entities>
    <Item type="CEntityDef">
      <archetypeName>prop_bench_01a</archetypeName>
      <position x="10.5" y="20.25" z="1.5" />
    </Item>
    <Item type="CEntityDef">
      <archetypeName>prop_table_01a</archetypeName>
      <position x="-10.5" y="-20.25" z="1.5" />
    </Item>
  </entities>
</CMapData>`;

describe("parseYmapXml", () => {
  it("extrait les entites et les extents", () => {
    const result = parseYmapXml(YMAP);
    expect(result.title).toBe("chicago_villa");
    expect(result.points).toHaveLength(2);
    expect(result.points[0]?.label).toBe("prop_bench_01a");
    expect(result.points[0]?.x).toBe(10.5);
    expect(result.bounds).toEqual({ minX: -100, minY: -200, maxX: 100, maxY: 200 });
  });

  it("cree un ancrage quand seuls les extents existent", () => {
    const result = parseYmapXml(
      `<CMapData><name>empty</name><streamingExtentsMin x="-10" y="-20" z="0" /><streamingExtentsMax x="10" y="20" z="10" /></CMapData>`,
    );
    expect(result.points).toHaveLength(1);
    expect(result.points[0]?.kind).toBe("anchor");
    expect(result.points[0]?.x).toBe(0);
    expect(result.points[0]?.y).toBe(0);
  });

  it("signale un XML sans position", () => {
    const result = parseYmapXml("<CMapData><name>empty</name></CMapData>");
    expect(result.points).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/Aucune position/);
  });

  it("classe les entrees d'interiorproxies comme des proxies", () => {
    const result = parseYmapXml(
      `<interiorProxies><Item><name>appartement</name><position x="1" y="2" z="3" /></Item></interiorProxies>`,
    );
    expect(result.points).toHaveLength(1);
    expect(result.points[0]?.kind).toBe("proxy");
    expect(result.points[0]?.label).toBe("appartement");
    expect(result.points[0]?.x).toBe(1);
  });

  it("lit les positions .meta hors bloc Item", () => {
    const result = parseYmapXml(
      `<interiorProxies><name>proxy</name><position x="4" y="5" z="6" /></interiorProxies>`,
    );
    expect(result.points).toHaveLength(1);
    expect(result.points[0]?.kind).toBe("position");
    expect(result.totalPoints).toBe(1);
  });

  it("lit les blocs CMapEntity sans conteneur Item", () => {
    const result = parseYmapXml(
      `<CMapData><name>entites</name><CMapEntity type="CEntityDef"><archetypeName>prop_bench_01a</archetypeName><position x="12" y="34" z="5" /></CMapEntity></CMapData>`,
    );
    expect(result.points).toHaveLength(1);
    expect(result.points[0]?.label).toBe("prop_bench_01a");
    expect(result.points[0]?.model).toBe("prop_bench_01a");
    expect(result.points[0]?.x).toBe(12);
  });

  it("reconnait uniquement les XML de mapping", () => {
    expect(looksLikeMappingXml(YMAP)).toBe(true);
    expect(looksLikeMappingXml(`<interiorProxies><Item /></interiorProxies>`)).toBe(true);
    expect(looksLikeMappingXml(`<vehicles><Item><modelName>sultan</modelName></Item></vehicles>`)).toBe(false);
    expect(looksLikeMappingXml(`<data><value>1</value></data>`)).toBe(false);
  });
});

describe("parseMloConfig", () => {
  it("extrait l'ancrage, les pieces, portails et entites", () => {
    const result = parseMloConfig(
      JSON.stringify({
        mloName: "Villa Chicago",
        coords: { x: 100, y: 200, z: 30 },
        rooms: [{ name: "salon", minX: 90, minY: 190, maxX: 110, maxY: 210 }],
        portals: [{ name: "porte", x: 100, y: 200, z: 30 }],
        entities: [{ model: "prop_table_01a", x: 101, y: 201, z: 30 }],
      }),
    );
    expect(result.title).toBe("Villa Chicago");
    expect(result.points).toHaveLength(4);
    expect(result.points.map((point) => point.kind)).toEqual(["anchor", "room", "portal", "entity"]);
    expect(result.points[1]?.x).toBe(100);
    expect(result.points[1]?.y).toBe(200);
  });

  it("accepte les coordonnees textuelles", () => {
    const result = parseMloConfig(
      JSON.stringify({ coords: "1.5, 2.5, 3.5", entities: [{ model: "prop", coords: [4, 5, 6] }] }),
    );
    expect(result.points[0]?.x).toBe(1.5);
    expect(result.points[1]?.x).toBe(4);
  });

  it("refuse un JSON invalide", () => {
    const result = parseMloConfig("{invalid");
    expect(result.points).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/JSON invalide/);
  });
});

describe("projection GTA", () => {
  it("place les coordonnees dans l'atlas", () => {
    const center = projectGtaPoint(375, 1800);
    expect(center.x).toBeCloseTo(512, 5);
    expect(center.y).toBeCloseTo(512, 5);
  });

  it("detecte les positions hors carte", () => {
    expect(isInsideGtaMap(0, 0)).toBe(true);
    expect(isInsideGtaMap(99999, 0)).toBe(false);
  });

  it("calcule le centre et formate les coordonnees", () => {
    const center = centerOfPoints([
      { id: "a", label: "A", kind: "entity", x: 0, y: 0, z: 0 },
      { id: "b", label: "B", kind: "entity", x: 10, y: 20, z: 2 },
    ]);
    expect(center).toEqual({ x: 5, y: 10, z: 1 });
    expect(
      formatMappingCoordinate({ x: 1.23456, y: -2.5, z: 3 }),
    ).toBe("1.235, -2.500, 3.000");
  });
});
