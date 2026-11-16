/**
 * Client Keygate - licence BL-Host.
 *
 * Communique avec l'API licence de Keygate (https://keygate.app/docs/api) :
 *   POST /api/v1/license/activate    - enregistre un appareil / utilisateur
 *   POST /api/v1/license/verify      - controle l'autorisation + token frais
 *   POST /api/v1/license/deactivate  - libere un slot d'appareil
 *
 * Aucune cle d'API n'est requise : la cle de licence est elle-meme le
 * credential. Le token retourne par activate/verify est signe Ed25519 et
 * permet une verification hors-ligne (readToken).
 *
 * Utilisation (site web ou bot Discord) :
 *   const { activate, verify, deactivate } = require("./keygate");
 *   const data = await verify("mon-identifiant-stable");
 */
require("dotenv").config();
const os = require("node:os");
const { createPublicKey, verify: edVerify } = require("node:crypto");

const REQUEST_TIMEOUT_MS = 10_000;

// Lisons l'env a chaque appel : le gate peut etre configure avant ou apres
// le chargement du module (et un meme process sert le site + le bot).
function baseUrl() {
  return String(process.env.KEYGATE_URL || "").replace(/\/+$/, "");
}

function licenseKey() {
  return process.env.LICENSE_KEY;
}

/** Erreur portant le code Keygate (LICENSE_NOT_FOUND, ACTIVATION_LIMIT, ...). */
class LicenseError extends Error {
  constructor(code, { status = 0, details = null, retryAfter = null, message } = {}) {
    super(message || code || "LICENSE_ERROR");
    this.name = "LicenseError";
    this.code = code || "LICENSE_ERROR";
    this.status = status;
    this.details = details;
    this.retryAfter = retryAfter;
  }
}

function requireConfig() {
  if (!baseUrl()) throw new LicenseError("CONFIG_MISSING", { message: "KEYGATE_URL manquant dans .env" });
  if (!licenseKey()) throw new LicenseError("CONFIG_MISSING", { message: "LICENSE_KEY manquant dans .env" });
}

async function licenseRequest(action, identifier, { label, idempotencyKey } = {}) {
  requireConfig();

  const id = String(identifier ?? "").trim();
  if (!id) throw new LicenseError("INVALID_IDENTIFIER", { message: "identifier vide" });
  if (id.length > 256) throw new LicenseError("INVALID_IDENTIFIER", { message: "identifier > 256 octets" });

  const body = { license_key: licenseKey(), identifier: id };
  // `label` n'est accepte que par activate (256 caracteres max).
  if (action === "activate" && label) body.label = String(label).slice(0, 256);

  const headers = { "Content-Type": "application/json" };
  if (action === "activate" && idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  let response;
  try {
    response = await fetch(`${baseUrl()}/api/v1/license/${action}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new LicenseError("NETWORK_ERROR", {
      message: `Keygate injoignable: ${error && error.message ? error.message : error}`,
    });
  }

  let result = null;
  try {
    result = await response.json();
  } catch {
    throw new LicenseError("BAD_RESPONSE", { status: response.status, message: "Reponse non-JSON de Keygate" });
  }

  // Enveloppe officielle : { success, data } ou { success:false, error:{code} }.
  if (!response.ok || !result.success) {
    const err = result && result.error ? result.error : {};
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new LicenseError(err.code || "LICENSE_ERROR", {
      status: response.status,
      details: result && result.details ? result.details : err.details || null,
      retryAfter: Number.isFinite(retryAfter) ? retryAfter : null,
      message: err.message,
    });
  }

  return result.data;
}

/** Enregistre cet appareil. Re-appele sur un appareil deja actif : repond
 *  `already_activated` sans consommer un slot (safe a rappeler). */
function activate(identifier, options = {}) {
  return licenseRequest("activate", identifier, options);
}

/** Verifie la licence et obtient un token hors-ligne frais.
 *  Repond 404 LICENSE_NOT_FOUND pour toute licence inutilisable ici. */
function verify(identifier, options = {}) {
  return licenseRequest("verify", identifier, options);
}

/** Libere le slot de l'appareil (a appeler avant de changer de machine). */
function deactivate(identifier, options = {}) {
  return licenseRequest("deactivate", identifier, options);
}

// ---------------------------------------------------------------------------
// Verification hors-ligne du token Ed25519
// ---------------------------------------------------------------------------

let cachedPubkeyHex = process.env.KEYGATE_PUBKEY || null;

/** Recupere (et met en cache) la cle publique de signature de Keygate. */
async function getPubkey() {
  if (cachedPubkeyHex) return cachedPubkeyHex;
  const response = await fetch(`${baseUrl()}/api/v1/license/pubkey`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const result = await response.json();
  if (!response.ok || !result.success || !result.data || !result.data.public_key) {
    throw new LicenseError("PUBKEY_UNAVAILABLE", { status: response.status });
  }
  cachedPubkeyHex = result.data.public_key;
  return cachedPubkeyHex;
}

function toEd25519PublicKey(publicKeyHex) {
  // Enveloppe DER SPKI attendue par Node pour une cle Ed25519 brute.
  return createPublicKey({
    key: Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      Buffer.from(publicKeyHex, "hex"),
    ]),
    format: "der",
    type: "spki",
  });
}

/**
 * Verifie un token hors-ligne. Retourne les claims (lid, sts, did, ftr, exp,
 * vun, ...) ou null si la signature est invalide ou si le token a ete emis
 * pour un autre identifiant.
 *
 * `publicKeyHex` est optionnel : sans lui, la cle est recuperee sur le
 * serveur (GET /api/v1/license/pubkey) et mise en cache.
 */
async function readToken(token, identifier, publicKeyHex) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const resolved = publicKeyHex || (await getPubkey());

  const [payload, signature] = token.split(".");
  const publicKey = toEd25519PublicKey(resolved);
  const valid = edVerify(
    null,
    Buffer.from(payload),
    publicKey,
    Buffer.from(signature, "base64url"),
  );
  if (!valid) return null;

  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (claims.did !== String(identifier).trim()) return null; // token d'un autre appareil
  return claims;
}

module.exports = { activate, verify, deactivate, licenseRequest, getPubkey, readToken, LicenseError };

// ---------------------------------------------------------------------------
// Mini CLI pour tester une vraie licence depuis un terminal :
//   node keygate.js verify [identifiant]
//   node keygate.js activate [identifiant] [label]
//   node keygate.js deactivate [identifiant]
// (l'identifiant par defaut est le nom de la machine)
// ---------------------------------------------------------------------------
if (require.main === module) {
  const [action, identifier = os.hostname(), label] = process.argv.slice(2);
  if (!["activate", "verify", "deactivate"].includes(action)) {
    console.error("Usage: node keygate.js <activate|verify|deactivate> [identifiant] [label]");
    process.exit(1);
  }
  licenseRequest(action, identifier, { label })
    .then((data) => console.log(JSON.stringify({ success: true, data }, null, 2)))
    .catch((error) => {
      console.error(JSON.stringify({ success: false, code: error.code, status: error.status, details: error.details, message: error.message }, null, 2));
      process.exit(1);
    });
}
