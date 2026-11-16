import { api } from "@/server/api";
import { json } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { consoleRelay } from "@/server/pterodactyl/console-relay";

/** Force une nouvelle connexion WebSocket vers Wings. */
export const POST = api(async () => {
  await requirePermission("server.console");

  try {
    await consoleRelay.reconnect();
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Reconnexion console impossible",
        status: consoleRelay.getStatus(),
      },
      { status: 502 },
    );
  }

  return json({ ok: true, status: consoleRelay.getStatus() });
});
