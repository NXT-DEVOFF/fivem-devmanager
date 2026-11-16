"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  FileCog,
  Info,
  RefreshCw,
  Search,
} from "lucide-react";
import { useApi } from "@/lib/use-api";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Skeleton,
} from "@/components/ui/primitives";
import { relativeTime } from "@/lib/format";
import { cn } from "@/components/ui/primitives";

interface ConfigCheck {
  id: string;
  level: "error" | "warning" | "info";
  title: string;
  detail: string;
}

interface ConfigPayload {
  configured: boolean;
  ok: boolean;
  path: string;
  error?: string;
  generatedAt: string;
  lineCount: number;
  directiveCount: number;
  aceCount: number;
  settings: Array<{ key: string; value: string; masked: boolean }>;
  endpoints: { tcp: string[]; udp: string[] };
  resources: {
    ensured: string[];
    duplicates: string[];
    missing: string[];
    notStarted: string[];
  };
  checks: ConfigCheck[];
}

const LEVELS = {
  error: { label: "Bloquant", variant: "danger" as const, icon: AlertTriangle },
  warning: { label: "Attention", variant: "warning" as const, icon: CircleAlert },
  info: { label: "Information", variant: "info" as const, icon: Info },
};

export default function ServerConfigPage() {
  const [path, setPath] = React.useState("/server.cfg");
  const [applied, setApplied] = React.useState("/server.cfg");
  const report = useApi<ConfigPayload>(`/api/server-config?path=${encodeURIComponent(applied)}`);

  const data = report.data;
  const checks = data?.checks ?? [];
  const errors = checks.filter((check) => check.level === "error").length;
  const warnings = checks.filter((check) => check.level === "warning").length;

  return (
    <div>
      <PageHeader
        title="Configuration serveur"
        description="Audit du server.cfg : licence, endpoints, OneSync, RCON, ressources demarrees mais absentes du disque."
        eyebrow="Developpement"
      >
        <Badge variant={!data ? "neutral" : errors > 0 ? "danger" : warnings > 0 ? "warning" : "success"}>
          {!data ? "analyse" : errors > 0 ? `${errors} bloquant(s)` : warnings > 0 ? `${warnings} alerte(s)` : "conforme"}
        </Badge>
        <Button variant="ghost" size="sm" onClick={() => void report.refresh()} loading={report.loading}>
          <RefreshCw className="h-3.5 w-3.5" /> Relancer
        </Button>
      </PageHeader>

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-end gap-3">
          <Field label="Fichier de configuration" hint="Chemin relatif a la racine du serveur, lu via l'API Pterodactyl." className="min-w-[260px] flex-1">
            <Input
              value={path}
              onChange={(event) => setPath(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setApplied(path.trim() || "/server.cfg");
              }}
              placeholder="/server.cfg"
              className="font-mono text-xs"
            />
          </Field>
          <Button variant="primary" onClick={() => setApplied(path.trim() || "/server.cfg")}>
            <Search className="h-3.5 w-3.5" /> Analyser
          </Button>
          {data?.ok ? (
            <p className="ml-auto text-[10.5px] text-muted">
              {data.lineCount} lignes · {data.directiveCount} directives · {data.aceCount} ACE ·{" "}
              {relativeTime(data.generatedAt)}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {report.loading && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-44" />
        </div>
      ) : report.error ? (
        <Card className="p-6 text-sm text-danger">{report.error}</Card>
      ) : !data?.configured ? (
        <Card>
          <EmptyState
            icon={<FileCog className="h-5 w-5" />}
            title="Pterodactyl non configure"
            description="L'audit lit le server.cfg via l'API du panel : renseignez-la dans Infrastructure."
          />
        </Card>
      ) : !data.ok ? (
        <Card>
          <EmptyState
            icon={<FileCog className="h-5 w-5" />}
            title="Fichier illisible"
            description={data.error ?? `Aucun server.cfg trouve a l'emplacement ${data.path}.`}
          />
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <Card>
              <CardHeader>
                <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-primary-300" /> Controles
                </h3>
                <span className="text-[10px] text-muted">{checks.length} verification(s)</span>
              </CardHeader>
              <CardBody className="space-y-2">
                {checks.map((check) => {
                  const level = LEVELS[check.level];
                  const Icon = level.icon;
                  return (
                    <div
                      key={check.id}
                      className={cn(
                        "flex items-start gap-2.5 rounded-lg border px-3 py-2",
                        check.level === "error"
                          ? "border-danger/25 bg-danger/[0.07]"
                          : check.level === "warning"
                            ? "border-warning/25 bg-warning/[0.06]"
                            : "border-border bg-surface/50",
                      )}
                    >
                      <Icon
                        className={cn(
                          "mt-0.5 h-3.5 w-3.5 shrink-0",
                          check.level === "error"
                            ? "text-danger"
                            : check.level === "warning"
                              ? "text-warning"
                              : "text-info",
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-fg">{check.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted">{check.detail}</p>
                      </div>
                      <Badge variant={level.variant} className="ml-auto shrink-0">
                        {level.label}
                      </Badge>
                    </div>
                  );
                })}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold">Directives & secrets masques</h3>
                <span className="text-[10px] text-muted">{data.settings.length} parametres</span>
              </CardHeader>
              <CardBody className="p-0">
                {data.settings.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-muted">Aucune directive `set` detectee.</p>
                ) : (
                  <div className="max-h-80 overflow-y-auto scrollbar-thin">
                    <table className="w-full text-left text-[11px]">
                      <thead className="sticky top-0 bg-card text-[10px] uppercase tracking-wide text-muted">
                        <tr>
                          <th className="px-4 py-2 font-medium">Cle</th>
                          <th className="px-4 py-2 font-medium">Valeur</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.settings.map((setting) => (
                          <tr key={setting.key} className="border-t border-border/60">
                            <td className="mono px-4 py-1.5 text-fg">{setting.key}</td>
                            <td className="mono px-4 py-1.5 text-muted">
                              {setting.value}
                              {setting.masked ? <span className="ml-2 text-[9px] text-warning">masque</span> : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold">Endpoints</h3>
              </CardHeader>
              <CardBody className="space-y-2 text-[11px]">
                <p className="text-[10px] uppercase tracking-wide text-muted">TCP</p>
                {data.endpoints.tcp.length === 0 ? (
                  <p className="text-danger">aucun</p>
                ) : (
                  data.endpoints.tcp.map((value) => (
                    <p key={value} className="mono rounded border border-border bg-surface px-2 py-1 text-fg">
                      {value}
                    </p>
                  ))
                )}
                <p className="pt-1 text-[10px] uppercase tracking-wide text-muted">UDP</p>
                {data.endpoints.udp.length === 0 ? (
                  <p className="text-warning">aucun</p>
                ) : (
                  data.endpoints.udp.map((value) => (
                    <p key={value} className="mono rounded border border-border bg-surface px-2 py-1 text-fg">
                      {value}
                    </p>
                  ))
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold">Ressources</h3>
                <Badge variant="neutral">{data.resources.ensured.length} demarrees</Badge>
              </CardHeader>
              <CardBody className="space-y-3 text-[11px]">
                <ResourceList
                  title="Absentes du disque"
                  values={data.resources.missing}
                  tone="danger"
                />
                <ResourceList
                  title="Installees mais non demarrees"
                  values={data.resources.notStarted}
                  tone="muted"
                />
                <ResourceList
                  title="Demarrees plusieurs fois"
                  values={data.resources.duplicates}
                  tone="warning"
                />
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function ResourceList({
  title,
  values,
  tone,
}: {
  title: string;
  values: string[];
  tone: "danger" | "warning" | "muted";
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted">
        {title} {values.length > 0 ? `(${values.length})` : ""}
      </p>
      {values.length === 0 ? (
        <p className="text-[10.5px] text-muted/60">aucune</p>
      ) : (
        <div className="mt-1 flex flex-wrap gap-1">
          {values.slice(0, 24).map((value) => (
            <span
              key={value}
              className={cn(
                "mono rounded px-1.5 py-0.5 text-[10px]",
                tone === "danger"
                  ? "bg-danger/10 text-danger"
                  : tone === "warning"
                    ? "bg-warning/10 text-warning"
                    : "bg-white/5 text-muted",
              )}
            >
              {value}
            </span>
          ))}
          {values.length > 24 ? <span className="text-[10px] text-muted">+{values.length - 24}</span> : null}
        </div>
      )}
    </div>
  );
}
