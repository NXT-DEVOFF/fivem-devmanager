import { describe, expect, it } from "vitest";
import { analyzeResource, summarizeQuality } from "../src/lib/resource-quality";

const base = {
  name: "garage",
  folder: "/resources/[jobs]/garage",
  state: "manifest_valide",
  fileCount: 12,
  dependencies: ["ox_lib"],
  missingDependencies: [],
  manifest: {
    fxVersion: "cerulean",
    game: "fxserver",
    version: "1.2.0",
    clientScripts: ["client/main.lua"],
    serverScripts: ["server/main.lua"],
    sharedScripts: ["shared/config.lua"],
  },
};

describe("resource quality", () => {
  it("note 100 une ressource propre", () => {
    const report = analyzeResource(base);
    expect(report.findings).toHaveLength(0);
    expect(report.score).toBe(100);
  });

  it("bloque une ressource sans fxmanifest", () => {
    const report = analyzeResource({ ...base, state: "manifest_absent", manifest: null });
    expect(report.score).toBeLessThan(70);
    expect(report.findings.map((finding) => finding.code)).toContain("manifest_missing");
  });

  it("signale une version ancienne et des dependances manquantes", () => {
    const report = analyzeResource({
      ...base,
      missingDependencies: ["es_extended"],
      manifest: { ...base.manifest, fxVersion: "summer" },
    });
    const codes = report.findings.map((finding) => finding.code);
    expect(codes).toContain("fx_version_old");
    expect(codes).toContain("missing_dependencies");
    expect(report.score).toBe(76);
    expect(report.missingDependencies).toEqual(["es_extended"]);
    expect(
      report.findings.find((finding) => finding.code === "missing_dependencies")?.details,
    ).toEqual(["es_extended"]);
  });

  it("nomme explicitement chaque dependance manquante", () => {
    const report = analyzeResource({
      ...base,
      missingDependencies: ["ox_lib", "es_extended", "ox_lib"],
    });
    const finding = report.findings.find((item) => item.code === "missing_dependencies");
    expect(report.missingDependencies).toEqual(["es_extended", "ox_lib"]);
    expect(finding?.message).toBe("2 dependances introuvables dans /resources.");
    expect(finding?.details).toEqual(["es_extended", "ox_lib"]);
  });

  it("refuse un chemin de script hors ressource", () => {
    const report = analyzeResource({
      ...base,
      manifest: { ...base.manifest, clientScripts: ["../secret/client.lua"] },
    });
    expect(report.findings.map((finding) => finding.code)).toContain("suspicious_script_path");
    expect(report.score).toBe(65);
  });

  it("resume correctement un lot", () => {
    const clean = analyzeResource(base);
    const broken = analyzeResource({ ...base, name: "legacy", state: "manifest_absent", manifest: null });
    const summary = summarizeQuality([clean, broken]);
    expect(summary.resources).toBe(2);
    expect(summary.clean).toBe(1);
    expect(summary.errors).toBe(1);
    expect(summary.averageScore).toBe(Math.round((100 + broken.score) / 2));
  });
});
