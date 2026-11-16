import { z } from "zod";
import { api } from "@/server/api";
import { json, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import {
  acquireFileLock,
  createRemoteFile,
  createRemoteFolder,
  deleteRemotePaths,
  listDirectory,
  releaseFileLock,
  renameRemotePath,
} from "@/server/files";
import { normalizeRemotePath } from "@/server/path-safety";

export const GET = api(async (request) => {
  await requirePermission("files.view");
  const params = new URL(request.url).searchParams;
  const path = normalizeRemotePath(params.get("path") ?? "/resources");
  const result = await listDirectory(path);
  return json({
    ...result,
    entries: result.entries.map((entry) => ({
      ...entry,
      modifiedAt: entry.modifiedAt.toISOString(),
    })),
  });
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create-file"),
    path: z.string().min(1),
    content: z.string().max(200_000).optional(),
  }),
  z.object({
    action: z.literal("create-folder"),
    root: z.string().min(1),
    name: z.string().min(1).max(200),
  }),
  z.object({
    action: z.literal("rename"),
    path: z.string().min(1),
    newName: z.string().min(1).max(200),
  }),
  z.object({
    action: z.literal("delete"),
    paths: z.array(z.string().min(1)).min(1).max(100),
    confirmation: z.string(),
  }),
  z.object({ action: z.literal("lock"), path: z.string().min(1) }),
  z.object({ action: z.literal("unlock"), path: z.string().min(1) }),
]);

export const POST = api(async (request) => {
  const user = await requirePermission("files.write");
  const body = await parseJson(request, actionSchema);

  switch (body.action) {
    case "create-file": {
      const result = await createRemoteFile({ user, path: body.path, content: body.content });
      return json(result, 201);
    }
    case "create-folder": {
      await createRemoteFolder({ user, root: body.root, name: body.name });
      return json({ ok: true }, 201);
    }
    case "rename": {
      const result = await renameRemotePath({ user, path: body.path, newName: body.newName });
      return json(result);
    }
    case "delete": {
      const result = await deleteRemotePaths({
        user,
        paths: body.paths,
        confirmation: body.confirmation,
      });
      return json(result);
    }
    case "lock": {
      const result = await acquireFileLock(body.path, user);
      return json(result, { status: result.ok ? 200 : 423 });
    }
    case "unlock": {
      await releaseFileLock(body.path, user);
      return json({ ok: true });
    }
    default:
      return json({ error: "Action inconnue" }, { status: 400 });
  }
});
