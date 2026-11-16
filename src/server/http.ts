/**
 * Helpers HTTP pour les Route Handlers Next.js.
 * - Reponses JSON homogenes + identifiant de requete
 * - Validation Zod
 * - Verification d'origine (CSRF)
 * - Erreurs applicatives typees et erreurs Prisma normalisees
 */
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, type ZodSchema } from "zod";

export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, message: string, code = "error", details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, message, "bad_request", details);
export const unauthorized = (message = "Authentification requise") =>
  new HttpError(401, message, "unauthorized");
export const forbidden = (message = "Acces refuse") => new HttpError(403, message, "forbidden");
export const notFound = (message = "Ressource introuvable") => new HttpError(404, message, "not_found");
export const conflict = (message: string) => new HttpError(409, message, "conflict");
export const tooManyRequests = (message = "Trop de requetes") =>
  new HttpError(429, message, "rate_limited");
export const upstream = (message: string, details?: unknown) =>
  new HttpError(502, message, "upstream_error", details);

function responseHeaders(requestId: string): Headers {
  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Request-Id", requestId);
  return headers;
}

export function json<T>(data: T, init?: ResponseInit | number) {
  const options: ResponseInit = typeof init === "number" ? { status: init } : (init ?? {});
  const headers = new Headers(options.headers);
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  if (!headers.has("X-Request-Id")) headers.set("X-Request-Id", randomUUID());
  return NextResponse.json(data, { ...options, headers });
}

function errorResponse(
  status: number,
  requestId: string,
  error: string,
  code: string,
  details: unknown = null,
) {
  return NextResponse.json(
    { error, code, details, requestId },
    { status, headers: responseHeaders(requestId) },
  );
}

export function jsonError(error: unknown) {
  const requestId = randomUUID();

  if (error instanceof HttpError) {
    return errorResponse(error.status, requestId, error.message, error.code, error.details ?? null);
  }

  if (error instanceof ZodError) {
    return errorResponse(
      400,
      requestId,
      "Donnees invalides",
      "validation_error",
      error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return errorResponse(409, requestId, "Cette valeur existe deja", "conflict");
    }
    if (error.code === "P2025") {
      return errorResponse(404, requestId, "Element introuvable", "not_found");
    }
    if (error.code === "P2003") {
      return errorResponse(409, requestId, "Reference liee invalide", "conflict");
    }
    console.error(`[api:${requestId}] erreur Prisma ${error.code}`);
    return errorResponse(500, requestId, "Erreur base de donnees", "database_error");
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return errorResponse(400, requestId, "Requete base de donnees invalide", "database_validation_error");
  }

  // Les erreurs inattendues sont journalisees cote serveur, jamais renvoyees brutes.
  console.error(`[api:${requestId}] erreur inattendue:`, error);
  return errorResponse(500, requestId, "Erreur interne du serveur", "internal_error");
}

/** Valide un parametre de date ISO (un 500 Prisma serait sinon renvoye). */
export function parseDateParam(value: string | null, label: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`Parametre ${label} invalide (date ISO attendue)`);
  }
  return date;
}

export async function parseJson<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw badRequest("Corps JSON invalide");
  }
  return schema.parse(raw);
}

/**
 * Protection CSRF : verifie que les requetes mutantes proviennent de la meme origine.
 * Les cookies sont SameSite=Lax, mais cette verification bloque les requetes
 * cross-origin forgees (formulaires, fetch depuis un autre site).
 */
export function assertSameOrigin(request: NextRequest | Request): void {
  const method = request.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return;

  // Bloque les requetes emises depuis un autre site, meme quand le navigateur
  // n'envoie pas d'en-tete Origin (formulaires, anciens clients).
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw forbidden("Requete intersite refusee (CSRF)");
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  const allowed = new Set<string>();
  if (host) {
    allowed.add(`http://${host}`);
    allowed.add(`https://${host}`);
  }
  const appUrl = process.env.APP_URL;
  if (appUrl) allowed.add(appUrl.replace(/\/$/, ""));

  let refererOrigin: string | null = null;
  if (referer) {
    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      throw forbidden("Referer invalide (CSRF)");
    }
  }

  const candidate = origin ?? refererOrigin;
  if (!candidate) {
    // Pas d'en-tete d'origine : requete non-navigateur (ex. CLI). On exige
    // un cookie de session valide, ce qui est deja verifie en amont.
    return;
  }
  if (!allowed.has(candidate.replace(/\/$/, ""))) {
    throw forbidden("Origine de la requete non autorisee (CSRF)");
  }
}

/** Extraction d'une IP fiable (derriere reverse proxy Pterodactyl/Nginx). */
export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim().slice(0, 64);
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim().slice(0, 64);
  return null;
}

export function getUserAgent(request: Request): string | null {
  return request.headers.get("user-agent")?.slice(0, 500) ?? null;
}

/** Rate limiter en memoire (par processus). Suffisant pour un deploiement mono-instance. */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function pruneBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function ensureCapacity(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  pruneBuckets(now);
  while (buckets.size >= MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (!oldest) break;
    buckets.delete(oldest);
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    ensureCapacity(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

/** Nettoyage periodique pour eviter une fuite memoire. */
if (typeof setInterval === "function") {
  const timer = setInterval(() => pruneBuckets(Date.now()), 60_000);
  timer.unref?.();
}
