import type { StudioInput, StudioTool, StudioToolSummary } from "./types";
import { countStudioTools } from "./catalog";
import { vehicleTools } from "./tools/vehicles";
import { mloTools } from "./tools/mlo";
import { devTools } from "./tools/dev";
import { opsTools } from "./tools/ops";
import { gameplayTools } from "./tools/gameplay";
import { vehicleExtraTools } from "./tools/vehicles-extra";
import { mloExtraTools } from "./tools/mlo-extra";
import { devExtraTools } from "./tools/dev-extra";
import { opsExtraTools } from "./tools/ops-extra";
import { gameplayExtraTools } from "./tools/gameplay-extra";
import { vehicleAdvancedTools } from "./tools/vehicles-advanced";
import { mloAdvancedTools } from "./tools/mlo-advanced";
import { devAdvancedTools } from "./tools/dev-advanced";
import { opsAdvancedTools } from "./tools/ops-advanced";
import { gameplayAdvancedTools } from "./tools/gameplay-advanced";

export {
  STUDIO_CATEGORIES,
  defaultFieldValue,
  defaultStudioInput,
  studioCategory,
} from "./catalog";

export const STUDIO_TOOLS: StudioTool[] = [
  ...vehicleTools,
  ...mloTools,
  ...devTools,
  ...opsTools,
  ...gameplayTools,
  ...vehicleExtraTools,
  ...mloExtraTools,
  ...devExtraTools,
  ...opsExtraTools,
  ...gameplayExtraTools,
  ...vehicleAdvancedTools,
  ...mloAdvancedTools,
  ...devAdvancedTools,
  ...opsAdvancedTools,
  ...gameplayAdvancedTools,
];

const TOOL_MAP = new Map(STUDIO_TOOLS.map((tool) => [tool.slug, tool]));

export function getStudioTool(slug: string): StudioTool | undefined {
  return TOOL_MAP.get(slug);
}

export function studioToolSummary(tool: StudioTool): StudioToolSummary {
  return {
    slug: tool.slug,
    name: tool.name,
    category: tool.category,
    description: tool.description,
    icon: tool.icon,
    tags: tool.tags,
    fields: tool.fields,
  };
}

export function validateStudioInput(
  tool: StudioTool,
  raw: Record<string, unknown>,
): { ok: true; values: StudioInput } | { ok: false; errors: string[] } {
  const values: StudioInput = {};
  const errors: string[] = [];

  for (const field of tool.fields) {
    const provided = raw[field.name];

    if (field.type === "switch") {
      values[field.name] =
        typeof provided === "boolean"
          ? provided
          : provided === "true"
            ? true
            : provided === "false"
              ? false
              : field.default === true;
      continue;
    }

    if (field.type === "number") {
      const candidate =
        provided === undefined || provided === null || provided === ""
          ? field.default
          : Number(provided);
      if (candidate === undefined || !Number.isFinite(Number(candidate))) {
        errors.push(`${field.label} doit etre un nombre.`);
        continue;
      }
      const numeric = Number(candidate);
      if (field.min !== undefined && numeric < field.min) {
        errors.push(`${field.label} doit etre superieur ou egal a ${field.min}.`);
        continue;
      }
      if (field.max !== undefined && numeric > field.max) {
        errors.push(`${field.label} doit etre inferieur ou egal a ${field.max}.`);
        continue;
      }
      values[field.name] = numeric;
      continue;
    }

    const text =
      provided === undefined || provided === null
        ? field.default === undefined
          ? ""
          : String(field.default)
        : String(provided);
    if (field.required && text.trim().length === 0) {
      errors.push(`${field.label} est requis.`);
      continue;
    }
    if (field.type === "select" && field.options && !field.options.some((option) => option.value === text)) {
      errors.push(`${field.label} doit etre une valeur proposee.`);
      continue;
    }
    values[field.name] = text;
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, values };
}

export function studioToolCountByCategory(): Record<string, number> {
  return countStudioTools(STUDIO_TOOLS);
}
