# Architecture technique

## Vue d'ensemble

```
Navigateur
   |  HTTPS (cookies HttpOnly)
   v
Reverse proxy (Nginx / Pterodactyl)
   |
   v
server.mjs ── HTTP ──> Next.js App Router
   |                     ├── Pages protegees (RSC + composants clients)
   |                     └── Route Handlers /api/*
   └── Socket.IO (meme port) ── rooms user/perm/activity/console
                               
Services serveur (src/server)
   ├── auth / permissions / audit / crypto
   ├── pterodactyl (API Client, relais console, actions)
   ├── files / sftp / snapshots / changes / resources
   ├── sessions / reports / patchnotes / ai / discord / deployments
   ├── notifications / realtime / workers / settings / pdf
   v
MariaDB/MySQL (Prisma) + fichiers locaux (var/snapshots)
```

## Decisions structurantes

### 1. Un seul processus Node
Socket.IO necessite le serveur HTTP brut. `server.mjs` cree Next en mode custom, attache
Socket.IO, puis laisse `src/instrumentation.ts` installer les handlers temps reel et demarrer
les taches de fond (inactivite, publications planifiees, sync fichiers, purge des verrous).
Avantage : un seul port, un seul processus a superviser dans Pterodactyl.

### 2. Authentification serveur, pas de JWT cote client
Le token de session (32 octets aleatoires) est stocke **hashe** en base. Le cookie est HttpOnly,
SameSite=Lax, Secure en production. Chaque requete revalide le hash, l'expiration, la revocation
et le statut du compte. Les permissions sont recalculees cote serveur a chaque appel.

### 3. Permissions granulaires resolues au runtime
`ROLE_PERMISSIONS` fournit les droits par defaut. `permissionsGranted` / `permissionsDenied`
ajustent par utilisateur. `hasPermission()` est la seule source de verite, appelee dans chaque
Route Handler via `requirePermission()`.

### 4. Secrets chiffres
`APP_ENCRYPTION_KEY` (AES-256-GCM) chiffre les cles Pterodactyl, SFTP, webhooks Discord.
Format versionne `v1:iv:tag:ciphertext`, dechiffrement uniquement en memoire serveur.
Les reponses API ne renvoient que des booleens de presence (`hasClientKey`).

### 5. Fichiers distants
Backend prefere : API Files Pterodactyl (respecte les permissions du panel). Fallback : SFTP
pour la recherche de contenu. Chaque chemin est normalise, toute traversee `..` est refusee.
Les ecritures :
1. verifient le verrou applicatif ;
2. controllent le hash de base (concurrence) ;
3. creent un snapshot compresse local ;
4. ecrivent chez Pterodactyl ;
5. incrementent la version du fichier suivi ;
6. enregistrent la modification, le diff et le rapprochement de tache.

### 6. Temps de session
Aucun compteur client ne fait foi. `accumulatedActiveSeconds` + `lastResumedAt` permettent de
recalculer le temps actif a tout instant. Les pauses sont des evenements horodates. L'inactivite
genere un avertissement, jamais une deduction.

### 7. Detection des modifications
Trois sources complementaires :
- ecritures via l'application (source `EDITOR`/`API`/`UPLOAD`) ;
- detection passive a la lecture (hash different du fichier suivi) ;
- synchronisation periodique des fichiers suivis (source `SYNC`, sans utilisateur).

Le rapprochement de tache utilise un score pondere (ressource, fichiers listes, session, assignation,
statut). Un score >= 35 propose une association ; il ne cloture jamais la tache.

### 8. Validation des taches
`evaluateTaskReadiness()` calcule 6 criteres a partir de donnees reelles. Une validation
automatique n'est possible que si `autoValidate && !requiresReview` et tous les criteres remplis.
Les validateurs humains peuvent forcer la validation, ce qui est journalise.

### 9. Discord
Embeds construits cote serveur, limites officielles appliquees (titre 256, description 4096,
25 champs, 1024 par valeur, 6000 total). Idempotence via hash (webhook + payload) et contrainte
unique `(webhookId, payloadHash)`. Les 429 sont retentes.

### 10. Snapshot / rollback
Les ressources sont parcourues recursivement (max 400 fichiers / 30 Mo), compressees en gzip
dans `var/snapshots`, indexees en base avec checksum. Le rollback reecrit les fichiers et
enregistre des modifications de source `ROLLBACK`.

## Modele de donnees (principaux modeles)

- `User` / `AuthSession` / `LoginEvent` : identite, sessions, historique de connexion.
- `DevSession` / `DevSessionEvent` / `Report` : temps, chronologie, rapports.
- `Task` (+ checklist, commentaires, dependances, pieces jointes), `Bug` (+ commentaires).
- `FileChange` / `TrackedFile` / `Resource` : fichiers, versions, ressources FiveM.
- `PatchNote` / `DiscordWebhook` / `DiscordDelivery` : communication et idempotence.
- `Deployment` / `Snapshot` : production controlee et rollback.
- `Notification` / `AuditLog` / `AppSetting` / `PterodactylConfig` / `SftpConfig`.

## Flux temps reel

| Room | Contenu |
|---|---|
| `user:{id}` | notifications personnelles |
| `perm:{permission}` | evenements cibles par permission |
| `activity` | fil d'activite global (sessions, fichiers, bugs, deploiements) |
| `console` | lignes console, statut, stats |

L'authentification du socket reutilise le cookie de session. Les commandes console envoyees par
socket revérifient la permission cote serveur.

## Taches de fond

| Tache | Frequence | Effet |
|---|---|---|
| `idle-sessions` | 60 s | avertissement d'inactivite + notification |
| `scheduled-patchnotes` | 60 s | publication des notes planifiees |
| `expired-locks` | 5 min | liberation des verrous de fichiers |
| `file-sync` | configurable (>= 60 s) | detection des modifications distantes |

## Extensibilite

- Ajouter une permission : `PERMISSIONS` + attribution de role, puis `requirePermission`.
- Ajouter un webhook : `WebhookKind` + configuration UI.
- Ajouter un type d'evenement : `RealtimeEvent` + emetteur.
- Multi-instances : remplacer le bus Socket.IO par l'adaptateur Redis et externaliser les workers.
