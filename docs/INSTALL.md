# Installation sur Pterodactyl / LumenWeb

Ce guide couvre un deploiement de production avec l'egg Node.js fourni.

## 1. Prerequis

- Un panel **Pterodactyl** (1.x) avec un noeud Wings.
- Une **allocation** pour le dashboard (ex. `3000`), differente de celle du serveur FiveM.
- Une base **MariaDB / MySQL** accessible depuis le conteneur du dashboard (celle du panel).
- Node.js >= 20.11 (l'egg utilise une image Node 22).
- Pour FiveM : l'URL du panel, un ID serveur et une cle API Client.

## 2. Base de donnees

Sur la MariaDB du panel (ou l'hebergement LumenWeb) :

```sql
CREATE DATABASE fivem_devmanager;
CREATE USER 'fivem'@'%' IDENTIFIED BY 'mot-de-passe-fort';
GRANT ALL PRIVILEGES ON fivem_devmanager.* TO 'fivem'@'%';
FLUSH PRIVILEGES;
```

`DATABASE_URL="mysql://fivem:mot-de-passe-fort@host:3306/fivem_devmanager"`

Si MariaDB tourne dans le meme conteneur qu'un serveur FiveM, gardez-la sur l'hote ou un
service dedie. Le dashboard ne doit pas dependre du serveur FiveM pour demarrer.

## 3. Import de l'egg

1. Panel → **Nests** → creer/importer un nest `FiveM`.
2. Importer `egg-fivem-devmgr.json` (Admin → Nests → Import Egg).
3. Creer un **nouveau serveur** avec cet egg :
   - Allocation : port du dashboard.
   - Variables : `DATABASE_URL`, `APP_URL` (https://devmanager.mondomaine.fr), `APP_ENCRYPTION_KEY`,
     `APP_SECRET`, `SEED_ADMIN_*`.
4. Le script d'installation execute : `npm ci`, `prisma generate`, `prisma migrate deploy`,
   `npm run build`, puis le seed si `SEED_ADMIN_PASSWORD` est fourni.

Generation des secrets (sur votre poste) :

```bash
node scripts/generate-secret.mjs
```

Copier `APP_ENCRYPTION_KEY` et `APP_SECRET` dans les variables du serveur Pterodactyl.
**Ne jamais** reutiliser ces valeurs entre environnements.

## 4. Ports et reseau

| Flux | Port | Note |
|---|---|---|
| Navigateur → dashboard | allocation (ex. 3000) | via reverse proxy HTTPS |
| Dashboard → panel Pterodactyl | 443 (HTTPS) | API REST |
| Dashboard → Wings | 443 ou 8080 (WSS) | console temps reel |
| Dashboard → SFTP FiveM | 2022 (configurable) | optionnel |
| Dashboard → MariaDB | 3306 | interne, non expose |

Derriere Nginx (exemple) :

```nginx
server {
  listen 443 ssl http2;
  server_name devmanager.mondomaine.fr;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
  }
}
```

Le support WebSocket (`Upgrade`/`Connection`) est indispensable pour Socket.IO et la console.
Definissez `APP_URL` avec exactement l'origine publique (sans slash final).

## 5. Migrations et donnees

```bash
npm run db:migrate
npm run db:seed
```

`db:seed` cree uniquement le super administrateur et les reglages par defaut.
Pour un environnement de demonstration :

```bash
DEMO_MODE=true npm run db:seed:demo
```

Le seed demo refuse de s'executer si `NODE_ENV=production`.

## 6. Demarrage

Commande de production : `npm run start` (equivalent `node server.mjs`).

- Port : `PORT` si defini, sinon `SERVER_PORT` (variable Pterodactyl), sinon 3000.
- Arret gracieux sur `SIGTERM`/`SIGINT` (Pterodactyl envoie `SIGTERM`).
- Logs applicatifs sur stdout/stderr, visibles dans la console Pterodactyl.
- L'application demarre sans Docker a l'interieur du conteneur.

## 7. Configuration de l'application

1. Se connecter avec le compte `SEED_ADMIN_*`.
2. Changer le mot de passe, activer la 2FA.
3. `Infrastructure` : panel Pterodactyl, ID serveur, cle API Client. Tester.
4. `Discord` : ajouter les webhooks, les tester.
5. `Parametres` : nom du serveur, version, inactivite.
6. `Utilisateurs` : creer les comptes de l'equipe et ajuster les permissions.
7. `Ressources` : synchroniser pour analyser les `fxmanifest.lua`.

## 8. Sauvegardes

Sonde de readiness pour le load balancer / Pterodactyl :

```bash
curl -fsS https://devmanager.mondomaine.fr/api/readyz
```

- **MariaDB/MySQL** : `mariadb-dump` (ou `mysqldump`) quotidien au minimum.
- **Snapshots applicatifs** : dossier `var/snapshots` (configurable via `SNAPSHOT_DIR`).
- **Pieces jointes des taches** : dossier `var/attachments` (configurable via `ATTACHMENT_DIR`).
- Les secrets sont chiffres avec `APP_ENCRYPTION_KEY` : sans cette cle, les cles Pterodactyl et
  webhooks deviennent illisibles. Sauvegardez-la separement (gestionnaire de secrets).

## 9. Mise a jour

```bash
# dans la console du serveur
git pull                # ou deployer les nouveaux fichiers
npm ci
npx prisma migrate deploy
npm run build
# redemarrer depuis le panel
```

Les migrations sont additives par defaut ; lisez toujours le SQL ajoute avant application.

## 10. Depannage

| Symptome | Piste |
|---|---|
| `Configuration invalide (.env)` | verifier `DATABASE_URL`, `APP_ENCRYPTION_KEY`, `APP_SECRET` |
| `Cle API refusee (401)` | cle Client invalide/expiree, ou IP non autorisee |
| `Permission Pterodactyl insuffisante (403)` | droits de la cle API sur ce serveur |
| Console vide | WebSocket Wings bloque par le proxy/firewall |
| `Origine de la requete non autorisee (CSRF)` | `APP_URL` ne correspond pas a l'origine reelle |
| Les cles sont illisibles apres redeploiement | `APP_ENCRYPTION_KEY` a change |
| Build echoue sur `public/monaco` | relancer `node scripts/copy-monaco.mjs` |
