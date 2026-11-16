/**
 * Couche temps reel (Socket.IO).
 *
 * Le serveur Socket.IO est attache au serveur HTTP custom (server.mjs) et
 * expose via globalThis pour que les Route Handlers puissent emettre.
 * L'authentification se fait avec le cookie de session HttpOnly ; aucune
 * emission n'est acceptee depuis le client sans controle serveur.
 */
import type { Server as SocketServer, Socket } from "socket.io";
import { resolvePermissions, hasPermission } from "@/server/permissions";
import { toStringArray } from "@/lib/json-array";
import { SESSION_COOKIE, findAuthSession } from "@/server/session-store";
import { rateLimit } from "@/server/http";

const globalForIo = globalThis as unknown as { __fdmIo?: SocketServer };

export interface RealtimeEvent {
  type:
    | "session.started"
    | "session.ended"
    | "session.paused"
    | "session.resumed"
    | "file.changed"
    | "resource.added"
    | "task.completed"
    | "bug.reported"
    | "incident.reported"
    | "incident.mitigated"
    | "incident.resolved"
    | "deployment.done"
    | "notification.created"
    | "notification.read"
    | "console.line"
    | "console.status"
    | "console.stats"
    | "server.status";
  title: string;
  detail?: string;
  actor?: { id: string; name: string } | null;
  link?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export function setIo(io: SocketServer): void {
  globalForIo.__fdmIo = io;
}

export function getIo(): SocketServer | null {
  return globalForIo.__fdmIo ?? null;
}

/** Diffuse un evenement d'activite a tous les clients authentifies. */
export function emitActivity(event: RealtimeEvent): void {
  const io = getIo();
  if (!io) return; // SSR / build : pas de serveur temps reel, pas d'erreur.
  io.to("activity").emit("activity", event);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  const io = getIo();
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

export function emitToPermission(permission: string, event: string, payload: unknown): void {
  const io = getIo();
  if (!io) return;
  io.to(`perm:${permission}`).emit(event, payload);
}

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

interface SocketAuthUser {
  id: string;
  displayName: string;
  role: Parameters<typeof resolvePermissions>[0]["role"];
  permissionsGranted: string[] | null;
  permissionsDenied: string[] | null;
}

export function installSocketServer(io: SocketServer): void {
  setIo(io);

  io.use(async (socket, next) => {
    try {
      const token = parseCookie(socket.handshake.headers.cookie, SESSION_COOKIE);
      if (!token) return next(new Error("unauthenticated"));

      const session = await findAuthSession(token);
      if (!session) return next(new Error("unauthenticated"));

      const user: SocketAuthUser = {
        id: session.user.id,
        displayName: session.user.displayName,
        role: session.user.role,
        permissionsGranted: toStringArray(session.user.permissionsGranted),
        permissionsDenied: toStringArray(session.user.permissionsDenied),
      };
      (socket.data as { user?: SocketAuthUser }).user = user;
      next();
    } catch (error) {
      console.error("[socket] auth error", error);
      next(new Error("unauthenticated"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket.data as { user?: SocketAuthUser }).user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    socket.join(`user:${user.id}`);
    socket.join("activity");

    const permissionMap = resolvePermissions(user);
    for (const [permission, allowed] of Object.entries(permissionMap)) {
      if (allowed) socket.join(`perm:${permission}`);
    }

    socket.emit("ready", { userId: user.id, at: new Date().toISOString() });

    // Abonnement a la console : permission verifiee cote serveur.
    socket.on("console:subscribe", async () => {
      if (!hasPermission(user, "server.console")) {
        socket.emit("console:error", { message: "Permission insuffisante" });
        return;
      }
      const { consoleRelay } = await import("@/server/pterodactyl/console-relay");
      await consoleRelay.subscribe(io, socket);
    });

    socket.on("console:unsubscribe", async () => {
      const { consoleRelay } = await import("@/server/pterodactyl/console-relay");
      consoleRelay.unsubscribe(socket.id);
    });

    socket.on("console:command", async (payload: { command?: string }) => {
      if (!hasPermission(user, "server.console.send")) {
        socket.emit("console:error", { message: "Permission insuffisante" });
        return;
      }
      const command = typeof payload?.command === "string" ? payload.command.trim() : "";
      if (!command || command.length > 500) {
        socket.emit("console:error", { message: "Commande invalide" });
        return;
      }
      const limited = rateLimit(`console:${user.id}`, 10, 10_000);
      if (!limited.ok) {
        socket.emit("console:error", {
          message: `Trop de commandes console. Reessayez dans ${limited.retryAfter} s.`,
        });
        return;
      }
      try {
        const { sendConsoleCommand } = await import("@/server/pterodactyl/actions");
        await sendConsoleCommand(command, { actor: user.displayName, actorId: user.id });
        socket.emit("console:sent", { command, at: new Date().toISOString() });
      } catch (error) {
        socket.emit("console:error", {
          message: error instanceof Error ? error.message : "Echec de l'envoi",
        });
      }
    });

    socket.on("disconnect", async () => {
      const { consoleRelay } = await import("@/server/pterodactyl/console-relay");
      consoleRelay.unsubscribe(socket.id);
    });
  });
}
