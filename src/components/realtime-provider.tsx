"use client";

import * as React from "react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";

export interface ActivityEvent {
  type: string;
  title: string;
  detail?: string;
  actor?: { id: string; name: string } | null;
  link?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface RealtimeContextValue {
  connected: boolean;
  events: ActivityEvent[];
  socket: Socket | null;
  unreadNotifications: number;
  refreshNotifications: () => void;
  permissions: string[];
  can: (permission: string) => boolean;
}

const RealtimeContext = React.createContext<RealtimeContextValue>({
  connected: false,
  events: [],
  socket: null,
  unreadNotifications: 0,
  refreshNotifications: () => undefined,
  permissions: [],
  can: () => false,
});

export function useRealtime(): RealtimeContextValue {
  return React.useContext(RealtimeContext);
}

export function RealtimeProvider({
  children,
  initialUnread = 0,
  permissions = [],
}: {
  children: React.ReactNode;
  initialUnread?: number;
  permissions?: string[];
}) {
  const [connected, setConnected] = React.useState(false);
  const [events, setEvents] = React.useState<ActivityEvent[]>([]);
  const [unread, setUnread] = React.useState(initialUnread);
  const [socket, setSocket] = React.useState<Socket | null>(null);

  const refreshNotifications = React.useCallback(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload && typeof payload.unreadNotifications === "number") {
          setUnread(payload.unreadNotifications);
        }
      })
      .catch(() => undefined);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    let instance: Socket | null = null;

    void import("socket.io-client")
      .then(({ io }) => {
        if (cancelled) return;
        instance = io({
          path: "/socket.io",
          withCredentials: true,
          reconnectionDelay: 1500,
          reconnectionDelayMax: 10_000,
          transports: ["websocket", "polling"],
        });
        setSocket(instance);

        instance.on("connect", () => setConnected(true));
        instance.on("disconnect", () => setConnected(false));
        instance.on("connect_error", () => setConnected(false));

        instance.on("activity", (event: ActivityEvent) => {
          setEvents((current) => [event, ...current].slice(0, 60));
        });

        instance.on(
          "notification:new",
          (notification: { title: string; body?: string; link?: string }) => {
            setUnread((value) => value + 1);
            toast(notification.title, {
              description: notification.body,
              action: notification.link
                ? { label: "Ouvrir", onClick: () => (window.location.href = notification.link!) }
                : undefined,
            });
          },
        );

        instance.on("notification:read", () => refreshNotifications());
      })
      .catch(() => setConnected(false));

    return () => {
      cancelled = true;
      instance?.close();
      setSocket(null);
    };
  }, [refreshNotifications]);

  React.useEffect(() => {
    const timer = setInterval(refreshNotifications, 120_000);
    return () => clearInterval(timer);
  }, [refreshNotifications]);

  const value = React.useMemo(
    () => ({
      connected,
      events,
      socket,
      unreadNotifications: unread,
      refreshNotifications,
      permissions,
      can: (permission: string) => permissions.includes(permission),
    }),
    [connected, events, socket, unread, refreshNotifications, permissions],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
