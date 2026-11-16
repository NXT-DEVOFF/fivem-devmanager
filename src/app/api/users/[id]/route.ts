import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { toStringArray } from "@/lib/json-array";
import { api } from "@/server/api";
import { badRequest, forbidden, json, notFound, parseJson } from "@/server/http";
import { requirePermission, revokeAllSessions } from "@/server/auth";
import { ALL_PERMISSIONS, hasPermission } from "@/server/permissions";
import { audit } from "@/server/audit";

const roleSchema = z.enum(["SUPER_ADMIN", "ADMIN", "LEAD_DEV", "DEVELOPER"]);
const permissionSchema = z
  .string()
  .max(80)
  .refine((value) => (ALL_PERMISSIONS as string[]).includes(value), { message: "Permission inconnue" });

const patchSchema = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().toLowerCase().email().max(320).optional(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9._-]+$/)
    .optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
  jobTitle: z.string().trim().max(80).nullable().optional(),
  avatarColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  permissionsGranted: z.array(permissionSchema).optional(),
  permissionsDenied: z.array(permissionSchema).optional(),
});

export const GET = api(async (_request, context) => {
  const actor = await requirePermission("users.view");
  const { id } = await context.params;
  if (id !== actor.id && !hasPermission(actor, "users.manage")) {
    throw forbidden("Consultation reservee aux administrateurs");
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
      jobTitle: true,
      avatarColor: true,
      twoFactorEnabled: true,
      mustChangePassword: true,
      lastLoginAt: true,
      lastSeenAt: true,
      createdAt: true,
      permissionsGranted: true,
      permissionsDenied: true,
      _count: { select: { devSessions: true, tasksAssigned: true, bugsAssigned: true } },
    },
  });
  if (!user) throw notFound("Utilisateur introuvable");
  return json({
    user: {
      ...user,
      permissionsGranted: toStringArray(user.permissionsGranted),
      permissionsDenied: toStringArray(user.permissionsDenied),
    },
  });
});

export const PATCH = api(async (request, context) => {
  const actor = await requirePermission("users.manage");
  const { id } = await context.params;
  const body = await parseJson(request, patchSchema);

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw notFound("Utilisateur introuvable");

  if (target.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") {
    throw forbidden("Seul un super administrateur peut modifier un super administrateur");
  }
  if (body.role !== undefined && actor.role !== "SUPER_ADMIN" && body.role !== target.role) {
    throw forbidden("Seul un super administrateur peut changer le role");
  }
  if (
    (body.permissionsGranted || body.permissionsDenied) &&
    !hasPermission(actor, "roles.manage")
  ) {
    throw forbidden("Permission roles.manage requise");
  }
  if (target.id === actor.id && body.isActive === false) {
    throw badRequest("Vous ne pouvez pas desactiver votre propre compte");
  }

  if (body.role === "SUPER_ADMIN" || target.role === "SUPER_ADMIN") {
    const superAdmins = await prisma.user.count({
      where: { role: "SUPER_ADMIN", isActive: true },
    });
    if (superAdmins <= 1 && (body.role !== "SUPER_ADMIN" || body.isActive === false)) {
      throw badRequest("Impossible de retirer le dernier super administrateur actif");
    }
  }

  if (body.email && body.email !== target.email) {
    const exists = await prisma.user.findUnique({ where: { email: body.email } });
    if (exists) throw badRequest("Cet email est deja utilise");
  }
  if (body.username && body.username !== target.username) {
    const exists = await prisma.user.findUnique({ where: { username: body.username } });
    if (exists) throw badRequest("Ce nom d'utilisateur est deja utilise");
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.username !== undefined ? { username: body.username } : {}),
      ...(body.role !== undefined ? { role: body.role } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.jobTitle !== undefined ? { jobTitle: body.jobTitle } : {}),
      ...(body.avatarColor !== undefined ? { avatarColor: body.avatarColor } : {}),
      ...(body.permissionsGranted !== undefined ? { permissionsGranted: body.permissionsGranted } : {}),
      ...(body.permissionsDenied !== undefined ? { permissionsDenied: body.permissionsDenied } : {}),
    },
  });

  const permissionChanged =
    body.permissionsGranted !== undefined || body.permissionsDenied !== undefined || body.role !== undefined;

  if (permissionChanged || body.isActive === false) {
    await revokeAllSessions(id);
  }

  await audit({
    actorId: actor.id,
    actorLabel: actor.displayName,
    action: permissionChanged ? "user.permissions" : "user.update",
    targetType: "user",
    targetId: id,
    metadata: {
      fields: Object.keys(body),
      ...(body.role ? { role: body.role } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  });

  return json({
    user: {
      id: updated.id,
      displayName: updated.displayName,
      role: updated.role,
      isActive: updated.isActive,
    },
    sessionsRevoked: permissionChanged || body.isActive === false,
  });
});

/** Desactivation (soft delete) : conserve l'historique et l'audit. */
export const DELETE = api(async (_request, context) => {
  const actor = await requirePermission("users.manage");
  const { id } = await context.params;
  if (id === actor.id) throw badRequest("Vous ne pouvez pas desactiver votre propre compte");

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw notFound("Utilisateur introuvable");
  if (target.role === "SUPER_ADMIN") {
    const superAdmins = await prisma.user.count({ where: { role: "SUPER_ADMIN", isActive: true } });
    if (superAdmins <= 1) throw badRequest("Impossible de desactiver le dernier super administrateur");
  }

  await prisma.user.update({ where: { id }, data: { isActive: false } });
  await revokeAllSessions(id);

  await audit({
    actorId: actor.id,
    actorLabel: actor.displayName,
    action: "user.deactivate",
    targetType: "user",
    targetId: id,
    metadata: { email: target.email },
  });

  return json({ ok: true });
});
