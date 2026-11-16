/** Types et calculs partages du module Sprints. */

export type SprintStatusValue = "PLANNED" | "ACTIVE" | "COMPLETED" | "ARCHIVED";

export interface SprintTask {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  resource: string | null;
  assignee: { id: string; displayName: string; avatarColor: string } | null;
}

export interface SprintView {
  id: string;
  name: string;
  goal: string | null;
  status: SprintStatusValue;
  startsAt: string;
  endsAt: string;
  completedAt: string | null;
  createdBy: { id: string; displayName: string };
  tasks: SprintTask[];
  progress: { total: number; done: number; percent: number };
}

export interface SprintsPayload {
  sprints: SprintView[];
}

export interface SprintInput {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  startsAt: Date;
  endsAt: Date;
  completedAt: Date | null;
  createdBy: { id: string; displayName: string };
  tasks: Array<{
    id: string;
    code: string;
    title: string;
    status: string;
    priority: string;
    resource: string | null;
    assignee: { id: string; displayName: string; avatarColor: string } | null;
  }>;
}

export function sprintProgress(tasks: Array<{ status: string }>): {
  total: number;
  done: number;
  percent: number;
} {
  const done = tasks.filter((task) => task.status === "DONE").length;
  return {
    total: tasks.length,
    done,
    percent: tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0,
  };
}

export function serializeSprint(sprint: SprintInput): SprintView {
  return {
    id: sprint.id,
    name: sprint.name,
    goal: sprint.goal,
    status: sprint.status as SprintStatusValue,
    startsAt: sprint.startsAt.toISOString(),
    endsAt: sprint.endsAt.toISOString(),
    completedAt: sprint.completedAt?.toISOString() ?? null,
    createdBy: sprint.createdBy,
    tasks: sprint.tasks,
    progress: sprintProgress(sprint.tasks),
  };
}

/** Nombre de jours calendaires UTC restants, negatif si la date est depassee. */
export function daysUntil(value: string | Date, now = new Date()): number {
  const target = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(target.getTime())) return 0;
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.round((end - start) / 86_400_000);
}
