import { api } from "@/server/api";
import { json } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { tryGetEnv } from "@/lib/env";
import {
  getPterodactylConfig,
  getSftpConfig,
  resolvePterodactyl,
} from "@/server/integrations";
import { consoleRelay } from "@/server/pterodactyl/console-relay";
import { isAiConfigured } from "@/server/ai";
import { formatBytes, relativeTime } from "@/lib/format";
import {
  diagnosticCounts,
  diagnosticScore,
  worstDiagnosticStatus,
  type DiagnosticCheck,
} from "@/lib/diagnostics";

const WEEK_MS = 7 * 24 * 60 * 60_000;

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Erreur inconnue";
}

/** Borne une promesse reseau pour que le diagnostic ne reste jamais bloque. */
async function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Delai depasse (${Math.round(ms / 1000)} s)`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const GET = api(async () => {
  await requirePermission("server.view");

  const checks: DiagnosticCheck[] = [];

  // ---------------------------------------------------------------------
  // Coeur applicatif
  // ---------------------------------------------------------------------
  const started = Date.now();
  let database = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
    checks.push({
      id: "database",
      label: "Base de donnees",
      group: "coeur",
      status: "ok",
      detail: `Requete executee en ${Date.now() - started} ms`,
    });
  } catch (error) {
    checks.push({
      id: "database",
      label: "Base de donnees",
      group: "coeur",
      status: "fail",
      detail: message(error),
      hint: "Verifiez DATABASE_URL et que la base MariaDB/MySQL est demarree.",
      fixHref: "/infrastructure",
    });
  }

  const env = tryGetEnv();
  checks.push({
    id: "configuration",
    label: "Configuration applicative",
    group: "coeur",
    status: env.ok ? "ok" : "fail",
    detail: env.ok ? "Toutes les variables obligatoires sont presentes" : env.error,
    hint: env.ok ? undefined : "Corrigez le fichier .env puis redemarrez l'application.",
    fixHref: "/infrastructure",
  });

  const consoleStatus = consoleRelay.getStatus();
  checks.push({
    id: "console",
    label: "Flux console Wings",
    group: "coeur",
    status: consoleStatus.connected ? "ok" : "warn",
    detail: consoleStatus.connected
      ? `Connecte (${consoleStatus.state})`
      : consoleStatus.lastError ?? `Etat ${consoleStatus.state} : aucune connexion active`,
    hint: consoleStatus.connected
      ? undefined
      : "Utilisez Reconnecter sur la console ; le worker retente ensuite chaque minute.",
    fixHref: "/console",
  });

  checks.push({
    id: "ai",
    label: "Generation IA",
    group: "coeur",
    status: isAiConfigured() ? "ok" : "warn",
    detail: isAiConfigured()
      ? "Cle IA presente : bilans et patch notes enrichis"
      : "Aucune cle IA : les rapports deterministes restent disponibles",
    hint: isAiConfigured() ? undefined : "Renseignez AI_API_KEY et AI_MODEL dans le .env ou le panel.",
    fixHref: "/assistant",
  });

  // Sans base, les controles metier ne peuvent pas s'executer.
  if (!database) {
    const score = diagnosticScore(checks);
    return json({
      generatedAt: new Date().toISOString(),
      score,
      overall: worstDiagnosticStatus(checks),
      counts: diagnosticCounts(checks),
      checks,
    });
  }

  // ---------------------------------------------------------------------
  // Integrations
  // ---------------------------------------------------------------------
  const pterodactyl = await getPterodactylConfig().catch(() => null);

  if (!pterodactyl) {
    checks.push({
      id: "pterodactyl",
      label: "Panel Pterodactyl",
      group: "integrations",
      status: "warn",
      detail: "Aucun panel configure",
      hint: "Renseignez l'URL du panel et les cles API pour piloter le serveur.",
      fixHref: "/infrastructure",
    });
    checks.push({
      id: "backups",
      label: "Sauvegardes",
      group: "integrations",
      status: "skip",
      detail: "Verification impossible sans panel Pterodactyl",
    });
  } else {
    try {
      const { client } = await resolvePterodactyl();
      const panelStarted = Date.now();
      const server = await within(client.getServer(), 10_000);
      const latency = Date.now() - panelStarted;

      checks.push({
        id: "pterodactyl",
        label: "Panel Pterodactyl",
        group: "integrations",
        status: "ok",
        detail: `${server.name} · ${server.status ?? "etat inconnu"} · ${latency} ms`,
        latencyMs: latency,
      });

      try {
        const backups = await within(client.listBackups(), 12_000);
        const successful = backups
          .filter((backup) => backup.is_successful)
          .sort(
            (a, b) =>
              new Date(b.completed_at ?? b.created_at).getTime() -
              new Date(a.completed_at ?? a.created_at).getTime(),
          );
        const latest = successful[0];
        if (!latest) {
          checks.push({
            id: "backups",
            label: "Sauvegardes",
            group: "integrations",
            status: "warn",
            detail: "Aucune sauvegarde terminee sur le serveur",
            hint: "Programmez une sauvegarde avant toute mise en production.",
            fixHref: "/backups",
          });
        } else {
          const date = latest.completed_at ?? latest.created_at;
          const age = Date.now() - new Date(date).getTime();
          checks.push({
            id: "backups",
            label: "Sauvegardes",
            group: "integrations",
            status: age > WEEK_MS ? "warn" : "ok",
            detail: `${latest.name} · ${formatBytes(latest.bytes)} · ${relativeTime(date)}`,
            hint: age > WEEK_MS ? "La derniere sauvegarde date de plus de 7 jours." : undefined,
            fixHref: "/backups",
          });
        }
      } catch (error) {
        checks.push({
          id: "backups",
          label: "Sauvegardes",
          group: "integrations",
          status: "warn",
          detail: `Liste indisponible : ${message(error)}`,
          fixHref: "/backups",
        });
      }
    } catch (error) {
      checks.push({
        id: "pterodactyl",
        label: "Panel Pterodactyl",
        group: "integrations",
        status: "fail",
        detail: message(error),
        hint: "Verifiez l'URL du panel et la cle API client.",
        fixHref: "/infrastructure",
      });
      checks.push({
        id: "backups",
        label: "Sauvegardes",
        group: "integrations",
        status: "skip",
        detail: "Verification impossible : panel injoignable",
      });
    }
  }

  const sftp = await getSftpConfig().catch(() => null);
  checks.push({
    id: "sftp",
    label: "Acces SFTP",
    group: "integrations",
    status: sftp ? "ok" : "warn",
    detail: sftp
      ? `${sftp.host}:${sftp.port} · racine ${sftp.remoteRoot || "/"}`
      : "Aucun acces SFTP configure",
    hint: sftp ? undefined : "Sans SFTP, l'editeur et l'analyse des ressources sont limites.",
    fixHref: "/infrastructure",
  });

  // ---------------------------------------------------------------------
  // Activite et qualite (requetes independantes, chacune tolerante a l'echec)
  // ---------------------------------------------------------------------
  const since = new Date(Date.now() - WEEK_MS);
  const [failedDeployments, pendingDeployments, staleSessions, missingReports, overdueTasks, webhooks] =
    await Promise.all([
      prisma.deployment.count({ where: { status: "FAILED", createdAt: { gte: since } } }).catch(() => -1),
      prisma.deployment.count({ where: { status: "PENDING" } }).catch(() => -1),
      prisma.devSession
        .count({
          where: {
            status: "ACTIVE",
            lastActivityAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) },
          },
        })
        .catch(() => -1),
      prisma.devSession
        .count({
          where: {
            status: "COMPLETED",
            endedAt: { lt: new Date(Date.now() - 5 * 60_000) },
            report: { is: null },
          },
        })
        .catch(() => -1),
      prisma.task
        .count({ where: { dueDate: { lt: new Date() }, status: { notIn: ["DONE"] } } })
        .catch(() => -1),
      prisma.discordWebhook.count({ where: { enabled: true } }).catch(() => -1),
    ]);

  checks.push({
    id: "failed-deployments",
    label: "Deploiements en echec",
    group: "activite",
    status: failedDeployments < 0 ? "skip" : failedDeployments > 0 ? "fail" : "ok",
    detail:
      failedDeployments < 0
        ? "Comptage indisponible"
        : failedDeployments === 0
          ? "Aucun echec sur les 7 derniers jours"
          : `${failedDeployments} deploiement(s) en echec sur 7 jours`,
    fixHref: "/deployments",
  });

  checks.push({
    id: "pending-deployments",
    label: "Approbations en attente",
    group: "activite",
    status: pendingDeployments < 0 ? "skip" : pendingDeployments > 0 ? "warn" : "ok",
    detail:
      pendingDeployments < 0
        ? "Comptage indisponible"
        : pendingDeployments === 0
          ? "Aucune demande en attente"
          : `${pendingDeployments} demande(s) a valider`,
    fixHref: "/deployments",
  });

  checks.push({
    id: "stale-sessions",
    label: "Sessions bloquees",
    group: "activite",
    status: staleSessions < 0 ? "skip" : staleSessions > 0 ? "warn" : "ok",
    detail:
      staleSessions < 0
        ? "Comptage indisponible"
        : staleSessions === 0
          ? "Toutes les sessions actives sont recentes"
          : `${staleSessions} session(s) active(s) sans activite depuis 24 h`,
    fixHref: "/sessions",
  });

  checks.push({
    id: "missing-reports",
    label: "Rapports manquants",
    group: "activite",
    status: missingReports < 0 ? "skip" : missingReports > 0 ? "warn" : "ok",
    detail:
      missingReports < 0
        ? "Comptage indisponible"
        : missingReports === 0
          ? "Chaque session terminee a son rapport"
          : `${missingReports} session(s) terminee(s) sans rapport`,
    hint: missingReports > 0 ? "Le worker de rattrapage repare cela sous 10 minutes." : undefined,
    fixHref: "/reports",
  });

  checks.push({
    id: "overdue-tasks",
    label: "Taches en retard",
    group: "activite",
    status: overdueTasks < 0 ? "skip" : overdueTasks > 0 ? "warn" : "ok",
    detail:
      overdueTasks < 0
        ? "Comptage indisponible"
        : overdueTasks === 0
          ? "Aucune echeance depassee"
          : `${overdueTasks} tache(s) au-dela de leur echeance`,
    fixHref: "/tasks",
  });

  checks.push({
    id: "discord",
    label: "Notifications Discord",
    group: "activite",
    status: webhooks < 0 ? "skip" : webhooks > 0 ? "ok" : "skip",
    detail:
      webhooks < 0
        ? "Comptage indisponible"
        : webhooks > 0
          ? `${webhooks} webhook(s) actif(s)`
          : "Aucun webhook configure (optionnel)",
    fixHref: "/discord",
  });

  return json({
    generatedAt: new Date().toISOString(),
    score: diagnosticScore(checks),
    overall: worstDiagnosticStatus(checks),
    counts: diagnosticCounts(checks),
    checks,
  });
});
