import { api } from "@/server/api";
import { json, rateLimit, tooManyRequests } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { scanMappings } from "@/server/mappings";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  const user = await requirePermission("resources.view");
  const limited = rateLimit(`mappings:${user.id}`, 12, 60_000);
  if (!limited.ok) {
    throw tooManyRequests(
      `Le scan des mappings est limite. Reessayez dans ${limited.retryAfter} secondes.`,
    );
  }

  const refresh = new URL(request.url).searchParams.get("refresh") === "1";
  const result = await scanMappings({ refresh });
  return json(result);
});
