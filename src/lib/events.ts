/** Types et calculs partages du module Evenements du serveur. */
import type { BadgeVariant } from "@/lib/labels";

export type EventStatusValue =
  | "DRAFT"
  | "PLANNED"
  | "OPEN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELED";

export const EVENT_STATUS: Record<
  EventStatusValue,
  { label: string; variant: BadgeVariant; description: string }
> = {
  DRAFT: {
    label: "Brouillon",
    variant: "neutral",
    description: "Événement en préparation, non annoncé",
  },
  PLANNED: {
    label: "Planifié",
    variant: "info",
    description: "Date fixée, inscriptions à venir",
  },
  OPEN: {
    label: "Inscriptions ouvertes",
    variant: "primary",
    description: "Les joueurs peuvent s'inscrire",
  },
  IN_PROGRESS: {
    label: "En cours",
    variant: "warning",
    description: "Événement actuellement en jeu",
  },
  COMPLETED: {
    label: "Terminé",
    variant: "success",
    description: "Événement clôturé",
  },
  CANCELED: {
    label: "Annulé",
    variant: "danger",
    description: "Événement annulé",
  },
};

export const EVENT_CATEGORIES = [
  "Communauté",
  "Course",
  "Combat",
  "Animation",
  "Enquête",
  "Métier",
  "Tournoi",
  "Autre",
] as const;

export interface EventPerson {
  id: string;
  displayName: string;
  avatarColor: string;
}

export interface ServerEvent {
  id: string;
  number: number;
  code: string;
  title: string;
  description: string;
  category: string;
  status: EventStatusValue;
  location: string | null;
  startsAt: string;
  endsAt: string;
  maxPlayers: number | null;
  reward: string | null;
  requirements: string | null;
  startedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  organizer: EventPerson;
}

export interface ServerEventInput {
  id: string;
  number: number;
  title: string;
  description: string;
  category: string;
  status: EventStatusValue;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  maxPlayers: number | null;
  reward: string | null;
  requirements: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  canceledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  organizer: EventPerson;
}

export interface EventSummaryNext {
  id: string;
  title: string;
  category: string;
  location: string | null;
  startsAt: string;
}

export interface EventSummary {
  total: number;
  planned: number;
  open: number;
  inProgress: number;
  completed30d: number;
  next: EventSummaryNext | null;
}

export function eventCode(number: number): string {
  return `EVT-${String(number).padStart(4, "0")}`;
}

export function serializeServerEvent(event: ServerEventInput): ServerEvent {
  return {
    id: event.id,
    number: event.number,
    code: eventCode(event.number),
    title: event.title,
    description: event.description,
    category: event.category,
    status: event.status,
    location: event.location,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    maxPlayers: event.maxPlayers,
    reward: event.reward,
    requirements: event.requirements,
    startedAt: event.startedAt?.toISOString() ?? null,
    completedAt: event.completedAt?.toISOString() ?? null,
    canceledAt: event.canceledAt?.toISOString() ?? null,
    cancelReason: event.cancelReason,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    organizer: event.organizer,
  };
}

type EventSummarySource = Pick<
  ServerEvent,
  | "id"
  | "title"
  | "category"
  | "location"
  | "status"
  | "startsAt"
  | "endsAt"
  | "completedAt"
>;

export function buildEventSummary(
  events: EventSummarySource[],
  now = new Date(),
): EventSummary {
  const thirtyDaysAgo = now.getTime() - 30 * 86_400_000;
  const next =
    events
      .filter(
        (event) =>
          (event.status === "PLANNED" || event.status === "OPEN") &&
          new Date(event.startsAt).getTime() >= now.getTime(),
      )
      .sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      )[0] ?? null;

  return {
    total: events.length,
    planned: events.filter((event) => event.status === "DRAFT" || event.status === "PLANNED")
      .length,
    open: events.filter((event) => event.status === "OPEN").length,
    inProgress: events.filter((event) => event.status === "IN_PROGRESS").length,
    completed30d: events.filter(
      (event) =>
        event.status === "COMPLETED" &&
        event.completedAt !== null &&
        new Date(event.completedAt).getTime() >= thirtyDaysAgo,
    ).length,
    next: next
      ? {
          id: next.id,
          title: next.title,
          category: next.category,
          location: next.location,
          startsAt: new Date(next.startsAt).toISOString(),
        }
      : null,
  };
}
