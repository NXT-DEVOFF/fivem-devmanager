import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api } from "@/server/api";
import { json, parseJson, unauthorized } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { audit } from "@/server/audit";

const schema = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  jobTitle: z.string().trim().max(80).nullable().optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  timezone: z.string().trim().max(60).optional(),
});

export const GET = api(async () => {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      displayName: true,
      email: true,
      jobTitle: true,
      avatarColor: true,
      timezone: true,
      twoFactorEnabled: true,
    },
  });
  return json({ profile: record });
});

export const PATCH = api(async (request) => {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  const body = await parseJson(request, schema);

  const profile = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
      ...(body.jobTitle !== undefined ? { jobTitle: body.jobTitle } : {}),
      ...(body.avatarColor !== undefined ? { avatarColor: body.avatarColor } : {}),
      ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
    },
    select: { displayName: true, jobTitle: true, avatarColor: true, timezone: true },
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "user.update",
    targetType: "user",
    targetId: user.id,
    metadata: { self: true, fields: Object.keys(body) },
  });

  return json({ profile });
});
