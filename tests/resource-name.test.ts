import { describe, expect, it } from "vitest";
import { isBuiltinResource, normalizeResourceName } from "@/lib/resource-name";

describe("noms de ressources FiveM", () => {
  it("ignore le prefixe de categorie", () => {
    expect(normalizeResourceName("[car]/eki_driveby")).toBe("eki_driveby");
    expect(normalizeResourceName("oxmysql")).toBe("oxmysql");
    expect(normalizeResourceName("  [core]/ES_Extended  ")).toBe("es_extended");
  });

  it("rapproche une dependance du dossier categorise", () => {
    expect(normalizeResourceName("[ox]/ox_lib")).toBe(normalizeResourceName("ox_lib"));
  });

  it("reconnait les ressources systeme FXServer", () => {
    expect(isBuiltinResource("spawnmanager")).toBe(true);
    expect(isBuiltinResource("[system]/sessionmanager")).toBe(true);
    expect(isBuiltinResource("fivem-map-skater")).toBe(true);
    expect(isBuiltinResource("ox_lib")).toBe(false);
  });
});
