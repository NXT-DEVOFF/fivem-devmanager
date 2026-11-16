# Checklist de mise en ligne

> Le code peut être prêt sans que le site public soit en ligne. Cette checklist sépare les deux.

## 1. Préflight local

- [ ] `npm ci` sans erreur.
- [ ] `npm run typecheck` : exit 0.
- [ ] `npm run lint` : exit 0.
- [ ] `npm test` : 135/135.
- [ ] `npm run verify:all -- --no-build` : 4/4.
- [ ] `APP_URL=https://<domaine> npm run build` : exit 0.
- [ ] Aucun secret dans `public/`, `.next/`, les logs ou Git.
- [ ] Média du teaser présent.

## 2. Base et configuration

- [ ] MariaDB/MySQL créée et accessible.
- [ ] `DATABASE_URL` correcte.
- [ ] `APP_ENCRYPTION_KEY` et `APP_SECRET` générés et sauvegardés.
- [ ] `APP_URL` exact, HTTPS, sans slash final.
- [ ] `SEED_ADMIN_*` renseigné pour le premier seed.
- [ ] `LEGAL_*` renseigné si les pages légales doivent être publiées.
- [ ] `LICENSE_KEY` vide en Community ; clé dédiée en Commercial.
- [ ] `DEMO_MODE=false` en production.

## 3. Serveur

- [ ] Node >= 20.11, idéalement 22 LTS.
- [ ] 2 vCPU / 4 Go minimum.
- [ ] Nginx + TLS + WebSocket.
- [ ] `3000` et `3306` en loopback.
- [ ] SSH par clé, root direct désactivé, fail2ban.
- [ ] Service systemd ou Pterodactyl avec redémarrage automatique.
- [ ] Logs et rotation.
- [ ] Sauvegardes base + snapshots + attachments.

## 4. Déploiement

- [ ] Artefact sans `node_modules` Windows.
- [ ] `npm ci` sur la plateforme cible.
- [ ] `prisma generate`, `build`, `migrate deploy`, `db:seed`.
- [ ] `[server] pret` dans les logs.
- [ ] `/api/health` et `/api/readyz` corrects.
- [ ] `/dashboard` protégé.
- [ ] WebSocket : 101.
- [ ] `/presentation` 200.
- [ ] `/robots.txt` et `/sitemap.xml` 200.
- [ ] Média `video/mp4` avec Range.
- [ ] Canonical et Open Graph corrects.

## 5. Sécurité

- [ ] HTTPS forcé et certificat valide.
- [ ] 2FA pour les administrateurs.
- [ ] Comptes nominatifs et permissions vérifiées.
- [ ] Sessions révoquées après tests.
- [ ] Aucun secret dans Git, `public/` ou les logs.
- [ ] `APP_ENCRYPTION_KEY` sauvegardée hors serveur.
- [ ] Sauvegardes chiffrées et restauration testée.
- [ ] WAF/cache Cloudflare ne bloquent pas `/api/` ou `/socket.io/`.

## 6. État actuel

- [x] Code et paquet de release prêts.
- [x] Typecheck, lint, build et 135 tests validés.
- [x] Correctif de redirection publique intégré.
- [ ] `https://bl-host.site` publié.
- [ ] `/presentation` public.
- [ ] Boîte `contact@bl-host.site` créée et testée.
- [ ] Pages légales complètes et publiées.
- [ ] Clé Keygate dédiée émise.

Tant que ces cases ne sont pas cochées, le site est **techniquement prêt mais pas en ligne**.

## 7. Après la mise en ligne

- [ ] Connexion depuis un appareil externe.
- [ ] 2FA et code de récupération.
- [ ] Pterodactyl, console et WebSocket.
- [ ] Tâche et bug de test créés puis supprimés.
- [ ] Permissions avec un compte non-admin.
- [ ] Sauvegarde et restauration.
- [ ] `contact@` depuis un appareil externe.
- [ ] Logs surveillés 24 h.
- [ ] URL, version et accès documentés dans le gestionnaire de secrets.

## 8. Scripts

| Commande | Usage |
|---|---|
| `npm run dev` | Développement |
| `npm run build` | Build production |
| `npm run start` | Serveur de production |
| `npm run db:migrate` | Migrations |
| `npm run db:seed` | Admin + réglages |
| `npm run db:seed:demo` | Démo hors production |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run test:api` | Smoke API |
| `npm run verify:all` | Panel + gate + tests |
| `npm run secret:generate` | Secrets |

## 9. Routes

### Public

`/presentation`, `/mentions-legales`, `/confidentialite`, `/login`, `/change-password`, `/robots.txt`, `/sitemap.xml`, `/media/*`.

### Santé

`/api/health`, `/api/readyz`.

### Application

`/dashboard`, `/sessions`, `/sprints`, `/incidents`, `/maintenance`, `/tasks`, `/bugs`, `/reports`, `/patch-notes`, `/assistant`, `/analytics`, `/players`, `/anticheat`, `/events`, `/editor`, `/snippets`, `/docs`, `/files`, `/resources`, `/sync`, `/quality`, `/server-config`, `/terminal`, `/console`, `/deployments`, `/studio`, `/vehicles`, `/mlo`, `/mlo/builder`, `/mappings`, `/knowledge`, `/team`, `/users`, `/notifications`, `/backups`, `/infrastructure`, `/monitoring`, `/diagnostics`, `/discord`, `/audit-logs`, `/settings`.
