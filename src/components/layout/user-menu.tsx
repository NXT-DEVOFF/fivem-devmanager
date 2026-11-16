"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, KeyRound, LogOut, Settings, ShieldCheck } from "lucide-react";
import { Avatar, Badge, cn } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/api-client";
import { ROLE_LABELS } from "@/lib/labels";

export function UserMenu({
  user,
}: {
  user: { displayName: string; email: string; role: string; avatarColor: string; twoFactorEnabled: boolean };
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const menuId = React.useId();

  React.useEffect(() => {
    function handle(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  async function logout() {
    setLoading(true);
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label={`Menu de ${user.displayName}`}
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg border border-transparent px-1.5 transition-colors hover:border-border hover:bg-card",
          open && "border-border bg-card",
        )}
      >
        <Avatar name={user.displayName} color={user.avatarColor} size="sm" />
        <div className="hidden text-left md:block">
          <p className="max-w-[120px] truncate text-xs font-medium text-fg">{user.displayName}</p>
          <p className="text-[10px] text-muted">{ROLE_LABELS[user.role] ?? user.role}</p>
        </div>
        <ChevronDown className="hidden h-3.5 w-3.5 text-muted md:block" />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Menu utilisateur"
          className="absolute right-0 top-11 z-40 w-64 animate-in overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        >
          <div className="border-b border-border px-3 py-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={user.displayName} color={user.avatarColor} />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{user.displayName}</p>
                <p className="truncate text-[11px] text-muted">{user.email}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <Badge variant="primary">{ROLE_LABELS[user.role] ?? user.role}</Badge>
              {user.twoFactorEnabled ? (
                <Badge variant="success">
                  <ShieldCheck className="h-3 w-3" /> 2FA
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="p-1">
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted hover:bg-white/5 hover:text-fg"
            >
              <Settings className="h-3.5 w-3.5" /> Parametres du compte
            </Link>
            <Link
              href="/change-password"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted hover:bg-white/5 hover:text-fg"
            >
              <KeyRound className="h-3.5 w-3.5" /> Changer le mot de passe
            </Link>
            <button
              role="menuitem"
              onClick={logout}
              disabled={loading}
              aria-busy={loading || undefined}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted hover:bg-danger/10 hover:text-danger"
            >
              <LogOut className="h-3.5 w-3.5" /> {loading ? "Deconnexion..." : "Se deconnecter"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
