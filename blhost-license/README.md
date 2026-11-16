# blhost-license

Client [Keygate](https://keygate.app/docs) partagé entre le **site web** (FiveM DevManager) et le **bot Discord** : activation, vérification et blocage réel des licences.

> **Édition commerciale uniquement.** La Community Edition de FiveM DevManager
> est distribuée sous AGPL-3.0 et doit pouvoir tourner sans `LICENSE_KEY` ni
> gate actif. Le gate est un composant de l'offre Self-hosted Commercial ; il
> ne constitue pas une restriction ajoutée à la licence AGPL. Voir
> [docs/LICENSING.md](../docs/LICENSING.md).

## Fichiers

| Fichier | Rôle |
|---|---|
| `keygate.js` | Client API : `activate`, `verify`, `deactivate` + vérification hors-ligne `readToken` (Ed25519) |
| `gate.js` | **Blocage** : `enforceLicense()` au démarrage, `startLicenseWatch()` en continu |
| `bot-gate.example.js` | Exemple d'intégration dans un bot discord.js |
| `selftest.js` | Auto-test : prouve chaque scénario de blocage (Keygate simulé) |

## Installation

```bash
cd blhost-license
npm install          # installe dotenv
cp .env.example .env # puis remplir KEYGATE_URL, LICENSE_KEY...
npm test             # 10 vérifications, prouve que le blocage marche
```

Côté site, les mêmes variables s'ajoutent dans le `.env` **racine** du projet (le site ne lit pas `blhost-license/.env`).

## Configuration (.env)

```env
KEYGATE_URL=https://licences.bl-host.site   # install Keygate
LICENSE_KEY=KG-XXXX-XXXX-XXXX-XXXX          # cle du produit
LICENSE_IDENTIFIER=                          # defaut : nom de machine
LICENSE_ENFORCE=true                         # defaut : auto (bloque si cle presente)
LICENSE_GRACE_HOURS=72                       # tolerance hors-ligne
LICENSE_CHECK_INTERVAL_MINUTES=60            # periode du watch
KEYGATE_PUBKEY=                              # optionnel, sinon recuperee
```

## Blocage côté site

`server.mjs` appelle `enforceLicense()` **avant** toute écoute HTTP :

- licence invalide → `[license] BLOQUE - ...` puis `process.exit(1)` : rien n'est servi ;
- valide → le serveur démarre, puis `startLicenseWatch()` re-vérifie toutes les heures ;
- révocation en cours de vie → arrêt gracieux du serveur.

## Blocage côté bot

Copie `bot-gate.example.js` dans ton bot :

```js
const { enforceLicense, startLicenseWatch } = require("./gate");

await enforceLicense();              // exit(1) si invalide -> le bot ne se connecte pas
// ... creation du client, login ...
startLicenseWatch({ onRevoked: async () => { client.destroy(); process.exit(1); } });
```

## Comportement du gate

| Situation | Résultat |
|---|---|
| Licence valide en ligne | ✅ démarrage (`VERIFIED`), token mis en cache |
| Keygate coupé, token encore valide | ✅ démarrage hors-ligne (`TOKEN_VALID`) |
| Token expiré < `LICENSE_GRACE_HOURS`, Keygate coupé | ✅ démarrage (`GRACE`) + warning |
| Token expiré > grâce, Keygate coupé | ❌ **bloqué** |
| Token falsifié (signature invalide) | ❌ **bloqué** (aucune grâce) |
| `404 LICENSE_NOT_FOUND` / révoquée / expirée | ❌ **bloqué** (aucune grâce) |
| `LICENSE_ENFORCE=true` sans `LICENSE_KEY` | ❌ **bloqué** (`NOT_CONFIGURED`) |
| Aucune configuration, mode auto | ⚪ gate inactif (dev conservé) |

Le token est signé **Ed25519** : il est vérifié localement (clé de `GET /api/v1/license/pubkey`, mise en cache), jamais simplement cru sur parole.

## CLI utile

```bash
node keygate.js activate "mon-serveur" "Bot Discord BL-Host"
node keygate.js verify "mon-serveur"
node keygate.js deactivate "mon-serveur"
```

## Notes

- L'`identifier` doit rester **stable** (une machine = toujours le même) : par défaut c'est le nom de machine, surridable avec `LICENSE_IDENTIFIER`.
- `.token.json` (cache du token) est gitignoré : ne jamais le committer.
- Échec de `verify` = `404 LICENSE_NOT_FOUND` dans tous les cas (clé fausse ou licence révocquée) : redemander la clé à l'utilisateur.
