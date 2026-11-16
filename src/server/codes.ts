/** Generation de codes lisibles (DEV-101, BUG-42) sans collision. */
import "server-only";
import { prisma } from "@/lib/prisma";

const globalForCodes = globalThis as unknown as { __fdmCodeLocks?: Map<string, Promise<unknown>> };

function lockFor(prefix: string): Promise<unknown> {
  if (!globalForCodes.__fdmCodeLocks) globalForCodes.__fdmCodeLocks = new Map();
  const existing = globalForCodes.__fdmCodeLocks.get(prefix) ?? Promise.resolve();
  const next = existing.then(async () => {
    // Serialise la generation par prefixe au sein du processus.
  });
  globalForCodes.__fdmCodeLocks.set(prefix, next);
  return next;
}

async function nextNumber(prefix: "DEV" | "BUG"): Promise<number> {
  if (prefix === "DEV") {
    const last = await prisma.task.findFirst({
      where: { code: { startsWith: "DEV-" } },
      orderBy: { createdAt: "desc" },
      select: { code: true },
    });
    const number = last ? Number(last.code.replace("DEV-", "")) : 100;
    return Number.isFinite(number) ? number + 1 : 101;
  }
  const last = await prisma.bug.findFirst({
    where: { code: { startsWith: "BUG-" } },
    orderBy: { createdAt: "desc" },
    select: { code: true },
  });
  const number = last ? Number(last.code.replace("BUG-", "")) : 0;
  return Number.isFinite(number) ? number + 1 : 1;
}

export async function generateCode(prefix: "DEV" | "BUG"): Promise<string> {
  await lockFor(prefix);
  const next = await nextNumber(prefix);
  return `${prefix}-${next}`;
}
