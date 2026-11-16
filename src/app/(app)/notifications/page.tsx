"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCheck, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/use-api";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useRealtime } from "@/components/realtime-provider";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Skeleton,
  Switch,
  cn,
} from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import { relativeTime } from "@/lib/format";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

type Preferences = Record<string, boolean>;

const PREFERENCE_LABELS: Record<string, string> = {
  sessions: "Sessions de developpement",
  tasks: "Taches et validations",
  bugs: "Bugs",
  deployments: "Deploiements",
  reports: "Rapports",
  security: "Securite du compte",
};

export default function NotificationsPage() {
  const { refreshNotifications } = useRealtime();
  const [filter, setFilter] = React.useState("all");
  const notifications = useApi<{ notifications: NotificationRow[]; unread: number; preferences: Preferences }>(
    `/api/notifications?filter=${filter}&limit=100`,
  );
  const [prefs, setPrefs] = React.useState<Preferences>({});
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (notifications.data) setPrefs(notifications.data.preferences ?? {});
  }, [notifications.data]);

  async function markAll() {
    setBusy(true);
    try {
      await apiFetch("/api/notifications", { method: "PATCH", body: { all: true } });
      await notifications.refresh();
      refreshNotifications();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function savePreferences(next: Preferences) {
    setPrefs(next);
    try {
      await apiFetch("/api/notifications", { method: "PATCH", body: { preferences: next } });
      toast.success("Preferences enregistrees");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const rows = notifications.data?.notifications ?? [];
  const unread = notifications.data?.unread ?? 0;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Centre de notifications interne avec preferences par categorie."
        eyebrow="Mon espace"
      >
        <Button variant="secondary" size="sm" onClick={markAll} loading={busy}>
          <CheckCheck className="h-3.5 w-3.5" /> Tout marquer comme lu
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <div className="px-4 pt-2">
              <Tabs
                tabs={[
                  { id: "all", label: "Toutes", count: rows.length },
                  { id: "unread", label: "Non lues", count: unread },
                ]}
                value={filter}
                onChange={setFilter}
              />
            </div>
            {notifications.loading ? (
              <div className="space-y-2 p-4">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-12" />)}</div>
            ) : rows.length === 0 ? (
              <EmptyState
                icon={<Bell className="h-5 w-5" />}
                title="Aucune notification"
                description="Les evenements importants de votre activite apparaitront ici."
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {rows.map((item) => (
                  <li key={item.id} className={cn("px-4 py-3", !item.readAt && "bg-primary-500/[0.04]")}>
                    <div className="flex items-start gap-2">
                      {!item.readAt ? <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" /> : <span className="mt-1.5 h-1.5 w-1.5 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-xs font-medium text-fg">{item.title}</p>
                          <Badge variant="neutral">{item.type}</Badge>
                        </div>
                        {item.body ? <p className="mt-0.5 text-[11px] text-muted">{item.body}</p> : null}
                        <p className="mt-1 text-[10px] text-muted/60">{relativeTime(item.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {item.link ? (
                          <Link href={item.link} className="text-[10px] text-primary-300 hover:underline">
                            Ouvrir
                          </Link>
                        ) : null}
                        {!item.readAt ? (
                          <button
                            onClick={async () => {
                              await apiFetch("/api/notifications", { method: "PATCH", body: { ids: [item.id] } });
                              await notifications.refresh();
                              refreshNotifications();
                            }}
                            className="rounded p-1 text-muted hover:bg-white/5 hover:text-fg"
                            title="Marquer comme lu"
                          >
                            <CheckCheck className="h-3 w-3" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <Settings2 className="h-3.5 w-3.5" /> Preferences
              </h3>
            </CardHeader>
            <CardBody className="space-y-3">
              {Object.entries(PREFERENCE_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted">{label}</span>
                  <Switch
                    checked={prefs[key] !== false}
                    onChange={(value) => void savePreferences({ ...prefs, [key]: value })}
                  />
                </div>
              ))}
              <p className="pt-1 text-[10px] text-muted/60">
                Les notifications de securite ne peuvent pas etre totalement desactivees cote serveur.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
