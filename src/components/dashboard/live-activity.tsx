"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bug,
  CircleDot,
  FileCode2,
  Package,
  PlayCircle,
  Rocket,
  Siren,
  Square,
  WifiOff,
} from "lucide-react";
import { useRealtime, type ActivityEvent } from "@/components/realtime-provider";
import { cn } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/format";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "session.started": PlayCircle,
  "session.ended": Square,
  "session.paused": CircleDot,
  "session.resumed": PlayCircle,
  "file.changed": FileCode2,
  "resource.added": Package,
  "task.completed": CircleDot,
  "bug.reported": Bug,
  "incident.reported": Siren,
  "incident.mitigated": Siren,
  "incident.resolved": Siren,
  "deployment.done": Rocket,
};

const COLORS: Record<string, string> = {
  "session.started": "text-success bg-success/10 border-success/20",
  "session.ended": "text-muted bg-white/5 border-border",
  "session.paused": "text-warning bg-warning/10 border-warning/20",
  "session.resumed": "text-success bg-success/10 border-success/20",
  "file.changed": "text-primary-300 bg-primary-500/10 border-primary-500/20",
  "task.completed": "text-success bg-success/10 border-success/20",
  "bug.reported": "text-danger bg-danger/10 border-danger/20",
  "incident.reported": "text-danger bg-danger/10 border-danger/20",
  "incident.mitigated": "text-warning bg-warning/10 border-warning/20",
  "incident.resolved": "text-success bg-success/10 border-success/20",
  "deployment.done": "text-info bg-info/10 border-info/20",
};

export function LiveActivity({ initial }: { initial: ActivityEvent[] }) {
  const { events, connected } = useRealtime();
  const [merged, setMerged] = React.useState<ActivityEvent[]>(initial);

  React.useEffect(() => {
    if (events.length === 0) return;
    setMerged((current) => {
      const seen = new Set(current.map((event) => `${event.type}:${event.timestamp}:${event.title}`));
      const additions = events.filter(
        (event) => !seen.has(`${event.type}:${event.timestamp}:${event.title}`),
      );
      return [...additions, ...current].slice(0, 25);
    });
  }, [events]);

  return (
    <div className="panel flex h-full flex-col">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {connected ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            ) : null}
            <span className={cn("relative h-2 w-2 rounded-full", connected ? "bg-success" : "bg-danger")} />
          </span>
          <h3 className="text-sm font-semibold">Activite en direct</h3>
        </div>
        <span className="text-[10px] text-muted">
          {connected ? "WebSocket" : "Hors ligne"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {merged.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <WifiOff className="h-5 w-5 text-muted/50" />
            <p className="text-xs text-muted">Aucune activite recente.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {merged.map((event, index) => {
              const Icon = ICONS[event.type] ?? CircleDot;
              return (
                <li key={`${event.timestamp}-${index}`} className="flex gap-3 px-4 py-2.5">
                  <div
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
                      COLORS[event.type] ?? "border-border bg-white/5 text-muted",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] font-medium text-fg">{event.title}</p>
                    {event.detail ? (
                      <p className="truncate text-[10.5px] text-muted">{event.detail}</p>
                    ) : null}
                    <p className="mt-0.5 text-[10px] text-muted/60">
                      {event.actor?.name ? `${event.actor.name} · ` : ""}
                      {relativeTime(event.timestamp)}
                    </p>
                  </div>
                  {event.link ? (
                    <Link
                      href={event.link}
                      className="self-center text-[10px] text-primary-300 hover:underline"
                    >
                      voir
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
