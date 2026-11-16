# Administration, rôles et permissions

> Le contrôle d'accès est appliqué côté serveur. Masquer un bouton dans l'interface ne protège rien.

## 1. Rôles

| Rôle | Portée |
|---|---|
| `SUPER_ADMIN` | Toutes les permissions, sauf deny explicite |
| `ADMIN` | Développement + utilisateurs, paramètres, intégrations, audit, serveur, sauvegardes, Discord, rollback |
| `LEAD_DEV` | Développement + tâches, sprints, incidents, déploiements, sanctions, anticheat, événements, connaissances |
| `DEVELOPER` | Sessions, tâches, bugs, fichiers, éditeur, console en lecture, rapports personnels, Studio |

## 2. Résolution des permissions

Pour chaque utilisateur :

1. permissions par défaut du rôle ;
2. ajout de `permissionsGranted` ;
3. retrait de `permissionsDenied`.

`hasPermission()` est la source de vérité. Chaque Route Handler sensible appelle `requirePermission()`. Un `SUPER_ADMIN` possède toutes les permissions, mais un deny explicite peut lui en retirer une.

## 3. Familles de permissions

- **Administration** : `users.manage`, `users.view`, `settings.manage`, `integrations.manage`, `audit.view`, `roles.manage`.
- **Infrastructure** : `server.view`, `monitoring.view`, `server.power`, `server.console`, `server.console.send`, `backups.view`, `backups.manage`, `server.logs`, `resources.view`, `resources.manage`.
- **Fichiers** : `files.view`, `files.write`, `files.upload`, `files.download`, `files.search`, `files.restore`, `sync.manage`, `editor.use`, `snippets.view`, `snippets.manage`.
- **Travail** : `sessions.*`, `tasks.*`, `sprints.*`, `incidents.*`, `bugs.*`, `reports.*`, `patchnotes.*`.
- **Communauté** : `players.*`, `sanctions.*`, `anticheat.*`, `events.*`.
- **Déploiements** : `deployments.view`, `deployments.request`, `deployments.approve`, `deployments.execute`, `deployments.rollback`.
- **Divers** : `notifications.view`, `analytics.view`, `terminal.use`, `studio.view`, `studio.use`.

## 4. Créer un utilisateur

1. Ouvrir `/users` avec `users.manage`.
2. Créer le compte avec nom, e-mail, identifiant et rôle.
3. Un mot de passe temporaire est généré ; l'utilisateur doit le changer.
4. Vérifier les permissions effectives avant de communiquer l'accès.
5. Demander l'activation de la 2FA.

Un compte par personne, jamais de compte partagé.

## 5. Modifier les permissions

- Accorder un droit via `permissionsGranted`.
- Retirer un droit via `permissionsDenied`.
- Tester avec un compte non-admin.
- Documenter la raison du changement.

Exemples :

- Publication de ressource : `files.write` ou `resources.manage` selon le besoin.
- Approbation de déploiement : `deployments.approve` et `deployments.execute`.
- Support en lecture : `incidents.view` et `server.view`, sans `server.power`.

## 6. Sécurité des comptes

- Mot de passe : 12 caractères minimum, majuscule, minuscule et chiffre.
- 2FA recommandée pour tous, obligatoire pour les administrateurs.
- Verrouillage après échecs répétés et rate limiting.
- Révocation d'une session ou de toutes les sessions.
- Procédure de récupération 2FA documentée.

## 7. Audit et sécurité

Le journal `/audit-logs` est immuable. Il enregistre les connexions, changements de permissions, commandes console, fichiers, validations, déploiements et publications Discord. Les secrets sont remplacés par `[redacted]`.

Le centre de sécurité affiche les sessions, appareils, événements de connexion et état de la 2FA.

## 8. Paramètres

`/settings` permet de gérer le nom du serveur, la version, le seuil d'inactivité et les préférences générales. Les secrets et l'URL publique restent dans l'environnement.

## 9. Séparation des duties

- Un demandeur ne peut pas approuver son propre déploiement, sauf privilège de rollback.
- Un auteur ne peut pas approuver ses propres patch notes.
- Les actions power et les commandes console sont permissionnées.
- Le serveur complet n'est jamais redémarré automatiquement par un déploiement.

## 10. Anti-lockout

Avant de modifier les rôles :

1. vérifier qu'au moins deux `SUPER_ADMIN` actifs existent ;
2. ne pas retirer sa propre permission de gestion des utilisateurs ;
3. tester avec un compte non-admin ;
4. conserver une session admin ouverte ;
5. documenter la modification.

## 11. Bonnes pratiques

- Moindre privilège.
- Permissions temporaires plutôt que comptes partagés.
- Revue trimestrielle des comptes.
- Révocation immédiate au départ d'un membre.
- 2FA sur tous les comptes administratifs.
- Journal d'audit sauvegardé.
- Compte `SEED_ADMIN` réservé à l'initialisation.
