"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Plus,
  Search,
  ShieldAlert,
  Siren,
  Timer,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/use-api";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useRealtime } from "@/components/realtime-provider";
import {
  Avatar,
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
  cn,
} from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { INCIDENT_STATUS, SEVERITY } from "@/lib/labels";
import { formatDateTime, formatDuration, relativeTime } from "@/lib/format";
import {
  type IncidentSeverityValue,
  type IncidentStatusValue,
  type IncidentView,
  type IncidentsPayload,
} from "@/lib/incidents";

interface TeamMember {
  id: string;
  displayName: string;
  role: string;
}

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export default function IncidentsPage() {
  const { can } = useRealtime();
  const incidents = useApi<IncidentsPayload>("/api/incidents");
  const team = useApi<{ users: TeamMember[] }>("/api/team");
  const [status, setStatus] = React.useState("");
  const [severity, setSeverity] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<IncidentView | null>(null);

  const rows = incidents.data?.incidents ?? [];
  const summary = incidents.data?.summary;
  const filtered = rows
    .filter((incident) => (status ? incident.status === status : true))
    .filter((incident) => (severity ? incident.severity === severity : true))
    .filter((incident) =>
      search
        ? `${incident.code} ${incident.title} ${incident.resource ?? ""}`
            .toLowerCase()
            .includes(search.toLowerCase())
        : true,
    )
    .sort((a, b) => {
      const activeDiff = Number(a.status === "RESOLVED") - Number(b.status === "RESOLVED");
      if (activeDiff !== 0) return activeDiff;
      const severityDiff = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });

  return (
    <div>
      <PageHeader
        title="Incidents de production"
        description="Un registre commun pour les incidents FiveM : impact, prise en charge, mitigation et resolution."
        eyebrow="Operations"
      >
        <Badge variant={(summary?.active ?? 0) > 0 ? "danger" : "success"}>
          <span
            className={cn(
              "mr-1 h-1.5 w-1.5 rounded-full",
              (summary?.active ?? 0) > 0 ? "bg-danger" : "bg-success",
            )}
          />
          {summary?.active ?? 0} actif(s)
        </Badge>
        {can("incidents.create") ? (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Signaler un incident
          </Button>
        ) : null}
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Incidents actifs"
          value={String(summary?.active ?? 0)}
          hint={`${summary?.investigating ?? 0} en investigation · ${summary?.mitigated ?? 0} maitrise(s)`}
          icon={<Siren className="h-4 w-4" />}
          accent={(summary?.active ?? 0) > 0 ? "danger" : "success"}
        />
        <Stat
          label="Critiques"
          value={String(summary?.critical ?? 0)}
          hint="Priorite absolue"
          icon={<ShieldAlert className="h-4 w-4" />}
          accent={(summary?.critical ?? 0) > 0 ? "danger" : "success"}
        />
        <Stat
          label="Temps moyen de resolution"
          value={summary?.avgResolutionSeconds ? formatDuration(summary.avgResolutionSeconds) : "-"}
          hint="Sur les incidents resolus ces 30 derniers jours"
          icon={<Timer className="h-4 w-4" />}
          accent="info"
        />
        <Stat
          label="Resolus / 30 jours"
          value={String(summary?.resolved30d ?? 0)}
          hint="Cycles d'incident termines"
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="success"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input
            className="pl-8"
            placeholder="Rechercher un incident, un code, une ressource..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-auto">
          <option value="">Tous les statuts</option>
          {Object.entries(INCIDENT_STATUS).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>
        <Select value={severity} onChange={(event) => setSeverity(event.target.value)} className="w-auto">
          <option value="">Toutes severites</option>
          {Object.entries(SEVERITY).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>
      </div>

      {incidents.error ? (
        <Card className="p-6 text-sm text-danger">{incidents.error}</Card>
      ) : incidents.loading && !incidents.data ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CheckCircle2 className="h-5 w-5" />}
            title={rows.length === 0 ? "Aucun incident enregistre" : "Aucun incident pour ces filtres"}
            description={
              rows.length === 0
                ? "Le prochain incident de production pourra etre qualifie, suivi et clos au meme endroit."
                : "Modifiez les filtres pour retrouver un incident."
            }
            action={
              rows.length === 0 && can("incidents.create") ? (
                <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Signaler un incident
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((incident) => (
            <IncidentRow key={incident.id} incident={incident} onOpen={() => setSelected(incident)} />
          ))}
        </div>
      )}

      <CreateIncidentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        team={team.data?.users ?? []}
        onCreated={() => {
          setCreateOpen(false);
          void incidents.refresh();
        }}
      />

      {selected ? (
        <IncidentDetailDialog
          key={`${selected.id}-${selected.status}-${selected.resolution ?? ""}`}
          incident={selected}
          canManage={can("incidents.manage")}
          team={team.data?.users ?? []}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            setSelected(null);
            void incidents.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function IncidentRow({ incident, onOpen }: { incident: IncidentView; onOpen: () => void }) {
  const status = INCIDENT_STATUS[incident.status] ?? INCIDENT_STATUS.OPEN!;
  const severity = SEVERITY[incident.severity] ?? SEVERITY.MEDIUM!;
  const active = incident.status !== "RESOLVED";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "panel panel-interactive flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left",
        active && incident.severity === "CRITICAL" && "border-danger/30",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
          active
            ? incident.severity === "CRITICAL"
              ? "border-danger/30 bg-danger/10 text-danger"
              : "border-warning/30 bg-warning/10 text-warning"
            : "border-success/30 bg-success/10 text-success",
        )}
      >
        {active ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="mono text-[10px] text-muted">{incident.code}</span>
          <Badge variant={severity.variant}>{severity.label}</Badge>
          <Badge variant={status.variant}>{status.label}</Badge>
          {incident.resource ? (
            <span className="rounded border border-border bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-muted">
              {incident.resource}
            </span>
          ) : null}
        </span>
        <span className="mt-1 block truncate text-xs font-medium text-fg">{incident.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <Avatar name={incident.reporter.displayName} color={incident.reporter.avatarColor} size="xs" />
            {incident.reporter.displayName}
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Clock3 className="h-3 w-3" /> ouvert {relativeTime(incident.startedAt)}
          </span>
          {incident.assignee ? (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <UserRound className="h-3 w-3" /> {incident.assignee.displayName}
              </span>
            </>
          ) : null}
        </span>
      </span>
      <span className="flex items-center gap-1 text-[10px] text-primary-300">
        Details <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

function IncidentDetailDialog({
  incident,
  canManage,
  team,
  onClose,
  onUpdated,
}: {
  incident: IncidentView;
  canManage: boolean;
  team: TeamMember[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [status, setStatus] = React.useState<IncidentStatusValue>(incident.status);
  const [severity, setSeverity] = React.useState<IncidentSeverityValue>(incident.severity);
  const [assigneeId, setAssigneeId] = React.useState(incident.assignee?.id ?? "");
  const [impact, setImpact] = React.useState(incident.impact ?? "");
  const [resolution, setResolution] = React.useState(incident.resolution ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const statusMeta = INCIDENT_STATUS[incident.status] ?? INCIDENT_STATUS.OPEN!;
  const severityMeta = SEVERITY[incident.severity] ?? SEVERITY.MEDIUM!;
  const requiresResolution = status === "RESOLVED" && !resolution.trim();

  const timeline = [
    { key: "started", label: "Incident signale", at: incident.startedAt },
    { key: "acknowledged", label: "Prise en charge", at: incident.acknowledgedAt },
    { key: "mitigated", label: "Impact maitrise", at: incident.mitigatedAt },
    { key: "resolved", label: "Resolution confirmee", at: incident.resolvedAt },
  ];

  async function submit() {
    if (requiresResolution) {
      setError("Renseignez la resolution avant de clore l'incident.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/incidents/${incident.id}`, {
        method: "PATCH",
        body: {
          status,
          severity,
          assigneeId: assigneeId || null,
          impact: impact || null,
          resolution: resolution || null,
        },
      });
      toast.success(status === "RESOLVED" ? "Incident resolu" : "Incident mis a jour");
      onUpdated();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${incident.code} · ${incident.title}`}
      description={`Signale par ${incident.reporter.displayName} · ${formatDateTime(incident.startedAt)}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          {canManage ? (
            <Button variant="primary" loading={busy} onClick={submit} disabled={requiresResolution}>
              {status === "RESOLVED" ? "Resoudre l'incident" : "Mettre a jour"}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-5">
        {error ? (
          <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={severityMeta.variant}>{severityMeta.label}</Badge>
          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
          {incident.resource ? (
            <span className="mono rounded border border-border bg-white/[0.03] px-2 py-0.5 text-[10px] text-muted">
              {incident.resource}
            </span>
          ) : null}
          <span className="ml-auto text-[10px] text-muted">
            duree ouverte : {formatDuration((Date.now() - new Date(incident.startedAt).getTime()) / 1000)}
          </span>
        </div>

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Description</p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-fg/90">
            {incident.description}
          </p>
        </section>

        {incident.impact ? (
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Impact</p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-fg/90">
              {incident.impact}
            </p>
          </section>
        ) : null}

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
            Chronologie
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {timeline.map((step) => (
              <div
                key={step.key}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[10.5px]",
                  step.at
                    ? "border-success/20 bg-success/[0.04] text-fg"
                    : "border-border bg-surface/40 text-muted",
                )}
              >
                {step.at ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                ) : (
                  <CircleDot className="h-3.5 w-3.5 shrink-0 text-muted/50" />
                )}
                <span className="min-w-0 flex-1 truncate">{step.label}</span>
                <span className="shrink-0 text-[9px] text-muted">
                  {step.at ? formatDateTime(step.at) : "-"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {incident.resolution ? (
          <section className="rounded-lg border border-success/20 bg-success/[0.04] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-success">Resolution</p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-fg/90">
              {incident.resolution}
            </p>
          </section>
        ) : null}

        {canManage ? (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Pilotage de l&apos;incident
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Statut">
                <Select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as IncidentStatusValue)}
                >
                  {Object.entries(INCIDENT_STATUS).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Severite">
                <Select
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value as IncidentSeverityValue)}
                >
                  {Object.entries(SEVERITY).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Responsable">
              <Select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                <option value="">Non assigne</option>
                {team.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Impact" hint="Services ou joueurs concernes, contournement eventuel.">
              <Textarea
                rows={3}
                value={impact}
                onChange={(event) => setImpact(event.target.value)}
              />
            </Field>
            <Field
              label="Resolution"
              hint="Obligatoire pour cloturer : cause racine et action corrective."
            >
              <Textarea
                rows={3}
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
                placeholder="Cause identifiee, correctif applique, verification effectuee..."
              />
            </Field>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function CreateIncidentDialog({
  open,
  onClose,
  team,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  team: TeamMember[];
  onCreated: () => void;
}) {
  const [form, setForm] = React.useState({
    title: "",
    description: "",
    severity: "HIGH",
    resource: "",
    impact: "",
    assigneeId: "",
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/incidents", {
        method: "POST",
        body: {
          title: form.title,
          description: form.description,
          severity: form.severity,
          resource: form.resource || undefined,
          impact: form.impact || undefined,
          assigneeId: form.assigneeId || null,
        },
      });
      toast.success("Incident signale");
      setForm({
        title: "",
        description: "",
        severity: "HIGH",
        resource: "",
        impact: "",
        assigneeId: "",
      });
      onCreated();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Signaler un incident"
      description="Qualifiez l'impact reel et désignez un responsable si possible."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="primary"
            loading={loading}
            onClick={submit}
            disabled={form.title.trim().length < 5 || form.description.trim().length < 10}
          >
            Ouvrir l&apos;incident
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        ) : null}
        <Field label="Titre">
          <Input
            value={form.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="Le serveur redemarre en boucle apres le chargement"
          />
        </Field>
        <Field label="Description">
          <Textarea
            rows={4}
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Symptomes, moment d'apparition, logs utiles..."
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Severite">
            <Select value={form.severity} onChange={(event) => update("severity", event.target.value)}>
              {Object.entries(SEVERITY).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Responsable">
            <Select value={form.assigneeId} onChange={(event) => update("assigneeId", event.target.value)}>
              <option value="">Non assigne</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Ressource concernee">
          <Input
            value={form.resource}
            onChange={(event) => update("resource", event.target.value)}
            placeholder="[core] / [vehicles] / serveur complet"
          />
        </Field>
        <Field label="Impact">
          <Textarea
            rows={3}
            value={form.impact}
            onChange={(event) => update("impact", event.target.value)}
            placeholder="Qui est touche, quelles fonctionnalites sont indisponibles ?"
          />
        </Field>
      </div>
    </Modal>
  );
}
