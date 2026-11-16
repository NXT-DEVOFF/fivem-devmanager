/**
 * Serveur HTTP custom : Next.js + Socket.IO.
 *
 * - Port fourni par PORT (jamais code en dur)
 * - Arret gracieux sur SIGTERM/SIGINT (Pterodactyl envoie SIGTERM)
 * - Le serveur Socket.IO est installe par Next (instrumentation.ts) via
 *   globalThis.__fdmInstallIo, ce qui permet de reutiliser le code TypeScript.
 */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import next from "next";
import { Server as SocketServer } from "socket.io";

// `npm run dev` passe --dev ; `npm run start` force la production.
const dev = process.argv.includes("--dev");
process.env.NODE_ENV = dev ? "development" : "production";
const port = Number(process.env.PORT || process.env.SERVER_PORT || 3000);
const hostname = process.env.HOST || "0.0.0.0";

if (!Number.isFinite(port) || port <= 0) {
  console.error("[server] PORT invalide:", process.env.PORT);
  process.exit(1);
}

// Identifiant de demarrage utile dans les logs Pterodactyl.
console.log(`[server] demarrage (${dev ? "dev" : "production"}) sur ${hostname}:${port} (pid ${process.pid})`);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

let httpServer;
let io;

async function installRealtime() {
  // L'installateur est expose par src/instrumentation.ts au chargement de Next.
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (typeof globalThis.__fdmInstallIo === "function") {
      globalThis.__fdmIo = io;
      try {
        globalThis.__fdmInstallIo(io);
        console.log("[server] temps reel Socket.IO installe");
        return;
      } catch (error) {
        console.error("[server] installation Socket.IO impossible:", error);
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  console.warn(
    "[server] installateur Socket.IO introuvable : le temps reel est desactive (verifiez instrumentation.ts)",
  );
}

async function main() {
  await app.prepare();

  httpServer = createServer((req, res) => {
    // En-tete de tracage (utile derriere un reverse proxy).
    res.setHeader("X-Request-Id", randomUUID());
    handle(req, res);
  });

  io = new SocketServer(httpServer, {
    path: "/socket.io",
    serveClient: false,
    maxHttpBufferSize: 1_000_000,
    pingInterval: 25_000,
    pingTimeout: 20_000,
    cors: { origin: false },
  });

  await installRealtime();

  httpServer.listen(port, hostname, () => {
    console.log(`[server] pret sur http://${hostname}:${port}`);
  });

  httpServer.on("error", (error) => {
    console.error("[server] erreur d'ecoute:", error);
    process.exit(1);
  });
}

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] signal ${signal} recu, arret gracieux...`);

  const force = setTimeout(() => {
    console.error("[server] arret force apres 20s");
    process.exit(1);
  }, 20_000);
  force.unref();

  try {
    if (io) {
      await new Promise((resolve) => io.close(resolve));
    }
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
    // Les connexions a la base sont fermees par la fin du processus.
    clearTimeout(force);
    process.exit(0);
  } catch (error) {
    console.error("[server] erreur pendant l'arret:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("[server] promesse rejetee non geree:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[server] exception non geree:", error);
});

main().catch((error) => {
  console.error("[server] demarrage impossible:", error);
  process.exit(1);
});
