import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tryGetEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Readiness : le processus peut-il servir du trafic métier ?
 * Contrairement à `/api/health` (liveness), une intégration Pterodactyl
 * absente n'empêche pas d'être prêt : elle est optionnelle pour le coeur.
 */
export async function GET() {
  const started = Date.now();
  const env = tryGetEnv();
  let database = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }

  const ready = env.ok && database;

  return NextResponse.json(
    {
      status: ready ? "ready" : "not_ready",
      ready,
      version: "1.0.0",
      uptimeSeconds: Math.round(process.uptime()),
      checks: {
        database,
        configuration: env.ok ? "ok" : "invalid",
      },
      responseMs: Date.now() - started,
    },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function HEAD() {
  const response = await GET();
  return new Response(null, { status: response.status, headers: response.headers });
}
