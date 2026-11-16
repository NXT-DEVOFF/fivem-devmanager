import { z } from "zod";
import { api } from "@/server/api";
import { json, parseJson, rateLimit, tooManyRequests } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { sendConsoleCommand } from "@/server/pterodactyl/actions";

const schema = z.object({
  command: z.string().trim().min(1).max(500),
});

export const POST = api(async (request) => {
  const actor = await requirePermission("server.console.send");
  const body = await parseJson(request, schema);

  // Protege le serveur contre une rafale de commandes (double-clic, script).
  const limited = rateLimit(`console:${actor.id}`, 10, 10_000);
  if (!limited.ok) {
    throw tooManyRequests(`Trop de commandes console. Reessayez dans ${limited.retryAfter} s.`);
  }

  await sendConsoleCommand(body.command, { actor: actor.displayName, actorId: actor.id });

  return json({ ok: true, command: body.command });
});
