import { describe, expect, it } from "vitest";
import { buildConfigReport, parseServerConfig } from "@/lib/server-config";

const SAMPLE = `
# Configuration du serveur
endpoint_add_tcp "0.0.0.0:30120"
endpoint_add_udp "0.0.0.0:30120"
set onesync on
set sv_maxclients 128
sv_licenseKey "cfxk_0123456789abcdef0123456789abcdef0123"
ensure mapmanager
ensure garage
ensure garage   // doublon
ensure [vehicles]/spawner

add_ace group.admin command allow
`;

describe("parseServerConfig", () => {
  it("extrait endpoints, reglages et ressources", () => {
    const parsed = parseServerConfig(SAMPLE);
    expect(parsed.endpoints.tcp).toEqual(["0.0.0.0:30120"]);
    expect(parsed.endpoints.udp).toEqual(["0.0.0.0:30120"]);
    expect(parsed.settings["onesync"]).toBe("on");
    expect(parsed.settings["sv_maxclients"]).toBe("128");
    expect(parsed.ensured).toEqual(["mapmanager", "garage", "garage", "[vehicles]/spawner"]);
    expect(parsed.aceCount).toBe(1);
  });

  it("ignore les commentaires et detecte les doublons", () => {
    const parsed = parseServerConfig("# ensure fantome\nensure garage\nensure GARAGE\n");
    expect(parsed.ensured).toEqual(["garage", "GARAGE"]);
    expect(parsed.duplicates).toEqual(["garage"]);
  });
});

describe("buildConfigReport", () => {
  it("compare les ressources demarrees aux ressources installees", () => {
    const report = buildConfigReport("/server.cfg", SAMPLE, [
      { name: "garage", folder: "/garage" },
      { name: "spawner", folder: "[vehicles]/spawner" },
      { name: "orpaillage", folder: "[jobs]/orpaillage" },
    ]);

    expect(report.resources.missing).toEqual([]);
    expect(report.resources.notStarted).toEqual(["orpaillage"]);
    expect(report.checks.some((check) => check.id === "duplicates")).toBe(true);
  });

  it("signale une configuration incomplete", () => {
    const report = buildConfigReport("/server.cfg", "ensure garage\n", []);
    const ids = report.checks.map((check) => check.id);
    expect(ids).toContain("license-missing");
    expect(ids).toContain("endpoint-tcp");
    expect(ids).toContain("missing-resources");
  });

  it("masque les secrets", () => {
    const report = buildConfigReport("/server.cfg", SAMPLE, []);
    const license = report.settings.find((setting) => setting.key === "sv_licensekey");
    expect(license?.masked).toBe(true);
    expect(license?.value).not.toContain("cfxk_0123456789");
  });
});
