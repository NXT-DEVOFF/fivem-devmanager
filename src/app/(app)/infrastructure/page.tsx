"use client";

import * as React from "react";
import {
  AlertTriangle,
  Cable,
  CheckCircle2,
  Database,
  KeyRound,
  Network,
  Play,
  Power,
  RotateCw,
  Save,
  ServerCog,
  Square,
  Wifi,
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
  Progress,
  Select,
  Skeleton,
} from "@/components/ui/primitives";
import { formatBytes, relativeTime } from "@/lib/format";

interface InfraPayload {
  configured: boolean;
  backend: string;
  config: {
    panelUrl: string;
    serverId: string;
    serverIdentifier: string | null;
    nodeId: string | null;
    hasClientKey: boolean;
    hasApplicationKey: boolean;
    lastCheckedAt: string | null;
    lastError: string | null;
  } | null;
  live?: {
    ok: boolean;
    error?: string;
    account?: string;
    server?: { name: string; status: string | null; suspended: boolean; node: string };
    resources?: {
      state: string;
      cpu: number;
      memoryBytes: number;
      memoryLimitBytes: number;
      diskBytes: number;
      diskLimitBytes: number;
      uptimeMs: number;
      networkRx: number;
      networkTx: number;
    };
    sftpDetails?: { ip: string; port: number; username: string };
  };
  sftp: {
    configured: boolean;
    host?: string;
    port?: number;
    username?: string;
    authType?: string;
    remoteRoot?: string;
    lastCheckAt?: string | null;
    lastError?: string | null;
  };
}

export default function InfrastructurePage() {
  const { can } = useRealtime();
  const infra = useApi<InfraPayload>("/api/infrastructure", { pollMs: 30_000 });
  const [busy, setBusy] = React.useState<string | null>(null);
  const [panelForm, setPanelForm] = React.useState({
    panelUrl: "",
    serverId: "",
    serverIdentifier: "",
    nodeId: "",
    clientApiKey: "",
    applicationApiKey: "",
  });
  const [sftpForm, setSftpForm] = React.useState({
    host: "",
    port: "2022",
    username: "",
    authType: "KEY",
    password: "",
    privateKey: "",
    passphrase: "",
    remoteRoot: "/",
  });
  const [testResult, setTestResult] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!infra.data) return;
    if (infra.data.config) {
      setPanelForm((current) => ({
        ...current,
        panelUrl: infra.data?.config?.panelUrl ?? "",
        serverId: infra.data?.config?.serverId ?? "",
        serverIdentifier: infra.data?.config?.serverIdentifier ?? "",
        nodeId: infra.data?.config?.nodeId ?? "",
      }));
    }
    if (infra.data.sftp.configured) {
      setSftpForm((current) => ({
        ...current,
        host: infra.data?.sftp.host ?? "",
        port: String(infra.data?.sftp.port ?? 2022),
        username: infra.data?.sftp.username ?? "",
        authType: infra.data?.sftp.authType ?? "KEY",
        remoteRoot: infra.data?.sftp.remoteRoot ?? "/",
      }));
    }
  }, [infra.data]);

  async function savePanel() {
    setBusy("panel");
    try {
      await apiFetch("/api/infrastructure", {
        method: "PUT",
        body: {
          panelUrl: panelForm.panelUrl,
          serverId: panelForm.serverId,
          serverIdentifier: panelForm.serverIdentifier || null,
          nodeId: panelForm.nodeId || null,
          ...(panelForm.clientApiKey ? { clientApiKey: panelForm.clientApiKey } : {}),
          ...(panelForm.applicationApiKey ? { applicationApiKey: panelForm.applicationApiKey } : {}),
        },
      });
      toast.success("Configuration Pterodactyl enregistree (cles chiffrees)");
      setPanelForm((current) => ({ ...current, clientApiKey: "", applicationApiKey: "" }));
      await infra.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function testPanel() {
    setBusy("test-panel");
    setTestResult(null);
    try {
      const payload = await apiFetch<{ ok: boolean; result?: { account: string; serverName: string; state: string } }>(
        "/api/infrastructure/test?target=pterodactyl",
        { method: "POST" },
      );
      setTestResult(`Connexion OK · compte ${payload.result?.account} · serveur ${payload.result?.serverName} (${payload.result?.state})`);
      toast.success("Connexion Pterodactyl validee");
    } catch (error) {
      setTestResult(errorMessage(error));
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function saveSftp() {
    setBusy("sftp");
    try {
      const payload = await apiFetch<{ test: { ok: boolean; message?: string } }>("/api/sftp", {
        method: "PUT",
        body: {
          host: sftpForm.host,
          port: Number(sftpForm.port) || 2022,
          username: sftpForm.username,
          authType: sftpForm.authType,
          remoteRoot: sftpForm.remoteRoot || "/",
          ...(sftpForm.password ? { password: sftpForm.password } : {}),
          ...(sftpForm.privateKey ? { privateKey: sftpForm.privateKey } : {}),
          ...(sftpForm.passphrase ? { passphrase: sftpForm.passphrase } : {}),
        },
      });
      toast.success(payload.test.ok ? "SFTP enregistre et connecte" : `Enregistre, test: ${payload.test.message}`);
      setSftpForm((current) => ({ ...current, password: "", privateKey: "", passphrase: "" }));
      await infra.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function testSftp() {
    setBusy("test-sftp");
    try {
      await apiFetch("/api/sftp", { method: "POST" });
      toast.success("Connexion SFTP validee");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function power(signal: "start" | "stop" | "restart") {
    if (signal !== "start" && !window.confirm(`Confirmer l'action ${signal} sur le serveur ?`)) return;
    setBusy(signal);
    try {
      await apiFetch("/api/infrastructure/power", { method: "POST", body: { signal } });
      toast.success(`Signal ${signal} envoye`);
      setTimeout(() => void infra.refresh(), 2500);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  const live = infra.data?.live;
  const resources = live?.resources;
  const online = resources?.state === "running";

  return (
    <div>
      <PageHeader
        title="Infrastructure"
        description="Connexion Pterodactyl et SFTP. Les cles sont chiffrees en AES-256-GCM et ne quittent jamais le backend."
        eyebrow="Systeme"
      >
        <Badge variant={infra.data?.configured ? "success" : "warning"}>
          {infra.data?.configured ? "Pterodactyl configure" : "Non configure"}
        </Badge>
        <Badge variant="neutral">Fichiers : {infra.data?.backend ?? "-"}</Badge>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <ServerCog className="h-4 w-4 text-primary-300" /> Panel Pterodactyl
              </h3>
              {can("integrations.manage") ? (
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="secondary" onClick={testPanel} loading={busy === "test-panel"}>
                    <TestIcon /> Tester
                  </Button>
                  <Button size="sm" variant="primary" onClick={savePanel} loading={busy === "panel"}>
                    <Save className="h-3.5 w-3.5" /> Enregistrer
                  </Button>
                </div>
              ) : null}
            </CardHeader>
            <CardBody className="space-y-3">
              {testResult ? (
                <p className={`rounded border px-3 py-2 text-[11px] ${testResult.startsWith("Connexion OK") ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"}`}>
                  {testResult}
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="URL du panel" hint="https://panel.exemple.fr">
                  <Input
                    value={panelForm.panelUrl}
                    onChange={(event) => setPanelForm({ ...panelForm, panelUrl: event.target.value })}
                    placeholder="https://panel.lumenweb.fr"
                    disabled={!can("integrations.manage")}
                  />
                </Field>
                <Field label="Identifiant du serveur" hint="ID court du serveur (ex: 1a2b3c4d)">
                  <Input
                    value={panelForm.serverId}
                    onChange={(event) => setPanelForm({ ...panelForm, serverId: event.target.value })}
                    className="font-mono text-xs"
                    disabled={!can("integrations.manage")}
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Cle API Client" hint={infra.data?.config?.hasClientKey ? "Une cle est deja enregistree" : "Requise"}>
                  <Input
                    type="password"
                    value={panelForm.clientApiKey}
                    onChange={(event) => setPanelForm({ ...panelForm, clientApiKey: event.target.value })}
                    placeholder={infra.data?.config?.hasClientKey ? "••••••••" : "ptlc_..."}
                    className="font-mono text-xs"
                    disabled={!can("integrations.manage")}
                  />
                </Field>
                <Field label="Cle API Application" hint="Optionnelle (superadmin)">
                  <Input
                    type="password"
                    value={panelForm.applicationApiKey}
                    onChange={(event) => setPanelForm({ ...panelForm, applicationApiKey: event.target.value })}
                    placeholder={infra.data?.config?.hasApplicationKey ? "••••••••" : "ptla_..."}
                    className="font-mono text-xs"
                    disabled={!can("integrations.manage")}
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Identifiant du noeud" hint="Optionnel">
                  <Input value={panelForm.nodeId} onChange={(event) => setPanelForm({ ...panelForm, nodeId: event.target.value })} className="font-mono text-xs" disabled={!can("integrations.manage")} />
                </Field>
                <Field label="Identifiant serveur (UUID)" hint="Optionnel">
                  <Input value={panelForm.serverIdentifier} onChange={(event) => setPanelForm({ ...panelForm, serverIdentifier: event.target.value })} className="font-mono text-xs" disabled={!can("integrations.manage")} />
                </Field>
              </div>
              {infra.data?.config?.lastError ? (
                <p className="flex items-start gap-2 rounded border border-danger/20 bg-danger/[0.06] px-3 py-2 text-[11px] text-danger">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {infra.data.config.lastError}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <Cable className="h-4 w-4 text-primary-300" /> Connexion SFTP
              </h3>
              {can("integrations.manage") ? (
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="secondary" onClick={testSftp} loading={busy === "test-sftp"}>Tester</Button>
                  <Button size="sm" variant="primary" onClick={saveSftp} loading={busy === "sftp"}>
                    <Save className="h-3.5 w-3.5" /> Enregistrer
                  </Button>
                </div>
              ) : null}
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-[11px] text-muted">
                Utilisee pour la recherche dans le contenu et les snapshots. Privilegiez une cle SSH.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Hote" className="sm:col-span-2">
                  <Input value={sftpForm.host} onChange={(event) => setSftpForm({ ...sftpForm, host: event.target.value })} placeholder="node.lumenweb.fr" disabled={!can("integrations.manage")} />
                </Field>
                <Field label="Port">
                  <Input type="number" value={sftpForm.port} onChange={(event) => setSftpForm({ ...sftpForm, port: event.target.value })} disabled={!can("integrations.manage")} />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Utilisateur">
                  <Input value={sftpForm.username} onChange={(event) => setSftpForm({ ...sftpForm, username: event.target.value })} className="font-mono text-xs" disabled={!can("integrations.manage")} />
                </Field>
                <Field label="Authentification">
                  <Select value={sftpForm.authType} onChange={(event) => setSftpForm({ ...sftpForm, authType: event.target.value })} disabled={!can("integrations.manage")}>
                    <option value="KEY">Cle SSH</option>
                    <option value="PASSWORD">Mot de passe</option>
                  </Select>
                </Field>
              </div>
              {sftpForm.authType === "KEY" ? (
                <Field label="Cle privee SSH" hint="Coller le contenu PEM. Chiffre en base.">
                  <textarea
                    rows={4}
                    value={sftpForm.privateKey}
                    onChange={(event) => setSftpForm({ ...sftpForm, privateKey: event.target.value })}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[10px] text-fg focus:border-primary-500 focus:outline-none"
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                    disabled={!can("integrations.manage")}
                  />
                </Field>
              ) : (
                <Field label="Mot de passe SFTP">
                  <Input type="password" value={sftpForm.password} onChange={(event) => setSftpForm({ ...sftpForm, password: event.target.value })} disabled={!can("integrations.manage")} />
                </Field>
              )}
              <Field label="Racine distante" hint="Limite les operations au repertoire du serveur FiveM.">
                <Input value={sftpForm.remoteRoot} onChange={(event) => setSftpForm({ ...sftpForm, remoteRoot: event.target.value })} className="font-mono text-xs" disabled={!can("integrations.manage")} />
              </Field>
              {infra.data?.sftp.lastError ? (
                <p className="text-[11px] text-danger">Derniere erreur : {infra.data.sftp.lastError}</p>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <Power className="h-4 w-4" /> Etat du serveur
              </h3>
              <Badge variant={online ? "success" : resources ? "danger" : "neutral"}>
                {resources?.state ?? "inconnu"}
              </Badge>
            </CardHeader>
            {infra.loading ? (
              <div className="p-4"><Skeleton className="h-24" /></div>
            ) : !infra.data?.configured ? (
              <p className="px-4 py-6 text-center text-xs text-muted">
                Renseignez le panel pour afficher l&apos;etat en direct.
              </p>
            ) : live && !live.ok ? (
              <p className="px-4 py-4 text-[11px] text-danger">{live.error}</p>
            ) : live?.resources ? (
              <CardBody className="space-y-3">
                <div className="text-[11px] text-muted">
                  <p className="text-fg">{live.server?.name}</p>
                  <p>{live.account} · noeud {live.server?.node}</p>
                </div>
                <Metric label="CPU" value={`${live.resources.cpu.toFixed(1)} %`} percent={live.resources.cpu} />
                <Metric
                  label="RAM"
                  value={`${formatBytes(live.resources.memoryBytes)} / ${formatBytes(live.resources.memoryLimitBytes)}`}
                  percent={
                    live.resources.memoryLimitBytes
                      ? (live.resources.memoryBytes / live.resources.memoryLimitBytes) * 100
                      : 0
                  }
                />
                <Metric
                  label="Disque"
                  value={`${formatBytes(live.resources.diskBytes)} / ${formatBytes(live.resources.diskLimitBytes)}`}
                  percent={
                    live.resources.diskLimitBytes
                      ? (live.resources.diskBytes / live.resources.diskLimitBytes) * 100
                      : 0
                  }
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {!online ? (
                    <Button size="sm" variant="success" onClick={() => power("start")} loading={busy === "start"} disabled={!can("server.power")}>
                      <Play className="h-3 w-3" /> Demarrer
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => power("restart")} loading={busy === "restart"} disabled={!can("server.power")}>
                        <RotateCw className="h-3 w-3" /> Redemarrer
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => power("stop")} loading={busy === "stop"} disabled={!can("server.power")}>
                        <Square className="h-3 w-3" /> Arreter
                      </Button>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-muted">Verifie {relativeTime(infra.data?.config?.lastCheckedAt)}</p>
              </CardBody>
            ) : null}
          </Card>

          <Card>
            <CardHeader>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <Network className="h-4 w-4" /> Reseau & ports
              </h3>
            </CardHeader>
            <CardBody className="space-y-2 text-[11px] text-muted">
              <p>Le dashboard doit joindre le panel Pterodactyl en HTTPS (443) et Wings en WebSocket (443/8080).</p>
              <ul className="space-y-1">
                <li className="flex items-center gap-1.5"><Wifi className="h-3 w-3 text-success" /> 443 — API et console</li>
                <li className="flex items-center gap-1.5"><Database className="h-3 w-3 text-primary-300" /> 3306 — MariaDB (panel, interne)</li>
                <li className="flex items-center gap-1.5"><KeyRound className="h-3 w-3 text-warning" /> 2022 — SFTP FiveM</li>
              </ul>
              {live?.sftpDetails ? (
                <p className="mono rounded border border-border bg-surface p-2 text-[10px] text-fg">
                  sftp://{live.sftpDetails.username}@{live.sftpDetails.ip}:{live.sftpDetails.port}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card className="p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Securite
            </p>
            <ul className="mt-2 space-y-1 text-[10.5px] text-muted">
              <li>• Cles API chiffrees AES-256-GCM</li>
              <li>• Aucune cle exposee au navigateur</li>
              <li>• Permissions verifiees a chaque appel</li>
              <li>• Journal d&apos;audit des actions sensibles</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <div>
      <div className="flex justify-between text-[10px]">
        <span className="text-muted">{label}</span>
        <span className="mono">{value}</span>
      </div>
      <Progress value={percent} className="mt-1" />
    </div>
  );
}

function TestIcon() {
  return <Wifi className="h-3.5 w-3.5" />;
}
