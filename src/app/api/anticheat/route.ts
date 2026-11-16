import { z } from "zod";
import { api, searchParams } from "@/server/api";
import { json } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import {
  buildAnticheatSummary,
  serializeAnticheatAgent,
  serializeAnticheatEvent,
  type AnticheatGroupCount,
  type AnticheatSeverityValue,
  type AnticheatStatusValue,
} from "@/lib/anticheat";

const statusSchema = z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED", "FALSE_POSITIVE"]);
const severitySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

const personSelect = {
  select: { id: true, displayName: true, avatarColor: true },
} as const;

const eventInclude = {
  acknowledgedBy: personSelect,
  resolvedBy: personSelect,
} as const;

export const GET = api(async (request) => {
  await requirePermission("anticheat.view");
  const params = searchParams(request);

  const status = statusSchema.safeParse(params.get("status") ?? "");
  const severity = severitySchema.safeParse(params.get("severity") ?? "");
  const detection = params.get("detection")?.trim().slice(0, 80) || undefined;
  const category = params.get("category")?.trim().slice(0, 40) || undefined;
  const search = params.get("q")?.trim().slice(0, 120) || undefined;
  const rawDays = Number(params.get("days") ?? 30);
  const days = Number.isFinite(rawDays) ? Math.min(90, Math.max(1, Math.round(rawDays))) : 30;
  const since = new Date(Date.now() - days * 86_400_000);

  const where = {
    createdAt: { gte: since },
    ...(status.success ? { status: status.data as AnticheatStatusValue } : {}),
    ...(severity.success ? { severity: severity.data as AnticheatSeverityValue } : {}),
    ...(detection ? { detection } : {}),
    ...(category ? { category } : {}),
    ...(search
      ? {
          OR: [
            { playerName: { contains: search } },
            { playerLicense: { contains: search } },
            { detection: { contains: search } },
            { resource: { contains: search } },
          ],
        }
      : {}),
  };

  const [events, grouped, last24h, flagged, agents] = await Promise.all([
    prisma.anticheatEvent.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: 300,
      include: eventInclude,
    }),
    prisma.anticheatEvent.groupBy({
      by: ["status", "severity"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.anticheatEvent.count({
      where: { occurredAt: { gte: new Date(Date.now() - 86_400_000) } },
    }),
    prisma.anticheatEvent.findMany({
      where: { createdAt: { gte: since }, playerLicense: { not: null } },
      distinct: ["playerLicense"],
      select: { playerLicense: true },
      take: 1000,
    }),
    prisma.anticheatAgent.findMany({
      orderBy: { lastSeenAt: "desc" },
      take: 20,
    }),
  ]);

  const detections = await prisma.anticheatEvent.groupBy({
    by: ["detection"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { detection: "desc" } },
    take: 30,
  });

  const groups: AnticheatGroupCount[] = grouped.map((group) => ({
    status: group.status as AnticheatStatusValue,
    severity: group.severity as AnticheatSeverityValue,
    count: group._count._all,
  }));

  return json({
    events: events.map(serializeAnticheatEvent),
    summary: buildAnticheatSummary({
      groups,
      last24h,
      flaggedPlayers: flagged.length,
    }),
    detections: detections.map((entry) => ({
      key: entry.detection,
      count: entry._count._all,
    })),
    agents: agents.map((agent) => serializeAnticheatAgent(agent)),
    periodDays: days,
  });
});
