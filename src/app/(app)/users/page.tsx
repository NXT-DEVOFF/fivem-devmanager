"use client";

import * as React from "react";
import { KeyRound, Plus, Search, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/use-api";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useRealtime } from "@/components/realtime-provider";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  cn,
} from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { ROLE_LABELS } from "@/lib/labels";
import { relativeTime } from "@/lib/format";

interface UserRow {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: string;
  isActive: boolean;
  jobTitle: string | null;
  avatarColor: string;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  twoFactorEnabled: boolean;
  permissionsGranted: string[];
  permissionsDenied: string[];
  effectivePermissions: number;
  _count: { devSessions: number; tasksAssigned: number };
}

const PERMISSION_GROUPS: Record<string, string[]> = {
  Administration: ["users.view", "users.manage", "settings.manage", "integrations.manage", "audit.view", "roles.manage"],
  Infrastructure: ["server.view", "server.power", "server.console", "server.console.send", "server.logs", "resources.view", "resources.manage"],
  Fichiers: ["files.view", "files.write", "files.upload", "files.download", "files.search", "files.restore", "editor.use"],
  Sessions: ["sessions.start", "sessions.view.own", "sessions.view.all", "sessions.manage", "terminal.use"],
  Taches: ["tasks.view", "tasks.create", "tasks.edit", "tasks.assign", "tasks.validate", "tasks.delete"],
  Sprints: ["sprints.view", "sprints.manage"],
  Incidents: ["incidents.view", "incidents.create", "incidents.manage"],
  Bugs: ["bugs.view", "bugs.create", "bugs.edit", "bugs.assign", "bugs.close"],
  Rapports: ["reports.view.own", "reports.view.all", "reports.create", "patchnotes.view", "patchnotes.create", "patchnotes.approve", "patchnotes.publish", "discord.manage"],
  Deploiements: ["deployments.view", "deployments.request", "deployments.approve", "deployments.execute", "deployments.rollback"],
  "FiveM Studio": ["studio.view", "studio.use"],
};

export default function UsersPage() {
  const { can } = useRealtime();
  const [search, setSearch] = React.useState("");
  const [role, setRole] = React.useState("");
  const users = useApi<{ users: UserRow[] }>(`/api/users?${search ? `q=${encodeURIComponent(search)}&` : ""}${role ? `role=${role}` : ""}`);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<UserRow | null>(null);
  const [permTarget, setPermTarget] = React.useState<UserRow | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [tempPassword, setTempPassword] = React.useState<{ user: string; password: string } | null>(null);

  const rows = users.data?.users ?? [];

  async function toggleActive(target: UserRow) {
    setBusy(true);
    try {
      await apiFetch(`/api/users/${target.id}`, { method: "PATCH", body: { isActive: !target.isActive } });
      toast.success(target.isActive ? "Compte desactive" : "Compte reactive");
      await users.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(target: UserRow) {
    if (!window.confirm(`Reinitialiser le mot de passe de ${target.displayName} ? Toutes ses sessions seront deconnectees.`)) return;
    setBusy(true);
    try {
      const payload = await apiFetch<{ temporaryPassword?: string }>(`/api/users/${target.id}/password`, {
        method: "POST",
        body: {},
      });
      if (payload.temporaryPassword) setTempPassword({ user: target.displayName, password: payload.temporaryPassword });
      toast.success("Mot de passe reinitialise");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        description="Comptes, roles et permissions granulaires. Toute modification est journalisee et invalide les sessions concernees."
        eyebrow="Administration"
      >
        {can("users.manage") ? (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Creer un compte
          </Button>
        ) : null}
      </PageHeader>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input className="pl-8" placeholder="Rechercher un utilisateur..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <Select value={role} onChange={(event) => setRole(event.target.value)} className="w-auto">
          <option value="">Tous les roles</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </div>

      <Card>
        {users.loading ? (
          <div className="space-y-2 p-4">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-14" />)}</div>
        ) : users.error ? (
          <p className="p-4 text-xs text-danger">{users.error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Utilisateur</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Statut</th>
                  <th className="px-4 py-2 font-medium">2FA</th>
                  <th className="px-4 py-2 font-medium">Derniere connexion</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((member) => (
                  <tr key={member.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar name={member.displayName} color={member.avatarColor} size="sm" />
                        <div>
                          <p className="text-xs text-fg">{member.displayName}</p>
                          <p className="text-[10px] text-muted">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={member.role === "DEVELOPER" ? "neutral" : "primary"}>
                        {ROLE_LABELS[member.role] ?? member.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={member.isActive ? "success" : "danger"}>
                        {member.isActive ? "Actif" : "Desactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {member.twoFactorEnabled ? (
                        <Badge variant="success"><ShieldCheck className="h-3 w-3" /> Active</Badge>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted">{relativeTime(member.lastLoginAt)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {can("users.manage") ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setEditTarget(member)}>Modifier</Button>
                            {can("roles.manage") ? (
                              <Button size="icon" variant="ghost" onClick={() => setPermTarget(member)} title="Permissions">
                                <UserCog className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                            <Button size="icon" variant="ghost" onClick={() => void resetPassword(member)} title="Reinitialiser le mot de passe">
                              <KeyRound className="h-3.5 w-3.5" />
                            </Button>
                            <button
                              onClick={() => void toggleActive(member)}
                              disabled={busy}
                              className={cn(
                                "rounded p-1 text-[10px]",
                                member.isActive ? "text-danger hover:bg-danger/10" : "text-success hover:bg-success/10",
                              )}
                            >
                              {member.isActive ? "Desactiver" : "Activer"}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(temporaryPassword, name) => {
          setCreateOpen(false);
          if (temporaryPassword) setTempPassword({ user: name, password: temporaryPassword });
          void users.refresh();
        }}
      />

      <Modal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={`Modifier ${editTarget?.displayName ?? ""}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditTarget(null)}>Fermer</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={async () => {
                if (!editTarget) return;
                const form = document.getElementById("edit-user-form") as HTMLFormElement;
                const data = new FormData(form);
                setBusy(true);
                try {
                  await apiFetch(`/api/users/${editTarget.id}`, {
                    method: "PATCH",
                    body: {
                      displayName: data.get("displayName"),
                      email: data.get("email"),
                      jobTitle: data.get("jobTitle") || null,
                      role: data.get("role"),
                    },
                  });
                  toast.success("Utilisateur mis a jour");
                  setEditTarget(null);
                  await users.refresh();
                } catch (error) {
                  toast.error(errorMessage(error));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Enregistrer
            </Button>
          </>
        }
      >
        {editTarget ? (
          <form id="edit-user-form" className="space-y-3">
            <Field label="Nom affiche">
              <Input name="displayName" defaultValue={editTarget.displayName} />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={editTarget.email} />
            </Field>
            <Field label="Fonction">
              <Input name="jobTitle" defaultValue={editTarget.jobTitle ?? ""} />
            </Field>
            <Field label="Role">
              <Select name="role" defaultValue={editTarget.role} disabled={!can("roles.manage")}>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
          </form>
        ) : null}
      </Modal>

      <PermissionsDialog
        target={permTarget}
        onClose={() => setPermTarget(null)}
        onSaved={() => {
          setPermTarget(null);
          void users.refresh();
        }}
      />

      <Modal
        open={Boolean(tempPassword)}
        onClose={() => setTempPassword(null)}
        title="Mot de passe temporaire"
        description="Ce mot de passe ne sera plus affiche. Transmettez-le de maniere securisee."
        footer={<Button variant="primary" onClick={() => setTempPassword(null)}>J&apos;ai note le mot de passe</Button>}
      >
        <div className="space-y-2">
          <p className="text-xs text-muted">Compte : {tempPassword?.user}</p>
          <pre className="select-all rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm text-success">
            {tempPassword?.password}
          </pre>
          <p className="text-[10px] text-warning">
            L&apos;utilisateur devra changer ce mot de passe a la prochaine connexion.
          </p>
        </div>
      </Modal>
    </div>
  );
}

function CreateUserDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (temporaryPassword: string | undefined, name: string) => void;
}) {
  const [form, setForm] = React.useState({
    displayName: "",
    email: "",
    username: "",
    role: "DEVELOPER",
    jobTitle: "",
    password: "",
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const payload = await apiFetch<{ temporaryPassword?: string }>("/api/users", {
        method: "POST",
        body: {
          displayName: form.displayName,
          email: form.email,
          username: form.username,
          role: form.role,
          jobTitle: form.jobTitle || undefined,
          ...(form.password ? { password: form.password } : {}),
        },
      });
      toast.success("Compte cree");
      onCreated(payload.temporaryPassword, form.displayName);
      setForm({ displayName: "", email: "", username: "", role: "DEVELOPER", jobTitle: "", password: "" });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Creer un compte"
      description="Le mot de passe est genere automatiquement s'il est laisse vide."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={busy} onClick={submit} disabled={!form.displayName || !form.email || !form.username}>
            Creer
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p> : null}
        <Field label="Nom affiche">
          <Input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </Field>
          <Field label="Identifiant" hint="minuscules, chiffres, . - _">
            <Input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} className="font-mono text-xs" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Role">
            <Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Fonction">
            <Input value={form.jobTitle} onChange={(event) => setForm({ ...form, jobTitle: event.target.value })} />
          </Field>
        </div>
        <Field label="Mot de passe (optionnel)" hint="12 caracteres min. Genere automatiquement sinon.">
          <Input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function PermissionsDialog({
  target,
  onClose,
  onSaved,
}: {
  target: UserRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [granted, setGranted] = React.useState<string[]>([]);
  const [denied, setDenied] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setGranted(target?.permissionsGranted ?? []);
    setDenied(target?.permissionsDenied ?? []);
  }, [target]);

  function stateOf(permission: string): "default" | "granted" | "denied" {
    if (granted.includes(permission)) return "granted";
    if (denied.includes(permission)) return "denied";
    return "default";
  }

  function cycle(permission: string) {
    const current = stateOf(permission);
    const next = current === "default" ? "granted" : current === "granted" ? "denied" : "default";
    setGranted((value) => (next === "granted" ? [...new Set([...value, permission])] : value.filter((p) => p !== permission)));
    setDenied((value) => (next === "denied" ? [...new Set([...value, permission])] : value.filter((p) => p !== permission)));
  }

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      title={`Permissions - ${target?.displayName ?? ""}`}
      description="Cliquez pour cycler : defaut (role) → autoriser → interdire."
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              if (!target) return;
              setBusy(true);
              try {
                await apiFetch(`/api/users/${target.id}`, {
                  method: "PATCH",
                  body: { permissionsGranted: granted, permissionsDenied: denied },
                });
                toast.success("Permissions mises a jour - sessions invalidees");
                onSaved();
              } catch (error) {
                toast.error(errorMessage(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {Object.entries(PERMISSION_GROUPS).map(([group, permissions]) => (
          <div key={group}>
            <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted">{group}</p>
            <div className="grid gap-1 sm:grid-cols-2">
              {permissions.map((permission) => {
                const state = stateOf(permission);
                return (
                  <button
                    key={permission}
                    onClick={() => cycle(permission)}
                    className={cn(
                      "flex items-center justify-between rounded border px-2 py-1 text-left text-[10.5px] transition-colors",
                      state === "granted"
                        ? "border-success/40 bg-success/10 text-success"
                        : state === "denied"
                          ? "border-danger/40 bg-danger/10 text-danger"
                          : "border-border bg-surface text-muted hover:border-border-strong",
                    )}
                  >
                    <span className="mono truncate">{permission}</span>
                    <span className="ml-1 shrink-0 text-[9px] uppercase">
                      {state === "granted" ? "autorise" : state === "denied" ? "interdit" : "role"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
