import { z } from "zod";
import { api } from "@/server/api";
import { badRequest, json, parseJson, rateLimit, tooManyRequests } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { sendConsoleCommand } from "@/server/pterodactyl/actions";
import { consoleRelay } from "@/server/pterodactyl/console-relay";
import { resolvePterodactyl } from "@/server/integrations";
import { audit } from "@/server/audit";

const PREDEFINED = [
  {
    id: "server-status",
    label: "Etat du serveur",
    description: "Interroge l'API Pterodactyl (statut, CPU, RAM)",
    permission: "server.view" as const,
    mode: "api" as const,
  },
  {
    id: "resources-list",
    label: "Liste des ressources chargees",
    description: "Envoie la commande 'resources' a la console FiveM",
    permission: "server.console.send" as const,
    mode: "console" as const,
    command: "resources",
  },
  {
    id: "check-errors",
    label: "Verifier les erreurs recentes",
    description: "Filtre la console sur les erreurs des 600 dernieres lignes",
    permission: "server.console" as const,
    mode: "logs" as const,
  },
  {
    id: "check-logs",
    label: "Consulter les logs",
    description: "Affiche les dernieres lignes de la console",
    permission: "server.console" as const,
    mode: "logs" as const,
  },
  {
    id: "players",
    label: "Joueurs connectes",
    description: "Envoie la commande 'status' a la console",
    permission: "server.console.send" as const,
    mode: "console" as const,
    command: "status",
  },
  {
    id: "restart-garage",
    label: "Redemarrer une ressource",
    description: "Utilise 'ensure <ressource>' via la console",
    permission: "server.console.send" as const,
    mode: "resource" as const,
  },
];

export const GET = api(async () => {
  const user = await requirePermission("terminal.use");

  const history = await prisma.auditLog.findMany({
    where: { action: "server.command", actorId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, createdAt: true, metadata: true, result: true },
  });

  return json({
    commands: PREDEFINED.filter((command) => user.permissions[command.permission]),
    history: history.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt.toISOString(),
      command: (entry.metadata as { command?: string } | null)?.command ?? "",
      result: entry.result,
    })),
    console: consoleRelay.getStatus(),
  });
});

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("console"),
    command: z.string().trim().min(1).max(500),
  }),
  z.object({
    action: z.literal("resource"),
    resource: z.string().trim().min(1).max(120),
    mode: z.enum(["ensure", "restart", "stop", "start"]).default("ensure"),
  }),
  z.object({
    action: z.literal("predefined"),
    id: z.string().max(60),
  }),
  z.object({ action: z.literal("clear") }),
]);

export const POST = api(async (request) => {
  const user = await requirePermission("terminal.use");
  const body = await parseJson(request, schema);

  if (body.action === "clear") {
    return json({ ok: true, lines: [] });
  }

  // Le terminal est une surface sensible : limite les rafales de commandes.
  const limited = rateLimit(`terminal:${user.id}`, 20, 60_000);
  if (!limited.ok) {
    throw tooManyRequests(`Trop d'actions terminal. Reessayez dans ${limited.retryAfter} s.`);
  }

  if (body.action === "console") {
    if (!user.permissions["server.console.send"]) {
      return json({ error: "Permission server.console.send requise", code: "forbidden" }, { status: 403 });
    }
    await sendConsoleCommand(body.command, { actor: user.displayName, actorId: user.id });
    return json({ ok: true, output: `Commande envoyee : ${body.command}` });
  }

  if (body.action === "resource") {
    if (!user.permissions["server.console.send"]) {
      return json({ error: "Permission server.console.send requise", code: "forbidden" }, { status: 403 });
    }
    if (!/^[A-Za-z0-9_\-[\]/]{2,120}$/.test(body.resource) || body.resource.includes("..")) {
      throw badRequest("Nom de ressource invalide");
    }
    const command =
      body.mode === "ensure"
        ? `ensure ${body.resource}`
        : body.mode === "restart"
          ? `restart ${body.resource}`
          : body.mode === "stop"
            ? `stop ${body.resource}`
            : `start ${body.resource}`;
    await sendConsoleCommand(command, { actor: user.displayName, actorId: user.id });
    return json({ ok: true, output: `Commande envoyee : ${command}` });
  }

  const predefined = PREDEFINED.find((command) => command.id === body.id);
  if (!predefined) throw badRequest("Commande inconnue");
  if (!user.permissions[predefined.permission]) {
    return json({ error: "Permission insuffisante", code: "forbidden" }, { status: 403 });
  }

  if (predefined.mode === "api") {
    const { client } = await resolvePterodactyl();
    const resources = await client.getResources();
    return json({
      ok: true,
      output: [
        `Etat : ${resources.current_state}`,
        `CPU : ${resources.resources.cpu_absolute.toFixed(1)} %`,
        `RAM : ${Math.round(resources.resources.memory_bytes / 1024 / 1024)} Mo`,
        `Disque : ${Math.round(resources.resources.disk_bytes / 1024 / 1024)} Mo`,
        `Uptime : ${Math.round(resources.resources.uptime / 1000)} s`,
      ].join("\n"),
    });
  }

  if (predefined.mode === "console" && predefined.command) {
    await sendConsoleCommand(predefined.command, { actor: user.displayName, actorId: user.id });
    return json({ ok: true, output: `Commande envoyee : ${predefined.command}` });
  }

  // Mode logs : lecture du tampon serveur (jamais d'acces shell).
  const buffer = consoleRelay.getBuffer(600);
  const lines = buffer.filter((entry) => /error|exception|failed|failed to|crash/i.test(entry.line));
  const joined = (predefined.id === "check-errors" ? lines : buffer)
    .map((entry) => entry.line)
    .join("\n");
  const relayStatus = consoleRelay.getStatus();
  const output =
    joined ||
    (relayStatus.connected
      ? "Aucune ligne correspondante dans le tampon console."
      : `Console non connectee a Wings (${relayStatus.state})${relayStatus.lastError ? ` : ${relayStatus.lastError}` : ""}.`);

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "terminal.logs",
    targetType: "console",
    metadata: { commandId: predefined.id, lines: output.split("\n").length },
  });

  return json({ ok: true, output });
});
