/**
 * Seed de DEMONSTRATION uniquement.
 * Refuse de s'executer si DEMO_MODE !== "true" ou si NODE_ENV === "production".
 * Les donnees creees sont explicitement identifiees (prefixe [DEMO]).
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { loadEnvFile } from "node:process";

try {
  loadEnvFile();
} catch {
  // Environnement fourni directement (Pterodactyl).
}

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("[demo] Refus : NODE_ENV=production. Utilisez un environnement de demonstration.");
    process.exit(1);
  }
  if (process.env.DEMO_MODE !== "true") {
    console.error("[demo] Refus : DEMO_MODE doit valoir true.");
    process.exit(1);
  }

  const passwordHash = await hash("DemoPassword123!", {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });

  const users = [
    { email: "lead@demo.local", username: "lead", displayName: "[DEMO] Camille Lead", role: "LEAD_DEV" },
    { email: "dev@demo.local", username: "dev", displayName: "[DEMO] Alex Dev", role: "DEVELOPER" },
    { email: "dev2@demo.local", username: "dev2", displayName: "[DEMO] Sam Dev", role: "DEVELOPER" },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      create: { ...user, passwordHash, avatarColor: "#5865F2", jobTitle: "Demonstration" },
      update: {},
    });
  }

  const lead = await prisma.user.findUnique({ where: { email: "lead@demo.local" } });
  const dev = await prisma.user.findUnique({ where: { email: "dev@demo.local" } });
  if (!lead || !dev) throw new Error("Comptes demo introuvables");

  const tasks = [
    {
      code: "DEV-9001",
      title: "[DEMO] Correction du systeme de garage",
      description: "Les vehicules ne sont pas sauvegardes a la deconnexion.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      category: "BUGFIX",
      resource: "[vehicles]/garage",
      files: ["/resources/[vehicles]/garage/client.lua", "/resources/[vehicles]/garage/server.lua"],
      assigneeId: dev.id,
    },
    {
      code: "DEV-9002",
      title: "[DEMO] Nouveau menu de concession",
      description: "Interface de concession avec categories.",
      status: "TODO",
      priority: "MEDIUM",
      category: "UI",
      resource: "[vehicles]/concession",
      assigneeId: dev.id,
    },
    {
      code: "DEV-9003",
      title: "[DEMO] Optimisation du chargement des vehicules",
      description: "Reduire les appels SQL au spawn.",
      status: "DONE",
      priority: "MEDIUM",
      category: "OPTIMIZATION",
      resource: "[vehicles]/garage",
      assigneeId: lead.id,
      completedAt: new Date(),
    },
  ];

  for (const task of tasks) {
    await prisma.task.upsert({
      where: { code: task.code },
      create: { ...task, creatorId: lead.id },
      update: {},
    });
  }

  await prisma.bug.upsert({
    where: { code: "BUG-9001" },
    create: {
      code: "BUG-9001",
      title: "[DEMO] Perte de la sauvegarde du vehicule",
      description: "Le vehicule disparait apres reconnexion.",
      severity: "HIGH",
      status: "FIXING",
      resource: "[vehicles]/garage",
      filePath: "/resources/[vehicles]/garage/server.lua",
      reporterId: lead.id,
      assigneeId: dev.id,
    },
    update: {},
  });

  console.log("[demo] Donnees de demonstration creees. Mot de passe : DemoPassword123!");
}

main()
  .catch((error) => {
    console.error("[demo] echec:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
