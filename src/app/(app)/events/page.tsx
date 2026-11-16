"use client";

import * as React from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  DoorOpen,
  MapPin,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { useRealtime } from "@/components/realtime-provider";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
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
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import {
  EVENT_CATEGORIES,
  EVENT_STATUS,
  type EventStatusValue,
  type EventSummary,
  type ServerEvent,
} from "@/lib/events";

interface EventsPayload {
  events: ServerEvent[];
  summary: EventSummary;
}

interface EventForm {
  title: string;
  category: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  maxPlayers: string;
  reward: string;
  requirements: string;
  status: "DRAFT" | "PLANNED" | "OPEN";
}

function toDatetimeLocal(value: string | Date): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultForm(): EventForm {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return {
    title: "",
    category: "Communauté",
    description: "",
    location: "",
    startsAt: toDatetimeLocal(start),
    endsAt: toDatetimeLocal(end),
    maxPlayers: "",
    reward: "",
    requirements: "",
    status: "PLANNED",
  };
}

function formFromEvent(event: ServerEvent): EventForm {
  return {
    title: event.title,
    category: event.category,
    description: event.description,
    location: event.location ?? "",
    startsAt: toDatetimeLocal(event.startsAt),
    endsAt: toDatetimeLocal(event.endsAt),
    maxPlayers: event.maxPlayers ? String(event.maxPlayers) : "",
    reward: event.reward ?? "",
    requirements: event.requirements ?? "",
    status: "PLANNED",
  };
}

const STATUS_ORDER: Record<EventStatusValue, number> = {
  IN_PROGRESS: 0,
  OPEN: 1,
  PLANNED: 2,
  DRAFT: 3,
  COMPLETED: 4,
  CANCELED: 5,
};

export default function EventsPage() {
  const { can } = useRealtime();
  const canManage = can("events.manage");
  const list = useApi<EventsPayload>("/api/events");

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ServerEvent | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ServerEvent | null>(null);
  const [busy, setBusy] = React.useState(false);

  const events = React.useMemo(() => list.data?.events ?? [], [list.data]);
  const summary = list.data?.summary;
  const selected = React.useMemo(
    () => events.find((event) => event.id === selectedId) ?? null,
    [events, selectedId],
  );

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return events
      .filter((event) => (statusFilter ? event.status === statusFilter : true))
      .filter((event) =>
        needle
          ? `${event.code} ${event.title} ${event.category} ${event.location ?? ""} ${
              event.description
            }`
              .toLowerCase()
              .includes(needle)
          : true,
      )
      .sort((a, b) => {
        const diff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (diff !== 0) return diff;
        const aTime = new Date(a.startsAt).getTime();
        const bTime = new Date(b.startsAt).getTime();
        return a.status === "COMPLETED" || a.status === "CANCELED" ? bTime - aTime : aTime - bTime;
      });
  }, [events, search, statusFilter]);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(event: ServerEvent) {
    setEditing(event);
    setSelectedId(null);
    setEditorOpen(true);
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await apiFetch(`/api/events/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Événement supprimé");
      setDeleteTarget(null);
      setSelectedId(null);
      await list.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const upcoming = (summary?.planned ?? 0) + (summary?.open ?? 0);

  return (
    <div>
      <PageHeader
        eyebrow="Communauté"
        title="Événements du serveur"
        description="Planifiez les animations, ouvrez les inscriptions, suivez le déroulement et gardez l'historique des événements communautaires."
      >
        {summary?.next ? (
          <Badge variant="info">
            Prochain : {summary.next.title} · {formatDate(summary.next.startsAt)}
          </Badge>
        ) : null}
        {canManage ? (
          <Button variant="primary" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouvel événement
          </Button>
        ) : null}
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="À venir"
          value={String(upcoming)}
          hint={
            summary?.next
              ? `${formatTime(summary.next.startsAt)} · ${summary.next.title}`
              : "Aucun événement planifié"
          }
          icon={<CalendarDays className="h-4 w-4" />}
          accent="primary"
        />
        <Stat
          label="Inscriptions ouvertes"
          value={String(summary?.open ?? 0)}
          hint="Les joueurs peuvent s'inscrire"
          icon={<DoorOpen className="h-4 w-4" />}
          accent={(summary?.open ?? 0) > 0 ? "info" : "success"}
        />
        <Stat
          label="En cours"
          value={String(summary?.inProgress ?? 0)}
          hint="Animation actuellement en jeu"
          icon={<Play className="h-4 w-4" />}
          accent={(summary?.inProgress ?? 0) > 0 ? "warning" : "success"}
        />
        <Stat
          label="Terminés / 30 jours"
          value={String(summary?.completed30d ?? 0)}
          hint={`${summary?.total ?? 0} événement(s) au total`}
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
            placeholder="Rechercher un code, un titre, un lieu..."
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="w-auto min-w-[190px]"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(EVENT_STATUS).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>
        <span className="text-xs text-muted">
          {filtered.length} / {events.length} événement(s)
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
            icon={<CalendarDays className="h-5 w-5" />}
            title={events.length === 0 ? "Aucun événement" : "Aucun résultat"}
            description={
              events.length === 0
                ? "Créez une animation pour rassembler les joueurs et structurer la vie du serveur."
                : "Modifiez les filtres pour retrouver un événement."
            }
            action={
              canManage && events.length === 0 ? (
                <Button variant="primary" size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Créer le premier événement
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((event) => (
            <EventRow key={event.id} event={event} onOpen={() => setSelectedId(event.id)} />
          ))}
        </div>
      )}

      <EventEditorDialog
        open={editorOpen}
        event={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={async () => {
          setEditorOpen(false);
          await list.refresh();
        }}
      />

      {selected ? (
        <EventDetailDialog
          key={selected.id}
          event={selected}
          canManage={canManage}
          onClose={() => setSelectedId(null)}
          onEdit={() => openEdit(selected)}
          onDelete={() => setDeleteTarget(selected)}
          onChanged={() => void list.refresh()}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        title="Supprimer cet événement ?"
        description={`« ${deleteTarget?.title ?? ""} » sera définitivement supprimé de l'historique.`}
        confirmLabel="Supprimer"
        dangerous
        loading={busy}
      />
    </div>
  );
}

function EventRow({ event, onOpen }: { event: ServerEvent; onOpen: () => void }) {
  const meta = EVENT_STATUS[event.status];
  const date = new Date(event.startsAt);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="panel panel-interactive flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
    >
      <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-white/[0.03]">
        <span className="text-sm font-semibold leading-none text-fg">
          {date.toLocaleDateString("fr-FR", { day: "2-digit" })}
        </span>
        <span className="mt-0.5 text-[9px] uppercase text-muted">
          {date.toLocaleDateString("fr-FR", { month: "short" })}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="mono text-[10px] text-muted">{event.code}</span>
          <Badge variant={meta.variant}>{meta.label}</Badge>
          <span className="rounded border border-border bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-muted">
            {event.category}
          </span>
        </span>
        <span className="mt-1 block truncate text-xs font-medium text-fg">{event.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <Clock3 className="h-3 w-3" /> {formatTime(event.startsAt)} → {formatTime(event.endsAt)}
          </span>
          {event.location ? (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {event.location}
              </span>
            </>
          ) : null}
          <span>·</span>
          <span>{event.organizer.displayName}</span>
        </span>
      </span>

      <span className="flex flex-col items-end gap-1 text-[10px] text-muted">
        {event.maxPlayers ? (
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> {event.maxPlayers} places
          </span>
        ) : null}
        {event.reward ? (
          <span className="flex items-center gap-1 text-warning">
            <Trophy className="h-3 w-3" /> {event.reward}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function EventEditorDialog({
  open,
  event,
  onClose,
  onSaved,
}: {
  open: boolean;
  event: ServerEvent | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = React.useState<EventForm>(defaultForm);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setForm(event ? formFromEvent(event) : defaultForm());
  }, [open, event]);

  function update<K extends keyof EventForm>(key: K, value: EventForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    const start = new Date(form.startsAt);
    const end = new Date(form.endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      toast.error("La fin de l'événement doit être postérieure au début.");
      return;
    }

    const maxPlayers = form.maxPlayers.trim() ? Number(form.maxPlayers) : null;
    if (maxPlayers !== null && (!Number.isInteger(maxPlayers) || maxPlayers < 1)) {
      toast.error("Le nombre de places doit être un entier supérieur à zéro.");
      return;
    }

    setBusy(true);
    try {
      const common = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim() || "Communauté",
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        maxPlayers,
      };

      if (event) {
        await apiFetch(`/api/events/${event.id}`, {
          method: "PATCH",
          body: {
            ...common,
            location: form.location.trim() || null,
            reward: form.reward.trim() || null,
            requirements: form.requirements.trim() || null,
          },
        });
        toast.success("Événement mis à jour");
      } else {
        await apiFetch("/api/events", {
          method: "POST",
          body: {
            ...common,
            location: form.location.trim() || undefined,
            reward: form.reward.trim() || undefined,
            requirements: form.requirements.trim() || undefined,
            status: form.status,
          },
        });
        toast.success("Événement créé");
      }

      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={event ? "Modifier l'événement" : "Nouvel événement"}
      description={
        event
          ? "Le statut se pilote depuis la fiche de l'événement."
          : "Préparez l'animation puis ouvrez les inscriptions quand tout est prêt."
      }
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
            {event ? "Enregistrer" : "Créer l'événement"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Titre">
          <Input
            value={form.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="Ex : Course nocturne autour de Los Santos"
            maxLength={160}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Catégorie">
            <Input
              value={form.category}
              onChange={(event) => update("category", event.target.value)}
              list="event-categories"
              maxLength={60}
            />
            <datalist id="event-categories">
              {EVENT_CATEGORIES.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </Field>
          <Field label="Lieu">
            <Input
              value={form.location}
              onChange={(event) => update("location", event.target.value)}
              placeholder="Ex : Sandy Shores, aéroport..."
              maxLength={120}
            />
          </Field>
        </div>

        <Field label="Description">
          <Textarea
            rows={4}
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Déroulé, règles, récompenses et informations utiles aux joueurs..."
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Début">
            <Input
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) => update("startsAt", event.target.value)}
            />
          </Field>
          <Field label="Fin">
            <Input
              type="datetime-local"
              value={form.endsAt}
              onChange={(event) => update("endsAt", event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Places" hint="Optionnel, laisser vide pour illimité.">
            <Input
              type="number"
              min={1}
              max={1024}
              value={form.maxPlayers}
              onChange={(event) => update("maxPlayers", event.target.value)}
              placeholder="32"
            />
          </Field>
          <Field label="Récompense" hint="Optionnel.">
            <Input
              value={form.reward}
              onChange={(event) => update("reward", event.target.value)}
              placeholder="50 000 $, véhicule..."
              maxLength={160}
            />
          </Field>
        </div>

        <Field label="Prérequis" hint="Optionnel : niveau, métier, inscription Discord...">
          <Textarea
            rows={2}
            value={form.requirements}
            onChange={(event) => update("requirements", event.target.value)}
            placeholder="Avoir un véhicule, être inscrit sur le Discord..."
          />
        </Field>

        {!event ? (
          <Field label="Statut initial">
            <Select
              value={form.status}
              onChange={(event) =>
                update("status", event.target.value as EventForm["status"])
              }
            >
              <option value="DRAFT">Brouillon (non annoncé)</option>
              <option value="PLANNED">Planifié</option>
              <option value="OPEN">Inscriptions ouvertes</option>
            </Select>
          </Field>
        ) : null}
      </div>
    </Modal>
  );
}

function EventDetailDialog({
  event,
  canManage,
  onClose,
  onEdit,
  onDelete,
  onChanged,
}: {
  event: ServerEvent;
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const meta = EVENT_STATUS[event.status];
  const [busyStatus, setBusyStatus] = React.useState<EventStatusValue | null>(null);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");

  async function changeStatus(next: EventStatusValue, reason?: string) {
    setBusyStatus(next);
    try {
      await apiFetch(`/api/events/${event.id}`, {
        method: "PATCH",
        body: {
          status: next,
          ...(reason ? { cancelReason: reason } : {}),
        },
      });
      toast.success(`Événement : ${EVENT_STATUS[next].label.toLowerCase()}`);
      setCancelOpen(false);
      setCancelReason("");
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyStatus(null);
    }
  }

  const timeline = [
    { label: "Créé", at: event.createdAt, icon: <CalendarDays className="h-3 w-3" /> },
    { label: "Démarrage", at: event.startedAt, icon: <Play className="h-3 w-3" /> },
    { label: "Fin", at: event.completedAt, icon: <CheckCircle2 className="h-3 w-3" /> },
    { label: "Annulation", at: event.canceledAt, icon: <XCircle className="h-3 w-3" /> },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={event.title}
      description={`${event.code} · organisé par ${event.organizer.displayName}`}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          {canManage ? (
            <Button
              variant="ghost"
              onClick={onDelete}
              className="text-danger hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 className="h-4 w-4" /> Supprimer
            </Button>
          ) : null}
          {canManage ? (
            <Button variant="primary" onClick={onEdit}>
              <Pencil className="h-4 w-4" /> Modifier
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={meta.variant}>{meta.label}</Badge>
          <Badge variant="neutral">{event.category}</Badge>
          <span className="ml-auto text-[10px] text-muted">
            {formatDateTime(event.startsAt)} → {formatDateTime(event.endsAt)}
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <InfoTile
            label="Lieu"
            value={event.location || "Non renseigné"}
            icon={<MapPin className="h-3 w-3" />}
          />
          <InfoTile
            label="Places"
            value={event.maxPlayers ? `${event.maxPlayers} joueurs` : "Illimitées"}
            icon={<Users className="h-3 w-3" />}
          />
          <InfoTile
            label="Récompense"
            value={event.reward || "Aucune"}
            icon={<Trophy className="h-3 w-3" />}
          />
        </div>

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Description
          </p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-fg/90">
            {event.description}
          </p>
        </section>

        {event.requirements ? (
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Prérequis
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-fg/90">
              {event.requirements}
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
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[10.5px] ${
                  step.at
                    ? "border-success/20 bg-success/[0.04] text-fg"
                    : "border-border bg-surface/40 text-muted"
                }`}
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

        {event.cancelReason ? (
          <section className="rounded-lg border border-border bg-white/[0.02] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Motif d&apos;annulation
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-fg/90">
              {event.cancelReason}
            </p>
          </section>
        ) : null}

        {canManage ? (
          <section className="space-y-3 border-t border-border pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Pilotage de l&apos;événement
            </p>

            <div className="flex flex-wrap items-center gap-2">
              {event.status === "DRAFT" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busyStatus === "PLANNED"}
                  onClick={() => void changeStatus("PLANNED")}
                >
                  Planifier
                </Button>
              ) : null}

              {event.status === "DRAFT" || event.status === "PLANNED" ? (
                <Button
                  size="sm"
                  variant="primary"
                  loading={busyStatus === "OPEN"}
                  onClick={() => void changeStatus("OPEN")}
                >
                  <DoorOpen className="h-3.5 w-3.5" /> Ouvrir les inscriptions
                </Button>
              ) : null}

              {event.status === "PLANNED" || event.status === "OPEN" ? (
                <Button
                  size="sm"
                  variant="success"
                  loading={busyStatus === "IN_PROGRESS"}
                  onClick={() => void changeStatus("IN_PROGRESS")}
                >
                  <Play className="h-3.5 w-3.5" /> Démarrer
                </Button>
              ) : null}

              {event.status === "IN_PROGRESS" ? (
                <Button
                  size="sm"
                  variant="success"
                  loading={busyStatus === "COMPLETED"}
                  onClick={() => void changeStatus("COMPLETED")}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Marquer terminé
                </Button>
              ) : null}

              {event.status === "COMPLETED" || event.status === "CANCELED" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busyStatus === "PLANNED"}
                  onClick={() => void changeStatus("PLANNED")}
                >
                  Réouvrir la planification
                </Button>
              ) : null}

              {event.status !== "CANCELED" && event.status !== "COMPLETED" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger hover:bg-danger/10 hover:text-danger"
                  onClick={() => setCancelOpen((current) => !current)}
                >
                  <XCircle className="h-3.5 w-3.5" /> Annuler
                </Button>
              ) : null}
            </div>

            {cancelOpen ? (
              <div className="space-y-2 rounded-lg border border-danger/25 bg-danger/[0.04] p-3">
                <Field label="Motif d'annulation" hint="Obligatoire pour annuler l'événement.">
                  <Textarea
                    rows={2}
                    value={cancelReason}
                    onChange={(input) => setCancelReason(input.target.value)}
                    placeholder="Raison de l'annulation, report éventuel..."
                  />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setCancelOpen(false)}>
                    Retour
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={busyStatus === "CANCELED"}
                    disabled={cancelReason.trim().length < 5}
                    onClick={() => void changeStatus("CANCELED", cancelReason.trim())}
                  >
                    Confirmer l&apos;annulation
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </Modal>
  );
}

function InfoTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-white/[0.02] px-3 py-2">
      <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-muted">
        {icon} {label}
      </p>
      <p className="mt-0.5 text-xs font-medium text-fg">{value}</p>
    </div>
  );
}
