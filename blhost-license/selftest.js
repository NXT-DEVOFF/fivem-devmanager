/**
 * Auto-test du gate : demarre un Keygate simule (Ed25519 reel) et prouve
 * que le blocage fonctionne dans les deux sens.
 *
 *   node selftest.js     (ou : npm test)
 *
 * Scenarios couverts :
 *   1. licence valide            -> demarrage autorise (VERIFIED)
 *   2. token en cache, serveur KO -> demarrage autorise hors-ligne
 *   3. token expire <  grace, KO  -> demarrage autorise (GRACE)
 *   4. token expire >  grace, KO  -> BLOQUE
 *   5. token forge (signature)    -> BLOQUE (pas de grace)
 *   6. licence revoquee (404)     -> BLOQUE
 *   7. LICENSE_ENFORCE=true sans cle -> BLOQUE (NOT_CONFIGURED)
 *   8. sans config, auto          -> gate inactif (comportement dev conserve)
 */
const { generateKeyPairSync, sign } = require("node:crypto");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const IDENTIFIER = "selftest-machine";
const CACHE_PATH = path.join(os.tmpdir(), `keygate-selftest-${process.pid}.json`);
const SILENT = { info() {}, warn() {}, error() {} };

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const PUBKEY_HEX = publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("hex");

function makeToken(did, expSeconds) {
  const payload = Buffer.from(
    JSON.stringify({ lid: "lid-test", pid: "pid-test", pln: "pln-test", sts: "active", did, iat: Math.floor(Date.now() / 1000), exp: expSeconds, ftr: { export_pdf: true } }),
  ).toString("base64url");
  const signature = sign(null, payload, privateKey).toString("base64url");
  return `${payload}.${signature}`;
}

// Keygate simule : meme enveloppe { success, data } / { success:false, error }.
let mode = "ok"; // "ok" | "not_found"
const server = http.createServer((req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.method === "GET" && req.url === "/api/v1/license/pubkey") {
    return send(200, { success: true, data: { algorithm: "ed25519", format: "hex", public_key: PUBKEY_HEX } });
  }
  if (req.method === "POST" && req.url === "/api/v1/license/verify") {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      if (mode === "not_found") {
        return send(404, { success: false, error: { code: "LICENSE_NOT_FOUND", message: "license not found" } });
      }
      const body = JSON.parse(raw || "{}");
      return send(200, {
        success: true,
        data: { status: "active", plan_name: "Pro", features: { export_pdf: true }, token: makeToken(body.identifier, Math.floor(Date.now() / 1000) + 7 * 86400) },
      });
    });
    return undefined;
  }
  return send(404, { success: false, error: { code: "NOT_FOUND", message: "route inconnue" } });
});

let passed = 0;
let failed = 0;
function assert(condition, label) {
  if (condition) {
    passed += 1;
    console.log(`  [OK] ${label}`);
  } else {
    failed += 1;
    console.error(`  [ECHEC] ${label}`);
  }
}

function writeCache(overrides = {}) {
  const base = {
    token: makeToken(IDENTIFIER, Math.floor(Date.now() / 1000) + 7 * 86400),
    identifier: IDENTIFIER,
    pubkey: PUBKEY_HEX,
    savedAt: new Date().toISOString(),
  };
  fs.writeFileSync(CACHE_PATH, JSON.stringify({ ...base, ...overrides }));
}

async function main() {
  process.env.KEYGATE_URL = "http://127.0.0.1:0"; // remplace apres le listen
  process.env.LICENSE_KEY = process.env.LICENSE_KEY || "KG-SELFTEST-0000-TEST";
  process.env.LICENSE_ENFORCE = "true";
  process.env.LICENSE_GRACE_HOURS = "72";
  delete process.env.LICENSE_IDENTIFIER;

  const { checkLicense, enforceLicense, LicenseError } = require("./gate");
  const opts = { identifier: IDENTIFIER, cachePath: CACHE_PATH, logger: SILENT };

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.KEYGATE_URL = `http://127.0.0.1:${server.address().port}`;
  fs.rmSync(CACHE_PATH, { force: true });

  console.log("1. Licence valide (Keygate simulé en ligne)");
  mode = "ok";
  let r = await checkLicense(opts);
  assert(r.ok && r.reason === "VERIFIED" && r.source === "network", "demarrage autorise (VERIFIED)");
  assert(fs.existsSync(CACHE_PATH), "token mis en cache (.token.json)");

  console.log("2. Token en cache, Keygate eteint -> hors-ligne");
  await new Promise((resolve) => server.close(resolve));
  r = await checkLicense(opts);
  assert(r.ok && r.reason === "TOKEN_VALID" && r.source === "cache", "demarrage autorise sans reseau");

  console.log("3. Token expire depuis 1h (< grace 72h), Keygate eteint");
  writeCache({ token: makeToken(IDENTIFIER, Math.floor(Date.now() / 1000) - 3600) });
  r = await checkLicense(opts);
  assert(r.ok && r.reason === "GRACE", "demarrage autorise pendant la grace");

  console.log("4. Token expire depuis 100h (> grace), Keygate eteint");
  writeCache({ token: makeToken(IDENTIFIER, Math.floor(Date.now() / 1000) - 100 * 3600) });
  r = await checkLicense(opts);
  assert(!r.ok && r.temporary, "BLOQUE (hors grace, reseau indisponible)");

  console.log("5. Token forge (mauvaise signature), Keygate eteint");
  const forged = makeToken(IDENTIFIER, Math.floor(Date.now() / 1000) + 7 * 86400).split(".");
  forged[1] = Buffer.from("0".repeat(128), "hex").toString("base64url");
  writeCache({ token: forged.join(".") });
  r = await checkLicense(opts);
  assert(!r.ok, "BLOQUE (signature invalide = pas de grace)");

  console.log("6. Licence revoquee (404 LICENSE_NOT_FOUND)");
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.KEYGATE_URL = `http://127.0.0.1:${server.address().port}`;
  mode = "not_found";
  fs.rmSync(CACHE_PATH, { force: true });
  r = await checkLicense(opts);
  assert(!r.ok && r.reason === "LICENSE_NOT_FOUND" && !r.temporary, "BLOQUE (pas de grace sur une reponse serveur)");

  let threw = false;
  try {
    await enforceLicense({ ...opts, exit: false });
  } catch (error) {
    threw = error instanceof LicenseError && error.code === "LICENSE_NOT_FOUND";
  }
  assert(threw, "enforceLicense leve LicenseError (exit:false)");

  console.log("7. LICENSE_ENFORCE=true sans cle configuree");
  const savedKey = process.env.LICENSE_KEY;
  delete process.env.LICENSE_KEY;
  r = await checkLicense(opts);
  assert(!r.ok && r.reason === "NOT_CONFIGURED", "BLOQUE (NOT_CONFIGURED)");
  process.env.LICENSE_KEY = savedKey;

  console.log("8. Sans config, mode auto (dev conserve)");
  delete process.env.LICENSE_KEY;
  delete process.env.KEYGATE_URL;
  delete process.env.LICENSE_ENFORCE;
  r = await checkLicense({ ...opts, enforce: undefined });
  assert(r.ok && r.enforced === false && r.reason === "NOT_CONFIGURED", "gate inactif sans licence configuree");

  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(CACHE_PATH, { force: true });

  console.log(`\n${passed} reussite(s), ${failed} echec(s)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("selftest en erreur:", error);
  process.exit(1);
});
