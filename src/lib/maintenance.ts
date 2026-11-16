/** Types et calculs partages du module Maintenance planifiee. */
import type { BadgeVariant } from "@/lib/labels";

export type MaintenanceStatusValue = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELED";

export const MAINTENANCE_STATUS: Record<
  MaintenanceStatusValue,
  { label: string; variant: BadgeVariant }
> = {
  PLANNED: { label: "Planifiée", variant: "info" },
  IN_PROGRESS: { label: "En cours", variant: "warning" },
  COMPLETED: { label: "Terminée", variant: "success" },
  CANCELED: { label: "Annulée", variant: "neutral" },
};

export interface MaintenancePerson {
  id: string;
  displayName: string;
  avatarColor: string;
}

export interface MaintenanceWindow {
  id: string;
  number: number;
  code: string;
  title: string;
  description: string;
  scope: string | null;
  impact: string | null;
  status: MaintenanceStatusValue;
  scheduledStart: string;
  scheduledEnd: string;
  startedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: MaintenancePerson;
}

export interface MaintenanceSummary {
  planned: number;
  inProgress: number;
  completed30d: number;
  next: MaintenanceWindow | null;
}

export interface MaintenanceWindowInput {
  id: string;
  number: number;
  title: string;
  description: string;
  scope: string | null;
  impact: string | null;
  status: MaintenanceStatusValue;
  scheduledStart: Date;
  scheduledEnd: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  canceledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: MaintenancePerson;
}

export function maintenanceCode(number: number): string {
  return `MNT-${String(number).padStart(4, "0")}`;
}

export function serializeMaintenanceWindow(window: MaintenanceWindowInput): MaintenanceWindow {
  return {
    id: window.id,
    number: window.number,
    code: maintenanceCode(window.number),
    title: window.title,
    description: window.description,
    scope: window.scope,
    impact: window.impact,
    status: window.status,
    scheduledStart: window.scheduledStart.toISOString(),
    scheduledEnd: window.scheduledEnd.toISOString(),
    startedAt: window.startedAt?.toISOString() ?? null,
    completedAt: window.completedAt?.toISOString() ?? null,
    canceledAt: window.canceledAt?.toISOString() ?? null,
    cancelReason: window.cancelReason,
    createdAt: window.createdAt.toISOString(),
    updatedAt: window.updatedAt.toISOString(),
    createdBy: window.createdBy,
  };
}

export function buildMaintenanceSummary(
  windows: MaintenanceWindow[],
  now = new Date(),
): MaintenanceSummary {
  const active = windows.filter(
    (window) => window.status === "PLANNED" || window.status === "IN_PROGRESS",
  );
  const thirtyDaysAgo = now.getTime() - 30 * 86_400_000;

  const next =
    active
      .filter((window) => new Date(window.scheduledEnd).getTime() >= now.getTime())
      .sort(
        (a, b) =>
          new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime(),
      )[0] ?? null;

  return {
    planned: windows.filter((window) => window.status === "PLANNED").length,
    inProgress: windows.filter((window) => window.status === "IN_PROGRESS").length,
    completed30d: windows.filter(
      (window) =>
        window.status === "COMPLETED" &&
        window.completedAt !== null &&
        new Date(window.completedAt).getTime() >= thirtyDaysAgo,
    ).length,
    next,
  };
}
