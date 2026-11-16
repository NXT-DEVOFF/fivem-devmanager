import { file, result } from "../helpers";
import type {
  StudioCategoryId,
  StudioDiagnostic,
  StudioField,
  StudioFile,
  StudioInput,
  StudioStat,
  StudioTool,
} from "../types";

export interface BuiltModule {
  data: Record<string, unknown>;
  lua?: string;
  sql?: string;
  files?: StudioFile[];
  readme?: string;
  stats?: StudioStat[];
  diagnostics?: StudioDiagnostic[];
}

export interface ModuleSpec {
  slug: string;
  name: string;
  category: StudioCategoryId;
  description: string;
  icon: string;
  tags: string[];
  fields: StudioField[];
  build: (input: StudioInput) => BuiltModule;
}

function pascal(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function defaultReadme(spec: ModuleSpec, data: Record<string, unknown>): string {
  return `# ${spec.name}

${spec.description}

## Fichiers

- \`${spec.slug}.lua\` : configuration Lua.
- \`${spec.slug}.json\` : configuration complete.

## Integration

Copiez la configuration dans votre ressource, validez les coordonnees et les permissions
cote serveur. Ne faites jamais confiance aux valeurs envoyees par le client.

\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`
`;
}

/** Genere un outil complet a partir d'une configuration specifique. */
export function moduleTool(spec: ModuleSpec): StudioTool {
  return {
    slug: spec.slug,
    name: spec.name,
    category: spec.category,
    description: spec.description,
    icon: spec.icon,
    tags: spec.tags,
    fields: spec.fields,
    run: (input) => {
      const built = spec.build(input);
      const json = JSON.stringify(built.data, null, 2);
      const lua = `Config = Config or {}\nConfig.${pascal(spec.slug)} = ${json}\n\n${built.lua ?? ""}`;
      const files: StudioFile[] = [
        file(`${spec.slug}.lua`, lua, "lua"),
        file(`${spec.slug}.json`, json, "json"),
        ...(built.sql ? [file("schema.sql", built.sql, "sql")] : []),
        ...(built.files ?? []),
        file("README.md", built.readme ?? defaultReadme(spec, built.data), "markdown"),
      ];
      return result(
        `${spec.name} genere : ${Object.keys(built.data).length} section(s).`,
        files,
        { stats: built.stats, diagnostics: built.diagnostics },
      );
    },
  };
}

export function rows(input: StudioInput, name: string, columns: string[]) {
  return parseTableRows(input, name, columns);
}

function parseTableRows(input: StudioInput, name: string, columns: string[]) {
  const value = input[name];
  const text = value === undefined || value === null ? "" : String(value);
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const cells = line.split(",").map((cell) => cell.trim());
      const record: Record<string, string> = {};
      columns.forEach((column, index) => {
        record[column] = cells[index] ?? "";
      });
      return record;
    });
}

export function list(input: StudioInput, name: string, fallback = ""): string[] {
  const value = input[name];
  const text = value === undefined || value === null ? fallback : String(value);
  return text
    .split(/[,;\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function coordParts(value: string): { x: number; y: number; z: number } {
  const [x = 0, y = 0, z = 0] = value.split(",").map((part) => Number(part.trim()));
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    z: Number.isFinite(z) ? z : 0,
  };
}
