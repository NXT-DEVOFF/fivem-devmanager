import { z } from "zod";
import { api } from "@/server/api";
import { json, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { readRemoteFile, saveRemoteFile } from "@/server/files";
import { normalizeRemotePath } from "@/server/path-safety";

export const GET = api(async (request) => {
  await requirePermission("files.view");
  const params = new URL(request.url).searchParams;
  const path = params.get("path");
  if (!path) return json({ error: "Parametre path requis", code: "bad_request" }, { status: 400 });
  const result = await readRemoteFile(normalizeRemotePath(path));
  return json(result);
});

const saveSchema = z.object({
  path: z.string().min(1),
  content: z.string().max(3_000_000),
  baseHash: z.string().length(64).nullable().optional(),
  sessionId: z.string().nullable().optional(),
});

export const PUT = api(async (request) => {
  const user = await requirePermission("files.write");
  const body = await parseJson(request, saveSchema);

  const result = await saveRemoteFile({
    user,
    path: body.path,
    content: body.content,
    baseHash: body.baseHash ?? null,
    sessionId: body.sessionId ?? null,
    source: "EDITOR",
  });

  return json(result);
});
