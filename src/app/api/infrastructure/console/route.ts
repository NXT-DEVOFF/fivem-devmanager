import { api } from "@/server/api";
import { json } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { consoleRelay } from "@/server/pterodactyl/console-relay";

export const GET = api(async (request) => {
  await requirePermission("server.console");
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get("limit") ?? 200) || 200, 600);
  const filter = params.get("filter")?.toLowerCase().trim();

  const buffer = consoleRelay.getBuffer(limit);
  const lines = filter
    ? buffer.filter((entry) => entry.line.toLowerCase().includes(filter))
    : buffer;

  return json({
    status: consoleRelay.getStatus(),
    lines,
    total: buffer.length,
    filtered: Boolean(filter),
  });
});
