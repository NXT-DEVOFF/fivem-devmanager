/**
 * Seed de production : cree uniquement le compte super administrateur initial
 * et les reglages par defaut. Aucune donnee de demonstration.
 *
 * Usage : SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import crypto from "node:crypto";
import { loadEnvFile } from "node:process";

// Le script est lance par `node` (pas par le CLI Prisma) : charger .env explicitement.
try {
  loadEnvFile();
} catch {
  // Pas de fichier .env : les variables doivent venir de l'environnement.
}

const prisma = new PrismaClient();

function fail(message) {
  console.error(`[seed] ${message}`);
  process.exit(1);
}

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const username = (process.env.SEED_ADMIN_USERNAME ?? "admin").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  const displayName = process.env.SEED_ADMIN_NAME ?? "Super Admin";

  if (!email) fail("SEED_ADMIN_EMAIL manquant");
  if (!password || password.length < 12) {
    fail("SEED_ADMIN_PASSWORD manquant ou trop court (12 caracteres minimum)");
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  if (existing) {
    console.log(`[seed] Un compte existe deja (${existing.email}) - aucune modification.`);
  } else {
    const passwordHash = await hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    });

    await prisma.user.create({
      data: {
        email,
        username,
        displayName,
        passwordHash,
        role: "SUPER_ADMIN",
        jobTitle: "Administrateur",
        avatarColor: "#5865F2",
      },
    });
    console.log(`[seed] Super administrateur cree : ${email}`);
  }

  const settingsKey = "app.settings";
  const settings = await prisma.appSetting.findUnique({ where: { key: settingsKey } });
  if (!settings) {
    await prisma.appSetting.create({
      data: {
        key: settingsKey,
        value: {
          serverName: "FiveM DevManager",
          gameVersion: "FXServer",
          currentVersion: "1.0.0",
          defaultIdleMinutes: 15,
          autoValidationEnabled: false,
          defaultSftpRoot: "/",
          timezone: "Europe/Paris",
        },
      },
    });
    console.log("[seed] Reglages par defaut crees.");
  }

  // Verification de la cle de chiffrement (indispensable au runtime).
  const key = process.env.APP_ENCRYPTION_KEY;
  if (!key) {
    console.warn("[seed] ATTENTION : APP_ENCRYPTION_KEY absent - les integrations chiffrees echoueront.");
  } else {
    const buffer = /^[0-9a-fA-F]{64}$/.test(key) ? Buffer.from(key, "hex") : Buffer.from(key, "base64");
    if (buffer.length !== 32) {
      fail("APP_ENCRYPTION_KEY invalide (32 octets attendus). Generez-la avec npm run secret:generate");
    }
    void crypto;
  }
}

main()
  .catch((error) => {
    console.error("[seed] echec:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
