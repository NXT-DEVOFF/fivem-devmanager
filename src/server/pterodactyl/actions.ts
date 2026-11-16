/** Actions serveur de haut niveau (alimentation, commandes) avec audit. */
import "server-only";
import { resolvePterodactyl } from "@/server/integrations";
import { audit } from "@/server/audit";
import { emitActivity } from "@/server/realtime";
import { HttpError } from "@/server/http";

export async function sendConsoleCommand(
  command: string,
  context: { actor: string; actorId?: string | null },
): Promise<void> {
  const trimmed = command.trim();
  if (!trimmed) throw new HttpError(400, "Commande vide");
  if (trimmed.length > 500) throw new HttpError(400, "Commande trop longue");
  if (/[\r\n]/.test(trimmed)) throw new HttpError(400, "Commande sur plusieurs lignes refusee");

  const { client } = await resolvePterodactyl();
  await client.sendCommand(trimmed);

  await audit({
    actorId: context.actorId ?? null,
    actorLabel: context.actor,
    action: "server.command",
    targetType: "pterodactyl",
    metadata: { command: trimmed },
  });

  emitActivity({
    type: "server.status",
    title: "Commande console envoyee",
    detail: trimmed,
    actor: { id: context.actorId ?? "system", name: context.actor },
    timestamp: new Date().toISOString(),
  });
}

export async function performPowerAction(
  signal: "start" | "stop" | "restart" | "kill",
  context: { actor: string; actorId?: string | null },
): Promise<void> {
  const { client } = await resolvePterodactyl();
  await client.sendPower(signal);

  await audit({
    actorId: context.actorId ?? null,
    actorLabel: context.actor,
    action: "server.power",
    targetType: "pterodactyl",
    metadata: { signal },
  });

  emitActivity({
    type: "server.status",
    title: `Serveur : ${signal === "start" ? "demarrage" : signal === "stop" ? "arret" : signal === "restart" ? "redemarrage" : "arret force"}`,
    actor: { id: context.actorId ?? "system", name: context.actor },
    timestamp: new Date().toISOString(),
  });
}
