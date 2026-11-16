"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Building2,
  Car,
  Bell,
  BookMarked,
  BookOpen,
  Bot,
  Boxes,
  Braces,
  CalendarClock,
  CalendarDays,
  Bug,
  ChevronLeft,
  Code2,
  DatabaseBackup,
  FileCog,
  FileText,
  FolderTree,
  LayoutDashboard,
  ListChecks,
  Map as MapIcon,
  MessagesSquare,
  MonitorPlay,
  PanelLeftClose,
  RefreshCw,
  Rocket,
  ScrollText,
  ServerCog,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Target,
  SquareArrowOutUpRight,
  Stethoscope,
  TerminalSquare,
  Timer,
  UserCog,
  Users,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { NAV_SECTIONS } from "@/lib/nav";
import { cn } from "@/components/ui/primitives";
import { useWorkspace } from "@/components/windows/workspace";
import type { Permission } from "@/server/permissions";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Activity,
  Building2,
  Car,
  Wrench,
  BookMarked,
  BookOpen,
  Bot,
  CalendarClock,
  CalendarDays,
  Users,
  Siren,
  Target,
  FileCog,
  Timer,
  ListChecks,
  Map: MapIcon,
  Bug,
  FileText,
  Sparkles,
  BarChart3,
  Code2,
  FolderTree,
  Braces,
  Boxes,
  TerminalSquare,
  MonitorPlay,
  DatabaseBackup,
  Rocket,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UsersRound,
  UserCog,
  Bell,
  ServerCog,
  MessagesSquare,
  ScrollText,
  Stethoscope,
  Settings,
};

export function Sidebar({
  permissions,
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
  serverName,
}: {
  permissions: Permission[];
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  serverName: string;
}) {
  const pathname = usePathname();
  const { openWindow } = useWorkspace();
  const allowed = React.useMemo(() => new Set(permissions), [permissions]);

  // Verrouille le scroll de fond et ferme le tiroir mobile avec Echap.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onMobileClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [mobileOpen, onMobileClose]);

  const sections = React.useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => !item.permission || allowed.has(item.permission)),
      })).filter((section) => section.items.length > 0),
    [allowed],
  );

  const content = (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 items-center gap-2.5 border-b border-border px-4", collapsed && "justify-center px-2")}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-400 to-primary-700 shadow-[0_8px_20px_-10px_rgba(88,101,242,0.95)] ring-1 ring-primary-300/30">
          <Code2 className="h-4 w-4 text-white" />
        </div>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold tracking-tight">FiveM DevManager</p>
            <p className="truncate text-[10px] text-muted">{serverName}</p>
          </div>
        ) : null}
        <button
          onClick={onToggle}
          className={cn("hidden rounded p-1 text-muted hover:bg-white/5 hover:text-fg lg:block", collapsed && "hidden lg:hidden")}
          aria-label="Reduire la barre laterale"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto px-2 py-4 scrollbar-thin">
        {sections.map((section) => (
          <div key={section.title} className="mb-5">
            {!collapsed ? (
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/50">
                {section.title}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = ICONS[item.icon] ?? LayoutDashboard;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href} className="group/item relative">
                    <Link
                      href={item.href}
                      onClick={onMobileClose}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                        active
                          ? "bg-gradient-to-r from-primary-500/20 to-primary-500/[0.04] font-medium text-fg ring-1 ring-inset ring-primary-500/25"
                          : "text-muted hover:bg-white/[0.05] hover:text-fg",
                        collapsed && "justify-center px-0 py-2",
                        !collapsed && "pr-8",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-primary-300" : "text-muted/80 group-hover:text-fg",
                        )}
                      />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </Link>
                    {!collapsed ? (
                      <button
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openWindow({ href: item.href, label: item.label });
                          onMobileClose();
                        }}
                        title="Ouvrir dans une fenetre"
                        aria-label={`Ouvrir ${item.label} dans une fenetre`}
                        className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded p-1 text-muted transition-colors hover:bg-white/10 hover:text-fg group-hover/item:block"
                      >
                        <SquareArrowOutUpRight className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("border-t border-border px-3 py-3 text-[10px] text-muted/60", collapsed && "text-center px-1")}>
        {collapsed ? "v1.0" : "FiveM DevManager · v1.0.0"}
      </div>
    </div>
  );

  return (
    <>
      <aside
        aria-label="Barre de navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-border bg-surface/80 backdrop-blur-xl transition-all duration-200 lg:block",
          collapsed ? "w-[64px]" : "w-[236px]",
        )}
      >
        {content}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation principale">
          <div className="absolute inset-0 bg-black/70" onClick={onMobileClose} aria-hidden />
          <div className="relative h-full w-[260px] animate-in border-r border-border bg-surface">
            <button
              onClick={onMobileClose}
              className="absolute right-2 top-3 rounded p-1 text-muted hover:bg-white/5"
              aria-label="Fermer le menu"
            >
              <X className="h-4 w-4" />
            </button>
            {content}
          </div>
        </div>
      ) : null}

      {collapsed ? (
        <button
          onClick={onToggle}
          className="fixed bottom-4 left-4 z-30 hidden h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted hover:text-fg lg:flex"
          aria-label="Etendre la barre laterale"
        >
          <ChevronLeft className="h-4 w-4 rotate-180" />
        </button>
      ) : null}
    </>
  );
}
