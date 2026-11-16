"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button, Field, Input } from "@/components/ui/primitives";
import { apiFetch, errorMessage, ApiError } from "@/lib/api-client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [totp, setTotp] = React.useState("");
  const [needsTotp, setNeedsTotp] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch<{ user: { mustChangePassword: boolean } }>("/api/auth/login", {
        method: "POST",
        body: { email, password, ...(totp ? { totp } : {}) },
      });
      const next = searchParams.get("next");
      const target = next && next.startsWith("/") ? next : "/dashboard";
      router.replace(target);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "totp_required") {
        setNeedsTotp(true);
        setError("Saisissez le code de votre application d'authentification.");
      } else {
        setError(errorMessage(caught));
      }
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-xs text-danger">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <Field label="Adresse email">
        <Input
          type="email"
          autoComplete="username"
          required
          placeholder="vous@serveur.fr"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoFocus
        />
      </Field>

      <Field label="Mot de passe">
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-fg"
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>

      {needsTotp ? (
        <Field label="Code 2FA" hint="6 chiffres, ou un code de secours.">
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={totp}
              onChange={(event) => setTotp(event.target.value)}
              className="pl-9 font-mono tracking-[0.2em]"
              autoFocus
            />
          </div>
        </Field>
      ) : null}

      <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
        {loading ? "Connexion..." : "Se connecter"}
        {!loading ? <ArrowRight className="h-4 w-4" /> : null}
      </Button>
    </form>
  );
}
