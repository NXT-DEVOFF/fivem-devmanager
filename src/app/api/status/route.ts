import { api } from "@/server/api";
import { json } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { getLiveStatus } from "@/server/live-status";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  await requirePermission("server.view");
  const force = new URL(request.url).searchParams.get("force") === "1";
  return json(await getLiveStatus(force));
});
