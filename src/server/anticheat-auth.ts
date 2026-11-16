/** Authentification partagee des endpoints appeles par l'agent FiveM. */
import "server-only";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "@/server/crypto";
import { HttpError, unauthorized } from "@/server/http";

/**
 * Verifie le token Bearer d'ingestion. Le token vient uniquement de
 * l'environnement : il n'est jamais stocke en clair en base ni renvoye.
 */
export function assertAnticheatToken(request: NextRequest): void {
  const expected = process.env.ANTICHEAT_INGEST_TOKEN;
  if (!expected) {
    throw new HttpError(
      503,
      "Ingestion anticheat non configuree (ANTICHEAT_INGEST_TOKEN manquant)",
      "not_configured",
    );
  }

  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) {
    throw unauthorized("Token d'ingestion requis");
  }
  const provided = header.slice("Bearer ".length).trim();
  if (!provided || !timingSafeEqual(provided, expected)) {
    throw unauthorized("Token d'ingestion invalide");
  }
}
