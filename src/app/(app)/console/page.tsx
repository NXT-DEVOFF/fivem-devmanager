"use client";

import * as React from "react";
import { CircleDot, Filter, Pause, Play, RefreshCw, Send, TerminalSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRealtime } from "@/components/realtime-provider";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { Badge, Button, Card, Input, PageHeader, Select, cn } from "@/components/ui/primitives";
import { useApi } from "@/lib/use-api";
import { stripAnsi } from "@/lib/ansi";

interface Line {
  line: string;
  at: string;
}

function normalizeLine(line: Line): Line {
  return { ...line, line: stripAnsi(line.line) };
}

interface ConsoleInfra {
  configured: boolean;
  live?: {
    ok: boolean;
    error?: string;
    server?: { name: string; node: string };
  };
}

export default function ConsolePage() {
  const { socket, can } = useRealtime();
  const [lines, setLines] = React.useState<Line[]>([]);
  const [status, setStatus] = React.useState("disconnected");
  const [error, setError] = React.useState<string | null>(null);
  const [stats, setStats] = React.useState<{ cpu?: number; memory?: number } | null>(null);
  const [filter, setFilter] = React.useState("");
  const [paused, setPaused] = React.useState(false);
  const [command, setCommand] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const pausedRef = React.useRef(paused);
  pausedRef.current = paused;

  const infra = useApi<ConsoleInfra>("/api/infrastructure");

  React.useEffect(() => {
    if (!socket) return;

    socket.emit("console:subscribe");

    const onBacklog = (payload: { lines: Line[] }) => {
      setLines((current) => [...payload.lines.map(normalizeLine), ...current].slice(-1200));
    };
    const onLine = (payload: Line) => {
      if (pausedRef.current) return;
      setLines((current) => [...current, normalizeLine(payload)].slice(-1200));
    };
    const onStatus = (payload: { state: string; error?: string | null }) => {
      setStatus(payload.state);
      if (payload.error) setError(payload.error);
      else if (payload.state === "connected") setError(null);
    };
    const onStats = (payload: { cpu?: number; memory?: { used?: number } }) =>
      setStats({ cpu: payload.cpu, memory: payload.memory?.used });
    const onError = (payload: { message: string }) => {
      setError(payload.message);
      toast.error(payload.message);
    };

    socket.on("console:backlog", onBacklog);
    socket.on("console:line", onLine);
    socket.on("console:status", onStatus);
    socket.on("console:stats", onStats);
    socket.on("console:error", onError);

    return () => {
      socket.emit("console:unsubscribe");
      socket.off("console:backlog", onBacklog);
      socket.off("console:line", onLine);
      socket.off("console:status", onStatus);
      socket.off("console:stats", onStats);
      socket.off("console:error", onError);
    };
  }, [socket]);

  React.useEffect(() => {
    if (paused) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, paused]);

  // Repli HTTP si le temps reel est indisponible.
  React.useEffect(() => {
    if (socket?.connected) return;
    const interval = setInterval(async () => {
      try {
        const payload = await apiFetch<{
          status: { state: string; lastError?: string | null };
          lines: Line[];
        }>("/api/infrastructure/console?limit=200");
        setStatus(payload.status.state);
        if (payload.status.lastError) setError(payload.status.lastError);
        else if (payload.status.state === "connected") setError(null);
        if (!pausedRef.current && payload.lines.length > 0) setLines(payload.lines.map(normalizeLine));
      } catch {
        // ignore
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [socket?.connected]);

  async function send() {
    if (!command.trim()) return;
    setSending(true);
    try {
      await apiFetch("/api/infrastructure/command", { method: "POST", body: { command } });
      toast.success("Commande envoyee");
      setCommand("");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  async function reconnectConsole() {
    try {
      const result = await apiFetch<{ status: { state: string; lastError?: string | null } }>(
        "/api/infrastructure/console/reconnect",
        { method: "POST" },
      );
      toast.success(`Reconnexion demandee (${result.status.state})`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const visible = filter
    ? lines.filter((line) => line.line.toLowerCase().includes(filter.toLowerCase()))
    : lines;

  return (
    <div>
      <PageHeader
        title="Console du serveur FiveM"
        description={
          infra.data?.live?.server?.name
            ? `Flux temps reel de ${infra.data.live.server.name} via WebSocket Wings. Les commandes sont authentifiees et journalisees.`
            : "Flux temps reel du serveur FiveM via WebSocket Wings. Les commandes sont authentifiees et journalisees."
        }
        eyebrow="Supervision"
      >
        <Badge variant={status === "running" || status === "connected" ? "success" : status === "starting" ? "warning" : "neutral"}>
          <CircleDot className="h-3 w-3" /> {status}
        </Badge>
        {stats?.cpu !== undefined ? (
          <Badge variant="info">CPU {stats.cpu.toFixed(1)} %</Badge>
        ) : null}
        <Button size="sm" variant="secondary" onClick={() => void reconnectConsole()}>
          <RefreshCw className="h-3.5 w-3.5" /> Reconnecter
        </Button>
      </PageHeader>

      {infra.data && !infra.data.configured ? (
        <Card className="mb-4 p-4 text-xs text-warning">
          Pterodactyl n&apos;est pas configure : <a href="/infrastructure" className="underline">renseignez vos cles API</a>.
        </Card>
      ) : infra.data?.live && !infra.data.live.ok ? (
        <Card className="mb-4 p-4 text-xs text-danger">{infra.data.live.error}</Card>
      ) : null}

      {infra.data?.live?.server?.name ? (
        <div className="mb-3 flex items-center gap-2 text-[11px] text-muted">
          <TerminalSquare className="h-3 w-3" />
          Serveur cible : <span className="text-fg">{infra.data.live.server.name}</span>
          {can("integrations.manage") ? (
            <a href="/infrastructure" className="ml-auto underline hover:text-fg">
              Changer de serveur
            </a>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <Card className="mb-4 p-4 text-xs text-danger">
          Flux console indisponible : {error}
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" />
            <Input
              className="h-8 w-56 pl-8 text-xs"
              placeholder="Filtrer les lignes..."
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>
          <Select
            className="h-8 w-auto text-xs"
            value={paused ? "paused" : "live"}
            onChange={(event) => setPaused(event.target.value === "paused")}
          >
            <option value="live">Temps reel</option>
            <option value="paused">Pause defilement</option>
          </Select>
          <Button size="icon" variant="ghost" onClick={() => setLines([])} title="Vider l'affichage">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <span className="ml-auto text-[10px] text-muted">
            {visible.length} ligne(s) {filter ? `filtree(s) sur ${lines.length}` : "en memoire"}
          </span>
        </div>

        <div className="h-[55vh] overflow-y-auto bg-[#0b0f16] p-3 font-mono text-[11px] leading-relaxed">
          {visible.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
              <TerminalSquare className="h-6 w-6 opacity-40" />
              <p className="text-[11px]">
                {socket?.connected ? "En attente des logs..." : "Connexion au flux console..."}
              </p>
            </div>
          ) : (
            visible.map((line, index) => (
              <div
                key={`${line.at}-${index}`}
                className={cn(
                  "whitespace-pre-wrap break-words",
                  /error|exception|failed|crash/i.test(line.line)
                    ? "text-danger"
                    : /warn/i.test(line.line)
                      ? "text-warning"
                      : "text-[#c9d4e3]",
                )}
              >
                <span className="mr-2 select-none text-[#3f4a5c]">
                  {new Date(line.at).toLocaleTimeString("fr-FR")}
                </span>
                {line.line}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div className="flex items-center gap-2 border-t border-border p-2">
          <span className="pl-1 text-[11px] text-primary-300">&gt;</span>
          <Input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void send();
            }}
            placeholder={can("server.console.send") ? "Commande console FiveM..." : "Permission serveur.console.send requise"}
            disabled={!can("server.console.send")}
            className="h-8 flex-1 font-mono text-xs"
          />
          <Button size="sm" variant="primary" onClick={send} loading={sending} disabled={!can("server.console.send")}>
            <Send className="h-3.5 w-3.5" /> Envoyer
          </Button>
        </div>
      </Card>

      <p className="mt-3 flex items-center gap-2 text-[11px] text-muted">
        <Pause className="h-3 w-3" />
        La console respecte les permissions Pterodactyl. Le tampon est conserve en memoire du
        backend ; aucun acces shell n&apos;est expose.
        <Play className="ml-auto h-3 w-3" />
      </p>
    </div>
  );
}
