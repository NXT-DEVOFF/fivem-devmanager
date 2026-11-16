# Déploiement LWS + Cloudflare — FiveM DevManager

> **Cible :** `https://bl-host.site` (apex) et `https://www.bl-host.site`.
> **Architecture :** Cloudflare → Nginx LWS → Next.js + Socket.IO (`127.0.0.1:3000`) → MariaDB (`127.0.0.1:3306`).
> **Document de référence pour l’état de mise en ligne :** [`CHECKLIST.md`](CHECKLIST.md).

Ce runbook décrit un déploiement **VPS/Cloud LWS avec accès SSH et sudo**, ou une
offre LWS Node.js managée **uniquement si le support confirme** les processus
persistants, les WebSockets, SSH et MySQL. Une formule d’hébergement web LWS
standard (PHP mutualisé, panneau LWS classique) ne suffit pas pour ce projet :
elle n’exécute pas un serveur Node persistant. LWS propose une formule
Node.js/cPanel ou un VPS ; il faut vérifier que la formule choisie autorise le
processus persistant, les WebSockets, SSH et MySQL.

Références utiles :

- offre Node.js LWS : <https://www.lws.fr/hebergement-node-js.php>
- guide Next.js sur VPS LWS : <https://tutoriels.lws.fr/vps/deployer-nextjs-sur-vps>
- WebSockets Cloudflare : <https://developers.cloudflare.com/network/websockets/>

---

## 1. Décision d’hébergement à prendre avant tout

Le projet ne peut pas tourner sur un simple hébergement PHP :

- `server.mjs` est un **serveur HTTP Node persistant** qui attache Socket.IO ;
- Next.js utilise le runtime Node (Prisma, argon2, `ssh2`, `pdf-lib`) ;
- MariaDB/MySQL doit être joignable depuis l’application ;
- Socket.IO et la console Pterodactyl ont besoin des **WebSockets** ;
- l’application écrit dans `var/snapshots` et `var/attachments` ;
- le build Next.js est gourmand : **2 vCPU / 4 Go de RAM minimum recommandés**
  (un conteneur à 1 Go a déjà tué le worker de build).

### Option recommandée — LWS VPS KVM

- Ubuntu 24.04 LTS ou Debian 12 ;
- 2 vCPU, 4 Go de RAM, 40 Go SSD minimum ;
- accès **root/sudo SSH** ;
- ports 22, 80, 443 ;
- MariaDB sur la même machine ou service MySQL managé ;
- Nginx + systemd + Node.js 22 LTS.

### Option acceptée sous conditions — LWS Node.js managé

À faire confirmer **par écrit** au support LWS avant paiement :

1. processus Node persistant (pas de réveil à la requête) ;
2. WebSocket/Upgrade autorisé vers le processus Node ;
3. SSH ou accès équivalent pour `npm`, Prisma et les migrations ;
4. MariaDB/MySQL fourni et accessible depuis l’application ;
5. redémarrage automatique et logs consultables ;
6. possibilité d’écrire `var/snapshots` et `var/attachments` ;
7. mémoire suffisante pour `next build` (4 Go recommandés).

Si une seule réponse est « non » ou « à vérifier », prendre le VPS.

> Ne pas réutiliser le tunnel Cloudflare `c23e37ba-…` de l’ancien déploiement
> `chicago`. Le runbook cible un **enregistrement A proxifié** vers l’origine
> LWS, pas un tunnel.

---

## 2. Accès exacts à fournir

Les secrets ne doivent **jamais** être collés dans le chat, un ticket ou un
fichier suivi par Git. Les valeurs ci-dessous sont des **placeholders**.

### 2.1 Minimum vital pour déployer

| # | Accès | Détail attendu | Droit / portée | Pourquoi |
|---|---|---|---|---|
| 1 | **LWS — compte client** | propriétaire du domaine et de l’hébergement, ou délégation explicite | gérer domaine, DNS, hébergement, SSL, e-mails, base | créer la boîte `contact@`, le DNS et l’origine |
| 2 | **LWS — SSH/SFTP** | hôte, port, utilisateur, **clé publique** installée | sudo/root sur le VPS, ou accès support équivalent | Node, Nginx, systemd, migrations, certificats |
| 3 | **LWS — base de données** | hôte, port, nom de base, utilisateur dédié | `ALL` sur cette base uniquement | Prisma, migrations, sauvegardes |
| 4 | **Cloudflare — zone `bl-host.site`** | accès au compte propriétaire de la zone ; si elle est encore chez LumenWEB, accès délégué ou support LumenWEB | Super Administrator **ou** jeton API limité (voir §2.2) | DNS, proxy, TLS, cache, WAF |
| 5 | **Cloudflare — certificat d’origine** | création d’un Origin CA pour `bl-host.site` et `*.bl-host.site` | SSL/TLS | mode Full (strict) |
| 6 | **LWS — messagerie** | accès à la gestion des boîtes du domaine | créer `contact@bl-host.site`, SPF/DKIM/DMARC | CTA de démo réellement opérationnel |
| 7 | **Keygate — administration** | accès admin/API à `licences.bl-host.site` | émettre une clé produit FiveM dédiée | offre Self-hosted Commercial |
| 8 | **Sauvegardes** | cible locale chiffrée ou bucket S3/SFTP | écriture + restauration | base, snapshots, pièces jointes, `.env` |

> **Point à vérifier avant de demander un token Cloudflare :** d’après
> `docs/DEPLOYMENT.md`, la zone `bl-host.site` est gérée dans le compte
> Cloudflare de **LumenWEB**, pas dans un compte dont l’utilisateur est
> nécessairement propriétaire. Dans ce cas, un accès LWS seul ne permet pas de
> modifier les enregistrements. Il faut soit un **accès délégué** à cette zone,
> soit faire appliquer les changements par le **support LumenWEB**, soit
> **transférer la zone** vers un compte Cloudflare contrôlé par le client (avec
> changement de nameservers chez le registraire). Ne pas créer une seconde zone
> en parallèle sans avoir changé les nameservers.

### 2.2 Jeton Cloudflare limité (si automatisation)

Créer un token **scopé** sur la zone `bl-host.site` :

- `Zone:Read` ;
- `Zone:DNS:Edit` ;
- `Zone:SSL and Certificates:Edit` ;
- `Account:SSL and Certificates:Edit` si l’Origin CA est créé par API ;
- `Zone:Cache Rules:Edit` ;
- `Zone:Firewall Services:Edit` ;
- `Zone:Zone Settings:Edit` (Always HTTPS, HSTS, etc.).

Fournir aussi, si demandé : **Account ID** et **Zone ID**. Le token se place
dans un gestionnaire de secrets ou un fichier local `chmod 600`, jamais dans le
dépôt.

### 2.3 Accès optionnels

| Accès | Quand |
|---|---|
| GitHub/GitLab + deploy key | CI/CD ou déploiement par tag |
| Pterodactyl — URL + ID serveur + Client API key | intégration du panel FiveM ; se configure **dans l’UI**, pas dans `.env` |
| SMTP/IMAP de `contact@` | test fonctionnel de la boîte uniquement ; l’application n’envoie pas d’e-mail |
| Hébergement des sauvegardes | si stockage hors serveur |
| Registraire du domaine | seulement si les nameservers ne sont pas gérés chez LWS |
| Support LumenWEB | si la zone `bl-host.site` reste dans son compte Cloudflare (DNS, proxy, MX) |

### 2.4 Ce qui n’est pas nécessaire

- un mot de passe LWS dans le chat ;
- une clé privée SSH copiée dans un message ;
- un token Cloudflare global ;
- un accès administrateur au serveur FiveM ;
- un compte Stripe (la vente retenue est **devis → contrat → facture**).

### 2.5 Prérequis non techniques encore bloqués

- **structure juridique inexistante** : ne pas publier les offres payantes ni
  encaisser avant sa création ;
- **`contact@bl-host.site` inexistant** : à créer et tester avant d’annoncer
  la démo ;
- **clé Keygate FiveM dédiée** non émise ;
- **SLA Managed** non testé sur l’infrastructure cible ;
- **dépôt public/CLA** absents pour la Community AGPL.

---

## 3. Architecture et flux

```text
Internet
  │  HTTPS / WSS
  ▼
Cloudflare (proxy, TLS, cache, WAF)
  │  Full (strict)
  ▼
Nginx LWS :443  ──►  Next.js + Socket.IO  127.0.0.1:3000
  │                        │
  │                        ├── MariaDB 127.0.0.1:3306
  │                        ├── var/snapshots
  │                        └── var/attachments
  └── /_next/static, /brand, /media (cache)
```

### Ports

| Flux | Port | Exposition |
|---|---|---|
| SSH administrateur | 22 | restreint par IP si possible |
| HTTP/HTTPS Cloudflare → Nginx | 80/443 | public |
| Nginx → Node | 3000 | **loopback uniquement** |
| Node → MariaDB | 3306 | **loopback uniquement** |
| Node → Pterodactyl/Keygate | 443 | sortant |

Ne jamais exposer `3000` ou `3306` sur Internet.

---

## 4. Préflight local

Depuis la racine du projet, avec le domaine final :

```bash
export APP_URL="https://bl-host.site"

npm ci
npm run typecheck
npm run lint
npm test
npm run verify:all -- --no-build
APP_URL="$APP_URL" npm run build
```

Critères de passage :

- [ ] typecheck exit 0 ;
- [ ] lint exit 0 ;
- [ ] 135/135 tests ;
- [ ] `verify:all` : 4/4 exécutés (PHP peut être ignoré s’il est absent) ;
- [ ] build exit 0 ;
- [ ] `public/media/fivem-devmgr-teaser-vertical.mp4` présent (8 Mo) ;
- [ ] aucune valeur secrète dans `git diff` ni dans `public/`.

> Le build doit être refait si `APP_URL` change : canonical, Open Graph,
> sitemap et cookies dépendent de cette valeur.

---

## 5. Préparer le VPS LWS

### 5.1 Base système

```bash
sudo apt update
sudo apt install -y nginx mariadb-server git curl ufw fail2ban ca-certificates certbot
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # >= 20.11, idéalement 22.x
npm -v
```

### 5.2 Compte applicatif

```bash
sudo adduser --system --group --home /var/www/fivem-devmgr fivem
sudo mkdir -p /var/www/fivem-devmgr /var/lib/fivem-devmgr/snapshots /var/lib/fivem-devmgr/attachments
sudo chown -R fivem:fivem /var/www/fivem-devmgr /var/lib/fivem-devmgr
```

### 5.3 Base MariaDB

```bash
sudo mariadb
```

```sql
CREATE DATABASE fivem_devmanager
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
CREATE USER 'fdm'@'127.0.0.1' IDENTIFIED BY '<MOT_DE_PASSE_FORT>';
GRANT ALL PRIVILEGES ON fivem_devmanager.* TO 'fdm'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Sauvegarder le mot de passe dans le gestionnaire de secrets, pas dans ce
document.

### 5.4 Pare-feu

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo systemctl enable --now fail2ban
```

Si Cloudflare proxy est actif et que l’IP d’origine est stable, restreindre
80/443 aux [plages Cloudflare](https://www.cloudflare.com/ips/) avec un script
de mise à jour. Ne pas bloquer l’accès avant d’avoir vérifié que Cloudflare
atteint bien l’origine.

---

## 6. Déployer l’application

### 6.1 Récupérer le code

```bash
sudo -u fivem -H bash
cd /var/www/fivem-devmgr
git clone <URL_DU_DEPOT> .
# ou rsync depuis la machine de build, sans node_modules ni .next Windows
```

Ne pas copier `node_modules` depuis Windows : Prisma et argon2 contiennent des
binaires natifs Linux. Toujours faire `npm ci` sur Linux.

### 6.2 Variables d’environnement

Créer `/etc/fivem-devmgr.env` :

```dotenv
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
APP_URL=https://bl-host.site

DATABASE_URL="mysql://fdm:<MOT_DE_PASSE>@127.0.0.1:3306/fivem_devmanager"
APP_ENCRYPTION_KEY=<GENERE_LOCALEMENT>
APP_SECRET=<GENERE_LOCALEMENT>

AUTH_SESSION_DAYS=30
SNAPSHOT_DIR=/var/lib/fivem-devmgr/snapshots
ATTACHMENT_DIR=/var/lib/fivem-devmgr/attachments
FILE_SYNC_INTERVAL_SECONDS=180

# Optionnel : ingestion anticheat. Laisser vide pour la désactiver.
ANTICHEAT_INGEST_TOKEN=

# Compte initial : à retirer après le seed.
SEED_ADMIN_EMAIL=<EMAIL_ADMIN>
SEED_ADMIN_USERNAME=<LOGIN_ADMIN>
SEED_ADMIN_PASSWORD=<MOT_DE_PASSE_INITIAL_FORT>
SEED_ADMIN_NAME="<NOM_AFFICHE>"

# Community : laisser vide. Commercial : renseigner après émission de la clé.
KEYGATE_URL=https://licences.bl-host.site
LICENSE_KEY=
LICENSE_ENFORCE=false

LEGAL_DRAFT=true
LEGAL_PUBLISHER_NAME=
LEGAL_PUBLISHER_STATUS=
LEGAL_PUBLISHER_ADDRESS=
LEGAL_PUBLISHER_PHONE=
LEGAL_PUBLICATION_DIRECTOR=
LEGAL_PUBLISHER_CAPITAL=
LEGAL_PUBLISHER_SIREN=
LEGAL_PUBLISHER_VAT=

DEMO_MODE=false
```

> Les variables `LEGAL_*` sont lues **au build** par Next.js. Les modifier dans
> l’environnement systemd ne suffit pas : il faut refaire `npm run build` et
> redémarrer le service pour que les pages légales changent d’état.

Générer les secrets localement :

```bash
npm run secret:generate
```

Puis :

```bash
sudo chown root:fivem /etc/fivem-devmgr.env
sudo chmod 640 /etc/fivem-devmgr.env
```

Le groupe `fivem` doit pouvoir lire ce fichier pour les commandes de build et
de migration lancées sous ce compte. Il reste illisible pour les autres
utilisateurs. `server.mjs` reçoit les variables par systemd, pas par une
lecture directe du fichier.

### 6.3 Installer, construire, migrer

```bash
sudo -u fivem -H bash
cd /var/www/fivem-devmgr

# Installer aussi les dépendances de build, même si NODE_ENV=production.
npm ci --include=dev
npm --prefix blhost-license ci --omit=dev

set -a
. /etc/fivem-devmgr.env
set +a

npx prisma generate
npm run build
npx prisma migrate deploy
npm run db:seed
```

Vérifier que le seed a créé l’administrateur, puis **retirer
`SEED_ADMIN_PASSWORD`** de l’environnement après la première connexion (ou le
remplacer par une valeur aléatoire inutilisée).

> `deploy/start.mjs` est prévu pour le conteneur Pterodactyl
> (`/home/container`). Sur un VPS LWS, utiliser **systemd** et `server.mjs`.

### 6.4 Service systemd

Créer `/etc/systemd/system/fivem-devmgr.service` :

```ini
[Unit]
Description=FiveM DevManager
After=network-online.target mariadb.service
Wants=network-online.target

[Service]
Type=simple
User=fivem
Group=fivem
WorkingDirectory=/var/www/fivem-devmgr
EnvironmentFile=/etc/fivem-devmgr.env
ExecStart=/usr/bin/node server.mjs
Restart=always
RestartSec=5
TimeoutStopSec=35
KillSignal=SIGTERM
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Activer :

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now fivem-devmgr
sudo systemctl status fivem-devmgr --no-pager
sudo journalctl -u fivem-devmgr -n 80 --no-pager
```

Attendre la ligne `[server] pret sur http://127.0.0.1:3000`, puis :

```bash
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://127.0.0.1:3000/api/readyz
```

`/api/readyz` doit répondre **200** avec la base et la configuration prêtes.

### 6.5 Nginx

> **Prérequis :** installer le certificat d’origine (section 6.6) avant
> `nginx -t`. Sans les fichiers `.pem` et `.key`, Nginx refuse la configuration.

Créer d’abord le map WebSocket dans `/etc/nginx/conf.d/websocket-upgrade.conf` :

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

Puis `/etc/nginx/sites-available/bl-host.site` :

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name bl-host.site www.bl-host.site;
    return 301 https://bl-host.site$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name bl-host.site;

    ssl_certificate     /etc/nginx/ssl/bl-host.site.pem;
    ssl_certificate_key /etc/nginx/ssl/bl-host.site.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    client_max_body_size 10m;

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_buffering off;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.bl-host.site;

    ssl_certificate     /etc/nginx/ssl/bl-host.site.pem;
    ssl_certificate_key /etc/nginx/ssl/bl-host.site.key;

    return 301 https://bl-host.site$request_uri;
}
```

> Si le VPS n’a pas d’IPv6, retirer les deux lignes `listen [::]:…` : sinon
> Nginx peut refuser de démarrer avec `Address family not supported`.

Activer :

```bash
sudo ln -s /etc/nginx/sites-available/bl-host.site /etc/nginx/sites-enabled/bl-host.site
sudo nginx -t
sudo systemctl reload nginx
```

### 6.6 Certificat d’origine

Deux méthodes valables :

1. **Cloudflare Origin CA** (recommandé avec proxy) : Cloudflare →
   SSL/TLS → Origin Server → Create Certificate pour
   `bl-host.site` + `*.bl-host.site`, puis installer le certificat et la clé
   dans `/etc/nginx/ssl/` :

   ```bash
   sudo mkdir -p /etc/nginx/ssl
   sudo chmod 600 /etc/nginx/ssl/bl-host.site.key
   ```

2. **Let’s Encrypt** : utiliser **DNS-01** en gardant le proxy Cloudflare, ou
   HTTP-01 avec le DNS temporairement en **DNS only** et la redirection 80→443
   neutralisée pendant le challenge. Ensuite, remettre le proxy et vérifier
   Full (strict).

Ne jamais laisser Cloudflare en mode **Flexible** : cela crée une boucle ou
masque un HTTP non chiffré entre Cloudflare et LWS.

---

## 7. Cloudflare

### 7.1 Mise en place de la zone

1. Ajouter `bl-host.site` dans Cloudflare.
2. Récupérer les deux nameservers Cloudflare.
3. Chez LWS (ou le registraire), remplacer les nameservers par ceux de
   Cloudflare.
4. Attendre la validation de la zone.
5. **Avant** de supprimer les anciens enregistrements, exporter le DNS LWS
   (MX, SPF, DKIM, DMARC, sous-domaines existants).

Si `bl-host.site` est déjà chez Cloudflare, ne pas changer les nameservers :
aller directement aux enregistrements. Si la zone est dans le compte Cloudflare
de **LumenWEB**, demander un accès délégué ou faire modifier les enregistrements
par son support ; ne pas ajouter une zone concurrente sans avoir repris les
nameservers.

### 7.2 Enregistrements DNS

| Type | Nom | Valeur | Proxy | Note |
|---|---|---|---|---|
| A | `@` | `<IP_LWS>` | **Proxied** | apex |
| AAAA | `@` | `<IPV6_LWS>` | Proxied | seulement si IPv6 |
| CNAME | `www` | `bl-host.site` | Proxied | redirection Nginx vers apex |
| MX | `@` | valeur LWS existante | **DNS only** | ne jamais proxifier un MX |
| TXT | `@` | SPF LWS | DNS only | copier depuis LWS |
| TXT | `lws._domainkey` ou selecteur DKIM | valeur LWS | DNS only | copier depuis LWS |
| TXT | `_dmarc` | politique DMARC | DNS only | commencer en `p=none`, puis durcir |
| A | `chicago` | **ne pas modifier** | existant | ancien panel, hors périmètre |
| CAA | `@` | selon l’autorité choisie | DNS only | optionnel |

Si un enregistrement `CNAME` pointe encore vers `*.cfargotunnel.com`, le
supprimer et créer l’A record. C’est la cause du `1014 CNAME Cross-User Banned`
observé sur l’ancien sous-domaine.

### 7.3 SSL/TLS

- SSL/TLS → Overview : **Full (strict)** ;
- Edge Certificates : **Always Use HTTPS** ;
- Minimum TLS 1.2 ;
- HSTS : seulement après validation complète (commencer sans `includeSubDomains`
  si `chicago` n’est pas prêt) ;
- Opportunistic Encryption : activé ;
- TLS 1.3 : activé.

### 7.4 Cache

Créer des règles dans **Caching → Cache Rules** :

| Règle | Expression | Action |
|---|---|---|
| API et temps réel | `(http.request.uri.path matches "^/(api|socket\.io)/")` | **Bypass cache** |
| Pages dynamiques | `(http.request.uri.path eq "/login" or http.request.uri.path matches "^/dashboard")` | Bypass cache |
| Pages HTML publiques | `(http.request.uri.path eq "/presentation" or http.request.uri.path eq "/")` | Bypass cache (ou cache très court, avec purge au déploiement) |
| Assets immuables | `(http.request.uri.path matches "^/(_next/static|brand)/")` | Cache éligible, Edge TTL long |
| Médias | `(http.request.uri.path matches "^/media/")` | Cache éligible, Edge TTL 1 jour |

Ne pas mettre « Cache Everything » sur tout le domaine : les réponses
authentifiées et les cookies ne doivent jamais être servis depuis le cache.

### 7.5 WAF, bots et WebSocket

- WebSockets : aucune option à activer sur les plans récents ; le proxy les
  supporte. Vérifier qu’aucune règle WAF ne bloque `/socket.io/`.
- Désactiver **Bot Fight Mode** sur l’offre Free, ou créer un **skip** WAF pour
  `/api/*` et `/socket.io/*` si l’offre permet des règles de contournement.
- Ne pas activer **Under Attack Mode** en production : il casse les appels API
  et les WebSockets.
- Ajouter un rate limit sur `POST /api/auth/login` (par IP) si le plan le
  permet ; ne pas bloquer les autres routes API.
- Désactiver **Rocket Loader** et **Email Address Obfuscation** (le CTA mailto
  et Next.js n’en ont pas besoin).
- Ne pas activer Auto Minify sur le HTML/JS de Next.

### 7.6 Purge après déploiement

Après un nouveau build :

```bash
# Si un token API est utilisé :
curl -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/purge_cache" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

Sinon : Cloudflare → Caching → Purge Everything. Purger aussi le cache local
du navigateur lors des tests.

---

## 8. Messagerie `contact@bl-host.site`

La boîte n’existe pas encore. Elle est indépendante de l’application : le site
utilise un lien `mailto:`, il n’y a pas de SMTP applicatif.

1. LWS Panel → Emails → créer `contact@bl-host.site`.
2. Définir un mot de passe fort et activer la double authentification du compte
   LWS.
3. Activer IMAP/SMTP et relever les paramètres (hôte, ports, TLS).
4. Dans la zone DNS (LWS, Cloudflare ou compte LumenWEB), conserver :
   - MX LWS ;
   - SPF incluant le serveur LWS ;
   - DKIM avec le sélecteur fourni par LWS ;
   - DMARC (`p=none` au départ).
5. Envoyer un e-mail depuis une adresse autorisée vers `contact@`.
6. Répondre depuis `contact@` vers une adresse externe.
7. Vérifier les en-têtes `Authentication-Results` (SPF/DKIM/DMARC = pass).
8. Tester le lien `mailto:` de `/presentation` sur desktop et mobile.

Ne pas basculer les MX vers Cloudflare Email Routing si une vraie boîte LWS est
utilisée. Si Email Routing est choisi, créer l’adresse de destination et suivre
la procédure Cloudflare ; ce n’est pas le choix par défaut de ce runbook.

---

## 9. Intégrations après le premier démarrage

1. Se connecter avec le compte `SEED_ADMIN_*`.
2. Changer immédiatement le mot de passe et activer la 2FA TOTP.
3. Supprimer `SEED_ADMIN_PASSWORD` de l’environnement et redémarrer le service.
4. **Infrastructure** : URL du panel Pterodactyl, ID serveur, clé API Client ;
   tester la connexion et la console WebSocket.
5. **Discord** : ajouter les webhooks et les tester.
6. **Paramètres** : nom du serveur, version, inactivité.
7. **Utilisateurs** : créer l’équipe, appliquer le RBAC.
8. **Ressources** : synchroniser et vérifier les permissions de fichiers.
9. **Anticheat** : si utilisé, générer `ANTICHEAT_INGEST_TOKEN`, le placer dans
   la configuration de l’agent FiveM, redémarrer, vérifier le heartbeat.
10. **Keygate** : seulement après émission de la clé dédiée ; sinon laisser
    `LICENSE_KEY` vide et `LICENSE_ENFORCE=false` (Community).

Les clés Pterodactyl/SFTP/Discord se saisissent dans l’interface et sont
chiffrées en base ; elles ne vont pas dans `.env`.

---

## 10. Vérifications post-déploiement

### 10.1 HTTP et pages

```bash
curl -I  https://bl-host.site/presentation
curl -I  https://bl-host.site/robots.txt
curl -I  https://bl-host.site/sitemap.xml
curl -I  https://bl-host.site/media/fivem-devmgr-teaser-vertical.mp4
curl -I  https://bl-host.site/mentions-legales
curl -I  https://bl-host.site/dashboard
```

Attendu :

- `/presentation` : **200** ;
- `/robots.txt` et `/sitemap.xml` : **200** ;
- `/media/...mp4` : **200**, `Content-Type: video/mp4` ;
- `/mentions-legales` : **200** mais `noindex, nofollow` tant que
  `LEGAL_DRAFT=true` ;
- `/dashboard` sans session : **307** vers `/login` ;
- canonical et Open Graph : `https://bl-host.site`, pas `localhost`.

### 10.2 Santé et base

```bash
curl -fsS https://bl-host.site/api/health
curl -fsS https://bl-host.site/api/readyz
```

- health : processus vivant, base et configuration vérifiées ;
- readyz : **200** seulement si la base et la configuration sont prêtes.

### 10.3 Vidéo et Range

```bash
curl -s -D - -o /dev/null -H 'Range: bytes=0-1023' \
  https://bl-host.site/media/fivem-devmgr-teaser-vertical.mp4
```

Attendu : **206 Partial Content**, `Content-Range`, `Accept-Ranges: bytes`.
Le teaser doit se lire et se déplacer dans la timeline.

### 10.4 WebSocket

```bash
curl -i -N \
  -H "Origin: https://bl-host.site" \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "https://bl-host.site/socket.io/?EIO=4&transport=websocket"
```

Attendu : **101 Switching Protocols**. Sans ce résultat, la console et le fil
d’activité resteront déconnectés. Vérifier Nginx, Cloudflare et les règles WAF.

### 10.5 Authentification et parcours réel

- [ ] connexion avec le compte admin ;
- [ ] changement de mot de passe ;
- [ ] 2FA TOTP + code de récupération ;
- [ ] déconnexion et révocation de session ;
- [ ] ouverture de `/dashboard` avec données réelles ;
- [ ] test Pterodactyl (statut, console, start/stop si autorisé) ;
- [ ] téléchargement du teaser depuis `/presentation` ;
- [ ] vérification mobile du lecteur vertical ;
- [ ] vérification `contact@` depuis un appareil externe.

### 10.6 Sécurité

- [ ] `https://bl-host.site` forcé, HTTP redirigé ;
- [ ] certificat valide, chaîne complète, expiration suivie ;
- [ ] `3000` et `3306` non accessibles depuis Internet ;
- [ ] SSH par clé, root direct désactivé, fail2ban actif ;
- [ ] `/etc/fivem-devmgr.env` en `640 root:fivem`, hors dépôt ;
- [ ] en-têtes CSP/HSTS/X-Frame-Options présents ;
- [ ] `LEGAL_DRAFT` cohérent : ne pas publier les pages légales incomplètes ;
- [ ] aucune promesse de vente payante tant que la structure n’existe pas.

---

## 11. Sauvegardes

### Base

```bash
sudo install -d -m 700 /var/backups/fivem-devmgr
sudo bash -c 'mariadb-dump --defaults-extra-file=/root/.my.cnf \
  --single-transaction --quick fivem_devmanager \
  | gzip > /var/backups/fivem-devmgr/db-$(date +%F-%H%M).sql.gz'
```

Créer `/root/.my.cnf` avec les identifiants, en `600`. Planifier via cron ou
systemd timer, conserver 30 jours, chiffrer et copier hors serveur.

### Fichiers

- `var/snapshots/` ;
- `var/attachments/` ;
- `/etc/fivem-devmgr.env` (secret, sauvegarde séparée) ;
- configuration Nginx/systemd ;
- export DNS Cloudflare et certificats.

Tester une restauration au moins une fois par trimestre. Une sauvegarde non
testée n’est pas une sauvegarde.

---

## 12. Mise à jour et rollback

### Mise à jour

```bash
sudo -u fivem -H bash
cd /var/www/fivem-devmgr
git fetch --all
git checkout <TAG>
npm ci --include=dev
npm --prefix blhost-license ci --omit=dev
set -a
. /etc/fivem-devmgr.env
set +a
npx prisma generate
npm run build
npx prisma migrate deploy
exit
sudo systemctl restart fivem-devmgr
```

Purger Cloudflare, puis refaire les smoke tests.

### Rollback

- conserver les releases précédentes ou une copie de `.next` + `public` ;
- en cas de migration destructive, restaurer la base **avant** de revenir au
  code précédent ;
- redémarrer systemd, vérifier `/api/health` et `/api/readyz` ;
- ne jamais supprimer une table de production sans dump vérifié.

---

## 13. Supervision

- sonde externe sur `/api/health` (liveness) ;
- sonde sur `/api/readyz` (readiness) ;
- alerte sur `systemctl status` / redémarrages répétés ;
- journal `journalctl -u fivem-devmgr` ;
- espace disque, RAM, CPU, MariaDB ;
- expiration TLS et certificat Cloudflare ;
- erreurs 5xx Cloudflare et Nginx ;
- test WebSocket après chaque déploiement ;
- test de réception `contact@` après chaque changement DNS.

---

## 14. Critères d’acceptation

Le déploiement LWS/Cloudflare est considéré comme réussi lorsque :

- [ ] `https://bl-host.site/presentation` est accessible sans session ;
- [ ] le teaser est lisible et téléchargeable, avec Range 206 ;
- [ ] `/api/health` et `/api/readyz` répondent correctement ;
- [ ] `/dashboard` est protégé ;
- [ ] le WebSocket répond 101 et la console fonctionne ;
- [ ] le canonical, l’OG et le sitemap utilisent `https://bl-host.site` ;
- [ ] les pages légales restent `noindex` tant que `LEGAL_DRAFT=true` ;
- [ ] `contact@bl-host.site` reçoit et envoie ;
- [ ] les sauvegardes base + fichiers sont planifiées et testées ;
- [ ] les secrets ne sont ni dans Git, ni dans `public/`, ni dans les logs ;
- [ ] la structure juridique existe et les offres payantes sont autorisées.

---

## 15. Handoff sécurisé

Pour que le déploiement puisse être exécuté :

1. créer une clé SSH dédiée et l’installer côté LWS ;
2. placer les identifiants de base et les secrets dans `/etc/fivem-devmgr.env`
   sur le serveur (ou dans le gestionnaire de secrets du client) ;
3. créer un token Cloudflare limité et le stocker dans le gestionnaire de
   secrets, pas dans un message ;
4. créer la boîte `contact@bl-host.site` et confirmer un test de réception ;
5. fournir l’URL du dépôt ou un accès de déploiement ;
6. ne jamais transmettre de mot de passe, clé privée ou token dans le chat.

Tant que les points **structure juridique**, **boîte mail** et **accès
serveur/DNS** ne sont pas levés, le site reste **techniquement prêt mais non
publié**.
