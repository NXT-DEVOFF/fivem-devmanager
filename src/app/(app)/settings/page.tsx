"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  KeyRound,
  Laptop,
  LogOut,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  Smartphone,
  UserCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/use-api";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useRealtime } from "@/components/realtime-provider";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Switch,
} from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { formatDateTime, relativeTime } from "@/lib/format";

interface Profile {
  displayName: string;
  email: string;
  jobTitle: string | null;
  avatarColor: string;
  timezone: string;
  twoFactorEnabled: boolean;
}

interface SettingsPayload {
  settings: {
    serverName: string;
    currentVersion: string;
    defaultIdleMinutes: number;
    autoValidationEnabled: boolean;
    timezone: string;
    gameVersion: string;
  };
  stats: { users: number; changes: number; sessions: number };
  runtime: { nodeVersion: string; demoMode: boolean; aiConfigured: boolean };
}

interface AuthSessionRow {
  id: string;
  deviceName: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  isCurrent: boolean;
  active: boolean;
}

export default function SettingsPage() {
  const { can } = useRealtime();
  const profile = useApi<{ profile: Profile }>("/api/auth/profile");
  const settings = useApi<SettingsPayload>("/api/settings");
  const sessions = useApi<{ sessions: AuthSessionRow[]; currentSessionId: string }>("/api/auth/sessions");

  const [profileForm, setProfileForm] = React.useState<Partial<Profile>>({});
  const [appForm, setAppForm] = React.useState<Partial<SettingsPayload["settings"]>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [twoFactorOpen, setTwoFactorOpen] = React.useState(false);
  const [twoFactorData, setTwoFactorData] = React.useState<{ secret: string; uri: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = React.useState("");
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = React.useState("");

  React.useEffect(() => {
    if (profile.data) setProfileForm(profile.data.profile);
  }, [profile.data]);
  React.useEffect(() => {
    if (settings.data) setAppForm(settings.data.settings);
  }, [settings.data]);

  async function saveProfile() {
    setBusy("profile");
    try {
      await apiFetch("/api/auth/profile", { method: "PATCH", body: profileForm });
      toast.success("Profil mis a jour");
      await profile.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function saveSettings() {
    setBusy("settings");
    try {
      await apiFetch("/api/settings", { method: "PUT", body: appForm });
      toast.success("Configuration enregistree");
      await settings.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function setupTwoFactor() {
    setBusy("2fa-setup");
    try {
      const payload = await apiFetch<{ secret: string; uri: string }>("/api/auth/2fa", {
        method: "POST",
        body: { action: "setup" },
      });
      setTwoFactorData(payload);
      setTwoFactorOpen(true);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function enableTwoFactor() {
    setBusy("2fa-enable");
    try {
      const payload = await apiFetch<{ recoveryCodes: string[] }>("/api/auth/2fa", {
        method: "POST",
        body: { action: "enable", code: twoFactorCode },
      });
      setRecoveryCodes(payload.recoveryCodes);
      toast.success("Double authentification activee");
      await profile.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function disableTwoFactor() {
    setBusy("2fa-disable");
    try {
      await apiFetch("/api/auth/2fa", { method: "POST", body: { action: "disable", password: disablePassword } });
      toast.success("Double authentification desactivee");
      setTwoFactorOpen(false);
      setDisablePassword("");
      await profile.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  const profileData = profile.data?.profile;

  return (
    <div>
      <PageHeader
        title="Parametres"
        description="Profil, securite du compte, appareils connectes et configuration de la plateforme."
        eyebrow="Systeme"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <UserCircle2 className="h-4 w-4 text-primary-300" /> Profil
              </h3>
              <Button size="sm" variant="primary" onClick={saveProfile} loading={busy === "profile"}>
                <Save className="h-3.5 w-3.5" /> Enregistrer
              </Button>
            </CardHeader>
            <CardBody className="space-y-3">
              {profile.loading ? (
                <Skeleton className="h-32" />
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Nom affiche">
                      <Input
                        value={profileForm.displayName ?? ""}
                        onChange={(event) => setProfileForm({ ...profileForm, displayName: event.target.value })}
                      />
                    </Field>
                    <Field label="Email">
                      <Input value={profileData?.email ?? ""} disabled />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Fonction" className="sm:col-span-2">
                      <Input
                        value={profileForm.jobTitle ?? ""}
                        onChange={(event) => setProfileForm({ ...profileForm, jobTitle: event.target.value })}
                        placeholder="Developpeur FiveM"
                      />
                    </Field>
                    <Field label="Couleur d'avatar">
                      <input
                        type="color"
                        value={profileForm.avatarColor ?? "#5865F2"}
                        onChange={(event) => setProfileForm({ ...profileForm, avatarColor: event.target.value })}
                        className="h-9 w-full cursor-pointer rounded-lg border border-border bg-surface p-1"
                      />
                    </Field>
                  </div>
                  <Field label="Fuseau horaire">
                    <Select
                      value={profileForm.timezone ?? "Europe/Paris"}
                      onChange={(event) => setProfileForm({ ...profileForm, timezone: event.target.value })}
                    >
                      <option value="Europe/Paris">Europe/Paris</option>
                      <option value="Europe/London">Europe/London</option>
                      <option value="America/Montreal">America/Montreal</option>
                      <option value="UTC">UTC</option>
                    </Select>
                  </Field>
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary-300" /> Double authentification
              </h3>
              <Badge variant={profileData?.twoFactorEnabled ? "success" : "neutral"}>
                {profileData?.twoFactorEnabled ? "Activee" : "Non activee"}
              </Badge>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-[11px] text-muted">
                Protege votre compte avec une application TOTP (Google Authenticator, Aegis, 1Password).
                Des codes de secours sont generes une seule fois.
              </p>
              <div className="flex flex-wrap gap-2">
                {!profileData?.twoFactorEnabled ? (
                  <Button size="sm" variant="secondary" onClick={setupTwoFactor} loading={busy === "2fa-setup"}>
                    <KeyRound className="h-3.5 w-3.5" /> Configurer
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => setTwoFactorOpen(true)}>
                  {profileData?.twoFactorEnabled ? "Desactiver / codes" : "Codes de secours"}
                </Button>
                <Link href="/change-password" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-[11px] text-muted hover:text-fg">
                  Changer le mot de passe
                </Link>
              </div>
            </CardBody>
          </Card>

          {can("settings.manage") ? (
            <Card>
              <CardHeader>
                <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                  <SettingsIcon className="h-4 w-4 text-primary-300" /> Configuration de la plateforme
                </h3>
                <Button size="sm" variant="primary" onClick={saveSettings} loading={busy === "settings"}>
                  <Save className="h-3.5 w-3.5" /> Enregistrer
                </Button>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nom du serveur">
                    <Input
                      value={appForm.serverName ?? ""}
                      onChange={(event) => setAppForm({ ...appForm, serverName: event.target.value })}
                    />
                  </Field>
                  <Field label="Version actuelle">
                    <Input
                      value={appForm.currentVersion ?? ""}
                      onChange={(event) => setAppForm({ ...appForm, currentVersion: event.target.value })}
                      className="font-mono text-xs"
                    />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Inactivite par defaut (minutes)">
                    <Input
                      type="number"
                      min={1}
                      max={180}
                      value={appForm.defaultIdleMinutes ?? 15}
                      onChange={(event) => setAppForm({ ...appForm, defaultIdleMinutes: Number(event.target.value) })}
                    />
                  </Field>
                  <Field label="Version du jeu">
                    <Input
                      value={appForm.gameVersion ?? ""}
                      onChange={(event) => setAppForm({ ...appForm, gameVersion: event.target.value })}
                    />
                  </Field>
                </div>
                <label className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
                  <div>
                    <p className="text-[11px] text-fg">Auto-validation globale</p>
                    <p className="text-[10px] text-muted">
                      Autorise les taches configurees comme auto-validables a etre validees si tous les
                      criteres sont remplis.
                    </p>
                  </div>
                  <Switch
                    checked={appForm.autoValidationEnabled ?? false}
                    onChange={(value) => setAppForm({ ...appForm, autoValidationEnabled: value })}
                  />
                </label>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <Laptop className="h-4 w-4 text-primary-300" /> Appareils connectes
              </h3>
              <Button
                size="sm"
                variant="danger"
                onClick={async () => {
                  if (!window.confirm("Deconnecter toutes les autres sessions ?")) return;
                  try {
                    await apiFetch("/api/auth/sessions", { method: "DELETE" });
                    toast.success("Autres sessions revoquees");
                    await sessions.refresh();
                  } catch (error) {
                    toast.error(errorMessage(error));
                  }
                }}
              >
                <LogOut className="h-3.5 w-3.5" /> Tout deconnecter
              </Button>
            </CardHeader>
            <div className="divide-y divide-border/60">
              {sessions.loading ? (
                <div className="p-4"><Skeleton className="h-16" /></div>
              ) : (
                sessions.data?.sessions.map((session) => (
                  <div key={session.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface">
                      {session.deviceName?.includes("iOS") || session.deviceName?.includes("Android") ? (
                        <Smartphone className="h-3.5 w-3.5 text-muted" />
                      ) : (
                        <Laptop className="h-3.5 w-3.5 text-muted" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-fg">
                        {session.deviceName ?? "Appareil inconnu"}
                        {session.isCurrent ? (
                          <Badge variant="success" className="ml-1.5">session courante</Badge>
                        ) : null}
                      </p>
                      <p className="text-[10px] text-muted">
                        {session.ip ?? "-"} · derniere activite {relativeTime(session.lastUsedAt)} · expire{" "}
                        {formatDateTime(session.expiresAt)}
                      </p>
                    </div>
                    {!session.isCurrent && session.active ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await apiFetch(`/api/auth/sessions/${session.id}`, { method: "DELETE" });
                          await sessions.refresh();
                        }}
                      >
                        Revoquer
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">Environnement</h3>
            </CardHeader>
            <CardBody className="space-y-2 text-[11px]">
              <Row label="Node.js" value={settings.data?.runtime.nodeVersion ?? "-"} />
              <Row label="Mode demo" value={settings.data?.runtime.demoMode ? "actif" : "desactive"} />
              <Row label="IA patch notes" value={settings.data?.runtime.aiConfigured ? "configuree" : "non configuree"} />
              <Row label="Utilisateurs" value={String(settings.data?.stats.users ?? 0)} />
              <Row label="Sessions" value={String(settings.data?.stats.sessions ?? 0)} />
              <Row label="Modifications" value={String(settings.data?.stats.changes ?? 0)} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">Roles et acces</h3>
            </CardHeader>
            <CardBody className="space-y-2 text-[11px] text-muted">
              <p>Super Admin, Admin, Responsable dev et Developpeur disposent de jeux de permissions distincts.</p>
              <p>Les overrides granulaires sont configurables par utilisateur depuis la page Utilisateurs.</p>
              {can("users.view") ? (
                <Link href="/users" className="inline-block text-primary-300 hover:underline">
                  Gerer les utilisateurs →
                </Link>
              ) : null}
            </CardBody>
          </Card>

          <Card className="p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Bonnes pratiques
            </p>
            <ul className="mt-2 space-y-1 text-[10.5px] text-muted">
              <li>• Activez la 2FA sur les comptes administrateurs.</li>
              <li>• Utilisez une cle API Pterodactyl dediee, limitee au serveur.</li>
              <li>• Verifiez regulierement le journal d&apos;audit.</li>
              <li>• Sauvegardez la base MariaDB et le dossier var/.</li>
            </ul>
          </Card>
        </div>
      </div>

      <Modal
        open={twoFactorOpen}
        onClose={() => setTwoFactorOpen(false)}
        title="Double authentification"
        description="Configurez ou desactivez la 2FA. Les codes de secours ne sont affiches qu'une fois."
        footer={<Button variant="ghost" onClick={() => setTwoFactorOpen(false)}>Fermer</Button>}
      >
        <div className="space-y-4">
          {twoFactorData ? (
            <div className="space-y-3">
              <p className="text-[11px] text-muted">
                Ajoutez ce secret dans votre application TOTP, puis saisissez le code genere.
              </p>
              <pre className="select-all rounded border border-border bg-surface px-3 py-2 font-mono text-[11px] text-success">
                {twoFactorData.secret}
              </pre>
              <pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded border border-border bg-surface p-2 font-mono text-[9px] text-muted">
                {twoFactorData.uri}
              </pre>
              <Field label="Code a 6 chiffres">
                <Input
                  value={twoFactorCode}
                  onChange={(event) => setTwoFactorCode(event.target.value)}
                  className="font-mono tracking-widest"
                  inputMode="numeric"
                />
              </Field>
              <Button variant="success" onClick={enableTwoFactor} loading={busy === "2fa-enable"}>
                Activer la 2FA
              </Button>
            </div>
          ) : null}

          {recoveryCodes ? (
            <div className="space-y-2">
              <p className="text-[11px] text-warning">
                Codes de secours (a conserver hors ligne) :
              </p>
              <div className="grid grid-cols-2 gap-1">
                {recoveryCodes.map((code) => (
                  <code key={code} className="rounded border border-border bg-surface px-2 py-1 text-[11px] text-success">
                    {code}
                  </code>
                ))}
              </div>
            </div>
          ) : null}

          <div className="border-t border-border pt-3">
            <p className="mb-2 text-[11px] font-medium">Desactiver la 2FA</p>
            <Field label="Mot de passe">
              <Input type="password" value={disablePassword} onChange={(event) => setDisablePassword(event.target.value)} />
            </Field>
            <Button variant="danger" className="mt-2" onClick={disableTwoFactor} loading={busy === "2fa-disable"} disabled={!disablePassword}>
              Desactiver
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="mono truncate text-fg">{value}</span>
    </div>
  );
}
