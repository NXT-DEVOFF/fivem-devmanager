import { describe, expect, it } from "vitest";
import { buildUnifiedDiff, diffStats } from "@/server/diff";

describe("diff", () => {
  it("retourne une chaine vide si les contenus sont identiques", () => {
    expect(buildUnifiedDiff("a.lua", "print('a')", "print('a')")).toBe("");
  });

  it("genere un patch unifie lisible", () => {
    const patch = buildUnifiedDiff(
      "resources/garage/client.lua",
      "local a = 1\nprint(a)\n",
      "local a = 2\nprint(a)\n-- commentaire\n",
    );
    expect(patch).toContain("--- a/resources/garage/client.lua");
    expect(patch).toContain("+++ b/resources/garage/client.lua");
    expect(patch).toContain("-local a = 1");
    expect(patch).toContain("+local a = 2");
    expect(patch).toContain("+-- commentaire");
  });

  it("compte les ajouts et suppressions", () => {
    const stats = diffStats("un\ndeux\ntrois", "un\ntrois\nquatre");
    expect(stats.additions).toBeGreaterThanOrEqual(1);
    expect(stats.deletions).toBeGreaterThanOrEqual(1);
  });

  it("gere les contenus vides", () => {
    const stats = diffStats("", "ligne 1\nligne 2");
    expect(stats.additions).toBe(2);
    expect(stats.deletions).toBe(0);
  });
});
