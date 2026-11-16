import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toStringArray } from "@/lib/json-array";
import { api } from "@/server/api";
import { badRequest, conflict, json, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { hashPassword, validatePasswordStrength } from "@/server/auth";
import { ALL_PERMISSIONS, ROLE_LABELS, effectivePermissionList, hasPermission } from "@/server/permissions";
import { audit } from "@/server/audit";
import { notify } from "@/server/notifications";

const roleSchema = z.enum(["SUPER_ADMIN", "ADMIN", "LEAD_DEV", "DEVELOPER"]);
const permissionSchema = z
  .string()
  .max(80)
  .refine((value) => (ALL_PERMISSIONS as string[]).includes(value), { message: "Permission inconnue" });

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9._-]+$/, "Lettres minuscules, chiffres, point, tiret et underscore uniquement"),
  displayName: z.string().trim().min(2).max(80),
  password: z.string().min(12).max(200).optional(),
  role: roleSchema.default("DEVELOPER"),
  jobTitle: z.string().trim().max(80).optional(),
  permissionsGranted: z.array(permissionSchema).optional(),
  permissionsDenied: z.array(permissionSchema).optional(),
});

export const GET = api(async (request) => {
  await requirePermission("users.view");
  const params = new URL(request.url).searchParams;
  const search = params.get("q")?.trim() ?? "";
  const role = params.get("role") as Role | null;
  const active = params.get("active");

  const users = await prisma.user.findMany({
    where: {
      ...(search
        ? {
            OR: [
              { displayName: { contains: search } },
              { email: { contains: search } },
              { username: { contains: search } },
            ],
          }
        : {}),
      ...(role ? { role } : {}),
      ...(active === "true" ? { isActive: true } : active === "false" ? { isActive: false } : {}),
    },
    orderBy: [{ isActive: "desc" }, { displayName: "asc" }],
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
      jobTitle: true,
      avatarColor: true,
      lastLoginAt: true,
      lastSeenAt: true,
      twoFactorEnabled: true,
      permissionsGranted: true,
      permissionsDenied: true,
      createdAt: true,
      _count: { select: { devSessions: true, tasksAssigned: true } },
    },
  });

  return json({
    users: users.map((user) => ({
      ...user,
      permissionsGranted: toStringArray(user.permissionsGranted),
      permissionsDenied: toStringArray(user.permissionsDenied),
      roleLabel: ROLE_LABELS[user.role],
      effectivePermissions: effectivePermissionList(user).length,
    })),
    roles: ROLE_LABELS,
  });
});

export const POST = api(async (request) => {
  const actor = await requirePermission("users.manage");
  const body = await parseJson(request, createSchema);

  if (body.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") {
    throw badRequest("Seul un super administrateur peut creer un super administrateur");
  }
  if ((body.permissionsGranted || body.permissionsDenied) && !hasPermission(actor, "roles.manage")) {
    throw badRequest("Permission insuffisante pour definir des permissions granulaires");
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: body.email }, { username: body.username }] },
    select: { email: true, username: true },
  });
  if (existing) {
    throw conflict(
      existing.email === body.email ? "Un compte utilise deja cet email" : "Ce nom d'utilisateur est pris",
    );
  }

  let password = body.password;
  let mustChangePassword = false;
  if (!password) {
    const { generateTemporaryPassword } = await import("@/server/auth");
    password = generateTemporaryPassword();
    mustChangePassword = true;
  } else {
    const strengthError = validatePasswordStrength(password);
    if (strengthError) throw badRequest(strengthError);
  }

  const user = await prisma.user.create({
    data: {
      email: body.email,
      username: body.username,
      displayName: body.displayName,
      role: body.role,
      jobTitle: body.jobTitle ?? null,
      passwordHash: await hashPassword(password),
      mustChangePassword,
      permissionsGranted: body.permissionsGranted ?? [],
      permissionsDenied: body.permissionsDenied ?? [],
    },
    select: { id: true, displayName: true, email: true, role: true },
  });

  await audit({
    actorId: actor.id,
    actorLabel: actor.displayName,
    action: "user.create",
    targetType: "user",
    targetId: user.id,
    metadata: { email: user.email, role: user.role, mustChangePassword },
  });

  await notify(user.id, {
    type: "user.welcome",
    title: "Bienvenue sur FiveM DevManager",
    body: "Votre compte a ete cree. Changez votre mot de passe des la premiere connexion.",
    link: "/dashboard",
  });

  return json(
    {
      user,
      temporaryPassword: mustChangePassword ? password : undefined,
    },
    201,
  );
});
