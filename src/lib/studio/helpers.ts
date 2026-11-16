import type {
  StudioFile,
  StudioInput,
  StudioResult,
  StudioStat,
} from "./types";

export function str(input: StudioInput, name: string, fallback = ""): string {
  const value = input[name];
  if (value === undefined || value === null) return fallback;
  return typeof value === "string" ? value : String(value);
}

export function num(input: StudioInput, name: string, fallback: number): number {
  const value = input[name];
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function bool(input: StudioInput, name: string, fallback = false): boolean {
  const value = input[name];
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function safeSlug(value: string, fallback = "fivem_resource"): string {
  const cleaned = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return cleaned || fallback;
}

/** Identifiant SQL sur, sans prefixe numerique invalide. */
export function sqlIdentifier(value: string, fallback = "fivem_data"): string {
  const clean = safeSlug(value, fallback).replace(/[^a-z0-9_]/g, "_");
  const prefixed = /^[0-9]/.test(clean) ? `t_${clean}` : clean;
  return prefixed.slice(0, 64);
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Chaine Lua sure (guillemets doubles, echappements JSON compatibles). */
export function luaString(value: string): string {
  return JSON.stringify(value);
}

export function luaValue(value: string | number | boolean): string {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  if (typeof value === "boolean") return value ? "true" : "false";
  return luaString(value);
}

export function luaTable(record: Record<string, string | number | boolean>, indent = 2): string {
  const pad = " ".repeat(indent);
  return Object.entries(record)
    .map(([key, value]) => `${pad}${key} = ${luaValue(value)},`)
    .join("\n");
}

export function file(path: string, content: string, language?: string): StudioFile {
  return { path, content, language };
}

export function stat(label: string, value: string, tone: StudioStat["tone"] = "default"): StudioStat {
  return { label, value, tone };
}

export function result(
  summary: string,
  files: StudioFile[],
  extra: Omit<StudioResult, "summary" | "files"> = {},
): StudioResult {
  return { summary, files, ...extra };
}

/** Parse une ligne CSV en respectant les guillemets doubles. */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function csvRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#") && !line.startsWith("--"))
    .map(parseCsvLine);
}

/**
 * Lit un tableau CSV avec en-tete optionnel.
 * Les colonnes absentes sont completees par une chaine vide.
 */
export function parseTable(text: string, columns: string[]): Array<Record<string, string>> {
  const rows = csvRows(text);
  if (rows.length === 0) return [];
  const normalizedColumns = columns.map((column) => column.toLowerCase());
  const first = rows[0]!.map((cell) => cell.toLowerCase());
  const hasHeader = normalizedColumns.every((column, index) => first[index] === column);
  const data = hasHeader ? rows.slice(1) : rows;
  return data.map((row) => {
    const record: Record<string, string> = {};
    columns.forEach((column, index) => {
      record[column] = row[index]?.trim() ?? "";
    });
    return record;
  });
}

export function parseNumberList(text: string): number[] {
  return text
    .split(/[,;\s]+/)
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
}

export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function mdTable(headers: string[], rows: string[][]): string {
  const header = `| ${headers.join(" | ")} |`;
  const separator = `| ${headers.map(() => "---").join(" | ")} |`;
  return [header, separator, ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");
}

export function timestamp(): string {
  return new Date().toISOString();
}

export function coords(input: StudioInput, name = "coords", fallback = "0, 0, 0"): string {
  return str(input, name, fallback);
}

export function splitList(text: string): string[] {
  return text
    .split(/[,;\n]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
