import {
  file,
  formatNumber,
  mdTable,
  num,
  parseTable,
  result,
  safeSlug,
  splitList,
  stat,
  str,
} from "../helpers";
import type { StudioTool } from "../types";

export const opsTools: StudioTool[] = [
  {
    slug: "txadmin-recipe",
    name: "Recette txAdmin",
    category: "serveur",
    description: "Genere une recette YAML txAdmin avec ressources, base de donnees et variables.",
    icon: "ServerCog",
    tags: ["txadmin", "deploiement", "serveur"],
    fields: [
      { name: "serverName", label: "Nom du serveur", type: "text", default: "ChicagoRP" },
      { name: "maxClients", label: "Slots", type: "number", default: 64, min: 1 },
      { name: "serverCfg", label: "Fichier server.cfg", type: "text", default: "server.cfg" },
      { name: "resourcesCsv", label: "Ressources (ensure)", type: "textarea", rows: 6, default: "ensure oxmysql\nensure ox_lib\nensure chat\nensure spawnmanager" },
      { name: "database", label: "Base de donnees", type: "switch", default: true },
      { name: "locale", label: "Langue", type: "select", options: [{ value: "fr", label: "Francais" }, { value: "en", label: "Anglais" }], default: "fr" },
    ],
    run: (input) => {
      const name = str(input, "serverName", "ChicagoRP");
      const resources = str(input, "resourcesCsv", "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const recipe = `# Recette txAdmin generee par FiveM DevManager\nname: ${JSON.stringify(name)}\nversion: 1.0.0\nlocale: ${str(input, "locale", "fr")}\n\nserver:\n  maxClients: ${num(input, "maxClients", 64)}\n  serverCfg: ${JSON.stringify(str(input, "serverCfg", "server.cfg"))}\n\nresources:\n${resources.map((resource) => `  - ${JSON.stringify(resource.replace(/^ensure\s+/, ""))}`).join("\n")}\n\n${str(input, "database", "true") === "true" ? "database:\n  enabled: true\n  # Renseignez les variables DB_* dans txAdmin, jamais dans ce fichier.\n" : "database:\n  enabled: false\n"}`;
      return result(`Recette txAdmin pour ${name} generee.`, [
        file("recipe.yaml", recipe, "yaml"),
        file("README.md", "# Recette txAdmin\n\nImportez ce fichier dans txAdmin > Recipes. Ne mettez jamais de mot de passe en clair dans le YAML.\n", "markdown"),
      ], { stats: [stat("Ressources", String(resources.length)), stat("Slots", String(num(input, "maxClients", 64)))] });
    },
  },
  {
    slug: "backup-plan",
    name: "Plan de sauvegarde",
    category: "serveur",
    description: "Genere un plan de sauvegarde, un script tar/mysqldump et une entree cron.",
    icon: "DatabaseBackup",
    tags: ["backup", "sauvegarde", "cron"],
    fields: [
      { name: "serverName", label: "Serveur", type: "text", default: "chicago" },
      { name: "frequency", label: "Frequence", type: "select", options: [{ value: "hourly", label: "Toutes les heures" }, { value: "daily", label: "Quotidien" }, { value: "weekly", label: "Hebdomadaire" }], default: "daily" },
      { name: "retention", label: "Retention (jours)", type: "number", default: 14, min: 1, max: 365 },
      { name: "target", label: "Dossier cible", type: "text", default: "/home/container/backups" },
      { name: "includeDatabase", label: "Inclure la base", type: "switch", default: true },
      { name: "includeResources", label: "Inclure les ressources", type: "switch", default: true },
    ],
    run: (input) => {
      const name = safeSlug(str(input, "serverName", "chicago"), "chicago");
      const target = str(input, "target", "/home/container/backups");
      const retention = num(input, "retention", 14);
      const cron = str(input, "frequency", "daily") === "hourly" ? "0 * * * *" : str(input, "frequency", "daily") === "weekly" ? "0 4 * * 0" : "0 4 * * *";
      const script = `#!/usr/bin/env bash\nset -euo pipefail\n\nSTAMP=$(date +%Y%m%d-%H%M%S)\nTARGET=${JSON.stringify(target)}/${name}-$STAMP\nmkdir -p "$TARGET"\n\n# Adaptez les chemins a votre conteneur.\n${str(input, "includeResources", "true") === "true" ? 'tar -czf "$TARGET/resources.tar.gz" -C /home/container resources\n' : ""}${str(input, "includeDatabase", "true") === "true" ? '# mysqldump --single-transaction "$DATABASE_URL" > "$TARGET/database.sql"\n# Utilisez les variables d environnement, jamais un mot de passe en clair.\n' : ""}find ${JSON.stringify(target)} -maxdepth 1 -type d -mtime +${retention} -name '${name}-*' -exec rm -rf {} +\necho "[backup] $TARGET"\n`;
      return result(`Plan de sauvegarde ${name} genere.`, [
        file("backup.sh", script, "bash"),
        file("backup-plan.md", `# Sauvegardes - ${name}\n\n- Frequence : ${str(input, "frequency", "daily")}\n- Retention : ${retention} jours\n- Cible : ${target}\n- Cron : \`${cron}\`\n\nTestez le script et la restauration sur une copie avant de l'activer.\n`, "markdown"),
        file("crontab.txt", `${cron} bash /home/container/deploy/backup.sh >> /home/container/logs/backup.log 2>&1\n`, "text"),
      ], {
        warnings: ["Ne stockez pas les sauvegardes sur le meme disque que le serveur sans copie externe."],
        stats: [stat("Retention", `${retention} j`), stat("Cible", target)],
      });
    },
  },
  {
    slug: "slot-calculator",
    name: "Calculateur de slots",
    category: "serveur",
    description: "Estime la charge serveur et recommande un nombre de slots realiste.",
    icon: "UsersRound",
    tags: ["slots", "performance", "capacite"],
    fields: [
      { name: "players", label: "Joueurs actuels", type: "number", default: 64, min: 1 },
      { name: "resources", label: "Ressources", type: "number", default: 80, min: 1 },
      { name: "avgMs", label: "Temps CPU moyen par ressource (ms)", type: "number", default: 0.12, step: 0.01 },
      { name: "bandwidthMbps", label: "Bande passante (Mbps)", type: "number", default: 100, min: 1 },
      { name: "tickRate", label: "Tick rate souhaite", type: "number", default: 30, min: 10, max: 120 },
    ],
    run: (input) => {
      const players = num(input, "players", 64);
      const resources = num(input, "resources", 80);
      const avg = num(input, "avgMs", 0.12);
      const bandwidth = num(input, "bandwidthMbps", 100);
      const tickRate = num(input, "tickRate", 30);
      const tickMs = 1000 / tickRate;
      const perPlayerMs = resources * avg;
      const totalMs = players * perPlayerMs;
      const bandwidthPerPlayer = players > 0 ? bandwidth / players : 0;
      const capacityByCpu = Math.floor((tickMs * 0.7) / Math.max(0.01, perPlayerMs));
      const capacityByBandwidth = Math.floor((bandwidth * 0.8) / 0.35);
      const recommended = Math.max(1, Math.min(capacityByCpu, capacityByBandwidth));
      const diagnostics = totalMs > tickMs
        ? [{ level: "error" as const, message: `Charge CPU ${formatNumber(totalMs, 2)} ms > budget ${formatNumber(tickMs, 2)} ms.` }]
        : totalMs > tickMs * 0.7
          ? [{ level: "warning" as const, message: "Charge CPU proche du budget : reduisez les ressources ou les slots." }]
          : [];
      return result(`Capacite recommandee : ${recommended} joueurs.`, [
        file("capacity-report.json", JSON.stringify({ players, resources, avgMs: avg, tickRate, totalMs, recommended, bandwidthPerPlayer }, null, 2), "json"),
        file("capacity-report.md", `# Capacite serveur\n\n${mdTable(["Indicateur", "Valeur"], [["Budget tick", `${formatNumber(tickMs, 2)} ms`], ["Charge par joueur", `${formatNumber(perPlayerMs, 2)} ms`], ["Charge totale", `${formatNumber(totalMs, 2)} ms`], ["Limite CPU", String(capacityByCpu)], ["Limite bande passante", String(capacityByBandwidth)], ["Slots recommandes", String(recommended)]])}\n`, "markdown"),
      ], { diagnostics, stats: [stat("Slots recommandes", String(recommended), recommended < players ? "warning" : "success"), stat("Charge CPU", `${formatNumber(totalMs, 1)} ms`, totalMs > tickMs ? "danger" : "success")] });
    },
  },
  {
    slug: "tick-budget",
    name: "Budget de tick",
    category: "serveur",
    description: "Calcule le budget par tick et identifie les ressources les plus couteuses.",
    icon: "Activity",
    tags: ["tick", "performance", "ressources"],
    fields: [
      { name: "tickRate", label: "Tick rate", type: "number", default: 30, min: 10, max: 120 },
      { name: "resourceMsCsv", label: "Ressource,temps ms", type: "textarea", rows: 6, default: "oxmysql,0.20\nox_lib,0.10\ninventory,0.35\nweather,0.05" },
    ],
    run: (input) => {
      const rows = parseTable(str(input, "resourceMsCsv", ""), ["resource", "ms"]);
      const resources = rows.map((row) => ({ name: row.resource || "resource", ms: Number(row.ms) || 0 })).sort((a, b) => b.ms - a.ms);
      const tickRate = num(input, "tickRate", 30);
      const budget = 1000 / tickRate;
      const total = resources.reduce((sum, resource) => sum + resource.ms, 0);
      const heavy = resources.filter((resource) => resource.ms > budget * 0.1);
      return result(`Budget ${formatNumber(budget, 2)} ms/tick · consommation ${formatNumber(total, 2)} ms.`, [
        file("tick-budget.json", JSON.stringify({ tickRate, budget, total, resources }, null, 2), "json"),
        file("tick-budget.md", `# Budget de tick\n\n${mdTable(["Ressource", "ms/tick"], resources.map((resource) => [resource.name, formatNumber(resource.ms, 3)]))}\n\nBudget : ${formatNumber(budget, 2)} ms. Consommation : ${formatNumber(total, 2)} ms.\n`, "markdown"),
      ], {
        diagnostics: [
          ...(total > budget ? [{ level: "error" as const, message: "Le budget de tick est depasse." }] : []),
          ...heavy.map((resource) => ({ level: "warning" as const, message: `${resource.name} consomme plus de 10% du budget.` })),
        ],
        stats: [stat("Budget", `${formatNumber(budget, 2)} ms`), stat("Consommation", `${formatNumber(total, 2)} ms`, total > budget ? "danger" : "success"), stat("Ressources lourdes", String(heavy.length), heavy.length ? "warning" : "success")],
      });
    },
  },
  {
    slug: "crash-parser",
    name: "Analyseur de crash",
    category: "serveur",
    description: "Extrait les erreurs d'un log de crash et propose des pistes de correction.",
    icon: "AlertTriangle",
    tags: ["crash", "log", "debug"],
    fields: [
      { name: "log", label: "Log de crash", type: "textarea", rows: 14, required: true, default: "[   script:mon_resource] Error loading script server/main.lua: attempt to index a nil value\nCitizenFX crash: access violation at 0x00000000\nResource 'inventory' failed to load\n" },
    ],
    run: (input) => {
      const log = str(input, "log", "");
      const lines = log.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const errors = lines.filter((line) => /error|crash|exception|failed|attempt to|nil value|access violation/i.test(line));
      const resources = [...new Set([...log.matchAll(/script:([a-zA-Z0-9_-]+)/g)].map((match) => match[1]!))];
      const suggestions: string[] = [];
      if (/attempt to index a nil value/i.test(log)) suggestions.push("Verifiez les variables non initialisees et les retours de requetes SQL.");
      if (/access violation|0x00000000/i.test(log)) suggestions.push("Cause native probable : verifiez les dernieres ressources C#/C++ et les fichiers .dll.");
      if (/failed to load/i.test(log)) suggestions.push("Verifiez le fxmanifest, les chemins de scripts et les dependances.");
      if (/mysql|sql/i.test(log)) suggestions.push("Verifiez la connexion oxmysql et les requetes au demarrage.");
      if (suggestions.length === 0) suggestions.push("Isolez la ressource en la desactivant puis redemarrez pour identifier le declencheur.");
      return result(`${errors.length} ligne(s) suspecte(s), ${resources.length} ressource(s) identifiee(s).`, [
        file("crash-report.md", `# Rapport de crash\n\n${mdTable(["Ligne", "Extrait"], errors.map((line, index) => [String(index + 1), line]))}\n\n## Pistes\n\n${suggestions.map((suggestion) => `- ${suggestion}`).join("\n")}\n`, "markdown"),
        file("crash-report.json", JSON.stringify({ errors, resources, suggestions }, null, 2), "json"),
      ], {
        stats: [stat("Erreurs", String(errors.length), errors.length ? "danger" : "success"), stat("Ressources", String(resources.length))],
        diagnostics: errors.length ? [{ level: "error", message: "Des erreurs bloquantes sont presentes dans le log." }] : [],
      });
    },
  },
  {
    slug: "log-analyzer",
    name: "Analyseur de logs",
    category: "serveur",
    description: "Resume les erreurs et avertissements d'un log FiveM par ressource.",
    icon: "ScrollText",
    tags: ["logs", "diagnostic", "serveur"],
    fields: [
      { name: "log", label: "Log", type: "textarea", rows: 14, required: true, default: "[citizen-server-impl] Started resource chat\n[script:oxmysql] Warning: connection pool saturated\n[script:inventory] Error: item not found\n" },
      { name: "maxLines", label: "Lignes max", type: "number", default: 500, min: 10, max: 5000 },
    ],
    run: (input) => {
      const lines = str(input, "log", "").split(/\r?\n/).slice(-num(input, "maxLines", 500));
      const errors = lines.filter((line) => /\berror\b|exception|failed/i.test(line));
      const warnings = lines.filter((line) => /\bwarn(ing)?\b/i.test(line));
      const byResource = new Map<string, number>();
      for (const line of [...errors, ...warnings]) {
        const match = line.match(/\[script:([^\]]+)\]/);
        const key = match?.[1] ?? "global";
        byResource.set(key, (byResource.get(key) ?? 0) + 1);
      }
      const ranking = [...byResource.entries()].sort((a, b) => b[1] - a[1]);
      return result(`${errors.length} erreur(s), ${warnings.length} avertissement(s).`, [
        file("log-summary.json", JSON.stringify({ errors: errors.length, warnings: warnings.length, byResource: Object.fromEntries(ranking) }, null, 2), "json"),
        file("log-summary.md", `# Resume des logs\n\n${mdTable(["Ressource", "Occurrences"], ranking.map(([name, count]) => [name, String(count)]))}\n\n## Dernieres erreurs\n\n${errors.slice(-20).map((line) => `- ${line}`).join("\n") || "Aucune"}\n`, "markdown"),
      ], {
        stats: [stat("Erreurs", String(errors.length), errors.length ? "danger" : "success"), stat("Warnings", String(warnings.length), warnings.length ? "warning" : "success")],
      });
    },
  },
  {
    slug: "restart-planner",
    name: "Planificateur de redemarrage",
    category: "serveur",
    description: "Genere un planning de redemarrages avec avertissements et commandes.",
    icon: "RefreshCw",
    tags: ["restart", "planning", "serveur"],
    fields: [
      { name: "timezone", label: "Fuseau", type: "text", default: "Europe/Paris" },
      { name: "restartTimesCsv", label: "Heures (HH:MM)", type: "text", default: "04:00, 12:00, 18:00, 23:00" },
      { name: "warningMinutes", label: "Avertissement (minutes)", type: "number", default: 10, min: 0, max: 60 },
      { name: "commandsCsv", label: "Commandes avant redemarrage", type: "textarea", rows: 3, default: "say Redemarrage dans 10 minutes\nsay Sauvegardez votre vehicule" },
    ],
    run: (input) => {
      const times = splitList(str(input, "restartTimesCsv", "04:00")).filter((time) => /^\d{1,2}:\d{2}$/.test(time));
      const commands = str(input, "commandsCsv", "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const warning = num(input, "warningMinutes", 10);
      const plan = times.map((time) => ({ time, warning, commands }));
      const cron = times.map((time) => {
        const [hour = "4", minute = "0"] = time.split(":");
        return `${Number(minute)} ${Number(hour)} * * * echo "restart"`;
      });
      return result(`${times.length} redemarrage(s) planifie(s).`, [
        file("restart-plan.json", JSON.stringify({ timezone: str(input, "timezone", "Europe/Paris"), plan }, null, 2), "json"),
        file("restart-plan.md", `# Plan de redemarrage\n\nFuseau : ${str(input, "timezone", "Europe/Paris")}\n\n${mdTable(["Heure", "Avertissement", "Commandes"], plan.map((item) => [item.time, `${item.warning} min`, String(item.commands.length)]))}\n`, "markdown"),
        file("crontab.txt", `${cron.join("\n")}\n`, "text"),
      ], {
        diagnostics: times.length === 0 ? [{ level: "error", message: "Aucune heure valide (format HH:MM)." }] : [],
        stats: [stat("Redemarrages", String(times.length))],
      });
    },
  },
  {
    slug: "resource-audit",
    name: "Audit de ressources",
    category: "serveur",
    description: "Prepare un audit de manifest, version et organisation des ressources.",
    icon: "FolderSearch",
    tags: ["audit", "ressources", "qualite"],
    fields: [
      { name: "resourcesCsv", label: "Ressources (nom,chemin,version)", type: "textarea", rows: 7, default: "oxmysql,/resources/[system]/oxmysql,1.0.0\ninventory,/resources/[system]/inventory,2.1.0\nmon_resource,/resources/[custom]/mon_resource,1.0.0" },
      { name: "requireVersion", label: "Version obligatoire", type: "switch", default: true },
      { name: "requireManifest", label: "fxmanifest obligatoire", type: "switch", default: true },
    ],
    run: (input) => {
      const rows = parseTable(str(input, "resourcesCsv", ""), ["name", "path", "version"]);
      const issues: string[] = [];
      for (const row of rows) {
        if (str(input, "requireVersion", "true") === "true" && !row.version) issues.push(`${row.name}: version manquante`);
        if (str(input, "requireManifest", "true") === "true" && !row.path) issues.push(`${row.name}: chemin manquant`);
      }
      const script = `#!/usr/bin/env bash\nset -euo pipefail\nROOT=\${1:-/home/container/resources}\nfor dir in "$ROOT"/* "$ROOT"/*/*; do\n  [ -d "$dir" ] || continue\n  name=$(basename "$dir")\n  if [ ! -f "$dir/fxmanifest.lua" ] && [ ! -f "$dir/__resource.lua" ]; then\n    echo "[audit] manifest absent: $name"\n  fi\ndone\n`;
      return result(`${rows.length} ressource(s) auditee(s), ${issues.length} anomalie(s).`, [
        file("audit.sh", script, "bash"),
        file("audit.md", `# Audit ressources\n\n${mdTable(["Ressource", "Version", "Etat"], rows.map((row) => [row.name, row.version || "-", issues.some((issue) => issue.startsWith(row.name + ":")) ? "A verifier" : "OK"]))}\n`, "markdown"),
      ], {
        diagnostics: issues.map((message) => ({ level: "warning" as const, message })),
        stats: [stat("Ressources", String(rows.length)), stat("Anomalies", String(issues.length), issues.length ? "warning" : "success")],
      });
    },
  },
  {
    slug: "network-estimator",
    name: "Estimateur reseau",
    category: "serveur",
    description: "Estime la bande passante par joueur et alerte sur les configurations risquees.",
    icon: "Network",
    tags: ["reseau", "bande passante", "performance"],
    fields: [
      { name: "players", label: "Joueurs", type: "number", default: 64, min: 1 },
      { name: "entities", label: "Entites synchronisees", type: "number", default: 200, min: 1 },
      { name: "updatesPerSecond", label: "Updates/s", type: "number", default: 10, min: 1, max: 60 },
      { name: "bytesPerEntity", label: "Octets/entite", type: "number", default: 24, min: 1 },
      { name: "bandwidthMbps", label: "Lien serveur (Mbps)", type: "number", default: 100, min: 1 },
    ],
    run: (input) => {
      const players = num(input, "players", 64);
      const entities = num(input, "entities", 200);
      const updates = num(input, "updatesPerSecond", 10);
      const bytes = num(input, "bytesPerEntity", 24);
      const link = num(input, "bandwidthMbps", 100);
      const perPlayerKBps = (entities * updates * bytes) / 1024;
      const totalMbps = (perPlayerKBps * players * 8) / 1024;
      const saturation = (totalMbps / link) * 100;
      return result(`Bande passante estimee : ${formatNumber(totalMbps, 1)} Mbps (${formatNumber(saturation, 0)}% du lien).`, [
        file("network-report.json", JSON.stringify({ players, entities, updates, bytes, perPlayerKBps, totalMbps, saturation }, null, 2), "json"),
        file("network-report.md", `# Estimation reseau\n\n- Par joueur : ${formatNumber(perPlayerKBps, 1)} Ko/s\n- Total : ${formatNumber(totalMbps, 1)} Mbps\n- Saturation : ${formatNumber(saturation, 0)} %\n`, "markdown"),
      ], {
        diagnostics: saturation > 80 ? [{ level: "error", message: "Le lien reseau est proche de la saturation." }] : saturation > 50 ? [{ level: "warning", message: "Marge reseau limite." }] : [],
        stats: [stat("Total", `${formatNumber(totalMbps, 1)} Mbps`, saturation > 80 ? "danger" : saturation > 50 ? "warning" : "success"), stat("Par joueur", `${formatNumber(perPlayerKBps, 1)} Ko/s`)],
      });
    },
  },
  {
    slug: "health-checklist",
    name: "Checklist de sante",
    category: "serveur",
    description: "Evalue la sante operationnelle du serveur et produit un rapport priorise.",
    icon: "HeartPulse",
    tags: ["sante", "monitoring", "checklist"],
    fields: [
      { name: "serverName", label: "Serveur", type: "text", default: "ChicagoRP" },
      { name: "cpu", label: "CPU (%)", type: "number", default: 45, min: 0, max: 100 },
      { name: "ram", label: "RAM (%)", type: "number", default: 55, min: 0, max: 100 },
      { name: "disk", label: "Disque (%)", type: "number", default: 60, min: 0, max: 100 },
      { name: "backups", label: "Sauvegardes recentes", type: "switch", default: true },
      { name: "txAdmin", label: "txAdmin configure", type: "switch", default: true },
      { name: "monitoring", label: "Monitoring actif", type: "switch", default: true },
    ],
    run: (input) => {
      const cpu = num(input, "cpu", 0);
      const ram = num(input, "ram", 0);
      const disk = num(input, "disk", 0);
      const checks = [
        ["CPU < 70%", cpu < 70, cpu],
        ["RAM < 75%", ram < 75, ram],
        ["Disque < 80%", disk < 80, disk],
        ["Sauvegardes recentes", str(input, "backups", "true") === "true", 100],
        ["txAdmin configure", str(input, "txAdmin", "true") === "true", 100],
        ["Monitoring actif", str(input, "monitoring", "true") === "true", 100],
      ] as const;
      const passed = checks.filter(([, ok]) => ok).length;
      const score = Math.round((passed / checks.length) * 100);
      const failures = checks.filter(([, ok]) => !ok).map(([label]) => label);
      return result(`Sante ${str(input, "serverName", "serveur")} : ${score}% (${passed}/${checks.length}).`, [
        file("health-report.md", `# Sante serveur\n\n${mdTable(["Controle", "Etat"], checks.map(([label, ok]) => [label, ok ? "OK" : "A corriger"]))}\n\nScore : **${score}%**\n`, "markdown"),
        file("health.json", JSON.stringify({ serverName: str(input, "serverName", "serveur"), score, checks: checks.map(([label, ok]) => ({ label, ok })) }, null, 2), "json"),
      ], {
        diagnostics: failures.map((failure) => ({ level: "warning" as const, message: `${failure} : controle en echec.` })),
        stats: [stat("Score", `${score}%`, score >= 80 ? "success" : score >= 50 ? "warning" : "danger"), stat("Controles", `${passed}/${checks.length}`)],
      });
    },
  },
];
