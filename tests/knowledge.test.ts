import { describe, expect, it } from "vitest";
import { knowledgeCategories, knowledgeExcerpt } from "@/lib/knowledge";

describe("knowledge", () => {
  it("resume un contenu Markdown simple", () => {
    expect(knowledgeExcerpt("## Guide\n\n**Important** : vérifier la console.")).toBe(
      "Guide Important : vérifier la console.",
    );
  });

  it("retire les blocs de code du resume", () => {
    expect(knowledgeExcerpt("```lua\nprint('debug')\n```\nAprès le redémarrage")).toBe(
      "Après le redémarrage",
    );
  });

  it("tronque proprement les contenus longs", () => {
    const result = knowledgeExcerpt(
      "Un guide très détaillé pour les développeurs du serveur FiveM",
      24,
    );
    expect(result.length).toBeLessThanOrEqual(24);
    expect(result.endsWith("…")).toBe(true);
  });

  it("dedoublonne et trie les categories", () => {
    expect(
      knowledgeCategories([
        { category: "Guides" },
        { category: "API" },
        { category: "Guides" },
        { category: "" },
      ]),
    ).toEqual(["API", "Guides"]);
  });
});
