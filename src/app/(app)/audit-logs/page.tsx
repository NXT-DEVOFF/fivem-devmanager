"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Filter, ScrollText, Search } from "lucide-react";
import { useApi } from "@/lib/use-api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Skeleton,
} from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/format";

interface AuditRow {
  id: string;
  actorLabel: string;
  action: string;
  actionLabel: string;
  targetType: string | null;
  targetId: string | null;
  result: string;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditPayload {
  logs: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  actions: Record<string, string>;
}

const RESULT_VARIANT: Record<string, "success" | "danger" | "warning"> = {
  SUCCESS: "success",
  FAILURE: "danger",
  DENIED: "warning",
};

export default function AuditLogsPage() {
  const [page, setPage] = React.useState(1);
  const [action, setAction] = React.useState("");
  const [result, setResult] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const params = new URLSearchParams({ page: String(page), pageSize: "30" });
  if (action) params.set("action", action);
  if (result) params.set("result", result);
  if (search) params.set("q", search);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const logs = useApi<AuditPayload>(`/api/audit-logs?${params.toString()}`);
  const actions = logs.data?.actions ?? {};

  return (
    <div>
      <PageHeader
        title="Journal d'audit"
        description="Historique immuable des operations sensibles. Aucune modification ni suppression n'est possible."
        eyebrow="Securite"
      >
        <Button variant="ghost" size="sm" onClick={() => void logs.refresh()}>Rafraichir</Button>
      </PageHeader>

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input
            className="pl-8"
            placeholder="Acteur, cible, action..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} className="w-auto">
          <option value="">Toutes les actions</option>
          {Object.entries(actions).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        <Select value={result} onChange={(event) => { setResult(event.target.value); setPage(1); }} className="w-auto">
          <option value="">Tous les resultats</option>
          <option value="SUCCESS">Succes</option>
          <option value="FAILURE">Echec</option>
          <option value="DENIED">Refuse</option>
        </Select>
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-9 rounded-lg border border-border bg-surface px-2 text-xs" />
        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-9 rounded-lg border border-border bg-surface px-2 text-xs" />
        <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); setAction(""); setResult(""); setSearch(""); setPage(1); }}>
          <Filter className="h-3.5 w-3.5" /> Reinitialiser
        </Button>
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="text-[11px] text-muted">
            {logs.data ? `${logs.data.total} evenement(s)` : "Chargement..."}
          </span>
          <span className="text-[10px] text-muted">
            Page {logs.data?.page ?? 1} / {logs.data?.totalPages ?? 1}
          </span>
        </div>

        {logs.loading ? (
          <div className="space-y-2 p-4">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-10" />)}</div>
        ) : logs.error ? (
          <p className="p-4 text-xs text-danger">{logs.error}</p>
        ) : (logs.data?.logs.length ?? 0) === 0 ? (
          <EmptyState icon={<ScrollText className="h-5 w-5" />} title="Aucun evenement" description="Aucune entree ne correspond aux filtres." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Acteur</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">Cible</th>
                  <th className="px-4 py-2 font-medium">Resultat</th>
                  <th className="px-4 py-2 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {logs.data?.logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr
                      onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                      className="cursor-pointer hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-2 whitespace-nowrap text-muted">{formatDateTime(log.createdAt)}</td>
                      <td className="px-4 py-2">{log.actorLabel}</td>
                      <td className="px-4 py-2">{log.actionLabel}</td>
                      <td className="mono max-w-[220px] truncate px-4 py-2 text-[10px] text-muted">
                        {log.targetType ?? "-"}
                        {log.targetId ? `:${log.targetId.slice(0, 12)}` : ""}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={RESULT_VARIANT[log.result] ?? "neutral"}>{log.result}</Badge>
                      </td>
                      <td className="mono px-4 py-2 text-[10px] text-muted">{log.ip ?? "-"}</td>
                    </tr>
                    {expanded === log.id ? (
                      <tr>
                        <td colSpan={6} className="bg-surface/60 px-4 py-3">
                          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-border bg-bg p-2 font-mono text-[10px] text-muted">
                            {JSON.stringify(log.metadata ?? {}, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border px-4 py-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={(logs.data?.page ?? 1) <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Precedent
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={(logs.data?.page ?? 1) >= (logs.data?.totalPages ?? 1)}
            onClick={() => setPage((value) => value + 1)}
          >
            Suivant <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
