# fdm-anticheat (v2)

Agent anticheat **server-authoritative** pour FiveM, inspire des modules
d'Electron AC. Mode **rapport** par defaut : aucune punition automatique.

- Aucune ressource cliente, aucune DLL, aucune injection memoire.
- Le token d'ingestion reste sur le serveur (convar), jamais envoye au client.
- Evenements envoyes par lots, avec retry et backoff exponentiel.
- **File persistante** `queue.json` : les alertes survivent a un redemarrage.
- **Heartbeat** toutes les 60 s : le dashboard affiche l'etat de l'agent.
- **Bans persistants** `bans.json`, verifies a la connexion (deferrals).
- **Menu admin** `/fdmac` : joueurs, bans, kick, ban, warn, whitelist, test.
- Bypass par module, compatible avec les ACE d'Electron (`Bypass.antiX`).

## Installation

1. Copiez le dossier `fdm-anticheat` dans `resources/`.
2. Generez un token (sur la machine du panel) :

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

3. Renseignez `ANTICHEAT_INGEST_TOKEN` dans le `.env` du panel avec cette valeur,
   puis redemarrez le panel.
4. Ajoutez ceci dans `server.cfg` **avant** le `ensure` :

   ```cfg
   set fdm_anticheat_endpoint "https://votre-panel.example.com/api/anticheat/ingest"
   set fdm_anticheat_token "LE_MEME_TOKEN_QUE_LE_PANEL"
   set fdm_anticheat_server_id "mon-serveur"
   set fdm_anticheat_flush_interval "5000"

   add_ace group.admin fdm.anticheat.admin allow

   ensure fdm-anticheat
   ```

5. Redemarrez le serveur, puis tapez `fdmac test` dans la console.
   L'evenement doit apparaitre dans `/anticheat` sous 30 secondes.

## Modules de detection

Chaque module est active par defaut et peut etre regle dans `config.lua` :

| Module | Detection | Severite | Declencheur |
|---|---|---|---|
| `antiExplosion` | `explosion_spam`, `explosion_abnormal_scale` | HIGH | Rafale d'explosions / `damageScale` anormal |
| `antiProjectile` | `projectile_spam` | MEDIUM | Rafale de projectiles |
| `antiEntitySpam` | `entity_spam` | MEDIUM | Creation massive d'entites |
| `antiVehicle` | `vehicle_spawn_spam` | HIGH | Spawn massif de vehicules |
| `antiWeaponDamage` | `weapon_damage_anomaly`, `weapon_damage_spam` | MEDIUM | Degats par impact / cadence anormale |
| `antiGodmode` | `godmode_suspected` | CRITICAL | Degats ignores ou `willKill` sans degats |
| `antiTeleport` | `teleport_anomaly` | HIGH | Ecart de position anormal entre mesures |
| `antiSpeed` | `speed_anomaly` | MEDIUM | Vitesse serveur au-dela du seuil |
| `antiNoclip` | `noclip_suspected` | HIGH | Vitesse verticale / au sol anormale |
| `antiSuperJump` | `superjump_suspected` | MEDIUM | Vitesse verticale excessive a pied |
| `antiIllegalWeapon` | `illegal_weapon` | HIGH | Arme bloquee ou hors liste blanche |
| `antiIllegalEntity` | `illegal_entity` | HIGH | Modele bloque (vehicule, ped, objet) |
| `antiClearTasks` | `clear_tasks_spam` | MEDIUM | Rafale de `clearPedTasksEvent` |
| `antiPTFX` | `ptfx_spam` | MEDIUM | Rafale d'effets de particules |
| `antiSyncedScene` | `synced_scene_spam` | MEDIUM | Rafale de scenes synchronisees |
| `antiFire` | `fire_spam` | MEDIUM | Rafale d'evenements de feu |

Chaque detection est limitee a **un rapport toutes les 5 secondes** par joueur
et par type. Le panel agrege ensuite les alertes ouvertes de meme type et de
meme joueur sur 10 minutes (`occurrences`).

## Bypass et exemptions

```cfg
# Exemption globale (deconseille hors comptes de confiance)
add_ace group.admin fdm.anticheat.exempt allow

# Exemption d'un seul module (compatible Electron)
add_ace group.admin fdm.anticheat.bypass.antiNoclip allow
add_ace identifier.discord:123456789012345678 Bypass.antiNoclip allow
```

En jeu, un admin peut accorder un bypass temporaire jusqu'a la deconnexion :

```text
/fdmac whitelist <id> antiTeleport
/fdmac unwhitelist <id> antiTeleport
```

## Menu admin

Commande reservee a la console et aux joueurs disposant de
`fdm.anticheat.admin` :

| Commande | Effet |
|---|---|
| `/fdmac status` | Etat de l'agent, modules, file, bans |
| `/fdmac players` | Joueurs en ligne (id, licence, vie, ping) |
| `/fdmac bans` | Liste des bans |
| `/fdmac ban <id> <raison>` | Bannit le joueur (licence, Discord, IP, identifiants) |
| `/fdmac unban <banId\|license>` | Supprime un ban |
| `/fdmac kick <id> <raison>` | Expulse le joueur |
| `/fdmac warn <id> <raison>` | Enregistre un avertissement dans le panel |
| `/fdmac whitelist <id> <module>` | Bypass temporaire d'un module |
| `/fdmac unwhitelist <id> <module>` | Retire le bypass temporaire |
| `/fdmac test` | Envoie un evenement de test |

## Exports (server-side)

```lua
exports["fdm-anticheat"]:banPlayer(source, reason, details, overrideWhitelist)
exports["fdm-anticheat"]:kickPlayer(source, reason, details, overrideWhitelist)
exports["fdm-anticheat"]:warnPlayer(source, reason, details, overrideWhitelist)
exports["fdm-anticheat"]:removeBan(banId)
exports["fdm-anticheat"]:getBanInfo(banId)
exports["fdm-anticheat"]:getPlayerBans(identifiers)
exports["fdm-anticheat"]:tempWhitelistPlayer(source, module)
exports["fdm-anticheat"]:tempUnWhitelistPlayer(source, module)
exports["fdm-anticheat"]:getVersion()
```

Evenements emis :

```lua
AddEventHandler("fdm-anticheat:playerBanned", function(source, reason, details, automatic) end)
AddEventHandler("fdm-anticheat:playerKicked", function(source, reason, details) end)
AddEventHandler("fdm-anticheat:playerWarned", function(source, reason, details, automatic) end)
```

## Punitions automatiques

Par defaut, **aucune punition** : `Config.Punishments.enabled = false`.
Pour activer une reponse automatique par module :

```lua
Config.Punishments.enabled = true
Config.Modules.antiGodmode.action = "ban"
Config.Modules.antiTeleport.action = "kick"
```

Les joueurs exemptes (ACE ou licence) ne sont jamais punis automatiquement.

## Convars

| Convar | Defaut | Role |
|---|---|---|
| `fdm_anticheat_enabled` | `true` | Active l'agent |
| `fdm_anticheat_endpoint` | vide | URL d'ingestion du panel |
| `fdm_anticheat_token` | vide | Token Bearer partage avec le panel |
| `fdm_anticheat_server_id` | `fivem` | Nom affiche dans les alertes et le heartbeat |
| `fdm_anticheat_flush_interval` | `5000` | Intervalle d'envoi en ms (1000 a 60000) |
| `fdm_anticheat_heartbeat_endpoint` | derive | URL du heartbeat si differente |
| `fdm_anticheat_debug` | `false` | Journal local detaille |

## Limites

- Modules **cote client** d'Electron non couverts par un agent server-only :
  aimbot, ESP/wallhack, menus de triche, injection, screenshots, replay,
  monitoring audio, anti-VPN et reputation globale.
- Les mesures de position et de vitesse sont prises cote serveur ; elles
  peuvent etre imprecises avec une latence elevee ou des teleportations
  legitimes (garages, evenements RP). Le mode rapport est volontaire.
- L'agent fournit des indices horodates, pas une preuve absolue.

## Depannage

- **Rien n'apparait** : `/fdmac status`, verifiez l'endpoint, le token, puis
  `ANTICHEAT_INGEST_TOKEN` cote panel.
- **HTTP 401** : token different entre le panel et `server.cfg`.
- **HTTP 503** : `ANTICHEAT_INGEST_TOKEN` absent dans le `.env` du panel.
- **HTTP 429** : plus de 240 requetes d'ingestion par minute et par IP.
- **Bans** : `bans.json` est ecrit dans le dossier de la ressource ; verifiez
  les droits d'ecriture du serveur FiveM.
