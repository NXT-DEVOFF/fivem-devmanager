#!/usr/bin/env node
/**
 * Verification complete du projet.
 *
 *   node scripts/verify.mjs                 # schema + types + tests + build
 *   node scripts/verify.mjs --no-build      # sans le build (plus rapide)
 *   node scripts/verify.mjs --api=https://votre-domaine.example
 *
 * Le dernier mode ajoute un audit de l'API deployee : sante, protection des
 * endpoints sans session et en-tetes de securite. Aucune ecriture n'est faite.
 */
import { spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const skipBuild = argv.includes("--no-build");
const apiArg = argv.find((arg) => arg.startsWith("--api="));
const apiUrl = (apiArg ? apiArg.slice(6) : process.env.FDM_API_URL ?? "").replace(/\/$/, "");

const results = [];

function run(label, command, args) {
  process.stdout.write(`\n▶ ${label}\n`);
  const started = Date.now();
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      // `prisma validate` exige une URL, sans se connecter.
      DATABASE_URL: process.env.DATABASE_URL ?? "mysql://user@localhost:3306/fdm",
    },
  });
  const ok = result.status === 0;
  results.push({ label, ok, ms: Date.now() - started });
  return ok;
}

async function probe(label, path, expected) {
  const started = Date.now();
  try {
    const response = await fetch(`${apiUrl}${path}`, { redirect: "manual" });
    const ok = expected.includes(response.status);
    results.push({
      label: `${label} (${path} → ${response.status}, attendu ${expected.join("/")})`,
      ok,
      ms: Date.now() - started,
    });
    return ok;
  } catch (error) {
    results.push({ label: `${label} (${path} → ${error.message})`, ok: false, ms: Date.now() - started });
    return false;
  }
}

async function apiAudit() {
  process.stdout.write(`\n▶ Audit de l'API ${apiUrl}\n`);
  await probe("Sante", "/api/health", [200]);

  const guarded = [
    "/api/tasks",
    "/api/bugs",
    "/api/users",
    "/api/settings",
    "/api/audit-logs",
    "/api/infrastructure",
    "/api/notifications",
    "/api/knowledge",
    "/api/maintenance",
    "/api/players",
    "/api/events",
    "/api/studio",
  ];
  for (const endpoint of guarded) {
    await probe("Endpoint protege", endpoint, [401]);
  }

  const page = await fetch(`${apiUrl}/dashboard`, { redirect: "manual" });
  results.push({
    label: `Page protegee (/dashboard → ${page.status}, attendu 307)`,
    ok: page.status === 307,
    ms: 0,
  });

  const headers = await fetch(`${apiUrl}/login`);
  const csp = headers.headers.get("content-security-policy") ?? "";
  results.push({
    label: "En-tete CSP present",
    ok: csp.includes("default-src") && csp.includes("frame-ancestors"),
    ms: 0,
  });
  results.push({
    label: "En-tete X-Frame-Options present",
    ok: Boolean(headers.headers.get("x-frame-options")),
    ms: 0,
  });
}

function summary() {
  const pad = Math.max(...results.map((item) => item.label.length), 10);
  process.stdout.write("\n================ VERIFICATION ================\n");
  for (const item of results) {
    const mark = item.ok ? "OK  " : "ECHEC";
    process.stdout.write(`${mark}  ${item.label.padEnd(pad)}  ${(item.ms / 1000).toFixed(1)}s\n`);
  }
  const failed = results.filter((item) => !item.ok);
  process.stdout.write("=============================================\n");
  process.stdout.write(
    `${results.length - failed.length}/${results.length} verifications reussies\n`,
  );
  return failed.length === 0;
}

const schemaOk = run("Schema Prisma", "npx", ["prisma", "validate"]);
const typesOk = schemaOk && run("TypeScript", "npx", ["tsc", "--noEmit"]);
const testsOk = typesOk && run("Tests unitaires", "npm", ["test"]);
const buildOk = testsOk && (skipBuild || run("Build production", "npm", ["run", "build"]));

if (apiUrl) await apiAudit();

const ok = summary();
process.exit(ok && buildOk ? 0 : 1);
