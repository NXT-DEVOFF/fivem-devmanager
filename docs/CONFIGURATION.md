# Configuration et variables d'environnement

> Ne jamais commiter `.env`, `APP_ENCRYPTION_KEY`, `APP_SECRET`, les clés Pterodactyl, les webhooks Discord ou les identifiants SFTP.

## 1. Fichier d'environnement

Copier le modèle :

```bash
cp .env.example .env
npm run secret:generate
```

Renseigner ensuite la base, l'URL publique et le compte administrateur initial. En production, fournir les variables par systemd, Pterodactyl ou un gestionnaire de secrets.

Permissions recommandées sur un VPS :

```bash
sudo chown root:fivem /etc/fivem-devmgr.env
sudo chmod 640 /etc/fivem-devmgr.env
```

## 2. Variables obligatoires

| Variable | Rôle | Remarque |
|---|---|---|
| `PORT` | Port HTTP | `SERVER_PORT` accepté en secours. |
| `APP_URL` | Origine publique exacte | Sans slash final ; cookies, CSRF, canonical et redirections. |
| `DATABASE_URL` | Connexion MariaDB/MySQL | Encoder les caractères spéciaux du mot de passe. |
| `APP_ENCRYPTION_KEY` | Chiffrement AES-256-GCM | 32 octets ; ne pas la changer sans migration. |
| `APP_SECRET` | Secret de session | 32 caractères aléatoires minimum. |
| `SEED_ADMIN_*` | Compte initial | À retirer après le premier seed. |

## 3. Sécurité et limites

| Variable | Défaut | Rôle |
|---|---|---|
| `NODE_ENV` | `production` | Active les cookies `Secure` et les protections. |
| `AUTH_SESSION_DAYS` | `30` | Durée des sessions. |
| `LOGIN_MAX_ATTEMPTS` | `8` | Tentatives avant verrouillage. |
| `LOGIN_LOCK_MINUTES` | `15` | Durée du verrouillage. |
| `MAX_FILE_SIZE_KB` | `2048` | Taille maximale d'un fichier éditable. |
| `MAX_ATTACHMENT_SIZE_KB` | `8192` | Taille maximale d'une pièce jointe. |
| `ATTACHMENT_DIR` | `var/attachments` | Stockage hors `public/`. |
| `SNAPSHOT_DIR` | `var/snapshots` | Snapshots avant écriture. |
| `FILE_SYNC_INTERVAL_SECONDS` | `180` | Synchronisation distante, minimum 60. |

## 4. Intégrations optionnelles

### IA

```dotenv
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_API_KEY=
```

Sans clé, un générateur déterministe produit les patch notes. L'IA ne doit pas inventer de contenu.

### Anticheat

```dotenv
ANTICHEAT_INGEST_TOKEN=
```

Laisser vide désactive l'ingestion. Générer une valeur aléatoire et la partager uniquement avec l'agent FiveM.

### Keygate

```dotenv
KEYGATE_URL=https://licences.bl-host.site
LICENSE_KEY=
LICENSE_ENFORCE=false
# LICENSE_IDENTIFIER=
# LICENSE_GRACE_HOURS=72
# LICENSE_CHECK_INTERVAL_MINUTES=60
```

- **Community AGPL** : laisser vide, `LICENSE_ENFORCE=false`.
- **Self-hosted Commercial** : renseigner une clé dédiée après émission.

### Mentions légales

```dotenv
LEGAL_DRAFT=true
LEGAL_PUBLISHER_NAME=
LEGAL_PUBLISHER_STATUS=
LEGAL_PUBLISHER_ADDRESS=
LEGAL_PUBLISHER_PHONE=
LEGAL_PUBLICATION_DIRECTOR=
LEGAL_PUBLISHER_CAPITAL=
LEGAL_PUBLISHER_SIREN=
LEGAL_PUBLISHER_VAT=
# LEGAL_UPDATED_AT=13 novembre 2026
```

Les variables `LEGAL_*` sont lues au build. Tant que `LEGAL_DRAFT=true` ou que les champs manquent, les pages restent en brouillon `noindex`.

### Démonstration

```dotenv
DEMO_MODE=false
```

`npm run db:seed:demo` refuse de s'exécuter en production.

## 5. Ce qui reste dans l'interface

Les éléments suivants ne vont pas dans `.env` :

- URL du panel Pterodactyl ;
- ID du serveur ;
- clé API Client / Application ;
- hôte, port, utilisateur et clé SFTP ;
- webhooks Discord.

Ils sont chiffrés en base et l'API ne renvoie que leur présence.

## 6. Après la première connexion

1. Changer le mot de passe initial.
2. Activer la 2FA TOTP.
3. Configurer Pterodactyl dans **Infrastructure** et tester la console.
4. Configurer Discord et envoyer un message de test.
5. Créer les comptes de l'équipe et vérifier les permissions.
6. Synchroniser les ressources.
7. Configurer l'anticheat si utilisé.

## 7. Contrôle

```bash
curl -fsS https://<domaine>/api/health
curl -fsS https://<domaine>/api/readyz
```

`/api/readyz` renvoie 200 seulement si la base et la configuration sont prêtes. En cas d'échec, consulter [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
