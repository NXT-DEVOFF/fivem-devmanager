import { z } from "zod";
import { api } from "@/server/api";
import { badRequest, json, notFound } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { audit } from "@/server/audit";
import { getStudioTool, validateStudioInput } from "@/lib/studio/registry";

export const runtime = "nodejs";

const schema = z.record(z.unknown());

export const POST = api(async (request, context) => {
  const user = await requirePermission("studio.use");
  const { slug } = await context.params;
  const tool = getStudioTool(slug);
  if (!tool) throw notFound("Outil FiveM Studio introuvable");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw badRequest("Corps JSON invalide");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw badRequest("Parametres invalides");
  }

  const validation = validateStudioInput(tool, schema.parse(body));
  if (!validation.ok) throw badRequest(validation.errors.join(" "), validation.errors);

  const result = tool.run(validation.values);

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "studio.run",
    targetType: "studio_tool",
    targetId: tool.slug,
    metadata: {
      category: tool.category,
      files: result.files.length,
      warnings: result.warnings?.length ?? 0,
    },
  });

  return json({
    tool: { slug: tool.slug, name: tool.name, category: tool.category },
    result,
  });
});
