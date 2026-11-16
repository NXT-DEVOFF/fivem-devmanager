import { file, num, safeSlug, sqlIdentifier as sqlName, stat, str } from "../helpers";
import { list, moduleTool, rows } from "./modules-shared";
import type { StudioDiagnostic, StudioTool } from "../types";

const DEFAULT_TABLES = `command_audit,created_at,30
player_reports,created_at,90
vehicle_telemetry,captured_at,14`;

export const opsAdvancedTools: StudioTool[] = [
  moduleTool({
    slug: "report-operations",
    name: "File de signalements",
    category: "serveur",
    description:
      "Genere un systeme de signalements joueurs avec categories, file admin, attribution, resolution, retention et SQL.",
    icon: "ScrollText",
    tags: ["signalement", "moderation", "sql", "admin", "support"],
    fields: [
      { name: "resourceName", label: "Ressource", type: "text", default: "fdm_reports", required: true },
      { name: "table", label: "Table SQL", type: "text", default: "player_reports", required: true },
      { name: "categoriesCsv", label: "Categories", type: "text", default: "bug, plainte, recrutement, autre", required: true },
      { name: "retentionDays", label: "Retention (jours)", type: "number", default: 90, min: 7, max: 730 },
      { name: "permission", label: "Permission joueur", type: "text", default: "fdm.reports" },
      { name: "adminAce", label: "Permission admin", type: "text", default: "fdm.reports.admin" },
      { name: "command", label: "Commande joueur", type: "text", default: "report" },
    ],
    build: (input) => {
      const resource = safeSlug(str(input, "resourceName", "fdm_reports"), "fdm_reports");
      const table = sqlName(str(input, "table", "player_reports"), "player_reports");
      const categories = list(input, "categoriesCsv", "bug,plainte,autre").map((category) => safeSlug(category, "autre"));
      const retentionDays = Math.max(7, Math.min(730, num(input, "retentionDays", 90)));
      const permission = str(input, "permission", "fdm.reports").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80) || "fdm.reports";
      const adminAce = str(input, "adminAce", "fdm.reports.admin").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80) || "fdm.reports.admin";
      const command = safeSlug(str(input, "command", "report"), "report").replace(/_/g, "");
      const diagnostics: StudioDiagnostic[] = categories.length === 0 ? [{ level: "error", message: "Aucune categorie definie.", field: "categoriesCsv" }] : [];
      const data = { resourceName: resource, table, categories, retentionDays, permission, adminAce, command };

      const schema = `CREATE TABLE IF NOT EXISTS ${table} (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reporter VARCHAR(80) NOT NULL,
  category VARCHAR(32) NOT NULL,
  message VARCHAR(500) NOT NULL,
  status ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
  assigned_to VARCHAR(80) NULL,
  resolution VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_player_reports_status (status, created_at),
  INDEX idx_player_reports_reporter (reporter, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

      const server = `local tableName = Config.ReportOperations.table
local categories = {}
local adminAce = Config.ReportOperations.adminAce
local retentionDays = Config.ReportOperations.retentionDays
local cooldowns = {}

for _, category in ipairs(Config.ReportOperations.categories) do
  categories[category] = true
end

local function identifier(source)
  return GetPlayerIdentifierByType(source, 'license')
end

local function notify(source, message, ok)
  TriggerClientEvent('chat:addMessage', source, {
    args = { 'Signalements', tostring(message) },
    color = ok and { 80, 220, 140 } or { 240, 120, 120 },
  })
end

local function isAdmin(source)
  return source == 0 or IsPlayerAceAllowed(source, adminAce)
end

local function shorten(value, limit)
  local text = tostring(value or ''):gsub('%s+', ' '):gsub('^%s+', ''):gsub('%s+$', '')
  return text:sub(1, limit)
end

RegisterCommand(Config.ReportOperations.command, function(source, args)
  if source == 0 then return end
  if not IsPlayerAceAllowed(source, Config.ReportOperations.permission) then
    notify(source, 'Vous ne pouvez pas creer de signalement.', false)
    return
  end

  local category = tostring(args[1] or ''):lower()
  local message = shorten(table.concat(args, ' ', 2), 500)
  if not categories[category] then
    notify(source, ('Categorie invalide. Valeurs : %s'):format(table.concat(Config.ReportOperations.categories, ', ')), false)
    return
  end
  if #message < 5 then
    notify(source, 'Le message doit contenir au moins 5 caracteres.', false)
    return
  end

  local now = os.time()
  if cooldowns[source] and now - cooldowns[source] < 60 then
    notify(source, 'Patientez avant de creer un autre signalement.', false)
    return
  end
  cooldowns[source] = now

  local reporter = identifier(source)
  if not reporter then
    notify(source, 'Identifiant joueur introuvable.', false)
    return
  end

  local id = MySQL.insert.await(
    ('INSERT INTO %s (reporter, category, message) VALUES (?, ?, ?)'):format(tableName),
    { reporter, category, message }
  )
  notify(source, ('Signalement #%s enregistre.'):format(tostring(id)), true)
  TriggerEvent('fdm:reports:created', tonumber(id), reporter, category, message)
end, false)

RegisterCommand('reports', function(source, args)
  if not isAdmin(source) then return end
  local filter = args[1] == 'all' and 'all' or 'open'
  local rows

  if filter == 'all' then
    rows = MySQL.query.await(('SELECT id, category, status, reporter, assigned_to, created_at FROM %s ORDER BY id DESC LIMIT 25'):format(tableName)) or {}
  else
    rows = MySQL.query.await(('SELECT id, category, status, reporter, assigned_to, created_at FROM %s WHERE status <> ? ORDER BY id ASC LIMIT 25'):format(tableName), { 'RESOLVED' }) or {}
  end

  if #rows == 0 then
    print('[reports] aucun signalement.')
    return
  end

  for _, row in ipairs(rows) do
    print(('[reports] #%s [%s] %s · %s · %s'):format(
      tostring(row.id), tostring(row.category), tostring(row.status),
      tostring(row.reporter), tostring(row.created_at)
    ))
  end
end, false)

RegisterCommand('reportclaim', function(source, args)
  if not isAdmin(source) then return end
  local id = tonumber(args[1])
  if not id then
    print('[reports] usage : /reportclaim <id>')
    return
  end

  local actor = source == 0 and 'console' or (identifier(source) or ('player:%d'):format(source))
  local affected = MySQL.update.await(
    ('UPDATE %s SET status = ?, assigned_to = ? WHERE id = ? AND status = ?'):format(tableName),
    { 'IN_PROGRESS', actor, id, 'OPEN' }
  )
  print(('[reports] #%d attribue (%d ligne).'):format(id, tonumber(affected) or 0))
end, false)

RegisterCommand('reportresolve', function(source, args)
  if not isAdmin(source) then return end
  local id = tonumber(args[1])
  local resolution = shorten(table.concat(args, ' ', 2), 500)
  if not id or #resolution < 3 then
    print('[reports] usage : /reportresolve <id> <resolution>')
    return
  end

  local actor = source == 0 and 'console' or (identifier(source) or ('player:%d'):format(source))
  local affected = MySQL.update.await(
    ('UPDATE %s SET status = ?, resolution = ?, assigned_to = COALESCE(assigned_to, ?) WHERE id = ?'):format(tableName),
    { 'RESOLVED', resolution, actor, id }
  )
  print(('[reports] #%d resolu (%d ligne).'):format(id, tonumber(affected) or 0))
  TriggerEvent('fdm:reports:resolved', id, actor, resolution)
end, false)

CreateThread(function()
  while true do
    Wait(12 * 60 * 60 * 1000)
    local ok, err = pcall(function()
      MySQL.query.await(
        ('DELETE FROM %s WHERE status = ? AND updated_at < (NOW() - INTERVAL %d DAY) LIMIT 5000'):format(tableName, retentionDays),
        { 'RESOLVED' }
      )
    end)
    if not ok then
      print(('[reports] purge impossible : %s'):format(tostring(err)))
    end
  end
end)
`;

      const client = `TriggerEvent('chat:addSuggestion', '/' .. Config.ReportOperations.command, 'Cree un signalement', {
  { name = 'categorie', help = table.concat(Config.ReportOperations.categories, ', ') },
  { name = 'message', help = 'Description du probleme' },
})
TriggerEvent('chat:addSuggestion', '/reports', 'Liste les signalements ouverts (admin)')
TriggerEvent('chat:addSuggestion', '/reportclaim', 'Attribue un signalement a soi-meme', {
  { name = 'id', help = 'Numero du signalement' },
})
TriggerEvent('chat:addSuggestion', '/reportresolve', 'Resout un signalement', {
  { name = 'id', help = 'Numero du signalement' },
  { name = 'resolution', help = 'Explication de la resolution' },
})
`;

      const fxmanifest = `fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name '${resource}'
description 'File de signalements generee par FiveM DevManager'
version '1.0.0'

dependencies {
  'oxmysql',
}

shared_scripts {
  'report-operations.lua',
}

server_scripts {
  'server/reports.lua',
}

client_scripts {
  'client/suggestions.lua',
}
`;

      const readme = `# ${resource}

File de signalements joueurs avec historique et traitement admin.

## Installation

1. Importez \`schema.sql\`.
2. Placez la ressource apres \`oxmysql\`.
3. Attribuez \`${permission}\` aux joueurs et \`${adminAce}\` aux moderateurs.

## Commandes

- \`/${command} <categorie> <message>\` : cree un signalement.
- \`/reports [open|all]\` : liste les signalements.
- \`/reportclaim <id>\` : attribue un signalement.
- \`/reportresolve <id> <resolution>\` : resout un signalement.

## Retention

Les signalements resolus de plus de ${retentionDays} jours sont supprimes par lots de 5000.
`;

      return {
        data,
        sql: schema,
        lua: `function IsReportCategory(category)
  for _, allowed in ipairs(Config.ReportOperations.categories) do
    if allowed == category then return true end
  end
  return false
end
`,
        files: [
          file("fxmanifest.lua", fxmanifest, "lua"),
          file("server/reports.lua", server, "lua"),
          file("client/suggestions.lua", client, "lua"),
        ],
        readme,
        stats: [
          stat("Categories", String(categories.length), categories.length ? "success" : "danger"),
          stat("Retention", `${retentionDays} j`),
          stat("Table", table),
        ],
        diagnostics,
      };
    },
  }),
  moduleTool({
    slug: "database-maintenance",
    name: "Maintenance base de donnees",
    category: "serveur",
    description:
      "Genere un plan de purge, analyse et optimisation SQL avec script bash securise et execution a blanc.",
    icon: "Database",
    tags: ["sql", "maintenance", "retention", "performance", "ops"],
    fields: [
      { name: "databaseEnv", label: "Variable base", type: "text", default: "DB_NAME" },
      { name: "hostEnv", label: "Variable hote", type: "text", default: "DB_HOST" },
      { name: "userEnv", label: "Variable utilisateur", type: "text", default: "DB_USER" },
      { name: "passwordEnv", label: "Variable mot de passe", type: "text", default: "DB_PASSWORD" },
      { name: "tablesCsv", label: "Tables (table,dateColumn,retentionDays)", type: "textarea", rows: 6, default: DEFAULT_TABLES },
      { name: "analyze", label: "Analyser les tables", type: "switch", default: true },
      { name: "optimize", label: "Optimiser les tables", type: "switch", default: false },
      { name: "dryRun", label: "Execution a blanc par defaut", type: "switch", default: true },
    ],
    build: (input) => {
      const databaseEnv = safeSlug(str(input, "databaseEnv", "DB_NAME"), "DB_NAME").toUpperCase().replace(/[^A-Z0-9_]/g, "_");
      const hostEnv = safeSlug(str(input, "hostEnv", "DB_HOST"), "DB_HOST").toUpperCase().replace(/[^A-Z0-9_]/g, "_");
      const userEnv = safeSlug(str(input, "userEnv", "DB_USER"), "DB_USER").toUpperCase().replace(/[^A-Z0-9_]/g, "_");
      const passwordEnv = safeSlug(str(input, "passwordEnv", "DB_PASSWORD"), "DB_PASSWORD").toUpperCase().replace(/[^A-Z0-9_]/g, "_");
      const analyze = input.analyze === undefined ? true : input.analyze === true || input.analyze === "true";
      const optimize = input.optimize === true || input.optimize === "true";
      const dryRun = input.dryRun === undefined ? true : input.dryRun === true || input.dryRun === "true";
      const tables = rows(input, "tablesCsv", ["table", "dateColumn", "retentionDays"]).map((row) => ({
        table: sqlName(row.table, "table_name"),
        dateColumn: /^[a-z0-9_]+$/i.test(row.dateColumn) ? row.dateColumn : "created_at",
        retentionDays: Math.max(1, Math.min(3650, Number(row.retentionDays) || 30)),
      }));
      const diagnostics: StudioDiagnostic[] = tables.length === 0 ? [{ level: "warning", message: "Aucune table definie : le script ne purgera rien.", field: "tablesCsv" }] : [];
      const data = { databaseEnv, hostEnv, userEnv, passwordEnv, analyze, optimize, dryRun, tables };

      const sql = [
        "-- Maintenance generee par FiveM DevManager",
        "SET SQL_SAFE_UPDATES = 0;",
        "",
        ...tables.flatMap((table) => [
          `-- ${table.table} : purge des lignes de plus de ${table.retentionDays} jours`,
          `DELETE FROM \`${table.table}\` WHERE \`${table.dateColumn}\` < (NOW() - INTERVAL ${table.retentionDays} DAY) LIMIT 5000;`,
          analyze ? `ANALYZE TABLE \`${table.table}\`;` : "",
          optimize ? `OPTIMIZE TABLE \`${table.table}\`;` : "",
          "",
        ]),
      ]
        .filter((line) => line !== "")
        .join("\n");

      const script = `#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)
SQL_FILE="\${SCRIPT_DIR}/maintenance.sql"
DRY_RUN="\${DRY_RUN:-${dryRun ? "1" : "0"}}"

: "\${${hostEnv}:?Definir ${hostEnv}}"
: "\${${userEnv}:?Definir ${userEnv}}"
: "\${${passwordEnv}:?Definir ${passwordEnv}}"
: "\${${databaseEnv}:?Definir ${databaseEnv}}"

if [ ! -f "$SQL_FILE" ]; then
  echo "[maintenance] fichier SQL introuvable : $SQL_FILE" >&2
  exit 2
fi

if [ "$DRY_RUN" = "1" ]; then
  echo "[maintenance] mode execution a blanc ; aucune requete envoyee."
  echo "[maintenance] variables : ${hostEnv}, ${userEnv}, ${databaseEnv}"
  sed -n '1,200p' "$SQL_FILE"
  exit 0
fi

echo "[maintenance] execution sur \${${databaseEnv}} via \${${hostEnv}}"
MYSQL_PWD="\${${passwordEnv}}" mysql \\
  --host="\${${hostEnv}}" \\
  --user="\${${userEnv}}" \\
  --database="\${${databaseEnv}}" \\
  --batch \\
  --raw < "$SQL_FILE"

echo "[maintenance] termine."
`;

      const cron = `# Maintenance mensuelle a 04:30
30 4 1 * * cd /home/container/maintenance && DRY_RUN=0 ./maintenance.sh >> /home/container/logs/database-maintenance.log 2>&1
`;

      const readme = `# Maintenance base de donnees

Script de purge et d'optimisation genere par FiveM DevManager.

## Preparation

1. Copiez \`maintenance.sql\`, \`maintenance.sh\` et \`cron\` sur le serveur.
2. Rendez le script executable : \`chmod +x maintenance.sh\`.
3. Definissez \`${hostEnv}\`, \`${userEnv}\`, \`${passwordEnv}\` et \`${databaseEnv}\` dans l'environnement.
4. Lancez d'abord sans \`DRY_RUN=0\` pour inspecter les requetes.

## Execution

\`\`\`bash
./maintenance.sh              # execution a blanc
DRY_RUN=0 ./maintenance.sh    # execution reelle
\`\`\`

## Tables

${tables.length > 0 ? tables.map((table) => `- \`${table.table}\` : \`${table.dateColumn}\`, retention ${table.retentionDays} jours`).join("\n") : "- Aucune table configuree"}

## Securite

- Aucun mot de passe n'est ecrit dans le script ou le SQL.
- Le mot de passe est transmis par la variable \`${passwordEnv}\`.
- L'execution reelle doit etre lancee manuellement apres validation.
- Les suppressions sont limitees par lots de 5000 lignes.
- Testez toujours sur une copie de la base avant la production.
`;

      return {
        data,
        files: [
          file("maintenance.sql", `${sql}\n`, "sql"),
          file("maintenance.sh", script, "bash"),
          file("cron", cron, "text"),
        ],
        readme,
        stats: [
          stat("Tables", String(tables.length)),
          stat("Mode", dryRun ? "A blanc" : "Execution", dryRun ? "warning" : "success"),
          stat("Optimisation", optimize ? "Active" : "Desactivee"),
        ],
        diagnostics,
      };
    },
  }),
  moduleTool({
    slug: "backup-verifier",
    name: "Verificateur de sauvegardes",
    category: "serveur",
    description:
      "Genere un script de verification des sauvegardes : fraicheur, taille, fichiers requis, archive tar et dump SQL.",
    icon: "DatabaseBackup",
    tags: ["backup", "verification", "ops", "cron", "restauration"],
    fields: [
      { name: "backupDir", label: "Dossier des sauvegardes", type: "text", default: "/home/container/backups", required: true },
      { name: "maxAgeHours", label: "Age maximum (heures)", type: "number", default: 26, min: 1, max: 720 },
      { name: "minSizeMb", label: "Taille minimum (Mo)", type: "number", default: 50, min: 1, max: 102400 },
      { name: "requiredFilesCsv", label: "Fichiers requis", type: "text", default: "resources.tar.gz, database.sql" },
      { name: "databaseDump", label: "Dump SQL", type: "text", default: "database.sql" },
      { name: "webhookEnv", label: "Variable webhook Discord", type: "text", default: "DISCORD_BACKUP_WEBHOOK" },
    ],
    build: (input) => {
      const backupDir = str(input, "backupDir", "/home/container/backups").replace(/"/g, "");
      const maxAgeHours = Math.max(1, Math.min(720, num(input, "maxAgeHours", 26)));
      const minSizeMb = Math.max(1, Math.min(102400, num(input, "minSizeMb", 50)));
      const requiredFiles = list(input, "requiredFilesCsv", "resources.tar.gz,database.sql");
      const databaseDump = str(input, "databaseDump", "database.sql").replace(/[^A-Za-z0-9_.-]/g, "");
      const webhookEnv = safeSlug(str(input, "webhookEnv", "DISCORD_BACKUP_WEBHOOK"), "DISCORD_BACKUP_WEBHOOK").toUpperCase().replace(/[^A-Z0-9_]/g, "_");
      const data = { backupDir, maxAgeHours, minSizeMb, requiredFiles, databaseDump, webhookEnv };

      const script = `#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="\${BACKUP_DIR:-${backupDir}}"
MAX_AGE_HOURS="\${MAX_AGE_HOURS:-${maxAgeHours}}"
MIN_SIZE_MB="\${MIN_SIZE_MB:-${minSizeMb}}"
WEBHOOK_ENV="${webhookEnv}"
WEBHOOK_URL=$(printenv "$WEBHOOK_ENV" || true)

fail() {
  echo "[backup] ECHEC : $1" >&2
  exit 1
}

[ -d "$BACKUP_DIR" ] || fail "dossier introuvable : $BACKUP_DIR"

LATEST=$(ls -1dt "$BACKUP_DIR"/*/ 2>/dev/null | head -n 1 || true)
LATEST="\${LATEST%/}"
[ -n "$LATEST" ] || fail "aucune sauvegarde trouvee"

NOW=$(date +%s)
MTIME=$(stat -c %Y "$LATEST")
AGE_HOURS=$(( (NOW - MTIME) / 3600 ))
[ "$AGE_HOURS" -le "$MAX_AGE_HOURS" ] || fail "sauvegarde trop ancienne : \${AGE_HOURS}h (max \${MAX_AGE_HOURS}h)"

SIZE_MB=$(du -sm "$LATEST" | awk '{print $1}')
[ "$SIZE_MB" -ge "$MIN_SIZE_MB" ] || fail "sauvegarde trop petite : \${SIZE_MB} Mo (min \${MIN_SIZE_MB} Mo)"

for required in ${requiredFiles.map((name) => `"${name.replace(/"/g, "")}"`).join(" ")}; do
  [ -s "$LATEST/$required" ] || fail "fichier manquant ou vide : $required"
done

[ -s "$LATEST/${databaseDump}" ] || fail "dump SQL absent ou vide : ${databaseDump}"
head -c 64 "$LATEST/${databaseDump}" | grep -Eq 'CREATE|INSERT|SET|MariaDB|MySQL' || fail "dump SQL non reconnu"

if [ -f "$LATEST/resources.tar.gz" ]; then
  tar -tzf "$LATEST/resources.tar.gz" >/dev/null || fail "archive resources.tar.gz corrompue"
fi

for archive in "$LATEST"/*.tar.gz; do
  [ -e "$archive" ] || continue
  tar -tzf "$archive" >/dev/null || fail "archive corrompue : $(basename "$archive")"
done

echo "[backup] OK · \${LATEST} · \${AGE_HOURS}h · \${SIZE_MB} Mo"

if [ -n "$WEBHOOK_URL" ]; then
  CONTENT="Sauvegarde OK : $(basename "$LATEST") · \${AGE_HOURS}h · \${SIZE_MB} Mo"
  curl -fsS -X POST -H 'Content-Type: application/json' \\
    -d "$(printf '{"content":"%s"}' "$CONTENT")" \\
    "$WEBHOOK_URL" >/dev/null || true
fi
`;

      const cron = `# Verification quotidienne a 05:15
15 5 * * * /home/container/backups/verify-backups.sh >> /home/container/logs/backup-verify.log 2>&1
`;

      const readme = `# Verification des sauvegardes

Verifie la derniere sauvegarde : fraicheur, taille, fichiers requis, dump SQL et archives.

## Installation

1. Copiez \`verify-backups.sh\` sur le serveur et rendez-le executable.
2. Adaptez \`BACKUP_DIR\` si necessaire.
3. Planifiez \`cron\` ou lancez le script manuellement.
4. Configurez \`${webhookEnv}\` pour recevoir une notification Discord.

## Criteres

- Derniere sauvegarde de moins de ${maxAgeHours} heures.
- Taille minimale de ${minSizeMb} Mo.
- Fichiers requis : ${requiredFiles.join(", ")}.
- Archive tar lisible.
- Dump \`${databaseDump}\` non vide et reconnu.

## Notes

Le script ne supprime aucune sauvegarde. Il sort en erreur si un controle echoue,
ce qui permet a cron, systemd ou votre supervision de declencher une alerte.
`;

      return {
        data,
        files: [
          file("verify-backups.sh", script, "bash"),
          file("cron", cron, "text"),
        ],
        readme,
        stats: [
          stat("Age max", `${maxAgeHours} h`),
          stat("Taille min", `${minSizeMb} Mo`),
          stat("Fichiers requis", String(requiredFiles.length)),
        ],
        diagnostics: requiredFiles.length === 0 ? [{ level: "warning", message: "Aucun fichier requis : la verification sera limitee a la taille et a l'age." }] : [],
      };
    },
  }),
];
