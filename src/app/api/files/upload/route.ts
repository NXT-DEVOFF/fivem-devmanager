import { api } from "@/server/api";
import { badRequest, json } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { uploadRemoteFile } from "@/server/files";
import { normalizeRemotePath } from "@/server/path-safety";

export const POST = api(async (request) => {
  const user = await requirePermission("files.upload");

  const form = await request.formData().catch(() => null);
  if (!form) throw badRequest("FormData attendu");

  const directoryRaw = form.get("directory");
  if (typeof directoryRaw !== "string") throw badRequest("Dossier cible manquant");
  const directory = normalizeRemotePath(directoryRaw);

  const entries = form.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (entries.length === 0) throw badRequest("Aucun fichier recu");
  if (entries.length > 20) throw badRequest("20 fichiers maximum par envoi");

  const uploaded: string[] = [];
  for (const file of entries) {
    if (!file.name || file.name.includes("/") || file.name.includes("\\")) {
      throw badRequest(`Nom de fichier invalide : ${file.name}`);
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadRemoteFile({ user, directory, name: file.name, data: buffer });
    uploaded.push(result.path);
  }

  return json({ ok: true, uploaded }, 201);
});
