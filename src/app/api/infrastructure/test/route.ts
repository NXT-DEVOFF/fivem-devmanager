import { api } from "@/server/api";
import { HttpError, json } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { testPterodactylConnection } from "@/server/integrations";
import { testSftpConnection } from "@/server/sftp";
import { audit } from "@/server/audit";

export const POST = api(async (request) => {
  const actor = await requirePermission("integrations.manage");
  const target = new URL(request.url).searchParams.get("target") ?? "pterodactyl";

  try {
    const result =
      target === "sftp" ? await testSftpConnection() : await testPterodactylConnection();
    await audit({
      actorId: actor.id,
      actorLabel: actor.displayName,
      action: "integration.test",
      targetType: target,
      metadata: { ok: true },
    });
    return json({ ok: true, target, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Echec du test";
    await audit({
      actorId: actor.id,
      actorLabel: actor.displayName,
      action: "integration.test",
      targetType: target,
      result: "FAILURE",
      metadata: { ok: false, error: message },
    });
    return json(
      { ok: false, target, error: message },
      { status: error instanceof HttpError ? error.status : 502 },
    );
  }
});
