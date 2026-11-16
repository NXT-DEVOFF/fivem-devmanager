import { describe, expect, it } from "vitest";
import {
  STUDIO_CATEGORIES,
  STUDIO_TOOLS,
  defaultStudioInput,
  getStudioTool,
  studioToolCountByCategory,
  validateStudioInput,
} from "@/lib/studio/registry";
import {
  DEFAULT_HANDLING,
  DEFAULT_HANDLING_XML,
  debugVehicle,
  generateHandlingXml,
  parseHandlingXml,
} from "@/lib/studio/vehicles";
import { buildMloScaffold, validateYmap } from "@/lib/studio/mlo";

describe("FiveM Studio - registre", () => {
  it("expose exactement 118 outils avec des slugs uniques", () => {
    expect(STUDIO_TOOLS).toHaveLength(118);
    expect(new Set(STUDIO_TOOLS.map((tool) => tool.slug)).size).toBe(118);
    for (const tool of STUDIO_TOOLS) {
      expect(tool.name.length).toBeGreaterThan(2);
      expect(tool.fields.length).toBeGreaterThan(0);
    }
    expect(getStudioTool("framework-bridge")).toBeDefined();
    expect(getStudioTool("ox-target-zone")).toBeDefined();
    expect(getStudioTool("vehicle-keys")).toBeDefined();
    expect(getStudioTool("vehicle-audio")).toBeDefined();
    expect(getStudioTool("mlo-elevator")).toBeDefined();
    expect(getStudioTool("oxmysql-migration")).toBeDefined();
    expect(getStudioTool("server-hardening")).toBeDefined();
    expect(getStudioTool("fishing-system")).toBeDefined();
    expect(getStudioTool("vehicle-fleet-telemetry")).toBeDefined();
    expect(getStudioTool("vehicle-handling-diff")).toBeDefined();
    expect(getStudioTool("vehicle-meta-audit")).toBeDefined();
    expect(getStudioTool("mlo-camera-network")).toBeDefined();
    expect(getStudioTool("mlo-access-control")).toBeDefined();
    expect(getStudioTool("mlo-parking")).toBeDefined();
    expect(getStudioTool("secure-api-client")).toBeDefined();
    expect(getStudioTool("statebag-sync")).toBeDefined();
    expect(getStudioTool("command-registry")).toBeDefined();
    expect(getStudioTool("report-operations")).toBeDefined();
    expect(getStudioTool("database-maintenance")).toBeDefined();
    expect(getStudioTool("backup-verifier")).toBeDefined();
    expect(getStudioTool("crafting-system")).toBeDefined();
    expect(getStudioTool("reputation-system")).toBeDefined();
    expect(getStudioTool("skill-tree")).toBeDefined();
  });

  it("repartit les outils par categorie", () => {
    expect(STUDIO_CATEGORIES).toHaveLength(5);
    const counts = studioToolCountByCategory();
    expect(counts).toEqual({
      vehicules: 24,
      mlo: 23,
      dev: 25,
      serveur: 23,
      gameplay: 23,
    });
  });

  it("execute chaque outil avec ses valeurs par defaut", () => {
    for (const tool of STUDIO_TOOLS) {
      const values = defaultStudioInput(tool);
      const output = tool.run(values);
      expect(output.summary.length, tool.slug).toBeGreaterThan(0);
      expect(output.files.length, tool.slug).toBeGreaterThan(0);
      const paths = output.files.map((item) => item.path);
      expect(new Set(paths).size, tool.slug).toBe(paths.length);
    }
  });

  it("valide les entrees et rejette les valeurs invalides", () => {
    const tool = getStudioTool("vehicle-debug");
    expect(tool).toBeDefined();
    if (!tool) return;

    const valid = validateStudioInput(tool, {
      ...defaultStudioInput(tool),
      model: "sultan",
    });
    expect(valid.ok).toBe(true);

    const missing = validateStudioInput(tool, { xml: "", model: "" });
    expect(missing.ok).toBe(false);

    const badPreset = validateStudioInput(tool, { preset: "pas-un-preset" });
    expect(badPreset.ok).toBe(false);
  });
});

describe("FiveM Studio - vehicules", () => {
  it("detecte un handling.meta d'exemple", () => {
    const parsed = parseHandlingXml(DEFAULT_HANDLING_XML);
    expect(parsed.found).toBe(true);
    expect(parsed.data.handlingName).toBe("sultan");
    expect(parsed.data.gearRatios.length).toBeGreaterThan(0);
  });

  it("produit un diagnostic et des fichiers de debug", () => {
    const tool = getStudioTool("vehicle-debug");
    expect(tool).toBeDefined();
    if (!tool) return;

    const output = debugVehicle(defaultStudioInput(tool));
    expect(output.files.some((item) => item.path === "handling.meta")).toBe(true);
    expect(output.files.some((item) => item.path === "rapport-vehicule.md")).toBe(true);
    expect(output.stats?.some((item) => item.label === "Score global")).toBe(true);
    expect(output.meta?.model).toBe("sultan");
  });

  it("signale un handling absent", () => {
    const output = debugVehicle({ xml: "<root />", model: "test" });
    expect(output.diagnostics?.some((item) => item.level === "error")).toBe(true);
  });
});

describe("FiveM Studio - MLO", () => {
  it("genere un scaffold complet avec pieces, portails et entites", () => {
    const tool = getStudioTool("mlo-scaffold");
    expect(tool).toBeDefined();
    if (!tool) return;

    const output = buildMloScaffold(defaultStudioInput(tool));
    expect(output.files.some((item) => item.path === "fxmanifest.lua")).toBe(true);
    expect(output.files.some((item) => item.path === "source/project.ymap.xml")).toBe(true);
    expect(output.files.some((item) => item.path === "source/rooms.json")).toBe(true);
    expect(output.meta?.rooms).toBe(3);
    expect(output.meta?.portals).toBe(2);
  });

  it("valide le ymap genere", () => {
    const tool = getStudioTool("mlo-scaffold");
    expect(tool).toBeDefined();
    if (!tool) return;

    const output = buildMloScaffold(defaultStudioInput(tool));
    const ymap = output.files.find((item) => item.path === "source/project.ymap.xml");
    expect(ymap).toBeDefined();
    const report = validateYmap(ymap?.content ?? "");
    expect(report.diagnostics?.some((item) => item.level === "error")).not.toBe(true);
    expect(report.stats?.some((item) => item.label === "CMapData" && item.value === "OK")).toBe(true);
  });
});

describe("FiveM Studio - modules avances", () => {
  const expectedFiles: Record<string, string[]> = {
    "vehicle-fleet-telemetry": ["schema.sql", "server/telemetry.lua"],
    "vehicle-handling-diff": ["handling-diff.md", "handling-diff.json", "handling-merged.meta"],
    "vehicle-meta-audit": ["vehicles.meta", "handling.meta", "audit-vehicles.md"],
    "mlo-camera-network": ["server/cameras.lua", "client/cameras.lua"],
    "mlo-access-control": ["schema.sql", "server/access.lua", "client/access.lua"],
    "mlo-parking": ["schema.sql", "server/parking.lua", "client/parking.lua"],
    "secure-api-client": ["server/http.lua"],
    "statebag-sync": ["server/statebags.lua", "client/statebags.lua"],
    "command-registry": ["schema.sql", "server/commands.lua", "server/actions.lua"],
    "report-operations": ["schema.sql", "server/reports.lua", "client/suggestions.lua"],
    "database-maintenance": ["maintenance.sql", "maintenance.sh", "cron"],
    "backup-verifier": ["verify-backups.sh", "cron"],
    "crafting-system": ["schema.sql", "server/crafting.lua", "client/crafting.lua"],
    "reputation-system": ["schema.sql", "server/reputation.lua", "client/suggestions.lua"],
    "skill-tree": ["schema.sql", "server/skills.lua", "client/suggestions.lua"],
  };

  it("genere les fichiers attendus sans placeholder", () => {
    for (const [slug, paths] of Object.entries(expectedFiles)) {
      const tool = getStudioTool(slug);
      expect(tool, slug).toBeDefined();
      if (!tool) continue;

      const output = tool.run(defaultStudioInput(tool));
      const generated = output.files.map((item) => item.path);
      for (const path of paths) expect(generated, `${slug} -> ${path}`).toContain(path);
      const content = output.files.map((item) => item.content).join("\n");
      expect(content, slug).not.toContain("TODO");
      expect(content, slug).not.toContain("CHANGEME");
    }
  });

  it("compare deux handling et produit un meta fusionne", () => {
    const tool = getStudioTool("vehicle-handling-diff");
    expect(tool).toBeDefined();
    if (!tool) return;

    const output = tool.run({
      ...defaultStudioInput(tool),
      xmlB: generateHandlingXml({ ...DEFAULT_HANDLING, handlingName: "sultan", mass: 1800 }),
    });
    const report = output.files.find((item) => item.path === "handling-diff.md");
    const merged = output.files.find((item) => item.path === "handling-merged.meta");
    expect(report?.content).toContain("Masse");
    expect(merged?.content).toContain("fMass");
    expect(merged?.content).toContain("1800");
  });

  it("valide un vehicles.meta coherent sans erreur", () => {
    const tool = getStudioTool("vehicle-meta-audit");
    expect(tool).toBeDefined();
    if (!tool) return;

    const output = tool.run(defaultStudioInput(tool));
    expect(output.diagnostics?.some((item) => item.level === "error")).not.toBe(true);
    expect(output.files.some((item) => item.path === "audit-vehicles.md")).toBe(true);
  });

  it("ne diffuse pas les licences des places de parking", () => {
    const tool = getStudioTool("mlo-parking");
    expect(tool).toBeDefined();
    if (!tool) return;

    const output = tool.run(defaultStudioInput(tool));
    const server = output.files.find((item) => item.path === "server/parking.lua");
    expect(server?.content).not.toContain("occupied[row.spot] = row.owner");
    expect(server?.content).toContain("GetPlayerIdentifierByType");
  });

  it("genere des scripts ops sans secret en clair", () => {
    for (const slug of ["database-maintenance", "backup-verifier"]) {
      const tool = getStudioTool(slug);
      expect(tool).toBeDefined();
      if (!tool) continue;

      const output = tool.run(defaultStudioInput(tool));
      const script = output.files.find((item) => item.path.endsWith(".sh"));
      expect(script?.content, slug).toContain("set -euo pipefail");
      expect(script?.content, slug).not.toMatch(/password\s*=\s*['\"][^'\"]+['\"]/i);
    }
  });

  it("prefixe les identifiants SQL commencant par un chiffre", () => {
    const cases: Array<[string, string]> = [
      ["vehicle-fleet-telemetry", "table"],
      ["mlo-access-control", "table"],
      ["mlo-parking", "table"],
      ["command-registry", "auditTable"],
      ["report-operations", "table"],
      ["crafting-system", "logTable"],
      ["reputation-system", "table"],
      ["skill-tree", "tablePrefix"],
    ];

    for (const [slug, field] of cases) {
      const tool = getStudioTool(slug);
      expect(tool, slug).toBeDefined();
      if (!tool) continue;

      const output = tool.run({ ...defaultStudioInput(tool), [field]: "123_table" });
      const schema = output.files.find((item) => item.path === "schema.sql");
      expect(schema?.content, slug).toContain("t_123_table");
      expect(schema?.content, slug).not.toMatch(/(FROM|EXISTS|INTO)\s+123_table/);
    }

    const maintenance = getStudioTool("database-maintenance");
    expect(maintenance).toBeDefined();
    if (maintenance) {
      const output = maintenance.run({ ...defaultStudioInput(maintenance), tablesCsv: "123_table,created_at,30" });
      const sql = output.files.find((item) => item.path === "maintenance.sql");
      expect(sql?.content).toContain("`t_123_table`");
    }
  });

  it("utilise des intervalles SQL sans placeholder MySQL", () => {
    for (const slug of ["vehicle-fleet-telemetry", "report-operations"]) {
      const tool = getStudioTool(slug);
      expect(tool, slug).toBeDefined();
      if (!tool) continue;

      const output = tool.run(defaultStudioInput(tool));
      const content = output.files.map((item) => item.content).join("\n");
      expect(content, slug).not.toContain("INTERVAL ?");
    }
  });

  it("genere un webhook de sauvegarde sans secret en dur", () => {
    const tool = getStudioTool("backup-verifier");
    expect(tool).toBeDefined();
    if (!tool) return;

    const output = tool.run(defaultStudioInput(tool));
    const script = output.files.find((item) => item.path === "verify-backups.sh");
    expect(script?.content).toContain('WEBHOOK_URL=$(printenv "$WEBHOOK_ENV" || true)');
    expect(script?.content).toContain('"$WEBHOOK_URL"');
    expect(script?.content).not.toContain("\\$WEBHOOK_URL");
  });
});
