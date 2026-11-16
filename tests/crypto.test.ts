import { beforeAll, describe, expect, it } from "vitest";

let encryptSecret: typeof import("@/server/crypto").encryptSecret;
let decryptSecret: typeof import("@/server/crypto").decryptSecret;
let maskSecret: typeof import("@/server/crypto").maskSecret;
let EncryptionError: typeof import("@/server/crypto").EncryptionError;
let generateEncryptionKey: typeof import("@/server/crypto").generateEncryptionKey;

beforeAll(async () => {
  process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  const crypto = await import("@/server/crypto");
  encryptSecret = crypto.encryptSecret;
  decryptSecret = crypto.decryptSecret;
  maskSecret = crypto.maskSecret;
  EncryptionError = crypto.EncryptionError;
  generateEncryptionKey = crypto.generateEncryptionKey;
});

describe("crypto", () => {
  it("chiffre et dechiffre un secret", () => {
    const plaintext = "ptlc_secret_api_key_123456789";
    const ciphertext = encryptSecret(plaintext);
    expect(ciphertext).not.toContain(plaintext);
    expect(ciphertext.startsWith("v1:")).toBe(true);
    expect(decryptSecret(ciphertext)).toBe(plaintext);
  });

  it("produit un chiffre different pour le meme secret (IV aleatoire)", () => {
    const a = encryptSecret("valeur");
    const b = encryptSecret("valeur");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("valeur");
    expect(decryptSecret(b)).toBe("valeur");
  });

  it("rejette une valeur alteree (tag GCM)", () => {
    const ciphertext = encryptSecret("secret");
    const parts = ciphertext.split(":");
    parts[3] = Buffer.from("contenu modifie").toString("base64");
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });

  it("rejette un format invalide", () => {
    expect(() => decryptSecret("nimportequoi")).toThrow(EncryptionError);
  });

  it("masque une valeur", () => {
    const masked = maskSecret("ptlc_abcdefghijklmnop");
    expect(masked).toContain("••••");
    expect(masked).not.toContain("abcdefghijklmnop");
  });

  it("genere une cle valide de 32 octets", () => {
    const key = generateEncryptionKey();
    expect(Buffer.from(key, "base64").length).toBe(32);
  });
});
