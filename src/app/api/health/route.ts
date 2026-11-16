import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tryGetEnv } from "@/lib/env";
import { getPterodactylConfig } from "@/server/integrations";
import { getSftpConfig } from "@/server/integrations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Endpoint public de sante (monitoring Pterodactyl / uptime).
 * Ne revele aucun secret, aucune donnee metier.
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

  const [pterodactyl, sftp] = await Promise.all([
    getPterodactylConfig().catch(() => null),
    getSftpConfig().catch(() => null),
  ]);

  const status = database && env.ok ? 200 : 503;

  return NextResponse.json(
    {
      status: status === 200 ? "ok" : "degraded",
      version: "1.0.0",
      uptimeSeconds: Math.round(process.uptime()),
      checks: {
        database,
        configuration: env.ok ? "ok" : "invalid",
        pterodactyl: pterodactyl ? "configured" : "not_configured",
        sftp: sftp ? "configured" : "not_configured",
      },
      responseMs: Date.now() - started,
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/** Les sondes de disponibilite n'ont pas besoin du corps JSON. */
export async function HEAD() {
  const response = await GET();
  return new Response(null, { status: response.status, headers: response.headers });
}
