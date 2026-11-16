/**
 * Initialisation serveur chargee par Next.js.
 *
 * - Expose l'installateur Socket.IO consomme par server.mjs
 * - Demarre les taches de fond (inactivite, publications planifiees, sync)
 *
 * Ce fichier ne s'execute que dans le runtime Node et jamais pendant le build.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const globalStore = globalThis as unknown as {
    __fdmInstallIo?: (io: unknown) => void;
    __fdmWorkersStarted?: boolean;
    __fdmIo?: unknown;
  };

  try {
    const { installSocketServer } = await import("@/server/realtime");
    globalStore.__fdmInstallIo = (io) => {
      installSocketServer(io as Parameters<typeof installSocketServer>[0]);
    };
    // Si server.mjs a deja cree le serveur Socket.IO, on l'installe tout de suite.
    if (globalStore.__fdmIo) {
      globalStore.__fdmInstallIo(globalStore.__fdmIo);
    }
  } catch (error) {
    console.error("[instrumentation] Socket.IO indisponible:", error);
  }

  // Les taches de fond demarrent apres l'initialisation complete.
  setTimeout(async () => {
    try {
      const { startWorkers } = await import("@/server/workers");
      startWorkers();
    } catch (error) {
      console.error("[instrumentation] taches de fond indisponibles:", error);
    }
  }, 5_000).unref?.();
}
