import { api } from "@/server/api";
import { json } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { consoleRelay } from "@/server/pterodactyl/console-relay";
import { detectBugsFromConsole } from "@/server/bug-detector";
import { audit } from "@/server/audit";

/**
 * Analyse a la demande du tampon console (les lignes deja recues par le
 * relais Wings). La detection tourne aussi automatiquement en arriere-plan.
 */
export const POST = api(async () => {
  const user = await requirePermission("bugs.create");
  const entries = consoleRelay.getBuffer(600);
  const result = await detectBugsFromConsole(entries, { maxPerRun: 20 });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "bug.scan",
    targetType: "console",
    metadata: result,
  });

  return json(result);
});
