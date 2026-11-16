/**
 * Acces centralise aux variables d'environnement.
 * Aucune valeur sensible n'est exposee cote client.
 */
import { z } from "zod";

const optionalString = z.string().trim().min(1).optional();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL est requis"),
  APP_ENCRYPTION_KEY: z.string().min(1, "APP_ENCRYPTION_KEY est requis (npm run secret:generate)"),
  APP_SECRET: z.string().min(16, "APP_SECRET doit contenir au moins 16 caracteres"),
  AUTH_SESSION_DAYS: z.coerce.number().int().positive().default(30),
  SEED_ADMIN_EMAIL: optionalString,
  SEED_ADMIN_USERNAME: optionalString,
  SEED_ADMIN_PASSWORD: optionalString,
  SEED_ADMIN_NAME: optionalString,
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(8),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  MAX_FILE_SIZE_KB: z.coerce.number().int().positive().default(2048),
  MAX_ATTACHMENT_SIZE_KB: z.coerce.number().int().positive().default(8192),
  SNAPSHOT_DIR: z.string().default("var/snapshots"),
  FILE_SYNC_INTERVAL_SECONDS: z.coerce.number().int().positive().default(180),
  AI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  AI_MODEL: z.string().default("gpt-4o-mini"),
  AI_API_KEY: optionalString,
  DEMO_MODE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuration invalide (.env):\n${details}`);
  }
  cached = parsed.data;
  return cached;
}

/** Version non bloquante, utile pour les pages qui doivent afficher un diagnostic. */
export function tryGetEnv(): { ok: true; env: AppEnv } | { ok: false; error: string } {
  try {
    return { ok: true, env: getEnv() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Configuration invalide" };
  }
}

export const isProduction = () => process.env.NODE_ENV === "production";
export const isDemoMode = () => process.env.DEMO_MODE === "true";
