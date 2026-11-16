import type {
  StudioCategory,
  StudioField,
  StudioInput,
  StudioInputValue,
  StudioToolSummary,
} from "./types";

export const STUDIO_CATEGORIES: StudioCategory[] = [
  {
    id: "vehicules",
    label: "Vehicules",
    description: "Handling, performance, tuning, concessions et debug de vehicules.",
    icon: "Car",
    accent: "primary",
  },
  {
    id: "mlo",
    label: "MLO & Mapping",
    description: "Pieces, portails, proxies, ymap, LODs et scaffolds de mapping.",
    icon: "Building2",
    accent: "info",
  },
  {
    id: "dev",
    label: "Developpement",
    description: "Manifests, commandes, SQL, NUI, locales et securite des ressources.",
    icon: "Code2",
    accent: "success",
  },
  {
    id: "serveur",
    label: "Serveur & Ops",
    description: "txAdmin, sauvegardes, performance, logs, reseau et sante serveur.",
    icon: "ServerCog",
    accent: "warning",
  },
  {
    id: "gameplay",
    label: "Gameplay & Economie",
    description: "Metiers, boutiques, loot, XP, logements, dispatch et quetes.",
    icon: "Gamepad2",
    accent: "danger",
  },
];

export function defaultStudioInput(tool: Pick<StudioToolSummary, "fields">): StudioInput {
  const values: StudioInput = {};
  for (const field of tool.fields) {
    if (field.default !== undefined) values[field.name] = field.default;
  }
  return values;
}

export function defaultFieldValue(field: StudioField): StudioInputValue {
  if (field.default !== undefined) return field.default;
  if (field.type === "switch") return false;
  if (field.type === "number") return field.min ?? 0;
  if (field.type === "select") return field.options?.[0]?.value ?? "";
  return "";
}

export function studioCategory(id: StudioCategory["id"]): StudioCategory {
  return STUDIO_CATEGORIES.find((category) => category.id === id) ?? STUDIO_CATEGORIES[0]!;
}

export function countStudioTools(
  tools: ReadonlyArray<Pick<StudioToolSummary, "category">>,
): Record<string, number> {
  return tools.reduce<Record<string, number>>((counts, tool) => {
    counts[tool.category] = (counts[tool.category] ?? 0) + 1;
    return counts;
  }, {});
}
