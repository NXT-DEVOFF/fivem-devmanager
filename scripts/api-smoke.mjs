#!/usr/bin/env node
/**
 * Smoke test non destructif de toutes les routes API.
 *
 *   API_BASE_URL=http://127.0.0.1:3101 node scripts/api-smoke.mjs
 *
 * - decouvre automatiquement les fichiers src/app/api/.../route.ts
 * - teste chaque methode exportee sans session
 * - verifie les routes publiques, le CSRF, les en-tetes et les 404
 * - ne realise aucune ecriture metier : les mutations sans session doivent
 *   etre refusees avant d'atteindre la base.
 */
import fs from "node:fs";
import path from "node:path";

const baseUrl = (process.env.API_BASE_URL ?? "http://127.0.0.1:3101").replace(/\/$/, "");
const root = process.cwd();
const apiRoot = path.join(root, "src", "app", "api");

function walkRoutes(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walkRoutes(full, output);
    else if (entry.name === "route.ts") output.push(full);
  }
  return output;
}

function methodsFor(source) {
  const methods = new Set();
  for (const match of source.matchAll(/export const (GET|POST|PUT|PATCH|DELETE|HEAD)\b/g)) {
    methods.add(match[1]);
  }
  for (const match of source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE|HEAD)\b/g)) {
    methods.add(match[1]);
  }
  return [...methods];
}

const routes = walkRoutes(apiRoot)
  .map((file) => {
    const relative = path.relative(apiRoot, file).split(path.sep).join("/");
    const route = `/api/${relative.replace(/\/route\.ts$/, "")}`;
    return { file, route, methods: methodsFor(fs.readFileSync(file, "utf8")) };
  })
  .sort((a, b) => a.route.localeCompare(b.route));

const cases = routes.flatMap((route) =>
  route.methods.map((method) => {
    let url = route.route.replace(/\[[^\]]+\]/g, "smoke-test");
    if (url === "/api/files/download") url += "?path=smoke-test.lua";
    return { method, route: url };
  }),
);

const publicExpectations = new Map([
  ["GET /api/health", [200, 503]],
  ["HEAD /api/health", [200, 503]],
  ["GET /api/readyz", [200, 503]],
  ["HEAD /api/readyz", [200, 503]],
  ["GET /api/auth/me", [200]],
  ["POST /api/auth/logout", [200]],
  ["POST /api/auth/login", [400]],
  ["POST /api/anticheat/ingest", [401, 503]],
  ["POST /api/anticheat/heartbeat", [401, 503]],
]);

const failures = [];
const warnings = [];
let tested = 0;
let requests = 0;

function bodyFor(method, route) {
  if (method === "GET" || method === "HEAD") return undefined;
  if (method === "DELETE") return undefined;
  return "{}";
}

async function probe(entry) {
  const key = `${entry.method} ${entry.route.split("?")[0]}`;
  const expected = publicExpectations.get(key);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const started = Date.now();

  try {
    const response = await fetch(`${baseUrl}${entry.route}`, {
      method: entry.method,
      headers: {
        Accept: "application/json",
        ...(bodyFor(entry.method, entry.route) !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      ...(bodyFor(entry.method, entry.route) !== undefined
        ? { body: bodyFor(entry.method, entry.route) }
        : {}),
      redirect: "manual",
      signal: controller.signal,
    });
    const elapsed = Date.now() - started;
    const contentType = response.headers.get("content-type") ?? "";
    const text = entry.method === "HEAD" ? "" : await response.text();
    const status = response.status;
    tested += 1;
    requests += 1;

    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    if (expected) {
      if (!expected.includes(status)) {
        failures.push({
          ...entry,
          reason: `statut ${status}, attendu ${expected.join("/")}`,
          elapsed,
          body: text.slice(0, 300),
        });
      }
      return;
    }

    // Toute route non publique doit refuser une requete sans session.
    const accepted = new Set([400, 401, 403, 404, 405, 409, 422, 429, 502, 503]);
    if (!accepted.has(status)) {
      failures.push({
        ...entry,
        reason: `route non publique accessible sans session (statut ${status})`,
        elapsed,
        body: text.slice(0, 300),
      });
      return;
    }
    if ([401, 403].includes(status) && !json) {
      warnings.push({
        ...entry,
        reason: `refus ${status} sans corps JSON`,
      });
    }
    if (status >= 500) {
      warnings.push({
        ...entry,
        reason: `dependance externe indisponible (${status})`,
      });
    }
    if (contentType && !contentType.includes("application/json") && text) {
      warnings.push({
        ...entry,
        reason: `content-type inattendu: ${contentType}`,
      });
    }
  } catch (error) {
    failures.push({
      ...entry,
      reason: `reseau/timeout: ${error instanceof Error ? error.message : String(error)}`,
      elapsed: Date.now() - started,
      body: "",
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function securityChecks() {
  // CSRF : une origine etrangere doit etre refusee avant toute action.
  requests += 1;
  const csrf = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
    body: "{}",
  });
  if (csrf.status !== 403) {
    failures.push({
      method: "POST",
      route: "/api/auth/logout (origine etrangere)",
      reason: `CSRF non bloque (statut ${csrf.status})`,
      body: (await csrf.text()).slice(0, 300),
    });
  }

  // Referer malforme : doit aussi etre rejete proprement.
  requests += 1;
  const badReferer = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Referer: "http://[invalid", "Content-Type": "application/json" },
    body: "{}",
  });
  if (badReferer.status !== 403) {
    failures.push({
      method: "POST",
      route: "/api/auth/logout (Referer invalide)",
      reason: `Referer malforme non bloque (statut ${badReferer.status})`,
      body: (await badReferer.text()).slice(0, 300),
    });
  }

  // En-tetes des reponses API.
  requests += 1;
  const me = await fetch(`${baseUrl}/api/auth/me`);
  const headers = me.headers;
  if (!headers.get("x-request-id")) {
    failures.push({
      method: "GET",
      route: "/api/auth/me",
      reason: "en-tete X-Request-Id absent",
    });
  }
  if ((headers.get("cache-control") ?? "") !== "no-store") {
    failures.push({
      method: "GET",
      route: "/api/auth/me",
      reason: "Cache-Control no-store absent",
    });
  }

  // En-tetes de securite de la page de connexion.
  requests += 1;
  const login = await fetch(`${baseUrl}/login`, { redirect: "manual" });
  const csp = login.headers.get("content-security-policy") ?? "";
  if (!csp.includes("default-src") || !csp.includes("frame-ancestors")) {
    failures.push({ method: "GET", route: "/login", reason: "CSP incomplete ou absente" });
  }
  if (!login.headers.get("x-frame-options")) {
    failures.push({ method: "GET", route: "/login", reason: "X-Frame-Options absent" });
  }

  // Route inconnue.
  requests += 1;
  const missing = await fetch(`${baseUrl}/api/route-inexistante-smoke`, {
    redirect: "manual",
  });
  if (missing.status !== 404) {
    failures.push({
      method: "GET",
      route: "/api/route-inexistante-smoke",
      reason: `statut ${missing.status}, attendu 404`,
    });
  }
}

async function main() {
  console.log(`[api-smoke] ${routes.length} routes, ${cases.length} methodes sur ${baseUrl}`);

  const concurrency = 6;
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < cases.length) {
      const index = cursor;
      cursor += 1;
      await probe(cases[index]);
    }
  });
  await Promise.all(workers);
  await securityChecks();

  if (warnings.length > 0) {
    console.log(`\n[api-smoke] ${warnings.length} avertissement(s) :`);
    for (const warning of warnings.slice(0, 20)) {
      console.log(`  ! ${warning.method} ${warning.route} — ${warning.reason}`);
    }
  }

  if (failures.length > 0) {
    console.log(`\n[api-smoke] ${failures.length} echec(s) :`);
    for (const failure of failures) {
      console.log(`  x ${failure.method} ${failure.route} — ${failure.reason}`);
      if (failure.body) console.log(`    ${failure.body.replace(/\s+/g, " ").slice(0, 220)}`);
    }
    console.log(
      `\n[api-smoke] RESULTAT: ${tested}/${cases.length} methodes testees, ${failures.length} echec(s).`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `\n[api-smoke] RESULTAT: ${tested}/${cases.length} methodes testees, 0 echec, ${warnings.length} avertissement(s), ${requests} requetes.`,
  );
}

main().catch((error) => {
  console.error("[api-smoke] erreur fatale:", error);
  process.exitCode = 1;
});
