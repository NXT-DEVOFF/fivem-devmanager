import { z } from "zod";
import { api } from "@/server/api";
import { json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { toStringArray } from "@/lib/json-array";
import {
  decideDeployment,
  executeDeployment,
  rollbackDeployment,
} from "@/server/deployments";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("execute"), restartResource: z.boolean().default(false) }),
  z.object({ action: z.literal("rollback"), restartResource: z.boolean().default(false) }),
]);

export const GET = api(async (_request, context) => {
  await requirePermission("deployments.view");
  const { id } = await context.params;
  const deployment = await prisma.deployment.findUnique({
    where: { id },
    include: {
      requestedBy: { select: { displayName: true } },
      approvedBy: { select: { displayName: true } },
    },
  });
  if (!deployment) throw notFound("Deploiement introuvable");
  return json({ deployment: { ...deployment, files: toStringArray(deployment.files) } });
});

export const PATCH = api(async (request, context) => {
  const user = await requirePermission("deployments.view");
  const { id } = await context.params;
  const body = await parseJson(request, schema);

  switch (body.action) {
    case "approve":
    case "reject": {
      if (!hasPermission(user, "deployments.approve")) {
        return json({ error: "Permission deployments.approve requise", code: "forbidden" }, { status: 403 });
      }
      const deployment = await decideDeployment({
        deploymentId: id,
        user,
        approve: body.action === "approve",
        reason: body.action === "reject" ? body.reason : undefined,
      });
      return json({ deployment });
    }
    case "execute": {
      if (!hasPermission(user, "deployments.execute")) {
        return json({ error: "Permission deployments.execute requise", code: "forbidden" }, { status: 403 });
      }
      const result = await executeDeployment({
        deploymentId: id,
        user,
        restartResource: body.restartResource ?? false,
      });
      return json(result);
    }
    case "rollback": {
      if (!hasPermission(user, "deployments.rollback")) {
        return json({ error: "Permission deployments.rollback requise", code: "forbidden" }, { status: 403 });
      }
      const result = await rollbackDeployment({
        deploymentId: id,
        user,
        restartResource: body.restartResource ?? false,
      });
      return json(result);
    }
    default:
      return json({ error: "Action inconnue" }, { status: 400 });
  }
});
