/** Connexion SFTP cote serveur (ssh2). Les identifiants restent en backend. */
import "server-only";
import { Client, type SFTPWrapper, type ConnectConfig } from "ssh2";
import { resolveSftpOrNull, resolveSftp, type ResolvedSftp } from "@/server/integrations";
import { normalizeRemotePath } from "@/server/path-safety";
import { HttpError } from "@/server/http";

export class SftpNotConfiguredError extends HttpError {
  constructor() {
    super(412, "SFTP n'est pas configure", "sftp_not_configured");
  }
}

export interface SftpEntry {
  name: string;
  path: string;
  isFile: boolean;
  size: number;
  modifiedAt: Date;
  mode: number;
}

function connectConfig(config: ResolvedSftp): ConnectConfig {
  return {
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    privateKey: config.privateKey,
    passphrase: config.passphrase,
    readyTimeout: 15_000,
    keepaliveInterval: 10_000,
    tryKeyboard: false,
  };
}

async function withSftp<T>(config: ResolvedSftp, handler: (sftp: SFTPWrapper) => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const client = new Client();
    let settled = false;
    const finish = (error: Error | null, value?: T) => {
      if (settled) return;
      settled = true;
      client.end();
      if (error) reject(error);
      else resolve(value as T);
    };

    client.on("ready", () => {
      client.sftp(async (error, sftp) => {
        if (error) return finish(error);
        try {
          finish(null, await handler(sftp));
        } catch (handlerError) {
          finish(handlerError instanceof Error ? handlerError : new Error(String(handlerError)));
        }
      });
    });
    client.on("error", (error: Error) => finish(error));
    try {
      client.connect(connectConfig(config));
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

function mapError(error: unknown): HttpError {
  const message = error instanceof Error ? error.message : "Erreur SFTP";
  if (/authentication|All configured authentication methods failed/i.test(message)) {
    return new HttpError(502, "Authentification SFTP refusee", "sftp_auth_failed");
  }
  if (/timed out|timeout/i.test(message)) {
    return new HttpError(504, "Delai de connexion SFTP depasse", "sftp_timeout");
  }
  if (/ENOENT|No such file/i.test(message)) {
    return new HttpError(404, "Fichier introuvable sur le serveur", "sftp_not_found");
  }
  if (/EACCES|Permission denied/i.test(message)) {
    return new HttpError(403, "Permission refusee sur le serveur", "sftp_permission");
  }
  return new HttpError(502, `Erreur SFTP : ${message}`, "sftp_error");
}

export async function testSftpConnection(configArg?: ResolvedSftp): Promise<{ ok: true; cwd: string }> {
  const config = configArg ?? (await resolveSftpOrNull());
  if (!config) throw new SftpNotConfiguredError();
  try {
    return await withSftp(config, async (sftp) =>
      new Promise<{ ok: true; cwd: string }>((resolve, reject) => {
        sftp.realpath(".", (error, path) => {
          if (error) return reject(error);
          resolve({ ok: true, cwd: path });
        });
      }),
    );
  } catch (error) {
    throw mapError(error);
  }
}

function resolveRemotePath(config: ResolvedSftp, path: string): string {
  const normalized = normalizeRemotePath(path);
  if (!config.remoteRoot || config.remoteRoot === "/") return normalized;
  const root = normalizeRemotePath(config.remoteRoot);
  return normalized === "/" ? root : `${root}${normalized}`;
}

export async function sftpList(path: string): Promise<SftpEntry[]> {
  const config = await resolveSftpOrNull();
  if (!config) throw new SftpNotConfiguredError();
  const remote = resolveRemotePath(config, path);
  try {
    return await withSftp(config, (sftp) =>
      new Promise<SftpEntry[]>((resolve, reject) => {
        sftp.readdir(remote, (error, list) => {
          if (error) return reject(error);
          resolve(
            list
              .filter((item) => item.filename !== "." && item.filename !== "..")
              .map((item) => ({
                name: item.filename,
                path: normalizeRemotePath(`${path}/${item.filename}`),
                isFile: item.attrs.isFile(),
                size: item.attrs.size,
                modifiedAt: new Date(item.attrs.mtime * 1000),
                mode: item.attrs.mode,
              })),
          );
        });
      }),
    );
  } catch (error) {
    throw mapError(error);
  }
}

export async function sftpReadFile(path: string, maxBytes = 2_000_000): Promise<string> {
  const config = await resolveSftpOrNull();
  if (!config) throw new SftpNotConfiguredError();
  const remote = resolveRemotePath(config, path);
  try {
    return await withSftp(config, (sftp) =>
      new Promise<string>((resolve, reject) => {
        sftp.stat(remote, (statError, stats) => {
          if (statError) return reject(statError);
          if (stats.size > maxBytes) {
            return reject(new HttpError(413, "Fichier trop volumineux pour l'editeur", "file_too_large"));
          }
          sftp.readFile(remote, (readError, data) => {
            if (readError) return reject(readError);
            resolve(data.toString("utf8"));
          });
        });
      }),
    );
  } catch (error) {
    throw error instanceof HttpError ? error : mapError(error);
  }
}

export async function sftpWriteFile(path: string, content: string): Promise<void> {
  const config = await resolveSftpOrNull();
  if (!config) throw new SftpNotConfiguredError();
  const remote = resolveRemotePath(config, path);
  try {
    await withSftp(config, (sftp) =>
      new Promise<void>((resolve, reject) => {
        sftp.writeFile(remote, content, { encoding: "utf8" }, (error) => {
          if (error) return reject(error);
          resolve();
        });
      }),
    );
  } catch (error) {
    throw mapError(error);
  }
}

export async function sftpStat(path: string): Promise<{ size: number; modifiedAt: Date; isFile: boolean } | null> {
  const config = await resolveSftpOrNull();
  if (!config) throw new SftpNotConfiguredError();
  const remote = resolveRemotePath(config, path);
  try {
    return await withSftp(config, (sftp) =>
      new Promise((resolve, reject) => {
        sftp.stat(remote, (error, stats) => {
          if (error) {
            if (/No such file/i.test(error.message)) return resolve(null);
            return reject(error);
          }
          resolve({ size: stats.size, modifiedAt: new Date(stats.mtime * 1000), isFile: stats.isFile() });
        });
      }),
    );
  } catch (error) {
    throw mapError(error);
  }
}

export async function sftpDeleteFile(path: string): Promise<void> {
  const config = await resolveSftpOrNull();
  if (!config) throw new SftpNotConfiguredError();
  const remote = resolveRemotePath(config, path);
  try {
    await withSftp(config, (sftp) =>
      new Promise<void>((resolve, reject) => {
        sftp.unlink(remote, (error) => (error ? reject(error) : resolve()));
      }),
    );
  } catch (error) {
    throw mapError(error);
  }
}

export async function sftpMkdir(path: string): Promise<void> {
  const config = await resolveSftpOrNull();
  if (!config) throw new SftpNotConfiguredError();
  const remote = resolveRemotePath(config, path);
  try {
    await withSftp(config, (sftp) =>
      new Promise<void>((resolve, reject) => {
        sftp.mkdir(remote, (error) => (error ? reject(error) : resolve()));
      }),
    );
  } catch (error) {
    throw mapError(error);
  }
}

export { resolveSftp };
