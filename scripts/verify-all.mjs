#!/usr/bin/env node
/**
 * Vérification unifiée des deux produits.
 *
 *   node scripts/verify-all.mjs
 *   node scripts/verify-all.mjs --no-build
 *   PHP_BIN=/usr/bin/php node scripts/verify-all.mjs
 *
 * Le panel est vérifié via scripts/verify.mjs (schéma, types, tests, build),
 * le service de licence via ses tests Node et sa vérification syntaxique.
 * PHP est exécuté s'il est disponible ; sinon la vérification est signalée
 * comme ignorée, jamais comme réussie.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const skipBuild = process.argv.includes("--no-build");
const results = [];

function run(label, command, args, cwd = root) {
  process.stdout.write(`\n▶ ${label}\n`);
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  const ok = result.status === 0;
  results.push({ label, ok, skipped: false, ms: Date.now() - started });
  return ok;
}

function skip(label, reason) {
  results.push({ label, ok: true, skipped: true, reason, ms: 0 });
  process.stdout.write(`\n↷ ${label} ignoré : ${reason}\n`);
}

const panelOk = run(
  skipBuild ? "Panel : schéma + types + tests" : "Panel : schéma + types + tests + build",
  "node",
  ["scripts/verify.mjs", ...(skipBuild ? ["--no-build"] : [])],
);

const gateOk =
  panelOk &&
  run("Panel : gate licence Keygate", "node", ["selftest.js"], path.join(root, "blhost-license"));
const licenseDir = path.join(root, "website-license-pro");
const licenseAvailable = fs.existsSync(licenseDir);

if (!licenseAvailable) {
  skip("Licence : service website-license-pro", "dossier non publié");
} else if (gateOk) {
  const licenseTestsOk = run("Licence : tests Node", "npm", ["test"], licenseDir);
  if (licenseTestsOk) {
    run("Licence : syntaxe", "npm", ["run", "check"], licenseDir);
  }
}

const phpBinary = process.env.PHP_BIN || "php";
const phpProbe = spawnSync(phpBinary, ["-v"], { stdio: "ignore", shell: false });
if (!licenseAvailable) {
  skip("Licence : tests PHP", "website-license-pro non publié");
} else if (phpProbe.status === 0) {
  run(
    "Licence : tests PHP",
    phpBinary,
    ["website-license-pro/php/tests/selftest.php"],
    root,
  );
} else {
  skip("Licence : tests PHP", `${phpBinary} introuvable (définir PHP_BIN)`);
}

const failed = results.filter((item) => !item.ok);
const executed = results.filter((item) => !item.skipped);
const skipped = results.filter((item) => item.skipped);
process.stdout.write("\n================ VERIFICATION GLOBALE ================\n");
for (const item of results) {
  const mark = item.skipped ? "IGNORE" : item.ok ? "OK    " : "ECHEC ";
  process.stdout.write(
    `${mark}  ${item.label}${item.reason ? ` (${item.reason})` : ""}  ${(item.ms / 1000).toFixed(1)}s\n`,
  );
}
process.stdout.write("======================================================\n");
process.stdout.write(
  `${executed.length - failed.length}/${executed.length} vérifications exécutées réussies` +
    (skipped.length ? `, ${skipped.length} ignorée(s)\n` : "\n"),
);
process.exit(failed.length === 0 ? 0 : 1);
