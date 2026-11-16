/**
 * Chargement / sauvegarde des integrations chiffrees.
 * Le dechiffrement n'a lieu qu'en memoire, dans le processus serveur.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, tryDecryptSecret } from "@/server/crypto";
import { PterodactylClient, type PterodactylCredentials } from "@/server/pterodactyl";
import { HttpError, badRequest } from "@/server/http";
import type { SftpConfig } from "@prisma/client";

export interface PterodactylResolved {
  id: string;
  name: string;
  panelUrl: string;
  serverId: string;
  serverIdentifier: string | null;
  client: PterodactylClient;
}

export class IntegrationNotConfiguredError extends HttpError {
  constructor(message: string) {
    super(412, message, "integration_not_configured");
  }
}

export async function getPterodactylConfig() {
  return prisma.pterodactylConfig.findFirst({
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
}

export async function resolvePterodactyl(): Promise<PterodactylResolved> {
  const config = await getPterodactylConfig();
  if (!config) {
    throw new IntegrationNotConfiguredError(
      "Pterodactyl n'est pas configure. Renseignez le panel dans Infrastructure.",
    );
  }
  const clientKey = tryDecryptSecret(config.clientApiKeyEnc);
  if (!clientKey) {
    throw new IntegrationNotConfiguredError(
      "Cle API Pterodactyl illisible. Reenregistrez la configuration (cle de chiffrement differente ?).",
    );
  }
  const applicationKey = tryDecryptSecret(config.applicationApiKeyEnc);

  const credentials: PterodactylCredentials = {
    panelUrl: config.panelUrl,
    serverId: config.serverId,
    clientApiKey: clientKey,
    applicationApiKey: applicationKey,
  };

  return {
    id: config.id,
    name: config.name,
    panelUrl: config.panelUrl,
    serverId: config.serverId,
    serverIdentifier: config.serverIdentifier,
    client: new PterodactylClient(credentials),
  };
}

export async function savePterodactylConfig(input: {
  panelUrl: string;
  serverId: string;
  serverIdentifier?: string | null;
  nodeId?: string | null;
  clientApiKey?: string | null;
  applicationApiKey?: string | null;
  name?: string;
}): Promise<{ id: string }> {
  const existing = await getPterodactylConfig();
  if (!input.clientApiKey && !existing) {
    throw badRequest("La cle API Client est obligatoire pour la premiere configuration");
  }

  const clientApiKeyEnc = input.clientApiKey
    ? encryptSecret(input.clientApiKey)
    : existing!.clientApiKeyEnc;
  const applicationApiKeyEnc = input.applicationApiKey
    ? encryptSecret(input.applicationApiKey)
    : existing?.applicationApiKeyEnc ?? null;

  if (existing) {
    const updated = await prisma.pterodactylConfig.update({
      where: { id: existing.id },
      data: {
        panelUrl: input.panelUrl.replace(/\/$/, ""),
        serverId: input.serverId,
        serverIdentifier: input.serverIdentifier ?? existing.serverIdentifier,
        nodeId: input.nodeId ?? existing.nodeId,
        clientApiKeyEnc,
        applicationApiKeyEnc,
        name: input.name ?? existing.name,
        lastError: null,
      },
    });
    return { id: updated.id };
  }

  const created = await prisma.pterodactylConfig.create({
    data: {
      panelUrl: input.panelUrl.replace(/\/$/, ""),
      serverId: input.serverId,
      serverIdentifier: input.serverIdentifier ?? null,
      nodeId: input.nodeId ?? null,
      clientApiKeyEnc,
      applicationApiKeyEnc,
      name: input.name ?? "Principal",
      isDefault: true,
    },
  });
  return { id: created.id };
}

export async function testPterodactylConnection(): Promise<{
  ok: true;
  account: string;
  serverName: string;
  state: string;
}> {
  const { client } = await resolvePterodactyl();
  const [account, server] = await Promise.all([client.getAccount(), client.getServer()]);
  return {
    ok: true,
    account: account.username,
    serverName: server.name,
    state: server.status ?? "unknown",
  };
}

// ---------------------------------------------------------------------------
// SFTP
// ---------------------------------------------------------------------------

export async function getSftpConfig(): Promise<SftpConfig | null> {
  return prisma.sftpConfig.findFirst({ orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] });
}

export interface ResolvedSftp {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: "KEY" | "PASSWORD";
  password?: string;
  privateKey?: string;
  passphrase?: string;
  remoteRoot: string;
}

export function resolveSftp(config: SftpConfig): ResolvedSftp {
  const password = config.passwordEnc ? decryptSecret(config.passwordEnc) : undefined;
  const privateKey = config.privateKeyEnc ? decryptSecret(config.privateKeyEnc) : undefined;
  const passphrase = config.passphraseEnc ? decryptSecret(config.passphraseEnc) : undefined;

  if (config.authType === "KEY" && !privateKey) {
    throw new IntegrationNotConfiguredError("Cle SSH privee manquante pour SFTP");
  }
  if (config.authType === "PASSWORD" && !password) {
    throw new IntegrationNotConfiguredError("Mot de passe SFTP manquant");
  }

  return {
    id: config.id,
    name: config.name,
    host: config.host,
    port: config.port,
    username: config.username,
    authType: config.authType,
    password,
    privateKey,
    passphrase,
    remoteRoot: config.remoteRoot || "/",
  };
}

export async function resolveSftpOrNull(): Promise<ResolvedSftp | null> {
  const config = await getSftpConfig();
  if (!config) return null;
  return resolveSftp(config);
}

export async function saveSftpConfig(input: {
  host: string;
  port: number;
  username: string;
  authType: "KEY" | "PASSWORD";
  password?: string | null;
  privateKey?: string | null;
  passphrase?: string | null;
  remoteRoot?: string;
  name?: string;
}): Promise<{ id: string }> {
  const existing = await getSftpConfig();
  const data = {
    host: input.host.trim(),
    port: input.port,
    username: input.username.trim(),
    authType: input.authType,
    remoteRoot: input.remoteRoot || "/",
    name: input.name ?? existing?.name ?? "Principal",
    passwordEnc: input.password ? encryptSecret(input.password) : (existing?.passwordEnc ?? null),
    privateKeyEnc: input.privateKey
      ? encryptSecret(input.privateKey)
      : (existing?.privateKeyEnc ?? null),
    passphraseEnc: input.passphrase
      ? encryptSecret(input.passphrase)
      : (existing?.passphraseEnc ?? null),
    lastError: null,
  };

  if (existing) {
    const updated = await prisma.sftpConfig.update({ where: { id: existing.id }, data });
    return { id: updated.id };
  }
  const created = await prisma.sftpConfig.create({ data: { ...data, isDefault: true } });
  return { id: created.id };
}
