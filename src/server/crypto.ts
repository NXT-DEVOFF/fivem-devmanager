/**
 * Chiffrement symetrique des secrets stockes en base (AES-256-GCM).
 *
 * Format de sortie : "v1:<iv base64>:<tag base64>:<ciphertext base64>"
 * La cle provient de APP_ENCRYPTION_KEY (32 octets en base64 ou hex).
 */
import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
let cachedKey: Buffer | null = null;

export class EncryptionError extends Error {}

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) throw new EncryptionError("APP_ENCRYPTION_KEY manquant");
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    key = Buffer.from(raw, "base64");
  }
  if (key.length !== 32) {
    throw new EncryptionError(
      "APP_ENCRYPTION_KEY invalide : 32 octets attendus (base64 ou hex). Generez-la avec npm run secret:generate.",
    );
  }
  cachedKey = key;
  return key;
}

export function encryptSecret(plaintext: string): string {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new EncryptionError("Valeur a chiffrer vide");
  }
  const key = loadKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptSecret(payload: string | null | undefined): string {
  if (!payload) throw new EncryptionError("Secret absent");
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new EncryptionError("Format de secret invalide");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const key = loadKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}

/** Dechiffrement tolerant : renvoie null au lieu de lever une exception. */
export function tryDecryptSecret(payload: string | null | undefined): string | null {
  try {
    return decryptSecret(payload);
  } catch {
    return null;
  }
}

/** Masque un secret pour l'affichage (jamais la valeur complete). */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Construit une cle de chiffrement (utilitaire CLI/tests). */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("base64");
}

export function generateAppSecret(): string {
  return crypto.randomBytes(48).toString("base64url");
}
