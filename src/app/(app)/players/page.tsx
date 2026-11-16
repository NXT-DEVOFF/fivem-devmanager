"use client";

import * as React from "react";
import {
  Ban,
  Gavel,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { useRealtime } from "@/components/realtime-provider";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import {
  Avatar,
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
import { formatDate, formatDateTime, relativeTime } from "@/lib/format";
import {
  BAN_SANCTIONS,
  DURATION_SANCTIONS,
  PLAYER_STATUS,
  SANCTION_TYPE,
  type PlayerEntry,
  type PlayerSanction,
  type PlayerStatusValue,
  type PlayersSummary,
  type SanctionTypeValue,
} from "@/lib/players";

interface PlayersPayload {
  players: PlayerEntry[];
  summary: PlayersSummary;
}

interface PlayerForm {
  displayName: string;
  license: string;
  discordId: string;
  steamHex: string;
  status: PlayerStatusValue;
  notes: string;
}

const EMPTY_FORM: PlayerForm = {
  displayName: "",
  license: "",
  discordId: "",
  steamHex: "",
  status: "ACTIVE",
  notes: "",
};

interface SanctionForm {
  type: SanctionTypeValue;
  reason: string;
  evidence: string;
  durationHours: string;
}

const EMPTY_SANCTION: SanctionForm = {
  type: "WARNING",
  reason: "",
  evidence: "",
  durationHours: "24",
};

export default function PlayersPage() {
  const { can } = useRealtime();
  const canManage = can("players.manage");
  const canSanction = can("sanctions.create");
  const canRevoke = can("sanctions.manage");
  const list = useApi<PlayersPayload>("/api/players");

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PlayerEntry | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<PlayerEntry | null>(null);
  const [busy, setBusy] = React.useState(false);

  const players = React.useMemo(() => list.data?.players ?? [], [list.data]);
  const summary = list.data?.summary;
  const selected = React.useMemo(
    () => players.find((player) => player.id === selectedId) ?? null,
    [players, selectedId],
  );

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return players.filter((player) => {
      if (statusFilter && player.status !== statusFilter) return false;
      if (!needle) return true;
      return `${player.displayName} ${player.license} ${player.discordId ?? ""} ${
        player.steamHex ?? ""
      } ${player.notes ?? ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [players, search, statusFilter]);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(player: PlayerEntry) {
    setEditing(player);
    setSelectedId(null);
    setEditorOpen(true);
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await apiFetch(`/api/players/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Fiche joueur supprimée");
      setDeleteTarget(null);
      setSelectedId(null);
      await list.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Communauté"
        title="Joueurs & sanctions"
        description="Conservez l'historique de modération de chaque joueur : licences, sanctions, avertissements et décisions de l'équipe."
      >
        <Badge variant={(summary?.banned ?? 0) > 0 ? "danger" : "neutral"}>
          {summary?.banned ?? 0} banni(s)
        </Badge>
        {canManage ? (
          <Button variant="primary" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Ajouter un joueur
          </Button>
        ) : null}
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Joueurs suivis"
          value={String(summary?.total ?? 0)}
          hint={`${summary?.active ?? 0} actif(s)`}
          icon={<Users className="h-4 w-4" />}
          accent="primary"
        />
        <Stat
          label="Sanctions actives"
          value={String(summary?.activeSanctions ?? 0)}
          hint="Bans, mutes et restrictions en cours"
          icon={<ShieldAlert className="h-4 w-4" />}
          accent={(summary?.activeSanctions ?? 0) > 0 ? "warning" : "success"}
        />
        <Stat
          label="Bannis"
          value={String(summary?.banned ?? 0)}
          hint="Accès au serveur bloqué"
          icon={<Ban className="h-4 w-4" />}
          accent={(summary?.banned ?? 0) > 0 ? "danger" : "success"}
        />
        <Stat
          label="Sanctions / 30 jours"
          value={String(summary?.sanctions30d ?? 0)}
          hint="Décisions de modération récentes"
          icon={<Gavel className="h-4 w-4" />}
          accent="info"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input
            className="pl-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un nom, une licence, un Discord..."
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="w-auto min-w-[190px]"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(PLAYER_STATUS).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>
        <span className="text-xs text-muted">
          {filtered.length} / {players.length} joueur(s)
        </span>
      </div>

      {list.loading && !list.data ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      ) : list.error ? (
        <Card className="p-6 text-sm text-danger">{list.error}</Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserRound className="h-5 w-5" />}
            title={players.length === 0 ? "Aucun joueur enregistré" : "Aucun résultat"}
            description={
              players.length === 0
                ? "Ajoutez une fiche pour suivre les sanctions, les avertissements et les antécédents d'un joueur."
                : "Modifiez la recherche ou le statut pour retrouver un joueur."
            }
            action={
              canManage && players.length === 0 ? (
                <Button variant="primary" size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Créer la première fiche
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((player) => (
            <PlayerRow key={player.id} player={player} onOpen={() => setSelectedId(player.id)} />
          ))}
        </div>
      )}

      <PlayerEditorDialog
        open={editorOpen}
        player={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={async () => {
          setEditorOpen(false);
          await list.refresh();
        }}
      />

      {selected ? (
        <PlayerDetailDialog
          key={selected.id}
          player={selected}
          canManage={canManage}
          canSanction={canSanction}
          canRevoke={canRevoke}
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
        title="Supprimer cette fiche joueur ?"
        description={`« ${deleteTarget?.displayName ?? ""} » et tout son historique de sanctions seront définitivement supprimés.`}
        confirmLabel="Supprimer"
        dangerous
        loading={busy}
      />
    </div>
  );
}

function PlayerRow({ player, onOpen }: { player: PlayerEntry; onOpen: () => void }) {
  const meta = PLAYER_STATUS[player.status];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="panel panel-interactive flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
    >
      <Avatar name={player.displayName} color={player.createdBy?.avatarColor ?? null} />

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-fg">{player.displayName}</span>
          <Badge variant={meta.variant}>{meta.label}</Badge>
          {player.activeSanctions > 0 ? (
            <Badge variant="danger">
              <ShieldAlert className="h-3 w-3" /> {player.activeSanctions} active(s)
            </Badge>
          ) : null}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted">
          <span className="mono">{player.license}</span>
          {player.discordId ? <span>· Discord {player.discordId}</span> : null}
          {player.steamHex ? <span>· Steam {player.steamHex}</span> : null}
        </span>
      </span>

      <span className="text-right text-[10px] text-muted">
        <span className="block">{player.totalSanctions} sanction(s)</span>
        <span className="block">
          {player.lastSeenAt ? `Vu ${relativeTime(player.lastSeenAt)}` : `Créé le ${formatDate(player.createdAt)}`}
        </span>
      </span>
    </button>
  );
}

function PlayerEditorDialog({
  open,
  player,
  onClose,
  onSaved,
}: {
  open: boolean;
  player: PlayerEntry | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = React.useState<PlayerForm>(EMPTY_FORM);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setForm(
      player
        ? {
            displayName: player.displayName,
            license: player.license,
            discordId: player.discordId ?? "",
            steamHex: player.steamHex ?? "",
            status: player.status,
            notes: player.notes ?? "",
          }
        : EMPTY_FORM,
    );
  }, [open, player]);

  function update<K extends keyof PlayerForm>(key: K, value: PlayerForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setBusy(true);
    try {
      const base = {
        displayName: form.displayName.trim(),
        license: form.license.trim(),
        status: form.status,
        notes: form.notes.trim() || undefined,
      };

      if (player) {
        await apiFetch(`/api/players/${player.id}`, {
          method: "PATCH",
          body: {
            ...base,
            notes: form.notes.trim() || null,
            discordId: form.discordId.trim() || null,
            steamHex: form.steamHex.trim() || null,
          },
        });
        toast.success("Fiche joueur mise à jour");
      } else {
        await apiFetch("/api/players", {
          method: "POST",
          body: {
            ...base,
            discordId: form.discordId.trim() || undefined,
            steamHex: form.steamHex.trim() || undefined,
          },
        });
        toast.success("Fiche joueur créée");
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
      title={player ? "Modifier la fiche joueur" : "Nouvelle fiche joueur"}
      description="La licence FiveM sert d'identifiant unique pour rattacher les sanctions."
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
            disabled={form.displayName.trim().length < 2 || form.license.trim().length < 3}
          >
            {player ? "Enregistrer" : "Créer la fiche"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom du joueur">
            <Input
              value={form.displayName}
              onChange={(event) => update("displayName", event.target.value)}
              placeholder="Ex : John Carter"
              maxLength={120}
            />
          </Field>
          <Field label="Licence FiveM" hint="Format license:xxxxx">
            <Input
              value={form.license}
              onChange={(event) => update("license", event.target.value)}
              placeholder="license:1a2b3c4d5e6f"
              maxLength={120}
              spellCheck={false}
              className="font-mono text-xs"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Discord" hint="Identifiant ou identifiant numérique.">
            <Input
              value={form.discordId}
              onChange={(event) => update("discordId", event.target.value)}
              placeholder="john_carter"
              maxLength={40}
            />
          </Field>
          <Field label="Steam Hex" hint="Optionnel.">
            <Input
              value={form.steamHex}
              onChange={(event) => update("steamHex", event.target.value)}
              placeholder="steam:110000112345678"
              maxLength={60}
              spellCheck={false}
              className="font-mono text-xs"
            />
          </Field>
        </div>

        <Field label="Statut">
          <Select
            value={form.status}
            onChange={(event) => update("status", event.target.value as PlayerStatusValue)}
          >
            {Object.entries(PLAYER_STATUS).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label} — {meta.description}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Notes internes"
          hint="Contexte utile à l'équipe : antécédents, réputation, contacts..."
        >
          <Textarea
            rows={4}
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
            placeholder="Historique, éléments à surveiller, informations de contact..."
          />
        </Field>
      </div>
    </Modal>
  );
}

function PlayerDetailDialog({
  player,
  canManage,
  canSanction,
  canRevoke,
  onClose,
  onEdit,
  onDelete,
  onChanged,
}: {
  player: PlayerEntry;
  canManage: boolean;
  canSanction: boolean;
  canRevoke: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const meta = PLAYER_STATUS[player.status];
  const [form, setForm] = React.useState<SanctionForm>(EMPTY_SANCTION);
  const [busy, setBusy] = React.useState(false);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);
  const [revokeReason, setRevokeReason] = React.useState("");
  const [revokeBusy, setRevokeBusy] = React.useState(false);

  const needsDuration = DURATION_SANCTIONS.includes(form.type);

  function update<K extends keyof SanctionForm>(key: K, value: SanctionForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function issueSanction() {
    setBusy(true);
    try {
      await apiFetch(`/api/players/${player.id}/sanctions`, {
        method: "POST",
        body: {
          type: form.type,
          reason: form.reason.trim(),
          evidence: form.evidence.trim() || undefined,
          durationHours: needsDuration ? Number(form.durationHours) : undefined,
        },
      });
      toast.success(`${SANCTION_TYPE[form.type].label} enregistrée`);
      setForm({ ...EMPTY_SANCTION, type: form.type });
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(sanction: PlayerSanction) {
    setRevokeBusy(true);
    try {
      await apiFetch(`/api/sanctions/${sanction.id}`, {
        method: "PATCH",
        body: { revokeReason: revokeReason.trim() },
      });
      toast.success("Sanction révoquée");
      setRevokingId(null);
      setRevokeReason("");
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRevokeBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={player.displayName}
      description={`${player.license} · fiche créée le ${formatDate(player.createdAt)}`}
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
          {player.discordId ? <Badge variant="neutral">Discord {player.discordId}</Badge> : null}
          {player.steamHex ? <Badge variant="neutral">Steam {player.steamHex}</Badge> : null}
          <span className="ml-auto text-[10px] text-muted">
            Dernière mise à jour {formatDateTime(player.updatedAt)}
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <InfoTile label="Sanctions" value={String(player.totalSanctions)} />
          <InfoTile label="Actives" value={String(player.activeSanctions)} />
          <InfoTile
            label="Dernier passage"
            value={player.lastSeenAt ? relativeTime(player.lastSeenAt) : "Non renseigné"}
          />
        </div>

        {player.notes ? (
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Notes internes
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-fg/90">
              {player.notes}
            </p>
          </section>
        ) : null}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Historique des sanctions
            </p>
            <span className="text-[10px] text-muted">{player.sanctions.length} entrée(s)</span>
          </div>

          {player.sanctions.length === 0 ? (
            <div className="rounded-lg border border-border bg-white/[0.02] px-3 py-4 text-center text-[11px] text-muted">
              Aucune sanction enregistrée pour ce joueur.
            </div>
          ) : (
            <div className="space-y-2">
              {player.sanctions.map((sanction) => {
                const typeMeta = SANCTION_TYPE[sanction.type];
                const expired =
                  !sanction.active && !sanction.revokedAt && sanction.endsAt !== null;
                return (
                  <div
                    key={sanction.id}
                    className="rounded-lg border border-border bg-surface/50 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mono text-[10px] text-muted">{sanction.code}</span>
                      <Badge variant={typeMeta.variant}>{typeMeta.label}</Badge>
                      {sanction.active ? (
                        <Badge variant="danger">Active</Badge>
                      ) : sanction.revokedAt ? (
                        <Badge variant="neutral">Révoquée</Badge>
                      ) : expired ? (
                        <Badge variant="neutral">Expirée</Badge>
                      ) : (
                        <Badge variant="neutral">Historique</Badge>
                      )}
                      <span className="ml-auto text-[10px] text-muted">
                        {formatDateTime(sanction.startsAt)}
                        {sanction.endsAt ? ` → ${formatDateTime(sanction.endsAt)}` : ""}
                      </span>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-fg/90">
                      {sanction.reason}
                    </p>

                    {sanction.evidence ? (
                      <p className="mt-1 whitespace-pre-wrap text-[10px] text-muted">
                        Preuve : {sanction.evidence}
                      </p>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted">
                      <span>Émise par {sanction.issuedBy.displayName}</span>
                      {sanction.revokedAt ? (
                        <span>
                          · Révoquée par {sanction.revokedBy?.displayName ?? "inconnu"} le{" "}
                          {formatDateTime(sanction.revokedAt)}
                          {sanction.revokedReason ? ` — ${sanction.revokedReason}` : ""}
                        </span>
                      ) : null}

                      {canRevoke && sanction.active ? (
                        <span className="ml-auto">
                          {revokingId === sanction.id ? (
                            <span className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <Input
                                value={revokeReason}
                                onChange={(event) => setRevokeReason(event.target.value)}
                                placeholder="Motif de la révocation (min. 5 caractères)"
                                className="h-8 min-w-[240px] text-xs"
                                maxLength={2000}
                              />
                              <span className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="danger"
                                  loading={revokeBusy}
                                  disabled={revokeReason.trim().length < 5}
                                  onClick={() => void revoke(sanction)}
                                >
                                  Confirmer
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setRevokingId(null);
                                    setRevokeReason("");
                                  }}
                                >
                                  Annuler
                                </Button>
                              </span>
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRevokingId(sanction.id);
                                setRevokeReason("");
                              }}
                            >
                              Révoquer
                            </Button>
                          )}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {canSanction ? (
          <section className="space-y-3 border-t border-border pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Nouvelle sanction
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type">
                <Select
                  value={form.type}
                  onChange={(event) => update("type", event.target.value as SanctionTypeValue)}
                >
                  {Object.entries(SANCTION_TYPE).map(([value, item]) => (
                    <option key={value} value={value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </Field>
              {needsDuration ? (
                <Field label="Durée (heures)" hint="Entre 1 et 87 600 heures.">
                  <Input
                    type="number"
                    min={1}
                    max={87600}
                    value={form.durationHours}
                    onChange={(event) => update("durationHours", event.target.value)}
                  />
                </Field>
              ) : (
                <div className="rounded-lg border border-border bg-white/[0.02] px-3 py-2 text-[10px] leading-relaxed text-muted">
                  {SANCTION_TYPE[form.type].description}
                </div>
              )}
            </div>

            <Field label="Motif" hint="Obligatoire, visible par l'équipe.">
              <Textarea
                rows={3}
                value={form.reason}
                onChange={(event) => update("reason", event.target.value)}
                placeholder="Décrivez les faits, le contexte et la règle concernée..."
              />
            </Field>

            <Field label="Preuve / référence" hint="Optionnel : lien, clip, ticket Discord...">
              <Input
                value={form.evidence}
                onChange={(event) => update("evidence", event.target.value)}
                placeholder="https://... ou ticket #1234"
                maxLength={4000}
              />
            </Field>

            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-muted">
                {BAN_SANCTIONS.includes(form.type)
                  ? "Un bannissement passe automatiquement la fiche en « Banni »."
                  : "La sanction est conservée dans l'historique du joueur."}
              </p>
              <Button
                variant="primary"
                loading={busy}
                onClick={issueSanction}
                disabled={
                  form.reason.trim().length < 5 ||
                  (needsDuration && Number(form.durationHours) < 1)
                }
              >
                <Gavel className="h-4 w-4" /> Enregistrer
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-white/[0.02] px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-xs font-medium text-fg">{value}</p>
    </div>
  );
}
