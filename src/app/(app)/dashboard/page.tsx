import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bug,
  CheckCircle2,
  Clock3,
  Code2,
  FileCode2,
  HeartPulse,
  ListChecks,
  Server,
  ShieldAlert,
  Siren,
  Target,
  Terminal,
  Timer,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { computeActiveSeconds } from "@/server/session-time";
import { formatDate, formatDuration, relativeTime, truncate } from "@/lib/format";
import { Avatar, Badge, Card, CardBody, CardHeader, Progress } from "@/components/ui/primitives";
import { LiveActivity } from "@/components/dashboard/live-activity";
import { DashboardCustomizeMenu } from "@/components/dashboard/dashboard-customize";
import { ServerStatusCard } from "@/components/dashboard/server-status-card";
import { StartSessionButton } from "@/components/dashboard/start-session-dialog";
import { SessionIndicator } from "@/components/session-indicator";
import { DashboardKpi } from "@/components/dashboard/dashboard-kpi";
import { DashboardPulseLazy } from "@/components/dashboard/dashboard-pulse-lazy";
import type { PulsePoint } from "@/components/dashboard/dashboard-pulse";
import type { ActivityEvent } from "@/components/realtime-provider";
import { PRIORITY, SEVERITY, SPRINT_STATUS, TASK_STATUS } from "@/lib/labels";
import { AUDIT_ACTION_LABELS } from "@/server/audit";
import { getPterodactylConfig } from "@/server/integrations";
import { consoleRelay } from "@/server/pterodactyl/console-relay";
import { incidentCode } from "@/lib/incidents";
import { daysUntil, sprintProgress } from "@/lib/sprints";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

interface ActiveTeamMember {
  id: string;
  sessionId: string;
  number: number;
  name: string;
  color: string;
  status: string;
  activeSeconds: number;
  startedAt: string;
}

interface PriorityItem {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  resource: string | null;
  assignee: { id: string; displayName: string; avatarColor: string } | null;
}

interface IncidentItem {
  id: string;
  code: string;
  title: string;
  severity: string;
  status: string;
  startedAt: string;
  resource: string | null;
  reporterName: string;
}

interface SprintSnapshot {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  endsAt: string;
  daysLeft: number;
  progress: { total: number; done: number; percent: number };
  tasks: Array<{
    id: string;
    code: string;
    title: string;
    status: string;
    priority: string;
  }>;
}

interface WorkloadItem {
  id: string;
  name: string;
  color: string;
  openTasks: number;
  lastSeenAt: Date | null;
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function activityType(action: string): string {
  if (action === "session.start") return "session.started";
  if (action === "session.end") return "session.ended";
  if (action === "session.pause") return "session.paused";
  if (action === "session.resume") return "session.resumed";
  if (action.startsWith("file.")) return "file.changed";
  if (action === "bug.create") return "bug.reported";
  if (action === "incident.resolve") return "incident.resolved";
  if (action.startsWith("incident.")) return "incident.reported";
  if (action === "deployment.execute") return "deployment.done";
  return "task.completed";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const canViewBugs = hasPermission(user, "bugs.view");
  const canViewIncidents = hasPermission(user, "incidents.view");
  const canViewSprints = hasPermission(user, "sprints.view");
  const canViewTasks = hasPermission(user, "tasks.view");
  const now = new Date();
  const today = startOfUtcDay(now);
  const seriesStart = new Date(today.getTime() - 13 * DAY_MS);
  const weekStart = new Date(today.getTime() - 6 * DAY_MS);
  const prevWeekStart = new Date(today.getTime() - 13 * DAY_MS);

  const [
    activeSessions,
    users,
    openBugsBySeverity,
    openIncidents,
    openIncidentCount,
    criticalIncidentCount,
    currentSprint,
    priorityTasks,
    activeSession,
    pterodactyl,
    auditLogs,
    sessionHistory,
    changeHistory,
    taskHistory,
    bugHistory,
    taskCounts,
    pendingDeployments,
    failedDeployments,
    overdueTasks,
    workload,
    metrics,
    myTasks,
  ] = await Promise.all([
    prisma.devSession.findMany({
      where: { status: { in: ["ACTIVE", "PAUSED"] } },
      include: { user: { select: { id: true, displayName: true, avatarColor: true } } },
      orderBy: { startedAt: "desc" },
      take: 12,
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, displayName: true, avatarColor: true, role: true, lastSeenAt: true },
      orderBy: { displayName: "asc" },
    }),
    canViewBugs
      ? prisma.bug.groupBy({
          by: ["severity"],
          where: { status: { notIn: ["FIXED", "CLOSED"] } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    canViewIncidents
      ? prisma.incident.findMany({
          where: { status: { not: "RESOLVED" } },
          orderBy: [{ severity: "asc" }, { startedAt: "desc" }],
          take: 4,
          include: {
            reportedBy: { select: { id: true, displayName: true, avatarColor: true } },
            assignee: { select: { id: true, displayName: true, avatarColor: true } },
          },
        })
      : Promise.resolve([]),
    canViewIncidents
      ? prisma.incident.count({ where: { status: { not: "RESOLVED" } } })
      : Promise.resolve(0),
    canViewIncidents
      ? prisma.incident.count({ where: { status: { not: "RESOLVED" }, severity: "CRITICAL" } })
      : Promise.resolve(0),
    canViewSprints
      ? prisma.sprint.findFirst({
          where: { status: "ACTIVE" },
          orderBy: { startsAt: "desc" },
          include: {
            tasks: {
              orderBy: [{ status: "asc" }, { priority: "desc" }],
              select: { id: true, code: true, title: true, status: true, priority: true },
            },
          },
        })
      : Promise.resolve(null),
    canViewTasks
      ? prisma.task.findMany({
          where: {
            status: { notIn: ["DONE"] },
            OR: [{ priority: { in: ["URGENT", "HIGH"] } }, { status: "BLOCKED" }],
          },
          orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
          take: 6,
          include: { assignee: { select: { id: true, displayName: true, avatarColor: true } } },
        })
      : Promise.resolve([]),
    prisma.devSession.findFirst({
      where: { userId: user.id, status: { in: ["ACTIVE", "PAUSED"] } },
      orderBy: { startedAt: "desc" },
    }),
    getPterodactylConfig().catch(() => null),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 14 }),
    prisma.devSession.findMany({
      where: { startedAt: { gte: seriesStart } },
      select: {
        startedAt: true,
        accumulatedActiveSeconds: true,
        lastResumedAt: true,
        status: true,
      },
    }),
    prisma.fileChange.findMany({
      where: { createdAt: { gte: seriesStart } },
      select: { createdAt: true },
    }),
    prisma.task.findMany({
      where: { completedAt: { gte: seriesStart } },
      select: { completedAt: true },
    }),
    prisma.bug.findMany({
      where: { fixedAt: { gte: seriesStart } },
      select: { fixedAt: true },
    }),
    prisma.task.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.deployment.count({ where: { status: { in: ["PENDING", "APPROVED"] } } }),
    prisma.deployment.count({
      where: { status: "FAILED", createdAt: { gte: weekStart } },
    }),
    prisma.task.count({ where: { dueDate: { lt: now }, status: { notIn: ["DONE"] } } }),
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: { assigneeId: { not: null }, status: { notIn: ["DONE"] } },
      _count: { _all: true },
    }),
    prisma.metricSample.findMany({
      orderBy: { recordedAt: "desc" },
      take: 24,
      select: {
        cpuPercent: true,
        memoryBytes: true,
        memoryLimitBytes: true,
        state: true,
        recordedAt: true,
      },
    }),
    canViewTasks
      ? prisma.task.findMany({
          where: { assigneeId: user.id, status: { notIn: ["DONE"] } },
          orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
          take: 6,
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            priority: true,
            resource: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const wings = consoleRelay.getStatus();
  const openBugCount = openBugsBySeverity.reduce((sum, entry) => sum + entry._count._all, 0);
  const criticalBugs =
    openBugsBySeverity.find((entry) => entry.severity === "CRITICAL")?._count._all ?? 0;
  const taskCountMap = new Map(taskCounts.map((entry) => [entry.status, entry._count._all]));
  const inProgress = (taskCountMap.get("IN_PROGRESS") ?? 0) + (taskCountMap.get("TESTING") ?? 0);

  const activeTeam: ActiveTeamMember[] = activeSessions.map((session) => ({
    id: session.user.id,
    sessionId: session.id,
    number: session.number,
    name: session.user.displayName,
    color: session.user.avatarColor,
    status: session.status,
    activeSeconds: computeActiveSeconds(session),
    startedAt: session.startedAt.toISOString(),
  }));

  const workloadById = new Map(
    workload
      .filter((entry): entry is typeof entry & { assigneeId: string } => Boolean(entry.assigneeId))
      .map((entry) => [entry.assigneeId, entry._count._all]),
  );
  const teamLoad: WorkloadItem[] = users
    .map((member) => ({
      id: member.id,
      name: member.displayName,
      color: member.avatarColor,
      openTasks: workloadById.get(member.id) ?? 0,
      lastSeenAt: member.lastSeenAt,
    }))
    .filter((member) => member.openTasks > 0)
    .sort((a, b) => b.openTasks - a.openTasks);

  const priorities: PriorityItem[] = priorityTasks.map((task) => ({
    id: task.id,
    code: task.code,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString() ?? null,
    resource: task.resource,
    assignee: task.assignee,
  }));

  const incidents: IncidentItem[] = openIncidents.map((incident) => ({
    id: incident.id,
    code: incidentCode(incident.number),
    title: incident.title,
    severity: incident.severity,
    status: incident.status,
    startedAt: incident.startedAt.toISOString(),
    resource: incident.resource,
    reporterName: incident.reportedBy.displayName,
  }));

  const sprint: SprintSnapshot | null = currentSprint
    ? {
        id: currentSprint.id,
        name: currentSprint.name,
        goal: currentSprint.goal,
        status: currentSprint.status,
        endsAt: currentSprint.endsAt.toISOString(),
        daysLeft: daysUntil(currentSprint.endsAt),
        progress: sprintProgress(currentSprint.tasks),
        tasks: currentSprint.tasks,
      }
    : null;

  const series: PulsePoint[] = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(seriesStart.getTime() + index * DAY_MS);
    return { date: dayKey(date), activeSeconds: 0, changes: 0, tasks: 0, fixes: 0 };
  });
  const seriesByDate = new Map(series.map((point) => [point.date, point]));

  for (const session of sessionHistory) {
    const point = seriesByDate.get(dayKey(session.startedAt));
    if (!point) continue;
    point.activeSeconds +=
      session.accumulatedActiveSeconds +
      (session.status === "ACTIVE" && session.lastResumedAt
        ? Math.max(0, Math.floor((now.getTime() - session.lastResumedAt.getTime()) / 1000))
        : 0);
  }
  for (const change of changeHistory) {
    const point = seriesByDate.get(dayKey(change.createdAt));
    if (point) point.changes += 1;
  }
  for (const task of taskHistory) {
    if (!task.completedAt) continue;
    const point = seriesByDate.get(dayKey(task.completedAt));
    if (point) point.tasks += 1;
  }
  for (const bug of bugHistory) {
    if (!bug.fixedAt) continue;
    const point = seriesByDate.get(dayKey(bug.fixedAt));
    if (point) point.fixes += 1;
  }

  const currentWeek = series.filter((point) => point.date >= dayKey(weekStart));
  const previousWeek = series.filter(
    (point) => point.date >= dayKey(prevWeekStart) && point.date < dayKey(weekStart),
  );
  const currentWeekSeconds = currentWeek.reduce((sum, point) => sum + point.activeSeconds, 0);
  const previousWeekSeconds = previousWeek.reduce((sum, point) => sum + point.activeSeconds, 0);
  const currentWeekChanges = currentWeek.reduce((sum, point) => sum + point.changes, 0);
  const previousWeekChanges = previousWeek.reduce((sum, point) => sum + point.changes, 0);
  const currentWeekTasks = currentWeek.reduce((sum, point) => sum + point.tasks, 0);
  const previousWeekTasks = previousWeek.reduce((sum, point) => sum + point.tasks, 0);

  let healthScore = 100;
  if (!pterodactyl) healthScore -= 16;
  if (!wings.connected) healthScore -= 9;
  if (criticalIncidentCount > 0) healthScore -= 20;
  else if (openIncidentCount > 0) healthScore -= 8;
  if (criticalBugs > 0) healthScore -= 12;
  else if (openBugCount > 4) healthScore -= 5;
  if (overdueTasks > 0) healthScore -= 8;
  if (failedDeployments > 0) healthScore -= 10;
  healthScore = Math.max(0, Math.min(100, healthScore));

  const recentEvents: ActivityEvent[] = auditLogs.map((log) => ({
    type: activityType(log.action),
    title: log.actorLabel
      ? `${log.actorLabel} · ${AUDIT_ACTION_LABELS[log.action] ?? log.action}`
      : AUDIT_ACTION_LABELS[log.action] ?? log.action,
    detail: log.targetId ?? undefined,
    actor: log.actorId ? { id: log.actorId, name: log.actorLabel } : null,
    timestamp: log.createdAt.toISOString(),
    link: "/audit-logs",
  }));

  const metricCpu = metrics
    .slice()
    .reverse()
    .map((sample) => Number(sample.cpuPercent.toFixed(1)));
  const metricMemory = metrics
    .slice()
    .reverse()
    .map((sample) =>
      sample.memoryLimitBytes > 0
        ? Number(((Number(sample.memoryBytes) / Number(sample.memoryLimitBytes)) * 100).toFixed(1))
        : 0,
    );

  const quickActions = [
    { href: "/tasks", label: "Kanban", icon: ListChecks, permission: "tasks.view" as const },
    { href: "/bugs", label: "Bugs", icon: Bug, permission: "bugs.view" as const },
    { href: "/incidents", label: "Incident", icon: Siren, permission: "incidents.view" as const },
    { href: "/sprints", label: "Sprint", icon: Target, permission: "sprints.view" as const },
    { href: "/editor", label: "Editeur", icon: Code2, permission: "editor.use" as const },
    { href: "/console", label: "Console", icon: Terminal, permission: "server.console" as const },
  ].filter((action) => !action.permission || hasPermission(user, action.permission));

  const idleMinutes = activeSession?.idleTimeoutMinutes ?? 15;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-primary-500/20 bg-[linear-gradient(115deg,rgba(88,101,242,0.13),rgba(20,26,36,0.86)_48%,rgba(56,189,248,0.06))] p-5 shadow-[0_24px_70px_-40px_rgba(88,101,242,0.8)] sm:p-6">
        <div className="subtle-grid pointer-events-none absolute inset-0 opacity-[0.12]" />
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-primary-500/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-300">
              <span className="h-1 w-1 rounded-full bg-primary-400" />
              Poste de commande ·{" "}
              {now.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <h1 className="text-[26px] font-semibold leading-tight tracking-tight">
              Bonjour {user.displayName.split(" ")[0]}
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
              {activeSession
                ? "Votre session est active. Le cockpit rassemble les signaux utiles pour décider vite."
                : "Voici l'état réel du développement, de la production et de l'équipe."}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant={pterodactyl ? (wings.connected ? "success" : "warning") : "danger"}>
                <Server className="h-3 w-3" />
                {pterodactyl
                  ? wings.connected
                    ? "Panel et console connectes"
                    : "Panel configure · console hors ligne"
                  : "Panel non configure"}
              </Badge>
              {sprint ? (
                <Badge variant="primary">
                  <Target className="h-3 w-3" /> {sprint.name} · {sprint.progress.percent} %
                </Badge>
              ) : null}
              {canViewIncidents ? (
                <Badge variant={openIncidentCount > 0 ? "danger" : "success"}>
                  <Siren className="h-3 w-3" /> {openIncidentCount} incident(s) actif(s)
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[10px] uppercase tracking-wide text-muted">Sante operationnelle</p>
              <p className="mt-0.5 text-xs font-medium">
                {healthScore >= 85 ? "Stable" : healthScore >= 65 ? "Sous surveillance" : "Action requise"}
              </p>
              <Link href="/diagnostics" className="mt-1 inline-flex items-center gap-1 text-[10px] text-primary-300 hover:underline">
                Ouvrir le diagnostic <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <HealthRing score={healthScore} />
            <div className="flex flex-col items-end gap-2">
              <DashboardCustomizeMenu />
              {activeSession ? (
                <SessionIndicator />
              ) : hasPermission(user, "sessions.start") ? (
                <StartSessionButton
                  tasks={myTasks.map((task) => ({
                    id: task.id,
                    code: task.code,
                    title: task.title,
                    status: task.status,
                    priority: task.priority,
                    resource: task.resource,
                  }))}
                  idleMinutes={idleMinutes}
                  label="Demarrer une session"
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/10 px-3 py-2 text-[11px] text-muted transition-all hover:border-primary-400/30 hover:bg-primary-500/[0.08] hover:text-fg"
              >
                <Icon className="h-3.5 w-3.5 text-primary-300" />
                <span className="flex-1">{action.label}</span>
                <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-dashboard-widget="stats">
        <DashboardKpi
          label="Temps actif"
          value={formatDuration(currentWeekSeconds)}
          hint="7 derniers jours"
          icon={<Timer className="h-4 w-4" />}
          accent="primary"
          spark={series.map((point) => point.activeSeconds)}
          trend={percentChange(currentWeekSeconds, previousWeekSeconds)}
        />
        <DashboardKpi
          label="Taches livrees"
          value={currentWeekTasks}
          hint={`${taskCountMap.get("DONE") ?? 0} terminees au total`}
          icon={<ListChecks className="h-4 w-4" />}
          accent="success"
          spark={series.map((point) => point.tasks)}
          trend={percentChange(currentWeekTasks, previousWeekTasks)}
        />
        <DashboardKpi
          label="Modifications"
          value={currentWeekChanges}
          hint="7 derniers jours"
          icon={<FileCode2 className="h-4 w-4" />}
          accent="info"
          spark={series.map((point) => point.changes)}
          trend={percentChange(currentWeekChanges, previousWeekChanges)}
        />
        <DashboardKpi
          label="Sante operationnelle"
          value={`${healthScore}/100`}
          hint={`${openIncidentCount} incident(s) · ${criticalBugs} bug(s) critique(s)`}
          icon={<HeartPulse className="h-4 w-4" />}
          accent={healthScore >= 85 ? "success" : healthScore >= 65 ? "warning" : "danger"}
          meter={healthScore}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <div data-dashboard-widget="pulse">
            <DashboardPulseLazy data={series} />
          </div>

          <div data-dashboard-widget="server">
            <ServerStatusCard
              canPower={hasPermission(user, "server.power")}
              canOpenConsole={hasPermission(user, "server.console")}
              trend={{ cpu: metricCpu, memory: metricMemory }}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {canViewTasks ? (
              <div data-dashboard-widget="priorities">
                <PrioritiesPanel tasks={priorities} inProgress={inProgress} canView />
              </div>
            ) : null}
            {canViewSprints ? (
              <div data-dashboard-widget="sprint">
                <SprintFocus
                  sprint={sprint}
                  canManage={hasPermission(user, "sprints.manage")}
                  canView
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div data-dashboard-widget="ops">
            <OperationsPanel
              configured={Boolean(pterodactyl)}
              wingsConnected={wings.connected}
              wingsState={wings.state}
              canViewIncidents={canViewIncidents}
              canViewBugs={canViewBugs}
              openIncidents={openIncidentCount}
              criticalIncidents={criticalIncidentCount}
              criticalBugs={criticalBugs}
              openBugs={openBugCount}
              overdueTasks={overdueTasks}
              failedDeployments={failedDeployments}
              pendingDeployments={pendingDeployments}
            />
          </div>
          {canViewIncidents ? (
            <div data-dashboard-widget="incidents">
              <IncidentsPanel incidents={incidents} total={openIncidentCount} />
            </div>
          ) : null}
          <div data-dashboard-widget="team">
            <TeamPanel active={activeTeam} load={teamLoad} usersCount={users.length} />
          </div>
          <div data-dashboard-widget="activity">
            <LiveActivity initial={recentEvents} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/60 px-5 py-3.5">
        <p className="text-[11px] text-muted">
          Session → édition → modifications → validation → rapport → patch notes. Chaque signal du cockpit est calculé à partir des données réelles.
        </p>
        <Link href="/analytics" className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-300 hover:underline">
          Analyser en profondeur <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function HealthRing({ score }: { score: number }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 85 ? "#22C55E" : score >= 65 ? "#F59E0B" : "#EF4444";

  return (
    <div className="relative flex h-[82px] w-[82px] shrink-0 items-center justify-center">
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="38" cy="38" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
        <circle
          cx="38"
          cy="38"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-[18px] font-semibold leading-none">{score}</p>
        <p className="mt-0.5 text-[8px] uppercase tracking-wide text-muted">sante</p>
      </div>
    </div>
  );
}

function OperationsPanel({
  configured,
  wingsConnected,
  wingsState,
  canViewIncidents,
  canViewBugs,
  openIncidents,
  criticalIncidents,
  criticalBugs,
  openBugs,
  overdueTasks,
  failedDeployments,
  pendingDeployments,
}: {
  configured: boolean;
  wingsConnected: boolean;
  wingsState: string;
  canViewIncidents: boolean;
  canViewBugs: boolean;
  openIncidents: number;
  criticalIncidents: number;
  criticalBugs: number;
  openBugs: number;
  overdueTasks: number;
  failedDeployments: number;
  pendingDeployments: number;
}) {
  const rows = [
    {
      label: "Panel Pterodactyl",
      value: configured ? "Configure" : "Absent",
      variant: configured ? ("success" as const) : ("danger" as const),
      href: "/infrastructure",
    },
    {
      label: "Console Wings",
      value: wingsConnected ? "Connectee" : wingsState,
      variant: wingsConnected ? ("success" as const) : ("warning" as const),
      href: "/console",
    },
    ...(canViewIncidents
      ? [
          {
            label: "Incidents actifs",
            value: `${openIncidents}${criticalIncidents > 0 ? ` · ${criticalIncidents} critique(s)` : ""}`,
            variant: openIncidents > 0 ? ("danger" as const) : ("success" as const),
            href: "/incidents",
          },
        ]
      : []),
    ...(canViewBugs
      ? [
          {
            label: "Bugs ouverts",
            value: `${openBugs}${criticalBugs > 0 ? ` · ${criticalBugs} critique(s)` : ""}`,
            variant:
              criticalBugs > 0
                ? ("danger" as const)
                : openBugs > 0
                  ? ("warning" as const)
                  : ("success" as const),
            href: "/bugs",
          },
        ]
      : []),
    {
      label: "Taches en retard",
      value: String(overdueTasks),
      variant: overdueTasks > 0 ? ("warning" as const) : ("success" as const),
      href: "/tasks",
    },
    {
      label: "Deploiements en echec",
      value: `${failedDeployments} · ${pendingDeployments} en attente`,
      variant: failedDeployments > 0 ? ("danger" as const) : pendingDeployments > 0 ? ("warning" as const) : ("success" as const),
      href: "/deployments",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert className="h-4 w-4 text-primary-300" /> Sante & alertes
          </h3>
          <p className="mt-0.5 text-[10.5px] text-muted">Les signaux qui demandent une decision.</p>
        </div>
      </CardHeader>
      <CardBody className="space-y-1 p-3">
        {rows.map((row) => (
          <Link
            key={row.label}
            href={row.href}
            className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.04]"
          >
            <span className="text-[11px] text-muted">{row.label}</span>
            <Badge variant={row.variant}>{row.value}</Badge>
          </Link>
        ))}
      </CardBody>
    </Card>
  );
}

function IncidentsPanel({ incidents, total }: { incidents: IncidentItem[]; total: number }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Siren className="h-4 w-4 text-danger" /> Incidents
          </h3>
          <p className="mt-0.5 text-[10.5px] text-muted">
            {total > 0 ? `${total} incident(s) a suivre` : "Aucun incident actif"}
          </p>
        </div>
        <Link href="/incidents" className="text-[10px] text-primary-300 hover:underline">
          Registre
        </Link>
      </CardHeader>
      {incidents.length === 0 ? (
        <div className="flex items-center gap-2 px-5 py-5 text-[11px] text-success">
          <CheckCircle2 className="h-4 w-4" /> Production stable.
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {incidents.map((incident) => {
            const severity = SEVERITY[incident.severity] ?? SEVERITY.MEDIUM!;
            return (
              <li key={incident.id}>
                <Link href="/incidents" className="block px-4 py-2.5 transition-colors hover:bg-white/[0.03]">
                  <div className="flex items-center gap-1.5">
                    <span className="mono text-[9px] text-muted">{incident.code}</span>
                    <Badge variant={severity.variant}>{severity.label}</Badge>
                    <span className="ml-auto text-[9px] text-muted">{relativeTime(incident.startedAt)}</span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-fg">{incident.title}</p>
                  <p className="mt-0.5 truncate text-[9px] text-muted">
                    {incident.resource ?? "Plateforme"} · {incident.reporterName}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function TeamPanel({
  active,
  load,
  usersCount,
}: {
  active: ActiveTeamMember[];
  load: WorkloadItem[];
  usersCount: number;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-primary-300" /> Equipe
          </h3>
          <p className="mt-0.5 text-[10.5px] text-muted">
            {active.length} en session · {usersCount} comptes actifs
          </p>
        </div>
        <Link href="/team" className="text-[10px] text-primary-300 hover:underline">
          Vue equipe
        </Link>
      </CardHeader>
      <CardBody className="space-y-3 p-4">
        {active.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted">
            Aucune session de developpement en cours.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {active.slice(0, 4).map((member) => (
              <li key={member.sessionId} className="flex items-center gap-2">
                <Avatar name={member.name} color={member.color} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium">{member.name}</p>
                  <p className="text-[9.5px] text-muted">
                    Session #{String(member.number).padStart(4, "0")} · {member.status === "ACTIVE" ? "active" : "pause"}
                  </p>
                </div>
                <span className="mono text-[10px] tabular-nums text-muted">
                  {formatDuration(member.activeSeconds)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {load.length > 0 ? (
          <div className="border-t border-border/60 pt-3">
            <p className="mb-2 text-[9.5px] uppercase tracking-wide text-muted">Charge ouverte</p>
            <ul className="space-y-1.5">
              {load.slice(0, 3).map((member) => {
                const max = Math.max(...load.map((entry) => entry.openTasks), 1);
                return (
                  <li key={member.id} className="flex items-center gap-2">
                    <span className="w-24 truncate text-[10px] text-muted">{member.name}</span>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-primary-500/70"
                        style={{ width: `${(member.openTasks / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-4 text-right text-[9px] text-muted">{member.openTasks}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function PrioritiesPanel({
  tasks,
  inProgress,
  canView,
}: {
  tasks: PriorityItem[];
  inProgress: number;
  canView: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-warning" /> Priorites
          </h3>
          <p className="mt-0.5 text-[10.5px] text-muted">{inProgress} tache(s) en cours dans le flux.</p>
        </div>
        {canView ? (
          <Link href="/tasks" className="text-[10px] text-primary-300 hover:underline">
            Kanban
          </Link>
        ) : null}
      </CardHeader>
      {tasks.length === 0 ? (
        <div className="flex items-center gap-2 px-5 py-7 text-[11px] text-success">
          <CheckCircle2 className="h-4 w-4" /> Aucune priorite haute ou bloquee.
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {tasks.slice(0, 5).map((task) => {
            const status = TASK_STATUS[task.status] ?? TASK_STATUS.TODO!;
            const priority = PRIORITY[task.priority] ?? PRIORITY.MEDIUM!;
            return (
              <li key={task.id}>
                <Link
                  href={`/tasks/${task.id}`}
                  className="flex items-start gap-2 px-4 py-2.5 transition-colors hover:bg-white/[0.03]"
                >
                  <span className="mt-1 flex flex-col gap-1">
                    <Badge variant={priority.variant}>{priority.label}</Badge>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] text-fg">{task.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] text-muted">
                      <span className="mono">{task.code}</span>
                      {task.resource ? <span>· {truncate(task.resource, 24)}</span> : null}
                      {task.dueDate ? (
                        <span className="text-warning">
                          · <Clock3 className="mr-0.5 inline h-2.5 w-2.5" />
                          {formatDate(task.dueDate)}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  {task.assignee ? (
                    <Avatar name={task.assignee.displayName} color={task.assignee.avatarColor} size="xs" />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function SprintFocus({
  sprint,
  canManage,
  canView,
}: {
  sprint: SprintSnapshot | null;
  canManage: boolean;
  canView: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4 text-primary-300" /> Sprint actif
          </h3>
          <p className="mt-0.5 text-[10.5px] text-muted">
            {sprint ? `${sprint.progress.done}/${sprint.progress.total} tache(s) engagee(s)` : "Aucun cycle en cours"}
          </p>
        </div>
        {canView ? (
          <Link href="/sprints" className="text-[10px] text-primary-300 hover:underline">
            Piloter
          </Link>
        ) : null}
      </CardHeader>
      {!sprint ? (
        <div className="px-5 py-7 text-center">
          <Target className="mx-auto h-5 w-5 text-muted/40" />
          <p className="mt-2 text-[11px] text-muted">Definissez le prochain objectif de l&apos;equipe.</p>
          {canManage ? (
            <Link href="/sprints" className="mt-3 inline-flex items-center gap-1 text-[10px] text-primary-300 hover:underline">
              Creer un sprint <ArrowUpRight className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
      ) : (
        <CardBody className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{sprint.name}</p>
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-muted">
                {sprint.goal ?? "Objectif non detaille."}
              </p>
            </div>
            <Badge variant={SPRINT_STATUS[sprint.status]?.variant ?? "info"}>
              {SPRINT_STATUS[sprint.status]?.label ?? sprint.status}
            </Badge>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-[9.5px] text-muted">
              <span>{sprint.progress.percent} %</span>
              <span className={sprint.daysLeft < 0 ? "text-danger" : sprint.daysLeft <= 3 ? "text-warning" : ""}>
                {sprint.daysLeft < 0
                  ? `Depasse de ${Math.abs(sprint.daysLeft)} j`
                  : `${sprint.daysLeft} j restant(s)`}
              </span>
            </div>
            <Progress value={sprint.progress.percent} />
          </div>
          {sprint.tasks.length > 0 ? (
            <ul className="space-y-1">
              {sprint.tasks.slice(0, 3).map((task) => (
                <li key={task.id} className="flex items-center gap-1.5 text-[10px] text-muted">
                  {task.status === "DONE" ? (
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-success" />
                  ) : (
                    <span className="h-3 w-3 shrink-0 rounded-full border border-border" />
                  )}
                  <span className="truncate">{task.title}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardBody>
      )}
    </Card>
  );
}
