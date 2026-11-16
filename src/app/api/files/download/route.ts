import { NextResponse } from "next/server";
import { api } from "@/server/api";
import { requirePermission } from "@/server/auth";
import { getDownloadUrl } from "@/server/files";
import { audit } from "@/server/audit";
import { normalizeRemotePath } from "@/server/path-safety";

/**
 * Redirection vers l'URL signee Pterodactyl : aucun fichier ne transite en
 * clair par le frontend, et la permission est verifiee cote serveur.
 */
export const GET = api(async (request) => {
  const user = await requirePermission("files.download");
  const path = normalizeRemotePath(new URL(request.url).searchParams.get("path") ?? "");
  const url = await getDownloadUrl(path);

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "file.download",
    targetType: "file",
    targetId: path,
  });

  return NextResponse.redirect(url, 302);
});
