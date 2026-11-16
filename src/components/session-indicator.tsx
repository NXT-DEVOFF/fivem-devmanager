"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pause, Play, Square, Timer } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { Badge, Button, cn } from "@/components/ui/primitives";
import { formatClock } from "@/lib/format";
import { useSessionClock } from "@/lib/use-session-clock";

interface ActiveSession {
  id: string;
  number: number;
  status: "ACTIVE" | "PAUSED";
  startedAt: string;
  activeSeconds: number;
  currentTaskId: string | null;
  tasks: Array<{ id: string; code: string; title: string }>;
}

export function SessionIndicator({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [session, setSession] = React.useState<ActiveSession | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const payload = await apiFetch<{ session: ActiveSession | null }>("/api/sessions/active");
      setSession(payload.session);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    window.addEventListener("fdm:session-change", onFocus);
    const interval = setInterval(() => void load(), 20_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("fdm:session-change", onFocus);
      clearInterval(interval);
    };
  }, [load]);

  // Meme base de temps que la page de session : mesure serveur + derive locale.
  const liveSeconds = useSessionClock(session?.activeSeconds ?? 0, session?.status === "ACTIVE");

  async function action(kind: "pause" | "resume" | "end") {
    if (!session) return;
    setBusy(true);
    try {
      await apiFetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        body: kind === "end" ? { action: "end" } : { action: kind },
      });
      toast.success(
        kind === "end" ? "Session terminee, rapport en cours de generation" : kind === "pause" ? "Session en pause" : "Session reprise",
      );
      await load();
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="h-9 w-32 animate-pulse rounded-lg bg-white/5" />;
  }

  if (!session) {
    return (
      <Link
        href="/sessions?start=1"
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-lg border border-primary-500/40 bg-primary-500/10 px-3 text-xs font-medium text-primary-200 transition-colors hover:bg-primary-500/20",
        )}
      >
        <Timer className="h-3.5 w-3.5" />
        {compact ? "Session" : "Demarrer une session"}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href={`/sessions/${session.id}`}
        className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2.5 transition-colors hover:border-border-strong"
        title={`Session #DEV-${String(session.number).padStart(4, "0")}`}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            session.status === "ACTIVE" ? "bg-success animate-pulse-ring" : "bg-warning",
          )}
        />
        <span className="mono text-xs font-semibold tabular-nums">{formatClock(liveSeconds)}</span>
        <Badge variant={session.status === "ACTIVE" ? "success" : "warning"} className="hidden sm:inline-flex">
          {session.status === "ACTIVE" ? "Live" : "Pause"}
        </Badge>
      </Link>
      {!compact ? (
        <div className="flex items-center gap-1">
          {session.status === "ACTIVE" ? (
            <Button size="icon" variant="ghost" onClick={() => action("pause")} disabled={busy} title="Mettre en pause">
              <Pause className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button size="icon" variant="ghost" onClick={() => action("resume")} disabled={busy} title="Reprendre">
              <Play className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => action("end")}
            disabled={busy}
            title="Terminer la session"
            className="hover:text-danger"
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Declenche un rafraichissement de l'indicateur de session (apres demarrage). */
export function announceSessionChange(): void {
  window.dispatchEvent(new Event("fdm:session-change"));
}
