import { describe, expect, it } from "vitest";
import {
  buildFileChangeSection,
  buildInternalSections,
  buildPublicSections,
  parseSections,
  renderSections,
  sanitizePublicText,
  type PatchSourceData,
} from "../src/lib/patch-notes";

function source(): PatchSourceData {
  return {
    number: 7,
    developer: { name: "Dev Test" },
    activeSeconds: 1800,
    durationSeconds: 2400,
    status: "COMPLETED",
    tasks: [{ code: "DEV-0007", title: "Garage", status: "DONE", timeSpentSeconds: 1800 }],
    tasksCompleted: [{ code: "DEV-0007", title: "Garage" }],
    tasksRemaining: [],
    bugsFixed: [{ code: "BUG-0012", title: "Menu noir", severity: "HIGH" }],
    filesCreated: ["resources/[jobs]/garage/client.lua"],
    filesModified: ["resources/[jobs]/garage/server.lua"],
    filesDeleted: [],
    resources: ["garage"],
    changes: [
      {
        path: "resources/[jobs]/garage/client.lua",
        type: "FILE_CREATED",
        additions: 20,
        deletions: 0,
        taskCode: "DEV-0007",
      },
      {
        path: "resources/[jobs]/garage/server.lua",
        type: "FILE_MODIFIED",
        additions: 5,
        deletions: 3,
        taskCode: "DEV-0007",
      },
    ],
    tests: [{ name: "Deploiement garage", result: "Succes" }],
    deployments: [{ resource: "garage", status: "DEPLOYED" }],
    pendingChanges: 1,
    notes: [],
    commands: [{ command: "ensure garage" }],
    summary: "Menu corrige",
  };
}

describe("patch notes", () => {
  it("regroupe taches, bugs et ressources dans le contenu public", () => {
    const sections = buildPublicSections(source(), new Map([["DEV-0007", "SCRIPT"]]));
    const items = sections.flatMap((section) => section.items);

    expect(items).toContain("Garage");
    expect(items).toContain("Menu noir");
    expect(items).toContain("Mise a jour de garage (2 fichiers)");
    expect(items).toContain("Mise en production : garage");
  });

  it("ne publie jamais un chemin de fichier interne", () => {
    const sections = buildPublicSections(source());
    const text = sections.flatMap((section) => section.items).join(" ");
    expect(text).not.toContain("resources/");
    expect(sanitizePublicText("voir resources/[jobs]/garage/server.lua")).not.toContain("garage/server.lua");
  });

  it("genere une section fichiers facon GitHub avec A/M et le total", () => {
    const section = buildFileChangeSection(source());
    expect(section.heading).toContain("Fichiers");
    expect(section.items.some((item) => item.startsWith("A `resources/[jobs]/garage/client.lua`"))).toBe(true);
    expect(section.items.some((item) => item.startsWith("M `resources/[jobs]/garage/server.lua`"))).toBe(true);
    expect(section.items.at(-1)).toContain("+25 / -3");
  });

  it("inclut les fichiers, les tests et les commandes dans les notes internes", () => {
    const sections = buildInternalSections(source());
    const headings = sections.map((section) => section.heading);
    expect(headings).toContain("📁 Fichiers modifies");
    expect(headings).toContain("Tests et deploiement");
    expect(headings).toContain("Commandes console");
    expect(headings).toContain("Resume du developpeur");
  });

  it("fait un aller-retour markdown -> sections", () => {
    const markdown = renderSections([
      { heading: "🆕 Nouveautes", items: ["Garage"] },
      { heading: "🔧 Corrections", items: ["Menu noir"] },
    ]);
    const parsed = parseSections(markdown);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]!.items).toEqual(["Garage"]);
  });
});
