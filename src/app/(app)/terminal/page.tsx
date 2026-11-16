"use client";

import * as React from "react";
import { CornerDownLeft, Play, RefreshCw, RotateCw, TerminalSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/use-api";
import { apiFetch, errorMessage, ApiError } from "@/lib/api-client";
import { useRealtime } from "@/components/realtime-provider";
import { Badge, Button, Card, Input, PageHeader, Skeleton } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/format";

interface TerminalPayload {
  commands: Array<{ id: string; label: string; description: string; mode: string }>;
  history: Array<{ id: string; command: string; createdAt: string; result: string }>;
  console: { state: string; connected: boolean; lastError?: string | null; host?: string | null };
}

export default function TerminalPage() {
  const { can } = useRealtime();
  const terminal = useApi<TerminalPayload>("/api/terminal");
  const [output, setOutput] = React.useState<string[]>([
    "FiveM DevManager - terminal integre",
    "Les commandes sont executees via la console Pterodactyl autorisee.",
    "",
  ]);
  const [command, setCommand] = React.useState("");
  const [resource, setResource] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [output]);

  function push(lines: string | string[]) {
    setOutput((current) => [...current, ...(Array.isArray(lines) ? lines : [lines])]);
  }

  async function run(body: Record<string, unknown>, label: string) {
    setBusy(true);
    push(`$ ${label}`);
    try {
      const result = await apiFetch<{ output: string }>("/api/terminal", { method: "POST", body });
      push(result.output.split("\n"));
      await terminal.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 412) {
        push("[info] Aucune integration Pterodactyl configuree. Rendez-vous dans Infrastructure.");
        toast.error("Pterodactyl non configure");
      } else {
        push(`[erreur] ${errorMessage(error)}`);
        toast.error(errorMessage(error));
      }
    } finally {
      setBusy(false);
      push("");
    }
  }

  async function reconnectConsole() {
    try {
      await apiFetch("/api/infrastructure/console/reconnect", { method: "POST" });
      toast.success("Reconnexion console demandee");
      await terminal.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div>
      <PageHeader
        title="Terminal de developpement"
        description="Commandes predefinies et console FiveM. Pas d'acces shell systeme : tout passe par l'API Pterodactyl."
        eyebrow="Developpement"
      >
        <Badge variant={terminal.data?.console.connected ? "success" : "neutral"}>
          Console {terminal.data?.console.state ?? "inconnue"}
        </Badge>
        <Button size="sm" variant="secondary" onClick={() => void reconnectConsole()}>
          <RefreshCw className="h-3.5 w-3.5" /> Reconnecter
        </Button>
      </PageHeader>

      {terminal.data && !terminal.data.console.connected ? (
        <Card className="mb-4 p-4 text-xs text-warning">
          Console Wings {terminal.data.console.state}
          {terminal.data.console.lastError
            ? ` : ${terminal.data.console.lastError}`
            : " — les commandes et l'etat du serveur fonctionnent, seule la lecture des logs est indisponible."}
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <div className="panel-header">
              <h3 className="text-sm font-semibold">Commandes rapides</h3>
            </div>
            <div className="p-2">
              {terminal.loading ? (
                <Skeleton className="h-32" />
              ) : terminal.data?.commands.length === 0 ? (
                <p className="px-2 py-4 text-[11px] text-muted">
                  Aucune commande disponible avec vos permissions.
                </p>
              ) : (
                terminal.data?.commands.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() =>
                      entry.mode === "resource"
                        ? document.getElementById("resource-input")?.focus()
                        : void run({ action: "predefined", id: entry.id }, entry.label)
                    }
                    disabled={busy}
                    className="w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/5 disabled:opacity-50"
                  >
                    <p className="text-[11px] text-fg">{entry.label}</p>
                    <p className="text-[10px] text-muted">{entry.description}</p>
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card>
            <div className="panel-header">
              <h3 className="text-sm font-semibold">Ressource</h3>
            </div>
            <div className="space-y-2 p-3">
              <Input
                id="resource-input"
                value={resource}
                onChange={(event) => setResource(event.target.value)}
                placeholder="garage ou [vehicles]/garage"
                className="h-8 font-mono text-[11px]"
              />
              <div className="grid grid-cols-2 gap-1.5">
                {(["ensure", "restart"] as const).map((mode) => (
                  <Button
                    key={mode}
                    size="sm"
                    variant="secondary"
                    disabled={!resource.trim() || busy || !can("server.console.send")}
                    onClick={() => void run({ action: "resource", resource, mode }, `${mode} ${resource}`)}
                  >
                    <RotateCw className="h-3 w-3" /> {mode}
                  </Button>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <div className="panel-header">
              <h3 className="text-sm font-semibold">Historique</h3>
            </div>
            <div className="max-h-52 overflow-y-auto p-2">
              {(terminal.data?.history ?? []).length === 0 ? (
                <p className="px-2 py-3 text-[10px] text-muted">Aucune commande recente.</p>
              ) : (
                terminal.data?.history.map((entry) => (
                  <div key={entry.id} className="rounded px-2 py-1 text-[10px] hover:bg-white/5">
                    <p className="mono truncate text-fg">{entry.command}</p>
                    <p className="text-muted">{relativeTime(entry.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <Card className="flex flex-col overflow-hidden lg:col-span-3">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <TerminalSquare className="h-4 w-4 text-primary-300" />
            <h3 className="text-sm font-semibold">Sortie</h3>
            <Button size="icon" variant="ghost" className="ml-auto" onClick={() => setOutput([])} title="Vider">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="h-[52vh] overflow-y-auto bg-[#0b0f16] p-3 font-mono text-[11px] leading-relaxed text-[#c9d4e3]">
            {output.map((line, index) => (
              <div
                key={index}
                className={
                  line.startsWith("$ ")
                    ? "text-primary-300"
                    : line.startsWith("[erreur]")
                      ? "text-danger"
                      : line.startsWith("[info]")
                        ? "text-warning"
                        : "whitespace-pre-wrap break-words"
                }
              >
                {line || "\u00A0"}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="flex items-center gap-2 border-t border-border p-2">
            <span className="pl-1 text-[11px] text-primary-300">$</span>
            <Input
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && command.trim()) {
                  void run({ action: "console", command }, command);
                  setCommand("");
                }
              }}
              placeholder={can("server.console.send") ? "Commande console..." : "Permission requise"}
              disabled={!can("server.console.send")}
              className="h-8 flex-1 font-mono text-xs"
            />
            <Button
              size="sm"
              variant="primary"
              disabled={!command.trim() || busy || !can("server.console.send")}
              onClick={() => {
                void run({ action: "console", command }, command);
                setCommand("");
              }}
              loading={busy}
            >
              <CornerDownLeft className="h-3.5 w-3.5" /> Executer
            </Button>
          </div>
        </Card>
      </div>

      <p className="mt-3 flex items-center gap-2 text-[11px] text-muted">
        <Play className="h-3 w-3" />
        Toutes les commandes sont journalisees dans le journal d&apos;audit avec l&apos;utilisateur et
        le resultat.
      </p>
    </div>
  );
}
