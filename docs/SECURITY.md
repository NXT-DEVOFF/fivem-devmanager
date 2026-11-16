# Securite

## Mesures implementees

### Authentification
- Mots de passe hashes avec **argon2id** (`@node-rs/argon2`, 19 456 Ko, 2 iterations).
- Politique : 12 caracteres minimum, majuscule, minuscule, chiffre.
- Sessions serveur : token 32 octets, stocke **hashe** (SHA-256), cookie `HttpOnly`,
  `SameSite=Lax`, `Secure` en production, expiration configurable (30 jours par defaut).
- Revocation par session, par appareil, ou globale (apres changement de mot de passe).
- Verrouillage progressif apres echecs + rate limiting par email/IP.
- 2FA TOTP (fenetre +/- 1 periode) et codes de recuperation hashes a usage unique.

### Autorisation
- RBAC a 4 roles + **permissions granulaires** (grant/deny).
- Verification cote serveur dans chaque Route Handler (`requirePermission`).
- Les composants clients masquent l'UI, mais ne constituent jamais la barriere de securite.
- Un auteur ne peut pas approuver ses propres patch notes ; un demandeur ne peut pas approuver
  son propre deploiement (sauf privilege de rollback).

### Protection des requetes
- Verification d'origine sur toutes les mutations (CSRF), en plus de `SameSite=Lax`.
- Validation stricte des entrees avec **Zod** (longueurs, enums, formats).
- Rate limiting en memoire pour la connexion et les operations sensibles.
- Reponses `Cache-Control: no-store` par defaut.
- CSP restrictive (Monaco servi localement, workers `blob:`), `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy`, `Permissions-Policy`.

### Secrets
- Cle API Pterodactyl, cle Application, identifiants SFTP et webhooks Discord : **AES-256-GCM**
  avec IV aleatoire et tag d'authentification.
- La cle maitresse `APP_ENCRYPTION_KEY` n'est jamais stockee en base ni renvoyee par l'API.
- Les valeurs ne sont jamais renvoyees au navigateur (uniquement `hasKey: true/false`).

### Fichiers
- Normalisation absolue des chemins, refus de `..`, des antislashs et des caracteres nuls.
- Taille maximale configurable, refus du binaire dans l'editeur.
- Verrou applicatif + controle de hash pour eviter l'ecrasement concurrent.
- Suppression protegee par confirmation explicite (`SUPPRIMER`) et interdiction sur `/resources`.
- Telechargement via URL signee Pterodactyl, jamais de proxy de fichier arbitraire.
- Aucun acces shell systeme : seul l'API Pterodactyl/Wings est utilisee.

### Injection / XSS
- Prisma avec requetes parametrees (pas de SQL brut, sauf `SELECT 1` de sante).
- React echappe le contenu ; aucun `dangerouslySetInnerHTML`.
- Les patch notes sont du markdown affiche dans un editeur (texte), pas interprete en HTML.
- Les contenus Discord sont nettoyes avant publication (URLs, IPs, chemins, emails, secrets).

### Audit
- Journal immuable : aucune route de modification/suppression.
- Connexions, changements de permissions, commandes console, fichiers, validations, deploiements,
  publications Discord.
- Metadonnees nettoyees : les cles sensibles sont remplacees par `[redacted]`.

### Exploitation
- Arret gracieux sur SIGTERM/SIGINT (Pterodactyl).
- Pas de port code en dur (`PORT`/`SERVER_PORT`).
- Erreurs internes journalisees, message generique renvoye au client.
- Pas de source maps exposees dans les assets publics.

## Recommandations de deploiement

1. HTTPS obligatoire (reverse proxy), `APP_URL` exact.
2. Base MariaDB/MySQL non exposee publiquement, mot de passe fort.
3. Cle API Pterodactyl dediee, limitee au serveur FiveM, rotationnelle.
4. 2FA obligatoire pour les comptes SUPER_ADMIN/ADMIN.
5. Sauvegardes chiffrees de la base **et** de `var/snapshots`.
6. `APP_ENCRYPTION_KEY` conservee dans un gestionnaire de secrets : sa perte rend les
   integrations illisibles.
7. Journalisation systeme (stdout) collectee par l'hebergeur.
8. Mises a jour : lire les migrations avant `prisma migrate deploy`.

## Signaler une vulnerabilite

Contactez l'administrateur du deploiement. Ne publiez pas de details d'exploitation dans les
patch notes publiques ni dans les canaux Discord ouverts.
