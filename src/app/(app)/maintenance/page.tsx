"use client";

import * as React from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Play,
  Plus,
  Search,
  UserRound,
  Wrench,
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
  cn,
} from "@/components/ui/primitives";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import {
  MAINTENANCE_STATUS,
  type MaintenanceStatusValue,
  type MaintenanceSummary,
  type MaintenanceWindow,
} from "@/lib/maintenance";

interface MaintenancePayload {
  windows: MaintenanceWindow[];
  summary: MaintenanceSummary;
}

interface MaintenanceForm {
  title: string;
  description: string;
  scope: string;
  impact: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: MaintenanceStatusValue;
  cancelReason: string;
}

const STATUS_ORDER: Record<MaintenanceStatusValue, number> = {
  IN_PROGRESS: 0,
  PLANNED: 1,
  COMPLETED: 2,
  CANCELED: 3,
};

function toDatetimeLocal(value: string | Date): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultForm(): MaintenanceForm {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    title: "",
    description: "",
    scope: "",
    impact: "",
    scheduledStart: toDatetimeLocal(start),
    scheduledEnd: toDatetimeLocal(end),
    status: "PLANNED",
    cancelReason: "",
  };
}

function formFromWindow(entry: MaintenanceWindow): MaintenanceForm {
  return {
    title: entry.title,
    description: entry.description,
    scope: entry.scope ?? "",
    impact: entry.impact ?? "",
    scheduledStart: toDatetimeLocal(entry.scheduledStart),
    scheduledEnd: toDatetimeLocal(entry.scheduledEnd),
    status: entry.status,
    cancelReason: entry.cancelReason ?? "",
  };
}

export default function MaintenancePage() {
  const { can } = useRealtime();
  const canManage = can("maintenance.manage");
  const list = useApi<MaintenancePayload>("/api/maintenance");

  const [statusFilter, setStatusFilter] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<MaintenanceWindow | null>(null);

  const windows = React.useMemo(() => list.data?.windows ?? [], [list.data]);
  const summary = list.data?.summary;

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return windows
      .filter((entry) => (statusFilter ? entry.status === statusFilter : true))
      .filter((entry) =>
        needle
          ? `${entry.code} ${entry.title} ${entry.scope ?? ""} ${entry.description}`
              .toLowerCase()
              .includes(needle)
          : true,
      )
      .sort((a, b) => {
        const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (statusDiff !== 0) return statusDiff;
        const aTime = new Date(a.scheduledStart).getTime();
        const bTime = new Date(b.scheduledStart).getTime();
        return a.status === "PLANNED" || a.status === "IN_PROGRESS" ? aTime - bTime : bTime - aTime;
      });
  }, [statusFilter, search, windows]);

  return (
    <div>
      <PageHeader
        eyebrow="Opérations"
        title="Maintenance planifiée"
        description="Annoncez les fenêtres de maintenance, suivez leur exécution et conservez l'historique des interventions sur le serveur."
      >
        <Badge variant={(summary?.inProgress ?? 0) > 0 ? "warning" : "neutral"}>
          {(summary?.inProgress ?? 0) > 0 ? "Maintenance en cours" : "Aucune maintenance en cours"}
        </Badge>
        {canManage ? (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Planifier une maintenance
          </Button>
        ) : null}
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Planifiées"
          value={String(summary?.planned ?? 0)}
          hint="Fenêtres à venir ou à confirmer"
          icon={<CalendarClock className="h-4 w-4" />}
          accent="info"
        />
        <Stat
          label="En cours"
          value={String(summary?.inProgress ?? 0)}
          hint="Intervention actuellement ouverte"
          icon={<Play className="h-4 w-4" />}
          accent={(summary?.inProgress ?? 0) > 0 ? "warning" : "success"}
        />
        <Stat
          label="Prochaine fenêtre"
          value={summary?.next ? formatDate(summary.next.scheduledStart) : "—"}
          hint={
            summary?.next
              ? `${formatTime(summary.next.scheduledStart)} · ${summary.next.title}`
              : "Aucune fenêtre à venir"
          }
          icon={<Clock3 className="h-4 w-4" />}
          accent="primary"
        />
        <Stat
          label="Terminées / 30 jours"
          value={String(summary?.completed30d ?? 0)}
          hint="Interventions clôturées"
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="success"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input
            className="pl-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un code, un titre, une ressource..."
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="w-auto min-w-[170px]"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(MAINTENANCE_STATUS).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>
        <span className="text-xs text-muted">
          {filtered.length} / {windows.length} fenêtre(s)
        </span>
      </div>

      {list.loading && !list.data ? (
        <div className="space-y-2">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      ) : list.error ? (
        <Card className="p-6 text-sm text-danger">{list.error}</Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wrench className="h-5 w-5" />}
            title={windows.length === 0 ? "Aucune maintenance planifiée" : "Aucun résultat"}
            description={
              windows.length === 0
                ? "Planifiez une fenêtre pour prévenir l'équipe et garder une trace des interventions."
                : "Modifiez les filtres pour retrouver une fenêtre de maintenance."
            }
            action={
              canManage && windows.length === 0 ? (
                <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Planifier la première maintenance
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => (
            <MaintenanceRow key={entry.id} entry={entry} onOpen={() => setSelected(entry)} />
          ))}
        </div>
      )}

      <CreateMaintenanceDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          void list.refresh();
        }}
      />

      {selected ? (
        <MaintenanceDetailDialog
          key={selected.id}
          entry={selected}
          canManage={canManage}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            setSelected(null);
            void list.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function MaintenanceRow({
  entry,
  onOpen,
}: {
  entry: MaintenanceWindow;
  onOpen: () => void;
}) {
  const meta = MAINTENANCE_STATUS[entry.status];
  const late =
    entry.status === "PLANNED" && new Date(entry.scheduledStart).getTime() < Date.now();
  const Icon =
    entry.status === "IN_PROGRESS"
      ? Play
      : entry.status === "COMPLETED"
        ? CheckCircle2
        : entry.status === "CANCELED"
          ? XCircle
          : CalendarClock;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "panel panel-interactive flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left",
        entry.status === "IN_PROGRESS" && "border-warning/30",
        late && "border-danger/30",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
          entry.status === "IN_PROGRESS"
            ? "border-warning/30 bg-warning/10 text-warning"
            : entry.status === "COMPLETED"
              ? "border-success/30 bg-success/10 text-success"
              : entry.status === "CANCELED"
                ? "border-border bg-white/[0.03] text-muted"
                : late
                  ? "border-danger/30 bg-danger/10 text-danger"
                  : "border-primary-500/30 bg-primary-500/10 text-primary-300",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="mono text-[10px] text-muted">{entry.code}</span>
          <Badge variant={meta.variant}>{meta.label}</Badge>
          {late ? <Badge variant="danger">En retard</Badge> : null}
          {entry.scope ? (
            <span className="rounded border border-border bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-muted">
              {entry.scope}
            </span>
          ) : null}
        </span>
        <span className="mt-1 block truncate text-xs font-medium text-fg">{entry.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <Clock3 className="h-3 w-3" /> {formatDateTime(entry.scheduledStart)} →{" "}
            {formatDateTime(entry.scheduledEnd)}
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <UserRound className="h-3 w-3" /> {entry.createdBy.displayName}
          </span>
        </span>
      </span>

      <span className="flex items-center gap-1 text-[10px] text-primary-300">
        Détails <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

function CreateMaintenanceDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = React.useState<MaintenanceForm>(defaultForm);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setForm(defaultForm());
      setError(null);
    }
  }, [open]);

  function update<K extends keyof MaintenanceForm>(key: K, value: MaintenanceForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    const start = new Date(form.scheduledStart);
    const end = new Date(form.scheduledEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setError("La fin de la maintenance doit être postérieure au début.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/maintenance", {
        method: "POST",
        body: {
          title: form.title.trim(),
          description: form.description.trim(),
          scope: form.scope.trim() || undefined,
          impact: form.impact.trim() || undefined,
          scheduledStart: start.toISOString(),
          scheduledEnd: end.toISOString(),
        },
      });
      toast.success("Fenêtre de maintenance planifiée");
      onCreated();
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
      title="Planifier une maintenance"
      description="La fenêtre est visible par l'équipe et conservée dans l'historique."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={save}
            disabled={form.title.trim().length < 5 || form.description.trim().length < 10}
          >
            Planifier
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
            placeholder="Ex : Mise à jour du framework et redémarrage"
            maxLength={200}
          />
        </Field>

        <Field label="Description" hint="Décrivez l'intervention et ce qui sera vérifié.">
          <Textarea
            rows={4}
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Ressources concernées, opérations prévues, contrôles après redémarrage..."
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Début">
            <Input
              type="datetime-local"
              value={form.scheduledStart}
              onChange={(event) => update("scheduledStart", event.target.value)}
            />
          </Field>
          <Field label="Fin">
            <Input
              type="datetime-local"
              value={form.scheduledEnd}
              onChange={(event) => update("scheduledEnd", event.target.value)}
            />
          </Field>
        </div>

        <Field label="Périmètre">
          <Input
            value={form.scope}
            onChange={(event) => update("scope", event.target.value)}
            placeholder="Serveur complet, ressource [core], base de données..."
            maxLength={120}
          />
        </Field>

        <Field label="Impact joueurs" hint="Optionnel : ce que les joueurs doivent anticiper.">
          <Textarea
            rows={3}
            value={form.impact}
            onChange={(event) => update("impact", event.target.value)}
            placeholder="Déconnexions temporaires, fonctionnalités indisponibles..."
          />
        </Field>
      </div>
    </Modal>
  );
}

function MaintenanceDetailDialog({
  entry,
  canManage,
  onClose,
  onUpdated,
}: {
  entry: MaintenanceWindow;
  canManage: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [form, setForm] = React.useState<MaintenanceForm>(() => formFromWindow(entry));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const meta = MAINTENANCE_STATUS[entry.status];
  const requiresCancelReason = form.status === "CANCELED" && !form.cancelReason.trim();

  function update<K extends keyof MaintenanceForm>(key: K, value: MaintenanceForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    const start = new Date(form.scheduledStart);
    const end = new Date(form.scheduledEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setError("La fin de la maintenance doit être postérieure au début.");
      return;
    }
    if (requiresCancelReason) {
      setError("Renseignez le motif d'annulation.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/maintenance/${entry.id}`, {
        method: "PATCH",
        body: {
          title: form.title.trim(),
          description: form.description.trim(),
          scope: form.scope.trim() || null,
          impact: form.impact.trim() || null,
          scheduledStart: start.toISOString(),
          scheduledEnd: end.toISOString(),
          status: form.status,
          ...(form.status === "CANCELED"
            ? { cancelReason: form.cancelReason.trim() || null }
            : {}),
        },
      });
      toast.success("Fenêtre de maintenance mise à jour");
      onUpdated();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const timeline = [
    { label: "Créée", at: entry.createdAt, icon: <CircleDot className="h-3 w-3" /> },
    { label: "Démarrage", at: entry.startedAt, icon: <Play className="h-3 w-3" /> },
    { label: "Fin", at: entry.completedAt, icon: <CheckCircle2 className="h-3 w-3" /> },
    { label: "Annulation", at: entry.canceledAt, icon: <XCircle className="h-3 w-3" /> },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={`${entry.code} · ${entry.title}`}
      description={`Créée par ${entry.createdBy.displayName} · ${formatDateTime(entry.createdAt)}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          {canManage ? (
            <Button
              variant="primary"
              loading={busy}
              onClick={save}
              disabled={
                form.title.trim().length < 5 ||
                form.description.trim().length < 10 ||
                requiresCancelReason
              }
            >
              Enregistrer
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
          <Badge variant={meta.variant}>{meta.label}</Badge>
          {entry.scope ? (
            <span className="mono rounded border border-border bg-white/[0.03] px-2 py-0.5 text-[10px] text-muted">
              {entry.scope}
            </span>
          ) : null}
          <span className="ml-auto text-[10px] text-muted">
            {formatDateTime(entry.scheduledStart)} → {formatDateTime(entry.scheduledEnd)}
          </span>
        </div>

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Description</p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-fg/90">
            {entry.description}
          </p>
        </section>

        {entry.impact ? (
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Impact joueurs
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-fg/90">
              {entry.impact}
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
                key={step.label}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[10.5px]",
                  step.at
                    ? "border-success/20 bg-success/[0.04] text-fg"
                    : "border-border bg-surface/40 text-muted",
                )}
              >
                <span className={step.at ? "text-success" : "text-muted/50"}>{step.icon}</span>
                <span className="min-w-0 flex-1 truncate">{step.label}</span>
                <span className="shrink-0 text-[9px] text-muted">
                  {step.at ? formatDateTime(step.at) : "-"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {entry.cancelReason ? (
          <section className="rounded-lg border border-border bg-white/[0.02] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Motif d&apos;annulation
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-fg/90">
              {entry.cancelReason}
            </p>
          </section>
        ) : null}

        {canManage ? (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Pilotage de la fenêtre
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Statut">
                <Select
                  value={form.status}
                  onChange={(event) =>
                    update("status", event.target.value as MaintenanceStatusValue)
                  }
                >
                  {Object.entries(MAINTENANCE_STATUS).map(([value, item]) => (
                    <option key={value} value={value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Périmètre">
                <Input
                  value={form.scope}
                  onChange={(event) => update("scope", event.target.value)}
                  placeholder="Serveur complet, ressource..."
                  maxLength={120}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Début">
                <Input
                  type="datetime-local"
                  value={form.scheduledStart}
                  onChange={(event) => update("scheduledStart", event.target.value)}
                />
              </Field>
              <Field label="Fin">
                <Input
                  type="datetime-local"
                  value={form.scheduledEnd}
                  onChange={(event) => update("scheduledEnd", event.target.value)}
                />
              </Field>
            </div>

            <Field label="Titre">
              <Input
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                maxLength={200}
              />
            </Field>

            <Field label="Description">
              <Textarea
                rows={3}
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
              />
            </Field>

            <Field label="Impact joueurs">
              <Textarea
                rows={2}
                value={form.impact}
                onChange={(event) => update("impact", event.target.value)}
              />
            </Field>

            {form.status === "CANCELED" ? (
              <Field label="Motif d'annulation" hint="Obligatoire pour annuler la fenêtre.">
                <Textarea
                  rows={2}
                  value={form.cancelReason}
                  onChange={(event) => update("cancelReason", event.target.value)}
                  placeholder="Raison de l'annulation, report éventuel..."
                />
              </Field>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
