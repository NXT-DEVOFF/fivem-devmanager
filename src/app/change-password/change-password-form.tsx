"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button, Field, Input } from "@/components/ui/primitives";
import { apiFetch, errorMessage } from "@/lib/api-client";

export function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const checks = [
    { label: "12 caracteres minimum", ok: newPassword.length >= 12 },
    { label: "Une majuscule", ok: /[A-Z]/.test(newPassword) },
    { label: "Une minuscule", ok: /[a-z]/.test(newPassword) },
    { label: "Un chiffre", ok: /[0-9]/.test(newPassword) },
    { label: "Les deux mots de passe correspondent", ok: newPassword.length > 0 && newPassword === confirm },
  ];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      await apiFetch("/api/auth/password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      setSuccess(true);
      setTimeout(() => {
        router.replace("/dashboard");
        router.refresh();
      }, 700);
    } catch (caught) {
      setError(errorMessage(caught));
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
      {success ? (
        <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2.5 text-xs text-success">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Mot de passe mis a jour. Redirection...
        </div>
      ) : null}

      <Field label="Mot de passe actuel">
        <Input
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoFocus
        />
      </Field>

      <Field label="Nouveau mot de passe">
        <Input
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
      </Field>

      <Field label="Confirmation">
        <Input
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </Field>

      <ul className="grid gap-1.5 rounded-lg border border-border bg-surface/60 px-3 py-2.5">
        {checks.map((check) => (
          <li key={check.label} className="flex items-center gap-2 text-[11px]">
            <CheckCircle2
              className={check.ok ? "h-3 w-3 text-success" : "h-3 w-3 text-muted/50"}
            />
            <span className={check.ok ? "text-muted" : "text-muted/60"}>{check.label}</span>
          </li>
        ))}
      </ul>

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        loading={loading}
        disabled={!checks.every((check) => check.ok)}
      >
        Mettre a jour le mot de passe
      </Button>
    </form>
  );
}
