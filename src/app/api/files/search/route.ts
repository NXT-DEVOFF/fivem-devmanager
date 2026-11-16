import { api } from "@/server/api";
import { json } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { searchFiles } from "@/server/files";

export const GET = api(async (request) => {
  await requirePermission("files.search");
  const params = new URL(request.url).searchParams;
  const query = params.get("q") ?? "";
  const mode = params.get("mode") === "content" ? "content" : "name";
  const root = params.get("root") ?? "/resources";
  const maxResults = Number(params.get("limit") ?? 50) || 50;

  const results = await searchFiles({ query, mode, root, maxResults });
  return json({ results, mode, query, count: results.length });
});
