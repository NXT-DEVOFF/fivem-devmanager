/**
 * Gate de licence Keygate - blocage reel, partage site web + bot Discord.
 *
 * Principe (voir https://keygate.app/docs/license-activation) :
 *   1. Au demarrage : verification obligatoire. Pas de licence valide =>
 *      le process ne demarre pas (process.exit(1)) ou leve LicenseError.
 *   2. Token hors-ligne : le token Ed25519 recu par verify est mis en cache
 *      (.token.json). Tant qu'il est valide, aucun reseau n'est necessaire.
 *   3. Panne Keygate : si le token signe existe encore (fenetre de grace
 *      LICENSE_GRACE_HOURS, 72h par defaut), le service continue avec un
 *      avertissement - les pannes reseau ne sont pas des pirates.
 *   4. Pendant l'execution : startLicenseWatch() re-verifie periodiquement.
 *      Licence revoquee/expiree => onRevoked() (arret du site / du bot).
 *
 * Variables .env :
 *   KEYGATE_URL, LICENSE_KEY        requis pour activer le gate
 *   LICENSE_IDENTIFIER              optionnel (defaut : nom de machine)
 *   LICENSE_ENFORCE                 true | false | absent (= auto :
 *                                  bloque seulement si LICENSE_KEY existe)
 *   LICENSE_GRACE_HOURS             duree de tolerance hors-ligne (def. 72)
 *   LICENSE_CHECK_INTERVAL_MINUTES  periode du watch (defaut 60)
 *   KEYGATE_PUBKEY                  optionnel, sinon recuperee et cachee
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { verify, getPubkey, readToken, LicenseError } = require("./keygate");

const DEFAULT_CACHE_PATH = path.join(__dirname, ".token.json");

// Codes temporaires : reseau, serveur ou rate-limit. On ne coupe pas tout
// de suite, on re-tente au prochain intervalle (ou on utilise la grace).
const TEMPORARY_CODES = new Set(["NETWORK_ERROR", "BAD_RESPONSE", "LOCKED_OUT", "PUBKEY_UNAVAILABLE"]);

function resolveEnforce(explicit) {
  if (typeof explicit === "boolean") return explicit;
  const env = String(process.env.LICENSE_ENFORCE || "").toLowerCase();
  if (env === "true" || env === "1") return true;
  if (env === "false" || env === "0") return false;
  return "auto"; // bloque uniquement si une licence est configuree
}

function graceMs() {
  const hours = Number(process.env.LICENSE_GRACE_HOURS);
  return (Number.isFinite(hours) && hours >= 0 ? hours : 72) * 3_600_000;
}

function resolveIdentifier(explicit) {
  return String(explicit || process.env.LICENSE_IDENTIFIER || os.hostname()).trim();
}

function loadCache(cachePath, identifier) {
  try {
    const raw = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    if (!raw || typeof raw.token !== "string") return null;
    if (raw.identifier !== identifier) return null; // cache d'une autre machine
    return raw;
  } catch {
    return null;
  }
}

function saveCache(cachePath, data) {
  try {
          const tmp = `${cachePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
      try {
        fs.chmodSync(tmp, 0o600);
      } catch {
        // Windows ne gère pas les modes POSIX.
      }
      fs.renameSync(tmp, cachePath); // ecriture atomique
  } catch (error) {
    // Lecture seule : on continuera en ligne a chaque demarrage.
    console.warn("[license] cache de token non ecrit:", error.message);
  }
}

/** Claims du cache si la signature Ed25519 est valide, sinon null. */
async function claimsFromCache(cache, identifier, pubkeyHex) {
  if (!cache || !pubkeyHex) return null;
  try {
    return await readToken(cache.token, identifier, pubkeyHex);
  } catch {
    return null;
  }
}

/**
 * Verifie la licence. Retourne :
 *   { ok: true,  reason, source: "cache"|"network", claims?, data?, enforced }
 *   { ok: false, reason, message, temporary, enforced }
 */
async function checkLicense(options = {}) {
  const identifier = resolveIdentifier(options.identifier);
  const cachePath = options.cachePath || DEFAULT_CACHE_PATH;
  const enforce = resolveEnforce(options.enforce);
  const log = options.logger || console;

  const configured = Boolean(process.env.KEYGATE_URL && process.env.LICENSE_KEY);
  const mustBlock = enforce === true || (enforce === "auto" && configured);

  if (!configured) {
    if (mustBlock) {
      return {
        ok: false,
        enforced: true,
        reason: "NOT_CONFIGURED",
        temporary: false,
        message: "KEYGATE_URL / LICENSE_KEY manquants dans .env (LICENSE_ENFORCE=true)",
        identifier,
      };
    }
    log.warn?.("[license] aucune licence configuree - gate inactif (LICENSE_ENFORCE=true pour forcer)");
    return { ok: true, enforced: false, reason: "NOT_CONFIGURED", identifier };
  }

  const cache = loadCache(cachePath, identifier);
  const pubkey = process.env.KEYGATE_PUBKEY || (cache && cache.pubkey) || null;

  // 1) Token hors-ligne encore dans sa fenetre de check-in : aucun reseau.
  if (cache) {
    const claims = await claimsFromCache(cache, identifier, pubkey);
    if (claims && claims.exp * 1000 > Date.now()) {
      return { ok: true, enforced: true, reason: "TOKEN_VALID", source: "cache", claims, identifier };
    }
  }

  // 2) Verification reseau (verify renvoie un token frais).
  try {
    const data = await verify(identifier);
    let usedPubkey = pubkey;
    if (data && data.token && !usedPubkey) {
      usedPubkey = await getPubkey().catch(() => null);
    }
    if (data && data.token) {
      saveCache(cachePath, {
        token: data.token,
        identifier,
        pubkey: usedPubkey,
        savedAt: new Date().toISOString(),
      });
    }
    return { ok: true, enforced: true, reason: "VERIFIED", source: "network", data, identifier };
  } catch (error) {
    const code = error && error.code ? error.code : "UNKNOWN";
    const temporary = TEMPORARY_CODES.has(code) || (Number(error && error.status) >= 500);

    // 3) Keygate injoignable : le cache signe fait foi pendant la grace.
    if (temporary && cache) {
      const claims = await claimsFromCache(cache, identifier, pubkey);
      const expiredSince = claims ? Date.now() - claims.exp * 1000 : Infinity;
      if (claims && expiredSince < graceMs()) {
        const left = Math.round((graceMs() - expiredSince) / 3_600_000);
        log.warn?.(
          `[license] Keygate inaccessible (${code}) - licence maintenue par le cache (plus que ~${left}h de grace)`,
        );
        return { ok: true, enforced: true, reason: "GRACE", source: "cache", claims, identifier };
      }
    }

    return {
      ok: false,
      enforced: true,
      reason: code,
      temporary,
      message: (error && error.message) || code,
      details: (error && error.details) || null,
      identifier,
    };
  }
}

/**
 * Blocage au demarrage : log + process.exit(1) si la licence est invalide.
 * options.exit = false => leve LicenseError au lieu de quitter (pour tests).
 * Retourne le resultat de checkLicense quand c'est valide.
 */
async function enforceLicense(options = {}) {
  const result = await checkLicense(options);
  const log = options.logger || console;

  if (result.ok) {
    if (result.enforced) {
      log.info?.(
        `[license] licence valide (${result.reason}${result.source ? `, ${result.source}` : ""}) - ${result.identifier}`,
      );
    }
    return result;
  }

  log.error(`[license] BLOQUE - ${result.reason}: ${result.message || ""}`);
  if (options.exit !== false) process.exit(1);
  throw new LicenseError(result.reason, { message: result.message, details: result.details });
}

/**
 * Re-verification periodique pendant l'execution.
 * - resultat invalide definitif  -> onRevoked(result) (arret du service)
 * - resultat invalide temporaire -> warning, re-tentative au prochain tour
 * Retourne une fonction d'arret du timer.
 */
function startLicenseWatch(options = {}) {
  const minutes = Math.max(
    1,
    Number(options.intervalMinutes || process.env.LICENSE_CHECK_INTERVAL_MINUTES) || 60,
  );
  const log = options.logger || console;

  const timer = setInterval(async () => {
    try {
      const result = await checkLicense(options);
      if (result.ok) return;
      if (result.temporary) {
        log.warn?.(
          `[license] verification impossible (${result.reason}) - nouvelle tentative dans ${minutes} min`,
        );
        return;
      }
      log.error(`[license] licence invalide (${result.reason}) - arret du service demande`);
      if (typeof options.onRevoked === "function") options.onRevoked(result);
    } catch (error) {
      log.error("[license] erreur pendant la re-verification:", error);
    }
  }, minutes * 60_000);

  // Ne pas empecher la fin de process (utile pour les scripts).
  if (typeof timer.unref === "function") timer.unref();
  log.info?.(`[license] surveillance active toutes les ${minutes} min`);
  return () => clearInterval(timer);
}

module.exports = { checkLicense, enforceLicense, startLicenseWatch, LicenseError };
