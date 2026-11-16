/** Types et calculs partages du module Incidents. */

export type IncidentSeverityValue = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type IncidentStatusValue = "OPEN" | "INVESTIGATING" | "MITIGATED" | "RESOLVED";

export interface IncidentPerson {
  id: string;
  displayName: string;
  avatarColor: string;
}

export interface IncidentView {
  id: string;
  number: number;
  code: string;
  title: string;
  description: string;
  severity: IncidentSeverityValue;
  status: IncidentStatusValue;
  resource: string | null;
  impact: string | null;
  resolution: string | null;
  startedAt: string;
  acknowledgedAt: string | null;
  mitigatedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  reporter: IncidentPerson;
  assignee: IncidentPerson | null;
}

export interface IncidentSummary {
  active: number;
  critical: number;
  investigating: number;
  mitigated: number;
  resolved30d: number;
  avgResolutionSeconds: number;
}

export interface IncidentsPayload {
  incidents: IncidentView[];
  summary: IncidentSummary;
}

export interface IncidentInput {
  id: string;
  number: number;
  title: string;
  description: string;
  severity: string;
  status: string;
  resource: string | null;
  impact: string | null;
  resolution: string | null;
  startedAt: Date;
  acknowledgedAt: Date | null;
  mitigatedAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  reportedBy: IncidentPerson;
  assignee: IncidentPerson | null;
}

export function incidentCode(number: number): string {
  return `INC-${String(number).padStart(4, "0")}`;
}

export function serializeIncident(incident: IncidentInput): IncidentView {
  return {
    id: incident.id,
    number: incident.number,
    code: incidentCode(incident.number),
    title: incident.title,
    description: incident.description,
    severity: incident.severity as IncidentSeverityValue,
    status: incident.status as IncidentStatusValue,
    resource: incident.resource,
    impact: incident.impact,
    resolution: incident.resolution,
    startedAt: incident.startedAt.toISOString(),
    acknowledgedAt: incident.acknowledgedAt?.toISOString() ?? null,
    mitigatedAt: incident.mitigatedAt?.toISOString() ?? null,
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
    createdAt: incident.createdAt.toISOString(),
    reporter: incident.reportedBy,
    assignee: incident.assignee,
  };
}

export function buildIncidentSummary(incidents: IncidentView[], now = new Date()): IncidentSummary {
  const active = incidents.filter((incident) => incident.status !== "RESOLVED");
  const thirtyDaysAgo = now.getTime() - 30 * 86_400_000;
  const resolved30d = incidents.filter(
    (incident) =>
      incident.status === "RESOLVED" &&
      incident.resolvedAt !== null &&
      new Date(incident.resolvedAt).getTime() >= thirtyDaysAgo,
  );
  const totalResolution = resolved30d.reduce((sum, incident) => {
    if (!incident.resolvedAt) return sum;
    return (
      sum +
      Math.max(0, new Date(incident.resolvedAt).getTime() - new Date(incident.startedAt).getTime())
    );
  }, 0);

  return {
    active: active.length,
    critical: active.filter((incident) => incident.severity === "CRITICAL").length,
    investigating: active.filter((incident) => incident.status === "INVESTIGATING").length,
    mitigated: active.filter((incident) => incident.status === "MITIGATED").length,
    resolved30d: resolved30d.length,
    avgResolutionSeconds:
      resolved30d.length > 0 ? Math.round(totalResolution / resolved30d.length / 1000) : 0,
  };
}
