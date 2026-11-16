"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu, SquarePen } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { SessionIndicator } from "@/components/session-indicator";
import { RealtimeProvider, useRealtime } from "@/components/realtime-provider";
import { cn } from "@/components/ui/primitives";
import { WorkspaceProvider } from "@/components/windows/workspace";
import { WindowLauncher } from "@/components/windows/window-launcher";
import { WindowLayer } from "@/components/windows/window-layer";
import { PageTransition } from "@/components/motion/page-transition";
import { useApi } from "@/lib/use-api";
import type { LiveStatus } from "@/lib/live-status";
import type { Permission } from "@/server/permissions";

export function AppShell({
  children,
  user,
  permissions,
  serverName,
  unread,
}: {
  children: React.ReactNode;
  user: {
    id: string;
    displayName: string;
    email: string;
    role: string;
    avatarColor: string;
    twoFactorEnabled: boolean;
  };
  permissions: Permission[];
  serverName: string;
  unread: number;
}) {
  const searchParams = useSearchParams();

  // Mode integre : un module charge dans une fenetre flottante n'affiche ni la
  // navigation globale ni le temps reel (sinon chaque fenetre ouvrirait un
  // Socket.IO supplementaire et reafficherait les notifications).
  if (searchParams?.get("embed") === "1") {
    return <main className="min-h-screen px-4 py-5">{children}</main>;
  }

  return (
    <RealtimeProvider initialUnread={unread} permissions={permissions}>
      <WorkspaceProvider>
        <div className="min-h-screen">
          <Shell user={user} permissions={permissions} serverName={serverName}>
            {children}
          </Shell>
        </div>
        <WindowLayer />
      </WorkspaceProvider>
    </RealtimeProvider>
  );
}

function Shell({
  children,
  user,
  permissions,
  serverName,
}: {
  children: React.ReactNode;
  user: {
    displayName: string;
    email: string;
    role: string;
    avatarColor: string;
    twoFactorEnabled: boolean;
  };
  permissions: Permission[];
  serverName: string;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const closeMobile = React.useCallback(() => setMobileOpen(false), []);
  const { connected } = useRealtime();
  const live = useApi<LiveStatus>("/api/status", { pollMs: 15_000 });
  const pathname = usePathname();

  // Meme source que la console, le terminal et le dashboard : l'en-tete ne
  // peut plus afficher "actif" quand Wings est deconnecte.
  const heartbeat = React.useMemo(() => {
    const data = live.data;
    if (live.error) {
      // Pas d'acces a l'etat serveur (permission) : on retombe sur le temps reel.
      return {
        color: connected ? "bg-success" : "bg-danger",
        label: connected ? "Temps reel actif" : "Temps reel indisponible",
        detail: `Etat serveur indisponible : ${live.error}`,
      };
    }
    if (!data) {
      return { color: "bg-muted", label: "Verification...", detail: "Etat en cours de chargement" };
    }
    if (!data.panel.configured) {
      return { color: "bg-warning", label: "Panel non configure", detail: "Renseignez Pterodactyl dans Infrastructure" };
    }
    if (!data.panel.reachable) {
      return {
        color: "bg-danger",
        label: "Panel injoignable",
        detail: data.panel.error ?? "L'API Pterodactyl ne repond pas",
      };
    }
    if (!data.wings.connected) {
      return {
        color: "bg-warning",
        label: "Console indisponible",
        detail: data.wings.lastError ?? `Flux Wings ${data.wings.state}`,
      };
    }
    return {
      color: connected ? "bg-success" : "bg-warning",
      label: connected ? "Temps reel actif" : "Reconnexion...",
      detail: connected
        ? "Panel, console et temps reel synchronises"
        : "Le temps reel navigateur se reconnecte",
    };
  }, [live.data, live.error, connected]);

  React.useEffect(() => {
    const stored = window.localStorage.getItem("fdm:sidebar");
    if (stored === "collapsed") setCollapsed(true);
  }, []);

  function toggleCollapse() {
    setCollapsed((value) => {
      window.localStorage.setItem("fdm:sidebar", value ? "expanded" : "collapsed");
      return !value;
    });
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:border focus:border-primary-400/40 focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:text-fg focus:shadow-2xl"
      >
        Aller au contenu principal
      </a>
      <Sidebar
        permissions={permissions}
        collapsed={collapsed}
        onToggle={toggleCollapse}
        mobileOpen={mobileOpen}
        onMobileClose={closeMobile}
        serverName={serverName}
      />

      <div
        className={cn(
          "flex min-h-screen flex-col transition-all duration-200",
          collapsed ? "lg:pl-[64px]" : "lg:pl-[236px]",
        )}
      >
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/70 bg-bg/70 px-4 shadow-[0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-xl supports-[backdrop-filter]:bg-bg/60">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-muted hover:bg-white/5 hover:text-fg lg:hidden"
            aria-label="Ouvrir le menu"
            aria-expanded={mobileOpen}
            aria-haspopup="dialog"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div
            className="hidden items-center gap-2 rounded-full border border-border/70 bg-card/60 px-2.5 py-1 text-[11px] text-muted sm:flex"
            title={heartbeat.detail}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", heartbeat.color)} />
            <span className="truncate">{heartbeat.label}</span>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <WindowLauncher permissions={permissions} />
            <Link
              href="/editor"
              className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-card/70 px-3 text-xs text-muted transition-colors hover:border-border-strong hover:bg-elevated hover:text-fg sm:flex"
            >
              <SquarePen className="h-3.5 w-3.5" />
              Ouvrir l&apos;editeur
            </Link>
            <SessionIndicator />
            <NotificationBell />
            <div className="mx-1 h-5 w-px bg-border" />
            <UserMenu user={user} />
          </div>
        </header>

        <main
          key={pathname}
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 py-7 focus:outline-none sm:px-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-[1500px]">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
      </div>
    </>
  );
}
