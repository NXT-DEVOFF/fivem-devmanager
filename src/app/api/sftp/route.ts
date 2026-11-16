import { z } from "zod";
import { api } from "@/server/api";
import { HttpError, json, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { getSftpConfig, saveSftpConfig } from "@/server/integrations";
import { testSftpConnection } from "@/server/sftp";
import { audit } from "@/server/audit";

const schema = z.object({
  host: z.string().trim().min(1).max(255),
  port: z.number().int().min(1).max(65535).default(2022),
  username: z.string().trim().min(1).max(120),
  authType: z.enum(["KEY", "PASSWORD"]),
  password: z.string().max(500).optional(),
  privateKey: z.string().max(20000).optional(),
  passphrase: z.string().max(500).optional(),
  remoteRoot: z.string().trim().max(500).optional(),
  name: z.string().trim().max(80).optional(),
});

export const GET = api(async () => {
  await requirePermission("server.view");
  const config = await getSftpConfig();
  if (!config) return json({ configured: false });
  return json({
    configured: true,
    config: {
      host: config.host,
      port: config.port,
      username: config.username,
      authType: config.authType,
      remoteRoot: config.remoteRoot,
      hasPassword: Boolean(config.passwordEnc),
      hasPrivateKey: Boolean(config.privateKeyEnc),
      lastCheckAt: config.lastCheckAt?.toISOString() ?? null,
      lastError: config.lastError,
    },
  });
});

export const PUT = api(async (request) => {
  const actor = await requirePermission("integrations.manage");
  const body = await parseJson(request, schema);

  if (body.authType === "KEY" && !body.privateKey) {
    const existing = await getSftpConfig();
    if (!existing?.privateKeyEnc) {
      return json({ error: "Une cle SSH privee est requise", code: "private_key_required" }, { status: 400 });
    }
  }
  if (body.authType === "PASSWORD" && !body.password) {
    const existing = await getSftpConfig();
    if (!existing?.passwordEnc) {
      return json({ error: "Un mot de passe est requis", code: "password_required" }, { status: 400 });
    }
  }

  const saved = await saveSftpConfig({ ...body, port: body.port ?? 2022 });

  // Test immediat avec la configuration fraichement enregistree.
  let test: { ok: boolean; message?: string } = { ok: false };
  try {
    const config = await getSftpConfig();
    if (config) {
      const { resolveSftp } = await import("@/server/integrations");
      await testSftpConnection(resolveSftp(config));
      test = { ok: true };
    }
  } catch (error) {
    test = { ok: false, message: error instanceof Error ? error.message : "Echec de connexion" };
  }

  await audit({
    actorId: actor.id,
    actorLabel: actor.displayName,
    action: "integration.sftp.save",
    targetType: "sftp_config",
    targetId: saved.id,
    metadata: { host: body.host, port: body.port, authType: body.authType, tested: test.ok },
  });

  return json({ ok: true, id: saved.id, test });
});

/** Test de connexion avec la configuration enregistree. */
export const POST = api(async () => {
  const actor = await requirePermission("integrations.manage");
  try {
    const result = await testSftpConnection();
    await audit({
      actorId: actor.id,
      actorLabel: actor.displayName,
      action: "integration.test",
      targetType: "sftp",
      metadata: { ok: true },
    });
    return json({ ...result, ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Echec SFTP";
    await audit({
      actorId: actor.id,
      actorLabel: actor.displayName,
      action: "integration.test",
      targetType: "sftp",
      result: "FAILURE",
      metadata: { error: message },
    });
    return json(
      { ok: false, error: message },
      { status: error instanceof HttpError ? error.status : 502 },
    );
  }
});
