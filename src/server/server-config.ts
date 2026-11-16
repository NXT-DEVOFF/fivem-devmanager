/**
 * Lecture du `server.cfg` FiveM via l'API Pterodactyl.
 * L'analyse elle-meme est pure et vit dans `src/lib/server-config`.
 */
import "server-only";
import { resolvePterodactyl } from "@/server/integrations";
import { DEFAULT_CONFIG_PATH, sanitizeConfigPath } from "@/lib/server-config";

const FALLBACK_PATHS = ["/server.cfg", "/cfg/server.cfg"];

/** Lit le fichier de configuration, avec repli sur les emplacements usuels. */
export async function readServerConfig(
  requestedPath: string,
): Promise<{ path: string; content: string }> {
  const { client } = await resolvePterodactyl();
  const sanitized = sanitizeConfigPath(requestedPath);
  const candidates = [sanitized, ...FALLBACK_PATHS.filter((path) => path !== sanitized)];

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const content = await client.readFile(candidate);
      return { path: candidate, content };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Aucun fichier de configuration trouve (${candidates.join(", ")})`);
}

export { DEFAULT_CONFIG_PATH };
