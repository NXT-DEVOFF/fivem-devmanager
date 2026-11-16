/**
 * Detection automatique des bugs a partir du flux console FiveM.
 *
 * Regles :
 * - seules les lignes reellement recues sont analysees (aucune invention) ;
 * - chaque anomalie est normalisee en signature pour ne pas creer 200 bugs
 *   identiques quand une erreur se repete en boucle ;
 * - un bug deja ouvert avec la meme signature n'est jamais duplique ;
 * - la ligne brute est conservee dans le bug pour le diagnostic.
 */
import "server-only";
import type { BugSeverity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/server/codes";
import { sha256 } from "@/server/crypto";
import { emitActivity } from "@/server/realtime";

export interface ConsoleEntry {
  line: string;
  at: string;
}

interface BugPattern {
  id: string;
  test: RegExp;
  label: string;
  severity: BugSeverity;
}

/**
 * Motifs reconnus dans les logs FiveM / Lua / CFX.
 * L'ordre compte : le premier motif correspondant gagne.
 */
const PATTERNS: BugPattern[] = [
  { id: "script-error", test: /script error:/i, label: "Erreur de script Lua", severity: "HIGH" },
  {
    id: "load-failed",
    test: /error loading script|failed to (?:load|start) resource|could not (?:load|find) resource/i,
    label: "Echec de chargement de ressource",
    severity: "CRITICAL",
  },
  {
    id: "nil-index",
    test: /attempt to index (?:a )?nil value/i,
    label: "Indexation d'une valeur nil",
    severity: "HIGH",
  },
  {
    id: "nil-call",
    test: /attempt to call (?:a )?nil value/i,
    label: "Appel d'une fonction nil",
    severity: "HIGH",
  },
  {
    id: "nil-field",
    test: /attempt to index (?:a )?nil value \(field|attempt to index a nil value \(global/i,
    label: "Champ ou global inexistant",
    severity: "HIGH",
  },
  {
    id: "arithmetic-nil",
    test: /attempt to perform arithmetic on/i,
    label: "Calcul sur une valeur invalide",
    severity: "MEDIUM",
  },
  {
    id: "syntax-error",
    test: /syntax error near|unexpected symbol near|unfinished string near/i,
    label: "Erreur de syntaxe Lua",
    severity: "HIGH",
  },
  {
    id: "sql-error",
    test: /sql error|mysql error|mysql2? .*error|deadlock found|duplicate entry/i,
    label: "Erreur base de donnees",
    severity: "HIGH",
  },
  {
    id: "dependency",
    test: /could not find dependency|missing dependenc|dependency .* not (?:found|started)/i,
    label: "Dependance manquante",
    severity: "HIGH",
  },
  {
    id: "nui-error",
    test: /error during nui callback|nui callback .* failed|failed to (?:fetch|post) nui/i,
    label: "Erreur de callback NUI",
    severity: "MEDIUM",
  },
  {
    id: "exception",
    test: /unhandled exception|stack traceback:|panic:|segmentation fault/i,
    label: "Exception non geree",
    severity: "HIGH",
  },
  {
    id: "http-failed",
    test: /failed to load resource|404 \(not found\)|500 \(internal server error\)/i,
    label: "Ressource HTTP introuvable",
    severity: "LOW",
  },
  {
    id: "generic-error",
    test: /\[(?:error|erreur)\]/i,
    label: "Erreur signalee par le serveur",
    severity: "MEDIUM",
  },
];

const SEEN_TTL_MS = 30 * 60_000;
const seen = new Map<string, number>();

function parseLine(line: string): { resource: string | null; message: string } {
  const match = /^\[(?:script:)?([A-Za-z0-9_\-[\]/]{2,60})\]\s*(.*)$/.exec(line.trim());
  if (match) {
    return { resource: match[1] ?? null, message: match[2] ?? line };
  }
  return { resource: null, message: line };
}

function signature(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/0x[0-9a-f]+/g, "0x0")
    .replace(/\d+/g, "0")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return sha256(normalized).slice(0, 16);
}

async function resolveReporterId(): Promise<string | null> {
  const configured = process.env.AUTO_BUG_REPORTER_ID?.trim();
  if (configured) {
    const user = await prisma.user.findUnique({ where: { id: configured }, select: { id: true } });
    if (user) return user.id;
  }
  const fallback = await prisma.user.findFirst({
    where: { isActive: true, role: { in: ["SUPER_ADMIN", "ADMIN", "LEAD_DEV"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return fallback?.id ?? null;
}

export async function detectBugsFromConsole(
  entries: ConsoleEntry[],
  options: { maxPerRun?: number } = {},
): Promise<{ created: number; skipped: number; scanned: number; duplicates: number }> {
  const maxPerRun = Math.min(Math.max(options.maxPerRun ?? 5, 1), 50);
  const batch = entries.slice(-400);
  if (batch.length === 0) return { created: 0, skipped: 0, scanned: 0, duplicates: 0 };

  const reporterId = await resolveReporterId();
  if (!reporterId) {
    // Sans utilisateur de reference, on ne peut pas creer de bug (cle etrangere).
    return { created: 0, skipped: batch.length, scanned: batch.length, duplicates: 0 };
  }

  const now = Date.now();
  let created = 0;
  let duplicates = 0;
  let skipped = 0;

  for (const entry of batch) {
    const pattern = PATTERNS.find((candidate) => candidate.test.test(entry.line));
    if (!pattern) {
      skipped += 1;
      continue;
    }

    const { resource, message } = parseLine(entry.line);
    const token = signature(`${pattern.id}:${resource ?? "server"}:${message}`);
    const lastAt = seen.get(token);
    if (lastAt && now - lastAt < SEEN_TTL_MS) {
      duplicates += 1;
      continue;
    }
    seen.set(token, now);

    const marker = `[auto:${token}]`;
    const existing = await prisma.bug.findFirst({
      where: {
        description: { contains: marker },
        status: { notIn: ["FIXED", "CLOSED"] },
      },
      select: { id: true },
    });
    if (existing) {
      duplicates += 1;
      continue;
    }

    if (created >= maxPerRun) {
      duplicates += 1;
      continue;
    }

    const raw = entry.line.slice(0, 1500);
    const bug = await prisma.bug
      .create({
        data: {
          code: await generateCode("BUG"),
          title: `${pattern.label}${resource ? ` (${resource})` : ""}`.slice(0, 200),
          description: [
            "Bug detecte automatiquement dans la console du serveur.",
            "",
            `Motif : ${pattern.label}`,
            `Ressource : ${resource ?? "non identifiee"}`,
            `Premiere occurrence : ${entry.at}`,
            "",
            "```",
            raw,
            "```",
            "",
            marker,
          ].join("\n"),
          severity: pattern.severity,
          status: "NEW",
          resource,
          logs: entry.line.slice(0, 4000),
          actualResult: entry.line.slice(0, 1000),
          reproduceSteps: `Consulter la console serveur autour de ${entry.at}, puis reproduire l'action declenchante.`,
          reporterId,
        },
        select: { id: true, code: true, title: true, severity: true },
      })
      .catch((error) => {
        console.error("[bug-detector] creation impossible:", error);
        return null;
      });

    if (!bug) {
      skipped += 1;
      continue;
    }

    created += 1;
    emitActivity({
      type: "bug.reported",
      title: `Bug detecte automatiquement : ${bug.code}`,
      detail: bug.title,
      actor: { id: reporterId, name: "Detection automatique" },
      link: `/bugs?highlight=${bug.id}`,
      timestamp: new Date().toISOString(),
    });
  }

  return { created, skipped, scanned: batch.length, duplicates };
}
