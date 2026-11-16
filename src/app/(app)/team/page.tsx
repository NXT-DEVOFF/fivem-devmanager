import Link from "next/link";
import { Activity, Timer, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { computeActiveSeconds } from "@/server/session-time";
import { formatDuration, relativeTime } from "@/lib/format";
import { Avatar, Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { ROLE_LABELS } from "@/lib/labels";

export const metadata = { title: "Equipe" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await requireUser();

  const [members, activeSessions, recentAudit] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: [{ role: "asc" }, { displayName: "asc" }],
      include: {
        _count: { select: { devSessions: true, tasksAssigned: true, bugsAssigned: true } },
        tasksAssigned: {
          where: { status: { notIn: ["DONE"] } },
          select: { id: true },
        },
      },
    }),
    prisma.devSession.findMany({
      where: { status: { in: ["ACTIVE", "PAUSED"] } },
      include: { user: { select: { id: true } } },
      orderBy: { startedAt: "desc" },
    }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  const sessionByUser = new Map(activeSessions.map((session) => [session.userId, session]));

  return (
    <div>
      <PageHeader
        title="Equipe"
        description="Vue d'ensemble des developpeurs, de leur charge et de leur activite."
        eyebrow="Equipe"
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Membres actifs</p>
          <p className="mt-1 text-xl font-semibold">{members.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">En session</p>
          <p className="mt-1 text-xl font-semibold text-success">{activeSessions.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted">Taches ouvertes assignees</p>
          <p className="mt-1 text-xl font-semibold">
            {members.reduce((sum, member) => sum + member.tasksAssigned.length, 0)}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
          {members.map((member) => {
            const session = sessionByUser.get(member.id);
            return (
              <Card key={member.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={member.displayName} color={member.avatarColor} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-medium">{member.displayName}</p>
                      <Badge variant={member.role === "DEVELOPER" ? "neutral" : "primary"}>
                        {ROLE_LABELS[member.role] ?? member.role}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted">{member.jobTitle ?? member.username}</p>
                    <p className="mt-1 text-[10px] text-muted/70">
                      {session ? (
                        <span className="text-success">
                          En session ({session.status === "ACTIVE" ? "active" : "pause"}) ·{" "}
                          {formatDuration(computeActiveSeconds(session))}
                        </span>
                      ) : (
                        <>
                          Vu {relativeTime(member.lastSeenAt ?? member.lastLoginAt)} ·{" "}
                          {member._count.devSessions} session(s)
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-border bg-surface/60 py-1.5">
                    <p className="text-[9px] uppercase text-muted">Taches</p>
                    <p className="text-xs">{member.tasksAssigned.length}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-surface/60 py-1.5">
                    <p className="text-[9px] uppercase text-muted">Bugs</p>
                    <p className="text-xs">{member._count.bugsAssigned}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-surface/60 py-1.5">
                    <p className="text-[9px] uppercase text-muted">Sessions</p>
                    <p className="text-xs">{member._count.devSessions}</p>
                  </div>
                </div>

                {session ? (
                  <Link
                    href={`/sessions/${session.id}`}
                    className="mt-2 flex items-center justify-center gap-1 rounded-md border border-success/20 bg-success/[0.06] py-1 text-[10px] text-success hover:bg-success/10"
                  >
                    <Timer className="h-3 w-3" /> Voir la session en cours
                  </Link>
                ) : null}
              </Card>
            );
          })}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <Activity className="h-3.5 w-3.5" /> Activite recente
              </h3>
            </CardHeader>
            {recentAudit.length === 0 ? (
              <EmptyState icon={<Users className="h-5 w-5" />} title="Aucune activite" />
            ) : (
              <ul className="divide-y divide-border/60">
                {recentAudit.map((entry) => (
                  <li key={entry.id} className="px-4 py-2">
                    <p className="truncate text-[11px] text-fg">
                      {entry.actorLabel} · {entry.action}
                    </p>
                    <p className="text-[10px] text-muted">{relativeTime(entry.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <p className="text-xs font-medium">Mon acces</p>
            <p className="mt-1 text-[11px] text-muted">
              Vous etes connecte en tant que {ROLE_LABELS[user.role] ?? user.role}. Les actions sensibles
              sont controlees cote serveur et journalisees.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
