# Dépannage et FAQ

> Commencer par les logs et les sondes. Ne jamais supprimer la base ou les secrets sans sauvegarde.

## 1. Diagnostic

```bash
curl -i http://127.0.0.1:3000/api/health
curl -i http://127.0.0.1:3000/api/readyz
sudo systemctl status fivem-devmgr --no-pager
sudo journalctl -u fivem-devmgr -n 100 --no-pager
```

`/api/health` vérifie le processus et la configuration. `/api/readyz` renvoie 200 seulement si la base et la configuration sont prêtes.

## 2. Démarrage

### `Configuration invalide (.env)`

Vérifier `DATABASE_URL`, `APP_ENCRYPTION_KEY` et `APP_SECRET`. Générer les secrets avec `npm run secret:generate`.

### Connexion base refusée

- MariaDB démarrée ?
- Port 3306 accessible depuis l'application ?
- Mot de passe URL-encodé dans `DATABASE_URL` ?
- Droits de l'utilisateur sur la base ?

### `Prisma Client not generated`

```bash
npx prisma generate
npm run build
```

### Migration en échec

Lire le SQL, sauvegarder la base et tester sur une base jetable. Ne jamais appliquer une migration sans dump.

## 3. Build et assets

### Build tué

Le build Next.js peut être tué sur un conteneur à 1 Go. Utiliser 2 vCPU / 4 Go minimum.

### `public/monaco` absent

```bash
node scripts/copy-monaco.mjs
```

### Ancien build affiché

- redémarrer le service ;
- purger Cloudflare ;
- vérifier le cache navigateur ;
- vérifier le port du reverse proxy.

## 4. HTTP et WebSocket

### 502 / 504

- le processus Node écoute-t-il sur `127.0.0.1:3000` ?
- Nginx pointe-t-il vers le bon port ?
- le service est-il démarré ?
- le firewall autorise-t-il Nginx/Cloudflare ?

### Console vide

```bash
curl -i -N \
  -H "Origin: https://<domaine>" \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "https://<domaine>/socket.io/?EIO=4&transport=websocket"
```

Attendu : **101 Switching Protocols**. Vérifier `Upgrade` / `Connection` dans Nginx, le WAF Cloudflare et Wings.

## 5. Authentification

### `Origine de la requête non autorisée (CSRF)`

`APP_URL` ne correspond pas à l'origine réelle. Corriger l'environnement et redémarrer.

### Cookie non conservé

- HTTPS en production ;
- `APP_URL` exact ;
- cookie `Secure` ;
- configuration du proxy.

### 2FA perdue

Utiliser un code de récupération ou la procédure de réinitialisation administrateur. Ne pas désactiver la 2FA globalement.

### Compte verrouillé

Attendre la durée de verrouillage ou appliquer la procédure de déverrouillage.

## 6. Permissions

1. Vérifier le rôle.
2. Vérifier `permissionsGranted` / `permissionsDenied`.
3. Se reconnecter.
4. Tester avec un compte de test.
5. Consulter l'audit.

## 7. Pterodactyl

| Erreur | Piste |
|---|---|
| 401 | Clé Client invalide ou expirée |
| 403 | Permission insuffisante ou serveur non partagé |
| Timeout | URL, DNS, firewall ou panel arrêté |
| Console vide | WebSocket Wings bloqué |
| Actions power absentes | `server.power` manquant ou clé limitée |

## 8. Fichiers

### Écriture refusée

- permission `files.write` ;
- session active ;
- verrou d'un autre utilisateur ;
- hash modifié : recharger (409).

### Upload refusé

Vérifier `MAX_FILE_SIZE_KB`, `MAX_ATTACHMENT_SIZE_KB`, la permission et l'en-tête `X-Ptero-Upload-Directory`.

### SFTP muet

Vérifier hôte, port, clé, utilisateur et pare-feu. Tester la lecture avant l'écriture.

## 9. Discord, IA et anticheat

- **Discord** : webhook actif, test, permission de publication, limites et logs 429.
- **IA** : sans clé, le générateur déterministe est normal.
- **Anticheat** : ressource `ensure`, token identique, URL d'ingestion accessible, pare-feu et heartbeat.

## 10. Site public et e-mail

- `/presentation` en 404 : le site n'est pas déployé sur le bon vhost.
- Page LWS par défaut : le paquet n'est pas publié.
- `contact@` non reçu : boîte externe, vérifier MX, SPF, DKIM et DMARC.
- Pages légales en brouillon : `LEGAL_DRAFT=true` ou champs manquants.

## 11. Commandes de secours

```bash
npm ci
npx prisma generate
npm run build
npx prisma migrate deploy
npm run db:seed
npm test
npm run verify -- --no-build
```

Avant toute opération destructive : dump de la base, copie de `.env`, snapshots et attachments.

## 12. FAQ

**Hébergement PHP mutualisé ?** Non : processus Node persistant, WebSockets et MariaDB requis.

**Docker obligatoire ?** Non. Un compose MariaDB est fourni, mais le déploiement de référence utilise Node + Nginx/systemd ou Pterodactyl.

**Pourquoi `/api/readyz` renvoie 503 en local ?** Base ou configuration non prête.

**Changer `APP_ENCRYPTION_KEY` ?** Pas sans migration : les secrets chiffrés deviendraient illisibles.

**Réinitialiser un mot de passe ?** Via la procédure administrateur, pas en modifiant la base à la main.

**Le site est-il en ligne ?** Vérifier [CHECKLIST.md](CHECKLIST.md) et les sondes publiques.
