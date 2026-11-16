export const FDM_THEME = "fdm-dark";

export function languageFromPath(path: string): string {
  if (path.endsWith(".lua") || path.endsWith(".fxmanifest")) return "lua";
  if (path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".js")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".sql")) return "sql";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".yml") || path.endsWith(".yaml")) return "yaml";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".xml")) return "xml";
  if (path.endsWith(".cfg")) return "ini";
  return "plaintext";
}
