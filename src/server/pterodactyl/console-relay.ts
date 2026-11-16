/**
 * Relais WebSocket de la console Pterodactyl.
 *
 * Le backend ouvre la connexion authentifiee vers Wings et rediffuse les
 * lignes aux clients autorises (permission server.console).
 */
import "server-only";
import WebSocket from "ws";
import type { Server as SocketServer, Socket } from "socket.io";
import { resolvePterodactyl } from "@/server/integrations";
import { stripAnsi } from "@/lib/ansi";

interface RelayState {
  socket: WebSocket | null;
  token: string | null;
  wsUrl: string | null;
  connecting: boolean;
  subscribers: Set<string>;
  buffer: Array<{ line: string; at: string }>;
  status: string;
  stats: Record<string, unknown> | null;
  retry: number;
  retryTimer: NodeJS.Timeout | null;
  configId: string | null;
  wsHost: string | null;
  lastError: string | null;
  tlsInsecure: boolean;
  attempts: number;
}

const MAX_BUFFER = 600;
const MONITOR_ID = "__monitor__";

// Erreurs de certificat : frequentes quand le noeud Wings utilise un certificat auto-signe.
const CERT_ERROR = /self[- ]?signed|unable to verify|certificate|CERT_|ERR_TLS|altnames/i;

// Les logs FiveM contiennent des sequences ANSI (couleurs, liens OSC).
// L'interface est du texte brut : on les retire avant le tampon et la detection.
function cleanConsoleLine(line: string): string {
  return stripAnsi(line);
}

function describeWsError(error: Error & { code?: string }): string {
  return `${error.code ? `${error.code}: ` : ""}${error.message || "erreur inconnue"}`;
}

/**
 * Wings n'accepte que les handshakes dont l'origine correspond au panel.
 * Un navigateur envoie cet en-tete automatiquement, mais le client `ws` de
 * Node ne le fait pas : sans lui, Wings repond 403 avant meme l'auth du token.
 */
function websocketOrigin(panelUrl: string): string {
  try {
    return new URL(panelUrl).origin;
  } catch {
    return panelUrl;
  }
}

class PterodactylConsoleRelay {
  private state: RelayState = {
    socket: null,
    token: null,
    wsUrl: null,
    connecting: false,
    subscribers: new Set(),
    buffer: [],
    status: "unknown",
    stats: null,
    retry: 0,
    retryTimer: null,
    configId: null,
    wsHost: null,
    lastError: null,
    tlsInsecure: false,
    attempts: 0,
  };

  private io: SocketServer | null = null;
  private monitoring = false;
  private pendingDetection: Array<{ line: string; at: string }> = [];
  private detectionTimer: NodeJS.Timeout | null = null;

  async subscribe(io: SocketServer, socket: Socket): Promise<void> {
    this.io = io;
    this.state.subscribers.add(socket.id);
    socket.join("console");

    try {
      const { id: configId } = await resolvePterodactyl();
      if (this.state.configId !== configId) {
        this.teardown();
        this.state.configId = configId;
      }
    } catch (error) {
      // Sans ce garde-fou, l'echec restait silencieux : l'interface affichait
      // "disconnected" indefiniment sans aucune explication.
      const message = error instanceof Error ? error.message : "Pterodactyl n'est pas configure";
      this.state.lastError = message;
      this.state.status = "error";
      socket.emit("console:error", { message });
      socket.emit("console:status", { state: "error", error: message });
      this.pushLocalLine(`[Console] ${message}`);
      return;
    }

    if (this.state.buffer.length > 0) {
      socket.emit("console:backlog", { lines: this.state.buffer.slice(-200) });
    }
    socket.emit("console:status", { state: this.state.status, error: this.state.lastError });

    if (!this.state.socket || this.state.socket.readyState > WebSocket.OPEN) {
      await this.connect();
    }
  }

  /**
   * Maintient une connexion Wings en continu (sans navigateur ouvert) afin que
   * la detection automatique des bugs et le tampon de logs restent alimentes.
   */
  async startMonitoring(): Promise<void> {
    // Le worker repasse chaque minute : ne jamais sortir en avance quand
    // "monitoring" est deja vrai. Sinon une coupure reseau ou un echec au
    // demarrage laissait la console deconnectee indefiniment, sans aucun
    // abonne pour relancer la connexion.
    this.monitoring = true;
    this.state.subscribers.add(MONITOR_ID);
    try {
      const { id } = await resolvePterodactyl();
      if (this.state.configId !== id) {
        this.teardown();
        this.state.configId = id;
      }
      if (!this.state.socket || this.state.socket.readyState > WebSocket.OPEN) {
        await this.connect();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Console Wings injoignable";
      this.state.status = "error";
      this.state.lastError = message;
      this.emitStatus("error");
      throw error;
    }
  }

  /** Reconnexion forcee (bouton interface ou changement de configuration). */
  async reconnect(): Promise<void> {
    this.teardown();
    this.state.configId = null;
    this.state.retry = 0;
    this.state.attempts = 0;
    this.state.lastError = null;
    this.state.tlsInsecure = false;
    this.state.subscribers.add(MONITOR_ID);
    await this.connect();
    if (!this.getStatus().connected) {
      throw new Error(this.state.lastError ?? "Wings n'a pas accepte la connexion");
    }
  }

  unsubscribe(socketId: string): void {
    this.state.subscribers.delete(socketId);
    if (this.state.subscribers.size === 0) {
      // On conserve la connexion quelques minutes pour eviter les reconnexions
      // en rafale, puis on libere.
      const timer = setTimeout(() => {
        if (this.state.subscribers.size === 0) this.teardown();
      }, 120_000);
      timer.unref?.();
    }
  }

  getStatus(): {
    state: string;
    connected: boolean;
    subscribers: number;
    host: string | null;
    lastError: string | null;
    attempts: number;
    insecureTls: boolean;
  } {
    return {
      state: this.state.status,
      connected: Boolean(this.state.socket && this.state.socket.readyState === WebSocket.OPEN),
      subscribers: this.state.subscribers.size,
      host: this.state.wsHost,
      lastError: this.state.lastError,
      attempts: this.state.attempts,
      insecureTls: this.state.tlsInsecure,
    };
  }

  getBuffer(limit = 200) {
    return this.state.buffer.slice(-limit);
  }

  private async connect(): Promise<void> {
    if (this.state.connecting) return;
    this.state.connecting = true;
    this.state.attempts += 1;
    try {
      const { client, panelUrl } = await resolvePterodactyl();
      const credentials = await client.getWebsocketCredentials();

      // L'URL fournie par Pterodactyl contient deja le chemin complet.
      const url = credentials.socket;
      const origin = websocketOrigin(panelUrl);
      try {
        const parsed = new URL(url);
        this.state.wsHost = `${parsed.protocol}//${parsed.host}`;
      } catch {
        this.state.wsHost = "URL Wings invalide";
      }

      const socket = new WebSocket(url, {
        handshakeTimeout: 15_000,
        headers: {
          Origin: origin,
          "User-Agent": "FiveM-DevManager/1.0",
        },
        ...(this.state.tlsInsecure ? { rejectUnauthorized: false } : {}),
      });

      this.state.socket = socket;
      this.state.token = credentials.token;

      socket.on("open", () => {
        this.state.status = "connecting";
        this.emitStatus("connecting");
        socket.send(JSON.stringify({ event: "auth", args: [credentials.token] }));
      });

      socket.on("message", (raw) => {
        this.handleMessage(raw.toString());
      });

      socket.on("error", (rawError) => {
        const message = describeWsError(rawError as Error & { code?: string });
        this.state.lastError = message;
        console.error(`[console] erreur websocket ${this.state.wsHost ?? ""}: ${message}`);

        // Noeud Wings avec certificat auto-signe : nouvelle tentative sans verification TLS.
        if (!this.state.tlsInsecure && CERT_ERROR.test(message)) {
          this.state.tlsInsecure = true;
          this.state.status = "connecting";
          this.pushLocalLine(
            "[Console] Certificat du noeud Wings non verifiable : nouvelle tentative sans verification TLS.",
          );
          try {
            socket.terminate();
          } catch {
            // ignore
          }
          this.scheduleReconnect(1_000);
          return;
        }

        this.state.status = "error";
        this.emitStatus("error");
        this.pushLocalLine(`[Console] Wings injoignable : ${message}`);
      });

      socket.on("close", (code, reason) => {
        this.state.socket = null;
        const detail = `connexion fermee (code ${code}${reason?.length ? ` : ${reason.toString()}` : ""})`;
        if (code !== 1000 && this.state.status !== "connected") {
          this.state.lastError = this.state.lastError
            ? `${this.state.lastError} · ${detail}`
            : detail;
          console.error(`[console] ${detail} vers ${this.state.wsHost ?? "Wings"}`);
        }
        this.state.status = "disconnected";
        this.emitStatus("disconnected");
        if (this.state.subscribers.size > 0) this.scheduleReconnect();
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connexion console impossible";
      this.state.lastError = message;
      this.state.status = "error";
      console.error("[console]", message);
      this.emitStatus("error");
      this.pushLocalLine(`[Console] ${message}`);
      if (this.state.subscribers.size > 0) this.scheduleReconnect();
    } finally {
      this.state.connecting = false;
    }
  }

  private handleMessage(raw: string): void {
    let payload: { event?: string; args?: unknown[] };
    try {
      payload = JSON.parse(raw) as { event?: string; args?: unknown[] };
    } catch {
      return;
    }

    const args = payload.args ?? [];
    switch (payload.event) {
      case "auth success":
        this.state.status = "connected";
        this.state.retry = 0;
        this.state.attempts = 0;
        this.state.lastError = null;
        this.emitStatus("connected");
        this.state.socket?.send(JSON.stringify({ event: "send logs", args: [] }));
        this.state.socket?.send(JSON.stringify({ event: "send stats", args: [] }));
        break;
      case "auth error":
        this.pushLocalLine("[Console] Authentification console refusee par Wings");
        this.state.socket?.close();
        break;
      case "token expiring":
        void this.refreshToken();
        break;
      case "token expired":
        void this.refreshToken(true);
        break;
      case "console output":
        if (typeof args[0] === "string") this.pushLine(args[0]);
        break;
      case "status":
        if (typeof args[0] === "string") {
          this.state.status = args[0];
          this.emitStatus(args[0]);
        }
        break;
      case "stats": {
        const stats = args[0];
        if (stats && typeof stats === "object") {
          this.state.stats = stats as Record<string, unknown>;
          this.io?.to("console").emit("console:stats", stats);
        }
        break;
      }
      default:
        break;
    }
  }

  private async refreshToken(forceReconnect = false): Promise<void> {
    try {
      const { client } = await resolvePterodactyl();
      const credentials = await client.getWebsocketCredentials();
      this.state.token = credentials.token;
      if (this.state.socket && this.state.socket.readyState === WebSocket.OPEN && !forceReconnect) {
        this.state.socket.send(JSON.stringify({ event: "auth", args: [credentials.token] }));
      } else if (forceReconnect) {
        this.state.socket?.close();
      }
    } catch (error) {
      console.error("[console] refresh token impossible:", error);
    }
  }

  private scheduleReconnect(fixedDelay?: number): void {
    if (this.state.retryTimer) return;
    const delay = fixedDelay ?? Math.min(30_000, 2_000 * Math.max(1, this.state.retry));
    this.state.retry = Math.min(this.state.retry + 1, 10);
    this.state.retryTimer = setTimeout(() => {
      this.state.retryTimer = null;
      if (this.state.subscribers.size > 0) void this.connect();
    }, delay);
    this.state.retryTimer.unref?.();
  }

  private emitStatus(state: string): void {
    this.io?.to("console").emit("console:status", { state });
    this.io?.to("activity").emit("server.status", { state, at: new Date().toISOString() });
  }

  private pushLine(line: string): void {
    const at = new Date().toISOString();
    const clean = cleanConsoleLine(line);
    this.state.buffer.push({ line: clean, at });
    if (this.state.buffer.length > MAX_BUFFER) this.state.buffer.shift();
    this.io?.to("console").emit("console:line", { line: clean, at });
    this.queueDetection(clean, at);
  }

  /** Analyse par lots : evite une requete base par ligne de console. */
  private queueDetection(line: string, at: string): void {
    this.pendingDetection.push({ line, at });
    if (this.pendingDetection.length > 300) this.pendingDetection.shift();
    if (this.detectionTimer) return;
    this.detectionTimer = setTimeout(() => {
      this.detectionTimer = null;
      const batch = this.pendingDetection.splice(0, this.pendingDetection.length);
      if (batch.length === 0) return;
      void import("@/server/bug-detector")
        .then(({ detectBugsFromConsole }) => detectBugsFromConsole(batch, { maxPerRun: 5 }))
        .catch((error) => console.error("[console] detection de bugs:", error));
    }, 5_000);
    this.detectionTimer.unref?.();
  }

  private pushLocalLine(line: string): void {
    this.pushLine(line);
  }

  private teardown(): void {
    if (this.state.retryTimer) clearTimeout(this.state.retryTimer);
    this.state.retryTimer = null;
    this.state.buffer = [];
    this.state.stats = null;
    try {
      this.state.socket?.close();
    } catch {
      // ignore
    }
    this.state.socket = null;
    this.state.status = "disconnected";
  }
}

const globalForRelay = globalThis as unknown as { __fdmConsoleRelay?: PterodactylConsoleRelay };

export const consoleRelay = globalForRelay.__fdmConsoleRelay ?? new PterodactylConsoleRelay();
if (!globalForRelay.__fdmConsoleRelay) globalForRelay.__fdmConsoleRelay = consoleRelay;
