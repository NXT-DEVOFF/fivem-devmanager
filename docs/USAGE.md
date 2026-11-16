# Guide d'utilisation du panel

> Les entrées de menu sont filtrées selon les permissions. Une action absente peut signifier un droit manquant, pas un bug.

## 1. Première connexion

1. Ouvrir `https://<domaine>/login`.
2. Se connecter avec le compte créé par le seed ou par un administrateur.
3. Si le changement de mot de passe est obligatoire, l'application redirige vers `/change-password`.
4. Activer la 2FA TOTP et conserver les codes de récupération.
5. Vérifier que le menu correspond au rôle.

## 2. Navigation

| Section | Pages |
|---|---|
| Pilotage | Dashboard, Sessions, Sprints, Incidents, Maintenance, Tâches, Bugs, Rapports, Patch notes, Assistant IA, Statistiques |
| Communauté | Joueurs, Anticheat, Événements |
| Développement | Éditeur, Snippets, Documentation, Fichiers, Ressources, Synchronisation, Qualité, Config serveur, Terminal, Console, Déploiements |
| FiveM Studio | Catalogue, Debug véhicules, Constructeur MLO, Builder MLO 3D, Carte des mappings |
| Équipe | Connaissances, Équipe, Utilisateurs, Notifications |
| Système | Sauvegardes, Infrastructure, Surveillance, Diagnostic, Discord, Journal d'audit, Paramètres |

## 3. Cockpit

Le dashboard affiche :

- la santé du panel, de la console, des incidents et des déploiements ;
- les KPI et le pouls de l'équipe ;
- l'état Pterodactyl, CPU/RAM/disque et uptime ;
- le sprint actif et les priorités ;
- le fil d'activité en direct ;
- les actions rapides.

Les widgets peuvent être personnalisés par appareil.

## 4. Session de développement

1. Ouvrir `/sessions`.
2. Démarrer une session ; une seule session active par développeur.
3. Le temps est calculé côté serveur à partir des timestamps.
4. Utiliser pause, reprise, changement de tâche et notes.
5. L'inactivité génère un rappel, jamais une déduction silencieuse.
6. Terminer la session génère un rapport exploitable et exportable en PDF.

## 5. Tâches

- Kanban à 7 colonnes, priorités, catégories, ressources et fichiers.
- Checklist, sous-tâches, dépendances, commentaires et pièces jointes.
- Estimation et temps réel.
- Validation par critères : fichiers modifiés, session, checklist, tests, commentaire et dépendances.
- L'auto-validation n'est possible que si la tâche est explicitement configurée ainsi.
- Toute validation forcée est journalisée.

## 6. Bugs

- Décrire les étapes de reproduction, le résultat attendu et le résultat observé.
- Joindre logs et captures.
- Définir gravité, responsable et ressource.
- Fermer après correction validée.
- Le bug peut être rapproché d'une tâche et d'un changement de fichier.

## 7. Sprints, incidents et maintenance

- **Sprints** : objectif, dates, tâches rattachées et progression sur les tâches terminées.
- **Incidents** : `INC-xxxx`, gravité, statut `OPEN → INVESTIGATING → MITIGATED → RESOLVED`, responsable et résolution.
- **Maintenance** : fenêtres `PLANNED → IN_PROGRESS → COMPLETED/CANCELED`, périmètre et impact joueurs.

## 8. Éditeur et fichiers

1. Ouvrir `/files` ou `/editor`.
2. Choisir une ressource et un fichier.
3. Monaco est servi localement.
4. Utiliser les onglets, l'autosave, le diff, `Ctrl+S` et `Ctrl+P`.
5. Les snippets FiveM sont disponibles pour `RegisterCommand`, `TriggerEvent`, `oxmysql`, etc.

Sécurité des écritures :

- verrou par fichier ;
- contrôle de hash et réponse 409 en cas de conflit ;
- snapshot avant écriture ;
- session active requise ;
- suppression par confirmation explicite ;
- binaires non éditables dans l'éditeur texte.

## 9. Ressources et synchronisation

- `/resources` synchronise les ressources et lit les `fxmanifest.lua`.
- `/sync` affiche les versions, la fraîcheur et les modifications ou suppressions distantes.
- `/quality` regroupe les contrôles qualité.
- `/mappings` analyse les `.ymap.xml`, `mlo.config.json` et `interiorproxies.meta`.

## 10. Console et déploiements

- `/console` affiche la console temps réel via WebSocket Wings.
- L'envoi de commandes nécessite `server.console.send`.
- `/terminal` est réservé aux profils autorisés.
- `/deployments` gère demande, approbation, exécution et rollback.
- Un déploiement vérifie la ressource, crée un snapshot et ne redémarre jamais tout le serveur automatiquement.

## 11. FiveM Studio

- `/studio` : 118 outils, recherche, filtres et formulaires.
- `/vehicles` : handling, presets, score, génération et audit croisé.
- `/mlo` : scaffold CodeWalker, pièces, volumes, portails, proxies et validation.
- `/mlo/builder` : viewport 3D, caméra orbitale, coordonnées, import/export JSON et génération.
- `/mappings` : carte, filtres et export des coordonnées.

Les exécutions sont protégées par `studio.view` / `studio.use` et auditées.

## 12. Rapports, patch notes et Discord

1. Générer un rapport depuis une session ou une période.
2. Créer des patch notes depuis les tâches terminées et bugs corrigés.
3. Relire le contenu ; sans clé IA, le générateur est déterministe.
4. Faire approuver les notes ; un auteur ne peut pas approuver les siennes.
5. Publier vers Discord si `patchnotes.publish` est accordé.
6. Vérifier l'historique et l'idempotence.

Les URLs, IPs, chemins, e-mails et secrets sont nettoyés avant publication publique.

## 13. Communauté et connaissance

- `/players` : fiches, licences et sanctions `SAN-xxxx`.
- `/anticheat` : alertes, preuves, heartbeat et traitement.
- `/events` : planning `EVT-xxxx`.
- `/knowledge` : articles, catégories, tags et recherche.
- `/team` : charge de l'équipe.
- `/notifications` : préférences par catégorie.

## 14. Bonnes pratiques

- Une tâche = un résultat vérifiable.
- Rattacher fichiers et ressource avant de commencer.
- Vérifier les permissions plutôt que partager un compte admin.
- Ne jamais fermer une tâche sans preuve de test.
- Consulter le journal d'audit après une action sensible.
