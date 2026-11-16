/**
 * Client Pterodactyl (API Client + API Application).
 * Toutes les requetes partent du backend : aucune cle n'atteint le navigateur.
 */
import "server-only";
import { z } from "zod";

export interface PterodactylCredentials {
  panelUrl: string;
  serverId: string;
  clientApiKey: string;
  applicationApiKey?: string | null;
}

export class PterodactylError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 0, code = "pterodactyl_error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const responseErrorSchema = z.object({
  errors: z
    .array(
      z.object({
        code: z.string().optional(),
        status: z.string().optional(),
        detail: z.string().optional(),
        meta: z.record(z.unknown()).optional(),
      }),
    )
    .optional(),
});

export interface PterodactylFileEntry {
  name: string;
  mode: string;
  mode_bits: string;
  size: number;
  is_file: boolean;
  is_symlink: boolean;
  mimetype: string;
  created_at: string;
  modified_at: string;
  directory?: string;
}

export interface PterodactylResources {
  current_state: string;
  is_suspended: boolean;
  resources: {
    memory_bytes: number;
    memory_limit_bytes?: number;
    cpu_absolute: number;
    disk_bytes: number;
    disk_limit_bytes?: number;
    network_rx_bytes: number;
    network_tx_bytes: number;
    uptime: number;
  };
}

export interface PterodactylBackup {
  uuid: string;
  name: string;
  ignored_files: string[];
  checksum: string | null;
  bytes: number;
  created_at: string;
  completed_at: string | null;
  is_successful: boolean;
  is_locked: boolean;
}

export interface PterodactylServerInfo {
  identifier: string;
  name: string;
  description?: string;
  node: string;
  status: string | null;
  is_suspended: boolean;
  limits: { memory: number; disk: number; cpu: number; swap: number; io: number };
  sftp_details: { ip: string; port: number; username: string };
  relationships?: { allocations?: { data?: Array<{ attributes: { ip: string; port: number; is_default: boolean } }> } };
}

/** Valide et normalise l'URL du panel (pas de slash final, http(s) uniquement). */
export function normalizePanelUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new PterodactylError("URL du panel invalide");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new PterodactylError("Le panel doit utiliser http ou https");
  }
  if (parsed.protocol === "http:" && !["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
    // On avertit sans bloquer : certains panels internes sont en HTTP.
    console.warn("[pterodactyl] panel en HTTP hors localhost : HTTPS recommande");
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`;
}

export class PterodactylClient {
  readonly panelUrl: string;
  readonly serverId: string;
  private readonly clientKey: string;
  private readonly applicationKey: string | null;

  constructor(credentials: PterodactylCredentials) {
    this.panelUrl = normalizePanelUrl(credentials.panelUrl);
    this.serverId = credentials.serverId;
    this.clientKey = credentials.clientApiKey;
    this.applicationKey = credentials.applicationApiKey?.trim() || null;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    auth: "client" | "application" = "client",
  ): Promise<T> {
    const key = auth === "application" ? this.applicationKey : this.clientKey;
    if (!key) {
      throw new PterodactylError(
        auth === "application"
          ? "Cle API Application non configuree"
          : "Cle API Client non configuree",
        0,
        "missing_credentials",
      );
    }

    let response: Response;
    try {
      response = await fetch(`${this.panelUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (error) {
      const message =
        error instanceof Error && error.name === "TimeoutError"
          ? "Le panel Pterodactyl ne repond pas (timeout 20s)"
          : "Impossible de joindre le panel Pterodactyl";
      throw new PterodactylError(message, 0, "network_error");
    }

    if (response.status === 204) return undefined as T;

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const parsed = responseErrorSchema.safeParse(payload);
      const detail = parsed.success ? parsed.data.errors?.[0]?.detail : undefined;
      const status = response.status;
      const message =
        status === 401
          ? "Cle API refusee par Pterodactyl (401)"
          : status === 403
            ? "Permission Pterodactyl insuffisante (403)"
            : status === 404
              ? "Serveur ou ressource introuvable sur le panel (404)"
              : detail ?? `Erreur Pterodactyl (${status})`;
      throw new PterodactylError(message, status);
    }

    return payload as T;
  }

  // --- Informations serveur -------------------------------------------------

  async getServer(): Promise<PterodactylServerInfo> {
    const data = await this.request<{ attributes: PterodactylServerInfo }>(
      `/api/client/servers/${encodeURIComponent(this.serverId)}`,
    );
    return data.attributes;
  }

  async getResources(): Promise<PterodactylResources & { attributes?: PterodactylResources }> {
    const data = await this.request<PterodactylResources & { attributes?: PterodactylResources }>(
      `/api/client/servers/${encodeURIComponent(this.serverId)}/resources`,
    );
    return "attributes" in data && data.attributes ? data.attributes : data;
  }

  async getAccount(): Promise<{ id: number; username: string; email: string }> {
    return (await this.request<{ attributes: { id: number; username: string; email: string } }>(
      "/api/client/account",
    )).attributes;
  }

  async getActivity(limit = 25): Promise<unknown[]> {
    const data = await this.request<{ data: Array<{ attributes: unknown }> }>(
      `/api/client/servers/${encodeURIComponent(this.serverId)}/activity?per_page=${limit}`,
    );
    return (data.data ?? []).map((entry) => entry.attributes);
  }

  // --- Alimentation / console ----------------------------------------------

  async sendPower(signal: "start" | "stop" | "restart" | "kill"): Promise<void> {
    await this.request(`/api/client/servers/${encodeURIComponent(this.serverId)}/power`, {
      method: "POST",
      body: JSON.stringify({ signal }),
    });
  }

  async sendCommand(command: string): Promise<void> {
    await this.request(`/api/client/servers/${encodeURIComponent(this.serverId)}/command`, {
      method: "POST",
      body: JSON.stringify({ command }),
    });
  }

  async getWebsocketCredentials(): Promise<{ token: string; socket: string }> {
    const data = await this.request<{ data: { token: string; socket: string } }>(
      `/api/client/servers/${encodeURIComponent(this.serverId)}/websocket`,
    );
    return data.data;
  }

  // --- Sauvegardes ----------------------------------------------------------

  async listBackups(): Promise<PterodactylBackup[]> {
    const data = await this.request<{ data: Array<{ attributes: PterodactylBackup }> }>(
      `/api/client/servers/${encodeURIComponent(this.serverId)}/backups`,
    );
    return (data.data ?? []).map((entry) => entry.attributes);
  }

  async createBackup(input: { name?: string; ignored?: string } = {}): Promise<PterodactylBackup> {
    const data = await this.request<{ attributes: PterodactylBackup }>(
      `/api/client/servers/${encodeURIComponent(this.serverId)}/backups`,
      {
        method: "POST",
        body: JSON.stringify({
          ...(input.name ? { name: input.name } : {}),
          ...(input.ignored ? { ignored: input.ignored } : {}),
        }),
      },
    );
    return data.attributes;
  }

  async deleteBackup(uuid: string): Promise<void> {
    await this.request(
      `/api/client/servers/${encodeURIComponent(this.serverId)}/backups/${encodeURIComponent(uuid)}`,
      { method: "DELETE" },
    );
  }

  async restoreBackup(uuid: string): Promise<void> {
    await this.request(
      `/api/client/servers/${encodeURIComponent(this.serverId)}/backups/${encodeURIComponent(uuid)}/restore`,
      { method: "POST" },
    );
  }

  async backupDownloadUrl(uuid: string): Promise<string> {
    const data = await this.request<{ attributes: { url: string } }>(
      `/api/client/servers/${encodeURIComponent(this.serverId)}/backups/${encodeURIComponent(uuid)}/download`,
    );
    return data.attributes.url;
  }

  // --- Fichiers -------------------------------------------------------------

  async listFiles(directory: string): Promise<PterodactylFileEntry[]> {
    const query = new URLSearchParams({ directory });
    const data = await this.request<{ data: Array<{ attributes: PterodactylFileEntry }> }>(
      `/api/client/servers/${encodeURIComponent(this.serverId)}/files/list?${query.toString()}`,
    );
    return (data.data ?? []).map((entry) => entry.attributes);
  }

  async readFile(file: string): Promise<string> {
    const response = await fetch(
      `${this.panelUrl}/api/client/servers/${encodeURIComponent(this.serverId)}/files/contents?${new URLSearchParams({ file }).toString()}`,
      {
        headers: { Authorization: `Bearer ${this.clientKey}`, Accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      throw new PterodactylError(
        response.status === 404 ? "Fichier introuvable" : `Lecture impossible (${response.status})`,
        response.status,
      );
    }
    return response.text();
  }

  async writeFile(file: string, content: string): Promise<void> {
    const response = await fetch(
      `${this.panelUrl}/api/client/servers/${encodeURIComponent(this.serverId)}/files/write?${new URLSearchParams({ file }).toString()}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.clientKey}`,
          Accept: "application/json",
          "Content-Type": "text/plain",
        },
        body: content,
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new PterodactylError(
        `Ecriture impossible (${response.status})${detail ? ` : ${detail.slice(0, 200)}` : ""}`,
        response.status,
      );
    }
  }

  async deleteFiles(root: string, files: string[]): Promise<void> {
    await this.request(`/api/client/servers/${encodeURIComponent(this.serverId)}/files/delete`, {
      method: "POST",
      body: JSON.stringify({ root, files }),
    });
  }

  async createFolder(root: string, name: string): Promise<void> {
    await this.request(
      `/api/client/servers/${encodeURIComponent(this.serverId)}/files/create-folder`,
      { method: "POST", body: JSON.stringify({ root, name }) },
    );
  }

  async renameFiles(root: string, files: Array<{ from: string; to: string }>): Promise<void> {
    await this.request(`/api/client/servers/${encodeURIComponent(this.serverId)}/files/rename`, {
      method: "POST",
      body: JSON.stringify({ root, files }),
    });
  }

  async compressFiles(root: string, files: string[]): Promise<void> {
    await this.request(`/api/client/servers/${encodeURIComponent(this.serverId)}/files/compress`, {
      method: "POST",
      body: JSON.stringify({ root, files }),
    });
  }

  async getDownloadUrl(file: string): Promise<string> {
    const data = await this.request<{ attributes: { url: string } }>(
      `/api/client/servers/${encodeURIComponent(this.serverId)}/files/download?${new URLSearchParams({ file }).toString()}`,
    );
    return data.attributes.url;
  }

  async getUploadUrl(): Promise<string> {
    const data = await this.request<{ attributes: { url: string } }>(
      `/api/client/servers/${encodeURIComponent(this.serverId)}/files/upload`,
    );
    return data.attributes.url;
  }

  async uploadFile(directory: string, file: { name: string; data: Buffer }): Promise<void> {
    const url = await this.getUploadUrl();
    const form = new FormData();
    form.append("files", new Blob([new Uint8Array(file.data)]), file.name);
    const response = await fetch(url, {
      method: "POST",
      body: form,
      // Wings utilise cet en-tete pour cibler le repertoire de l'URL signee.
      headers: { "X-Ptero-Upload-Directory": directory },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      throw new PterodactylError(`Televersement refuse (${response.status})`, response.status);
    }
  }

  // --- API Application (superadmin uniquement) ------------------------------

  async getApplicationServer(): Promise<unknown> {
    return this.request(
      `/api/application/servers/${encodeURIComponent(this.serverId)}`,
      {},
      "application",
    );
  }

  async getNode(nodeId: string): Promise<unknown> {
    return this.request(`/api/application/nodes/${encodeURIComponent(nodeId)}`, {}, "application");
  }
}
