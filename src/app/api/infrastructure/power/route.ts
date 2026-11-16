import { z } from "zod";
import { api } from "@/server/api";
import { json, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { performPowerAction } from "@/server/pterodactyl/actions";

const schema = z.object({
  signal: z.enum(["start", "stop", "restart", "kill"]),
});

export const POST = api(async (request) => {
  const actor = await requirePermission("server.power");
  const body = await parseJson(request, schema);

  await performPowerAction(body.signal, { actor: actor.displayName, actorId: actor.id });

  return json({ ok: true, signal: body.signal, at: new Date().toISOString() });
});
