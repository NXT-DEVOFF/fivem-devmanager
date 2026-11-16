"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Copy,
  Crosshair,
  Flame,
  Move,
  Plug,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Target,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { useRealtime } from "@/components/realtime-provider";
import { Modal } from "@/components/ui/modal";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Stat,
  Textarea,
} from "@/components/ui/primitives";
import { formatDateTime, relativeTime } from "@/lib/format";
import {
  ANTICHEAT_SEVERITY,
  ANTICHEAT_STATUS,
  categoryLabel,
  detectionMeta,
  type AnticheatAgentEntry,
  type AnticheatEventEntry,
  type AnticheatStatusValue,
  type AnticheatSummary,
} from "@/lib/anticheat";

interface AnticheatPayload {
  events: AnticheatEventEntry[];
  summary: AnticheatSummary;
  detections: Array<{ key: string; count: number }>;
  agents: AnticheatAgentEntry[];
  periodDays: number;
}

type Period = "24h" | "7d" | "30d" | "all";

const PERIODS: Array<{ value: Period; label: string; hours: number | null }> = [
  { value: "24h", label: "24 heures", hours: 24 },
  { value: "7d", label: "7 jours", hours: 24 * 7 },
  { value: "30d", label: "30 jours", hours: 24 * 30 },
  { value: "all", label: "Toute la période", hours: null },
];

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  explosion: Flame,
  entity: Boxes,
  projectile: Crosshair,
  weapon: Target,
  movement: Move,
};

export default function AnticheatPage() {
  const { can } = useRealtime();
  const canManage = can("anticheat.manage");
  const list = useApi<AnticheatPayload>("/api/anticheat?days=30", { pollMs: 30_000 });

  const [search, setSearch] = React.useState("");
  const [severityFilter, setSeverityFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [period, setPeriod] = React.useState<Period>("30d");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [installOpen, setInstallOpen] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const events = React.useMemo(() => list.data?.events ?? [], [list.data]);
  const summary = list.data?.summary;
  const agents = React.useMemo(() => list.data?.agents ?? [], [list.data]);
  const onlineAgent = agents.find((agent) => agent.online) ?? null;
  const selected = React.useMemo(
    () => events.find((event) => event.id === selectedId) ?? null,
    [events, selectedId],
  );

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    const hours = PERIODS.find((entry) => entry.value === period)?.hours ?? null;
    const since = hours ? Date.now() - hours * 3_600_000 : null;

    return events.filter((event) => {
      if (severityFilter && event.severity !== severityFilter) return false;
      if (statusFilter && event.status !== statusFilter) return false;
      if (since && new Date(event.lastSeenAt).getTime() < since) return false;
      if (!needle) return true;
      return `${event.playerName ?? ""} ${event.playerLicense ?? ""} ${event.detection} ${
        event.resource ?? ""
      } ${event.serverId ?? ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [events, search, severityFilter, statusFilter, period]);

  async function refresh() {
    setRefreshing(true);
    try {
      await list.refresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Sécurité"
        title="Anticheat"
        description="Alertes envoyées par l'agent serveur FiveM. Mode rapport uniquement : aucune sanction n'est appliquée automatiquement, chaque alerte est vérifiée par l'équipe."
      >
        <Badge variant={onlineAgent ? "success" : "warning"}>
          <Activity className="h-3 w-3" />
          {agents.length === 0
            ? "Agent non connecté"
            : onlineAgent
              ? `Agent en ligne · ${onlineAgent.serverId}`
              : "Agent hors ligne"}
        </Badge>
        <Badge variant="info">
          <ShieldCheck className="h-3 w-3" /> Mode rapport
        </Badge>
        <Button variant="secondary" onClick={() => setInstallOpen(true)}>
          <Plug className="h-4 w-4" />
          Connecter mon serveur
        </Button>
        <Button variant="ghost" onClick={() => void refresh()} loading={refreshing}>
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </Button>
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Alertes / 24 h"
          value={String(summary?.total24h ?? 0)}
          hint="Toutes sévérités confondues"
          icon={<Siren className="h-4 w-4" />}
          accent={(summary?.total24h ?? 0) > 0 ? "warning" : "success"}
        />
        <Stat
          label="Ouvertes"
          value={String(summary?.open ?? 0)}
          hint={`${summary?.acknowledged ?? 0} prise(s) en compte`}
          icon={<AlertTriangle className="h-4 w-4" />}
          accent={(summary?.open ?? 0) > 0 ? "danger" : "success"}
        />
        <Stat
          label="Critiques ouvertes"
          value={String(summary?.criticalOpen ?? 0)}
          hint="À traiter en priorité"
          icon={<ShieldAlert className="h-4 w-4" />}
          accent={(summary?.criticalOpen ?? 0) > 0 ? "danger" : "success"}
        />
        <Stat
          label="Joueurs signalés"
          value={String(summary?.flaggedPlayers ?? 0)}
          hint={`${summary?.resolved ?? 0} résolue(s) · ${
            summary?.falsePositive ?? 0
          } faux positif(s)`}
          icon={<Users className="h-4 w-4" />}
          accent="info"
        />
      </div>

      <AgentStrip agents={agents} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input
            className="pl-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un joueur, une licence, une détection..."
          />
        </div>
        <Select
          value={severityFilter}
          onChange={(event) => setSeverityFilter(event.target.value)}
          className="w-auto min-w-[160px]"
        >
          <option value="">Toutes les sévérités</option>
          {Object.entries(ANTICHEAT_SEVERITY).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="w-auto min-w-[170px]"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(ANTICHEAT_STATUS).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>
        <Select
          value={period}
          onChange={(event) => setPeriod(event.target.value as Period)}
          className="w-auto min-w-[170px]"
        >
          {PERIODS.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </Select>
        <span className="text-xs text-muted">
          {filtered.length} / {events.length} alerte(s)
        </span>
      </div>

      {list.loading && !list.data ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      ) : list.error ? (
        <Card className="p-6 text-sm text-danger">{list.error}</Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShieldCheck className="h-5 w-5" />}
            title={events.length === 0 ? "Aucune alerte pour le moment" : "Aucun résultat"}
            description={
              events.length === 0
                ? "Connectez l'agent fdm-anticheat à votre serveur : les détections apparaîtront ici et resteront en attente de vérification."
                : "Modifiez la recherche, la sévérité, le statut ou la période."
            }
            action={
              events.length === 0 ? (
                <Button variant="primary" size="sm" onClick={() => setInstallOpen(true)}>
                  <Plug className="h-4 w-4" />
                  Voir l&apos;installation
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              onOpen={() => setSelectedId(event.id)}
            />
          ))}
        </div>
      )}

      <Card className="mt-4 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary-500/20 bg-primary-500/10 text-primary-300">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-fg">Aucune punition automatique</p>
            <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted">
              L&apos;agent collecte des preuves côté serveur et les transmet au panel. Les faux
              positifs sont possibles (ressources personnalisées, événements RP, outils
              d&apos;administration) : vérifiez toujours le contexte avant une sanction manuelle.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setInstallOpen(true)}>
            <Plug className="h-3.5 w-3.5" />
            Installation
          </Button>
        </div>
      </Card>

      {selected ? (
        <EventDetailDialog
          key={selected.id}
          event={selected}
          canManage={canManage}
          onClose={() => setSelectedId(null)}
          onChanged={async () => {
            setSelectedId(null);
            await list.refresh();
          }}
        />
      ) : null}

      <InstallDialog
        open={installOpen}
        onClose={() => setInstallOpen(false)}
        detections={list.data?.detections ?? []}
      />
    </div>
  );
}

function AgentStrip({ agents }: { agents: AnticheatAgentEntry[] }) {
  if (agents.length === 0) return null;

  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2">
      {agents.map((agent) => (
        <div key={agent.id} className="panel flex flex-wrap items-center gap-3 px-4 py-3">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              agent.online ? "bg-success" : "bg-danger"
            }`}
            aria-label={agent.online ? "En ligne" : "Hors ligne"}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-fg">{agent.serverId}</p>
            <p className="mt-0.5 text-[10px] text-muted">
              {agent.online
                ? "Agent connecté"
                : `Hors ligne depuis ${relativeTime(agent.lastSeenAt)}`}
              {agent.version ? ` · v${agent.version}` : ""}
              {` · ${agent.playerCount} joueur(s)`}
              {agent.lastError ? ` · ${agent.lastError}` : ""}
            </p>
          </div>
          <div className="text-right text-[10px] text-muted">
            <p>{agent.queueSize} en file</p>
            <p>{agent.detectionsTotal} détection(s) depuis le démarrage</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function EventRow({ event, onOpen }: { event: AnticheatEventEntry; onOpen: () => void }) {
  const severity = ANTICHEAT_SEVERITY[event.severity];
  const status = ANTICHEAT_STATUS[event.status];
  const detection = detectionMeta(event.detection);
  const Icon = CATEGORY_ICONS[event.category] ?? AlertTriangle;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="panel panel-interactive flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-white/[0.03] text-muted">
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-fg">{detection.label}</span>
          <Badge variant={severity.variant}>{severity.label}</Badge>
          <Badge variant={status.variant}>{status.label}</Badge>
          {event.occurrences > 1 ? (
            <Badge variant="warning">×{event.occurrences}</Badge>
          ) : null}
          <span className="text-[10px] text-muted">{categoryLabel(event.category)}</span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted">
          {event.playerName ? <span>{event.playerName}</span> : <span>Joueur inconnu</span>}
          {event.playerLicense ? <span className="mono">· {event.playerLicense}</span> : null}
          {event.resource ? <span>· {event.resource}</span> : null}
          {event.serverId ? <span>· {event.serverId}</span> : null}
        </span>
      </span>

      <span className="text-right text-[10px] text-muted">
        <span className="block">{relativeTime(event.lastSeenAt)}</span>
        <span className="block">{formatDateTime(event.lastSeenAt)}</span>
      </span>
    </button>
  );
}

function EventDetailDialog({
  event,
  canManage,
  onClose,
  onChanged,
}: {
  event: AnticheatEventEntry;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const severity = ANTICHEAT_SEVERITY[event.severity];
  const status = ANTICHEAT_STATUS[event.status];
  const detection = detectionMeta(event.detection);
  const [resolution, setResolution] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function update(next: AnticheatStatusValue, note?: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/anticheat/${event.id}`, {
        method: "PATCH",
        body: { status: next, resolution: note },
      });
      toast.success(
        next === "ACKNOWLEDGED"
          ? "Alerte prise en compte"
          : next === "OPEN"
            ? "Alerte réouverte"
            : "Alerte traitée",
      );
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const closed = event.status === "RESOLVED" || event.status === "FALSE_POSITIVE";
  const details = event.details ? JSON.stringify(event.details, null, 2) : "Aucune donnée technique";

  return (
    <Modal
      open
      onClose={onClose}
      title={detection.label}
      description={detection.description}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          {canManage && closed ? (
            <Button variant="secondary" loading={busy} onClick={() => void update("OPEN")}>
              Réouvrir
            </Button>
          ) : null}
          {canManage && event.status === "OPEN" ? (
            <Button variant="secondary" loading={busy} onClick={() => void update("ACKNOWLEDGED")}>
              <CheckCircle2 className="h-4 w-4" />
              Prendre en compte
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={severity.variant}>{severity.label}</Badge>
          <Badge variant={status.variant}>{status.label}</Badge>
          {event.occurrences > 1 ? (
            <Badge variant="warning">×{event.occurrences} occurrences</Badge>
          ) : null}
          <Badge variant="neutral">{categoryLabel(event.category)}</Badge>
          {event.resource ? <Badge variant="neutral">{event.resource}</Badge> : null}
          <span className="ml-auto text-[10px] text-muted">
            {formatDateTime(event.occurredAt)}
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <InfoTile label="Joueur" value={event.playerName ?? "Inconnu"} />
          <InfoTile label="Licence" value={event.playerLicense ?? "Non transmise"} mono />
          <InfoTile
            label="Source / Net ID"
            value={
              event.playerSource !== null || event.playerNetId !== null
                ? `${event.playerSource ?? "?"} / ${event.playerNetId ?? "?"}`
                : "—"
            }
          />
          <InfoTile label="Serveur" value={event.serverId ?? "Non renseigné"} />
        </div>

        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
            Données techniques
          </p>
          <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-black/30 p-3 text-[10px] leading-relaxed text-fg/80">
            {details}
          </pre>
          {event.identifiers.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {event.identifiers.map((identifier) => (
                <Badge key={identifier} variant="neutral">
                  {identifier}
                </Badge>
              ))}
            </div>
          ) : null}
        </section>

        <section className="grid gap-2 text-[11px] text-muted sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-white/[0.02] px-3 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted">Détections</p>
            <p className="mt-0.5 text-fg/90">
              {event.occurrences} occurrence(s) · reçue le {formatDateTime(event.createdAt)}
            </p>
            <p className="mt-1 text-fg/90">
              Première : {formatDateTime(event.occurredAt)} · dernière :{" "}
              {formatDateTime(event.lastSeenAt)}
            </p>
            <p className="mt-1 mono text-[9px] text-muted/70">ID {event.eventId}</p>
          </div>
          <div className="rounded-lg border border-border bg-white/[0.02] px-3 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted">Traitement</p>
            {event.acknowledgedAt ? (
              <p className="mt-0.5 text-fg/90">
                Prise en compte par {event.acknowledgedBy?.displayName ?? "inconnu"} le{" "}
                {formatDateTime(event.acknowledgedAt)}
              </p>
            ) : (
              <p className="mt-0.5 text-fg/90">En attente de prise en compte</p>
            )}
            {event.resolvedAt ? (
              <p className="mt-1 text-fg/90">
                Traitée par {event.resolvedBy?.displayName ?? "inconnu"} le{" "}
                {formatDateTime(event.resolvedAt)}
              </p>
            ) : null}
          </div>
        </section>

        {event.resolution ? (
          <section>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
              Note de résolution
            </p>
            <p className="whitespace-pre-wrap rounded-lg border border-border bg-white/[0.02] px-3 py-2 text-xs leading-relaxed text-fg/90">
              {event.resolution}
            </p>
          </section>
        ) : null}

        {canManage && !closed ? (
          <section className="space-y-3 border-t border-border pt-4">
            <Field
              label="Note de résolution"
              hint="Obligatoire pour clôturer : contexte vérifié, sanction éventuelle, ou raison du faux positif."
            >
              <Textarea
                rows={3}
                value={resolution}
                onChange={(changeEvent) => setResolution(changeEvent.target.value)}
                placeholder="Ex : vitesse élevée confirmée en avion, faux positif. / Clip vérifié, ban appliqué manuellement."
                maxLength={2000}
              />
            </Field>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="ghost"
                loading={busy}
                disabled={resolution.trim().length < 5}
                onClick={() => void update("FALSE_POSITIVE", resolution.trim())}
              >
                <XCircle className="h-4 w-4" />
                Faux positif
              </Button>
              <Button
                variant="primary"
                loading={busy}
                disabled={resolution.trim().length < 5}
                onClick={() => void update("RESOLVED", resolution.trim())}
              >
                <CheckCircle2 className="h-4 w-4" />
                Résoudre
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}

function InstallDialog({
  open,
  onClose,
  detections,
}: {
  open: boolean;
  onClose: () => void;
  detections: Array<{ key: string; count: number }>;
}) {
  const [origin, setOrigin] = React.useState("https://votre-panel.example.com");

  React.useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const endpoint = `${origin}/api/anticheat/ingest`;

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copié`);
    } catch {
      toast.error("Copie impossible : sélectionnez le texte manuellement");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Connecter mon serveur FiveM"
      description="L'agent fdm-anticheat envoie des rapports au panel. Aucune ressource cliente, aucune DLL, aucune punition automatique."
      size="xl"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Fermer
        </Button>
      }
    >
      <div className="space-y-5 text-xs">
        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
            1 · Installer la ressource
          </p>
          <p className="leading-relaxed text-fg/90">
            Copiez le dossier{" "}
            <span className="mono rounded bg-white/5 px-1 py-0.5">fivem-resources/fdm-anticheat</span>{" "}
            dans le dossier <span className="mono">resources</span> de votre serveur, puis ajoutez
            les lignes suivantes à votre <span className="mono">server.cfg</span>.
          </p>
        </section>

        <section>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              2 · Endpoint du panel
            </p>
            <Button variant="ghost" size="sm" onClick={() => void copy(endpoint, "Endpoint")}>
              <Copy className="h-3.5 w-3.5" /> Copier
            </Button>
          </div>
          <pre className="overflow-auto rounded-lg border border-border bg-black/30 p-3 text-[10px] text-fg/80">
            {endpoint}
          </pre>
          <p className="mt-2 text-[10px] leading-relaxed text-muted">
            Panel et serveur FiveM sur la même machine ? Utilisez l&apos;adresse privée de
            l&apos;hôte et le port alloué au panel (par exemple{" "}
            <span className="mono">http://IP_PRIVEE:PORT/api/anticheat/ingest</span>) pour garder
            le trafic en local. Conservez le token et limitez ce port au serveur FiveM dans le
            pare-feu ; utilisez HTTPS si le trafic quitte la machine.
          </p>
        </section>

        <section>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
            3 · server.cfg
          </p>
          <pre className="overflow-auto rounded-lg border border-border bg-black/30 p-3 text-[10px] leading-relaxed text-fg/80">
{`# Endpoint et token d'ingestion (token à générer, voir ci-dessous)
set fdm_anticheat_endpoint "${endpoint}"
set fdm_anticheat_token "VOTRE_TOKEN"
set fdm_anticheat_server_id "mon-serveur"

# Envoi plus rapide et file persistante (panel sur la même machine)
set fdm_anticheat_flush_interval "5000"

# Commandes de diagnostic réservées aux admins
add_ace group.admin fdm.anticheat.admin allow

ensure fdm-anticheat`}
          </pre>
          <p className="mt-2 text-[10px] leading-relaxed text-muted">
            Le token doit être identique à la variable{" "}
            <span className="mono">ANTICHEAT_INGEST_TOKEN</span> du panel. Générez-le avec{" "}
            <span className="mono">
              node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;base64url&apos;))&quot;
            </span>
            . Ne le mettez jamais dans une ressource cliente.
          </p>
        </section>

        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
            4 · Vérifier
          </p>
          <p className="leading-relaxed text-fg/90">
            Redémarrez le serveur, puis tapez <span className="mono">fdmac test</span> dans la
            console : un événement de test doit apparaître ici sous 30 secondes.{" "}
            <span className="mono">fdmac status</span> affiche la file d&apos;envoi et l&apos;état
            de connexion.
          </p>
        </section>

        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
            5 · Détections actives
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[
              "explosion_spam",
              "explosion_abnormal_scale",
              "entity_spam",
              "vehicle_spawn_spam",
              "projectile_spam",
              "weapon_damage_anomaly",
              "speed_anomaly",
              "teleport_anomaly",
            ].map((key) => (
              <Badge key={key} variant="neutral">
                {detectionMeta(key).label}
              </Badge>
            ))}
          </div>
          {detections.length > 0 ? (
            <p className="mt-2 text-[10px] text-muted">
              Reçues récemment : {detections.slice(0, 5).map((entry) => `${entry.key} (${entry.count})`).join(", ")}
            </p>
          ) : null}
        </section>

        <section className="rounded-lg border border-warning/25 bg-warning/5 px-3 py-2 text-[10px] leading-relaxed text-warning/90">
          Les seuils par défaut privilégient la détection des comportements manifestes. Ajustez
          <span className="mono"> config.lua </span>
          selon vos ressources (RP, courses, outils admin) pour limiter les faux positifs. Les
          joueurs disposant de l&apos;ACE <span className="mono">fdm.anticheat.exempt</span> sont
          ignorés : réservez-la aux comptes de confiance.
        </section>
      </div>
    </Modal>
  );
}

function InfoTile({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-white/[0.02] px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-0.5 truncate text-xs font-medium text-fg ${mono ? "mono" : ""}`} title={value}>
        {value}
      </p>
    </div>
  );
}
