/**
 * Noms de ressources FiveM.
 *
 * Les dossiers sont organises en categories (`[car]/mon-script`) alors que les
 * dependances declarees dans un fxmanifest utilisent toujours le nom court
 * (`mon-script`). Toute comparaison doit donc passer par le nom court.
 */

export function normalizeResourceName(name: string): string {
  const trimmed = name.trim();
  const slash = trimmed.lastIndexOf("/");
  return (slash >= 0 ? trimmed.slice(slash + 1) : trimmed).toLowerCase();
}

/** Ressources fournies par FXServer : jamais considerees comme manquantes. */
const BUILTIN_RESOURCES = new Set([
  "spawnmanager",
  "sessionmanager",
  "mapmanager",
  "chat",
  "resources",
  "rconlog",
  "scoreboard",
  "playernames",
  "baseevents",
  "hardcap",
  "example-loadscreen",
  "fivem",
  "yarn",
]);

export function isBuiltinResource(name: string): boolean {
  const normalized = normalizeResourceName(name);
  return BUILTIN_RESOURCES.has(normalized) || normalized.startsWith("fivem-map-");
}
