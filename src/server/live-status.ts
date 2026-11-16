/**
 * Etat temps reel agrege : panel Pterodactyl, flux Wings et SFTP.
 *
 * Plusieurs modules interrogent le meme etat (en-tete, dashboard, console,
 * terminal). Le resultat est mis en cache quelques secondes pour eviter de
 * marteler l'API du panel a chaque sondage.
 */
import "server-only";
import { consoleRelay } from "@/server/pterodactyl/console-relay";
import { getPterodactylConfig, getSftpConfig, resolvePterodactyl } from "@/server/integrations";
import type { LiveStatus } from "@/lib/live-status";

const CACHE_MS = 8_000;

let cache: { value: LiveStatus; expires: number } | null = null;

export async function getLiveStatus(force = false): Promise<LiveStatus> {
  if (!force && cache && cache.expires > Date.now()) return cache.value;

  const wings = consoleRelay.getStatus();
  const panel: LiveStatus["panel"] = {
    configured: false,
    reachable: false,
    state: null,
    error: null,
    serverName: null,
  };

  try {
    const config = await getPterodactylConfig();
    if (!config) {
      panel.error = "Pterodactyl n'est pas configure";
    } else {
      panel.configured = true;
      panel.serverName = config.name;
      const { client } = await resolvePterodactyl();
      const resources = await client.getResources();
      panel.reachable = true;
      panel.state = resources.current_state ?? null;
    }
  } catch (error) {
    panel.error = error instanceof Error ? error.message : "Panel injoignable";
  }

  let sftpConfigured = false;
  try {
    sftpConfigured = Boolean(await getSftpConfig());
  } catch {
    sftpConfigured = false;
  }

  const value: LiveStatus = {
    at: new Date().toISOString(),
    panel,
    wings: {
      state: wings.state,
      connected: wings.connected,
      subscribers: wings.subscribers,
      host: wings.host,
      lastError: wings.lastError,
    },
    sftp: { configured: sftpConfigured },
  };

  cache = { value, expires: Date.now() + CACHE_MS };
  return value;
}
