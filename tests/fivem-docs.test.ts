import { describe, expect, it } from "vitest";
import { DOCS_FRAMEWORKS, FIVEM_DOCS } from "@/lib/fivem-docs";

describe("Documentation FiveM", () => {
  it("expose des guides uniques et structures", () => {
    expect(FIVEM_DOCS).toHaveLength(16);
    expect(new Set(FIVEM_DOCS.map((doc) => doc.id)).size).toBe(FIVEM_DOCS.length);

    for (const doc of FIVEM_DOCS) {
      expect(doc.title.length).toBeGreaterThan(5);
      expect(doc.summary.length).toBeGreaterThan(20);
      expect(doc.sections.length).toBeGreaterThan(0);
      expect(doc.sections.every((section) => section.title.length > 0)).toBe(true);
    }
  });

  it("couvre les frameworks et les systemes demandes", () => {
    const frameworkIds = new Set(DOCS_FRAMEWORKS.map((item) => item.id));
    expect(frameworkIds).toEqual(new Set(["esx", "qbcore", "ox", "core", "systems"]));

    const articleIds = new Set(FIVEM_DOCS.map((doc) => doc.id));
    expect(articleIds).toContain("esx-server");
    expect(articleIds).toContain("esx-client");
    expect(articleIds).toContain("qbcore-server");
    expect(articleIds).toContain("qbcore-client");
    expect(articleIds).toContain("ox-lib");
    expect(articleIds).toContain("ox-inventory");
    expect(articleIds).toContain("systems-jobs");
    expect(articleIds).toContain("systems-vehicles");
    expect(articleIds).toContain("systems-anticheat");
  });
});
