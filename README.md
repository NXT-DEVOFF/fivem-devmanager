# FiveM DevManager — Documentation

Documentation technique publique de **FiveM DevManager**, une plateforme auto-hébergée pour développer, gérer et superviser un serveur FiveM.

> **État du projet :** le code, le build et les tests sont prêts. Le site public `https://bl-host.site` n'est pas encore déployé ; il affiche encore la page par défaut de l'hébergeur. Cette documentation ne contient aucun secret.

## Sommaire

- [Architecture](docs/ARCHITECTURE.md)
- [Installation locale](docs/INSTALL.md)
- [Configuration](docs/CONFIGURATION.md)
- [Déploiement LWS + Cloudflare](docs/DEPLOY-LWS-CLOUDFLARE.md)
- [Utilisation du panel](docs/USAGE.md)
- [Administration et permissions](docs/ADMINISTRATION.md)
- [Intégrations externes](docs/INTEGRATIONS.md)
- [Sécurité](docs/SECURITY.md)
- [Dépannage](docs/TROUBLESHOOTING.md)
- [Checklist de mise en ligne](docs/CHECKLIST.md)

## Présentation

FiveM DevManager centralise :

- le cockpit temps réel et la supervision Pterodactyl ;
- les sessions, sprints, tâches, bugs et rapports ;
- les fichiers distants, l'éditeur Monaco et les déploiements ;
- les joueurs, sanctions, événements et l'anticheat ;
- FiveM Studio : véhicules, MLO, mappings et générateurs ;
- les patch notes et les webhooks Discord.

Le panel ne simule pas les intégrations : une connexion non configurée renvoie une erreur explicite.

## Fonctionnalités principales

### Pilotage

- Dashboard avec santé, KPI, sprint, incidents et activité en direct.
- Sessions chronométrées côté serveur, pauses et rapports PDF.
- Sprints, incidents `INC-xxxx`, maintenance et registre de bugs.
- Tâches en kanban avec checklist, dépendances, pièces jointes et validation par critères.
- Statistiques et journal d'audit.

### Développement

- Explorateur de fichiers Pterodactyl et fallback SFTP.
- Éditeur Monaco local, multi-onglets, autosave, diff, snippets FiveM.
- Snapshot avant écriture, verrou par fichier et détection de conflit.
- Synchronisation et détection des modifications distantes.
- Déploiements avec approbation, snapshot et rollback.
- Console temps réel et terminal selon permissions.

### FiveM Studio

- Catalogue de 118 outils.
- Debug et génération de handling véhicule.
- Constructeur MLO et builder 3D Three.js.
- Carte des mappings, coordonnées et projets CodeWalker.
- Générateurs ESX / QBCore / ox / standalone.

### Communauté

- Fiches joueurs et historique de sanctions.
- Anticheat serveur autoritatif, en mode rapport, avec heartbeat.
- Planning d'événements et suivi des places.

### Communication

- Patch notes internes ou publiques.
- Publication Discord avec idempotence.
- Base de connaissances et documentation FiveM intégrée.

## Stack

| Couche | Technologie |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Backend | Route Handlers Next.js, services TypeScript |
| Temps réel | Socket.IO sur le serveur HTTP custom |
| Base | MariaDB 10.11+ / MySQL 8+ avec Prisma |
| Auth | Sessions serveur, cookie HttpOnly, argon2id, TOTP |
| Fichiers | API Pterodactyl, fallback SFTP |
| Tests | Vitest |

## Démarrage rapide

Prérequis : **Node.js >= 20.11**, **MariaDB 10.11+ / MySQL 8+**.

```bash
npm install
cp .env.example .env
npm run secret:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Ouvrir `http://localhost:3000`, se connecter avec le compte `SEED_ADMIN_*`, changer le mot de passe et activer la 2FA.

Consulter [INSTALL.md](docs/INSTALL.md) pour la procédure complète et [CONFIGURATION.md](docs/CONFIGURATION.md) pour les variables.

## Variables essentielles

| Variable | Rôle |
|---|---|
| `APP_URL` | Origine publique exacte, sans slash final |
| `DATABASE_URL` | Connexion MariaDB/MySQL |
| `APP_ENCRYPTION_KEY` | Chiffrement AES-256-GCM des intégrations |
| `APP_SECRET` | Secret de session |
| `SEED_ADMIN_*` | Compte administrateur initial |
| `ANTICHEAT_INGEST_TOKEN` | Token Bearer de l'agent anticheat |
| `LICENSE_KEY` | Licence Self-hosted Commercial, vide en Community |

Ne jamais commiter `.env` ni une clé. Les clés Pterodactyl, SFTP et Discord se configurent dans l'interface et sont chiffrées en base.

## Déploiement

Le projet nécessite un processus Node persistant, des WebSockets et une base MariaDB/MySQL. Un hébergement PHP mutualisé classique ne suffit pas.

Deux parcours sont documentés :

- **Pterodactyl / LumenWeb** : [INSTALL.md](docs/INSTALL.md) ;
- **VPS LWS + Cloudflare** : [DEPLOY-LWS-CLOUDFLARE.md](docs/DEPLOY-LWS-CLOUDFLARE.md).

Après déploiement :

```bash
curl -fsS https://<domaine>/api/health
curl -fsS https://<domaine>/api/readyz
```

`/api/readyz` doit répondre **200** lorsque la base et la configuration sont prêtes.

## Sécurité

- Sessions serveur, cookie `HttpOnly`, `SameSite=Lax`, `Secure` en production.
- Permissions vérifiées côté serveur sur chaque route.
- Protection CSRF, validation Zod, CSP et `X-Frame-Options`.
- Secrets chiffrés avec AES-256-GCM.
- Snapshots et contrôle de concurrence avant écriture.
- Journal d'audit immuable.

Voir [SECURITY.md](docs/SECURITY.md).

## Documentation complémentaire

La version Notion contient les guides détaillés d'installation, de déploiement, d'utilisation et d'exploitation. Ce dépôt GitHub publie la documentation technique versionnable ; il ne contient ni code source, ni secrets, ni données d'exploitation.

## Licence

Le projet est distribué sous **AGPL-3.0-only**. Voir [LICENSE](LICENSE) et [NOTICE](NOTICE). Les composants tiers sont listés dans [NOTICES.md](NOTICES.md).

## Contribution

Les corrections de documentation sont bienvenues via une offre de pull request. Ne jamais inclure de secrets, d'adresses internes, de journaux d'exploitation ou de données personnelles dans une contribution.
