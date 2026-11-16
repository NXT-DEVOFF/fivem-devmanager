# Intégrations externes

> Les secrets se configurent dans l'interface et sont chiffrés en base. Ne jamais les coller dans un ticket, un dépôt ou un message.

## 1. Pterodactyl

### Prérequis

- URL du panel Pterodactyl ;
- ID du serveur FiveM ;
- clé API Client créée dans `/account/api` ;
- accès réseau du dashboard vers le panel et Wings.

### Configuration

1. Ouvrir `/infrastructure`.
2. Renseigner URL, ID serveur et clé API Client.
3. Enregistrer et tester la connexion.
4. Vérifier statut, CPU/RAM/disque et uptime.
5. Ouvrir `/console` et vérifier le WebSocket.

### Erreurs

| Erreur | Cause probable |
|---|---|
| 401 | Clé invalide, expirée ou IP non autorisée |
| 403 | Permission insuffisante sur le serveur |
| Timeout | URL, DNS, pare-feu ou panel arrêté |
| Console vide | WebSocket Wings bloqué |

La clé Application est optionnelle ; ne pas l'utiliser si la clé Client suffit.

## 2. SFTP

Le SFTP complète l'API Pterodactyl pour la recherche de contenu et certaines opérations.

Configurer hôte, port, utilisateur, clé SSH et chemin racine. Utiliser un compte dédié, jamais root. Tester lecture, écriture et recherche.

## 3. Discord

1. Créer un webhook dans le salon cible.
2. Ouvrir `/discord`.
3. Ajouter le webhook, choisir le type et l'activer.
4. Envoyer un message de test.
5. Vérifier l'historique et l'idempotence.

Le backend applique les limites Discord, chiffre le webhook et évite les doublons par hash. Les réponses 429 sont retentées.

## 4. IA

```dotenv
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_API_KEY=
```

L'IA raffine les patch notes. Sans clé, un générateur déterministe est utilisé. Relire chaque contenu avant publication et ne jamais exposer la clé côté navigateur.

## 5. Anticheat

L'agent `fivem-resources/fdm-anticheat` est serveur autoritatif, en mode rapport :

- aucune punition automatique ;
- aucune ressource cliente ;
- aucune DLL.

### Installation

1. Copier la ressource dans le serveur FiveM.
2. Ajouter `ensure fdm-anticheat` au `server.cfg`.
3. Générer `ANTICHEAT_INGEST_TOKEN` dans l'environnement du panel.
4. Configurer la convar `fdm_anticheat_token` avec le même token.
5. Configurer l'URL d'ingestion et les ACE.
6. Redémarrer et vérifier le heartbeat dans `/anticheat`.
7. Tester avec `fdmac test`.

Détections : explosions, dégâts anormaux, entités massives, spawn de véhicules, projectiles, vitesse et déplacements suspects. Les alertes sont agrégées et conservées.

En réseau local, utiliser un endpoint privé et restreindre le port au pare-feu.

## 6. Keygate

- **Community** : `LICENSE_KEY` vide, `LICENSE_ENFORCE=false`.
- **Commercial** : `KEYGATE_URL`, `LICENSE_KEY` et `LICENSE_ENFORCE=true`.

La clé doit être dédiée au produit FiveM DevManager. Une licence révoquée ou expirée arrête le serveur.

## 7. Vérifications

```bash
curl -fsS https://<domaine>/api/health
curl -fsS https://<domaine>/api/readyz
```

Puis vérifier dans l'interface :

- Pterodactyl : statut et console ;
- SFTP : lecture et recherche ;
- Discord : message de test ;
- IA : génération relue ;
- anticheat : heartbeat et alerte de test ;
- Keygate : démarrage avec licence valide.

## 8. Sécurité

- Clés dédiées et limitées.
- Rotation après départ ou incident.
- Sauvegarde séparée de `APP_ENCRYPTION_KEY`.
- Aucun port Pterodactyl, SFTP ou MariaDB exposé sur Internet.
- Vérifier les logs après chaque changement.
