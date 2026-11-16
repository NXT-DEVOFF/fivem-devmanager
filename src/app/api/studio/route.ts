import { api } from "@/server/api";
import { json } from "@/server/http";
import { requirePermission } from "@/server/auth";
import {
  STUDIO_CATEGORIES,
  STUDIO_TOOLS,
  studioToolCountByCategory,
  studioToolSummary,
} from "@/lib/studio/registry";

export const GET = api(async () => {
  await requirePermission("studio.view");
  return json({
    categories: STUDIO_CATEGORIES,
    tools: STUDIO_TOOLS.map(studioToolSummary),
    total: STUDIO_TOOLS.length,
    counts: studioToolCountByCategory(),
  });
});
