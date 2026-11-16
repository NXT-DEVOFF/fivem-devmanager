"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useRealtime } from "@/components/realtime-provider";
import { cn } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/format";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const { unreadNotifications, refreshNotifications, socket } = useRealtime();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const menuId = React.useId();

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch<{ notifications: NotificationItem[] }>("/api/notifications?limit=8");
      setItems(payload.notifications);
    } catch (caught) {
      setItems([]);
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);

  React.useEffect(() => {
    if (!socket) return;
    const handler = () => {
      if (open) void load();
    };
    socket.on("notification:new", handler);
    return () => {
      socket.off("notification:new", handler);
    };
  }, [socket, open, load]);

  React.useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  async function markAllRead() {
    try {
      await apiFetch("/api/notifications", { method: "PATCH", body: { all: true } });
      setItems((current) => current.map((item) => ({ ...item, readAt: new Date().toISOString() })));
      refreshNotifications();
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-muted transition-colors hover:border-border hover:bg-card hover:text-fg",
          open && "border-border bg-card text-fg",
        )}
        aria-label={unreadNotifications > 0 ? `Notifications (${unreadNotifications} non lues)` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
      >
        <Bell className="h-4 w-4" />
        {unreadNotifications > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
            {unreadNotifications > 9 ? "9+" : unreadNotifications}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 top-11 z-40 w-[340px] animate-in overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <p className="text-xs font-semibold">Notifications</p>
            <button
              role="menuitem"
              onClick={markAllRead}
              className="flex items-center gap-1 text-[10px] text-muted hover:text-fg"
            >
              <Check className="h-3 w-3" /> Tout lire
            </button>
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {loading ? (
              <p className="px-3 py-6 text-center text-xs text-muted">Chargement...</p>
            ) : error ? (
              <div className="space-y-2 px-3 py-6 text-center">
                <p className="text-xs text-danger">{error}</p>
                <button
                  onClick={() => void load()}
                  className="rounded-md border border-border px-3 py-1 text-[11px] text-muted hover:text-fg"
                >
                  Reessayer
                </button>
              </div>
            ) : items.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-muted">Aucune notification.</p>
            ) : (
              items.map((item) => (
                <Link
                  key={item.id}
                  href={item.link ?? "/notifications"}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block border-b border-border/50 px-3 py-2.5 transition-colors last:border-0 hover:bg-white/[0.03]",
                    !item.readAt && "bg-primary-500/[0.04]",
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!item.readAt ? <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" /> : <span className="mt-1.5 h-1.5 w-1.5 shrink-0" />}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-fg">{item.title}</p>
                      {item.body ? <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">{item.body}</p> : null}
                      <p className="mt-1 text-[10px] text-muted/60">{relativeTime(item.createdAt)}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 border-t border-border px-3 py-2 text-[11px] text-muted hover:text-fg"
          >
            Voir toutes les notifications <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
