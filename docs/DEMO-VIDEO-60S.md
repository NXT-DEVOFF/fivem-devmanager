# Script de démo vidéo — FiveM DevManager

**Durée : 60 secondes · Format : 16:9 · 1920 × 1080 · 30 fps minimum**

## Intention

Montrer en une minute que FiveM DevManager n'est pas un énième tableau de bord :
c'est le poste de commande complet d'une équipe FiveM, du premier commit au
patch note publié. Le ton est calme, précis et orienté bénéfice. Pas de
superlatifs, pas de fausse promesse : chaque plan montre une action réelle.

**Public :** propriétaires de serveurs FiveM, lead devs, équipes RP.
**Message final :** « Livrez plus vite. Gardez le contrôle. »

## Les cinq fonctionnalités retenues

| # | Fonctionnalité | Bénéfice vendu |
|---|---|---|
| 01 | **Cockpit temps réel** | Un seul écran pour voir le serveur, le sprint et l'équipe. |
| 02 | **FiveM Studio + builder MLO 3D** | 118 générateurs et un vrai gain de temps sur le boilerplate. |
| 03 | **Sessions, tâches et rapports** | Du temps mesuré côté serveur et des rapports PDF générés automatiquement. |
| 04 | **Anticheat server-authoritative** | Des preuves exploitables, sans DLL cliente ni ban automatique. |
| 05 | **Éditeur, déploiements et patch notes Discord** | Livrer avec snapshot et rollback, puis communiquer sans copier-coller. |

---

## Timeline

### 00:00–00:04 — Accroche

**Image**
Fond noir. Le logo 3D FiveM DevManager apparaît en six images, avec un halo
violet discret. Cut sec sur quatre plans très courts (six images chacun) :
graphe du cockpit, diff dans Monaco, viewport MLO 3D, alerte anticheat.

**Voix off**
> Un serveur FiveM, c'est une équipe, des joueurs… et des angles morts.

**Texte à l'écran**
- `FIVEM DEVMANAGER`
- `Le cockpit FiveM`

**Son**
Impact grave + whoosh. La musique démarre réellement à 00:04.

---

### 00:04–00:14 — 01 · Cockpit temps réel

**Image**
Page `/dashboard` avec un compte de démo propre. Léger push-in de 100 % à
106 %. Le curseur met en évidence, dans cet ordre :

1. l'anneau de santé et les KPI ;
2. le statut Pterodactyl, le CPU et la RAM ;
3. le sprint actif et sa progression ;
4. le fil « Activité en direct ».

Un nouvel événement arrive dans le fil en temps réel : il glisse et s'illumine
pendant une seconde.

**Voix off**
> Le cockpit FiveM DevManager centralise la santé du serveur, les ressources
> Pterodactyl, le sprint en cours et l'activité de l'équipe, en temps réel.
> Tout est là.

**Texte à l'écran**
- `01 · COCKPIT TEMPS RÉEL`
- Bas de l'écran : `Pterodactyl · Sprint · Activité live`

**Son**
Nappe électronique discrète. Tick UI à chaque surbrillance. Chime léger quand
l'événement live apparaît.

---

### 00:14–00:26 — 02 · FiveM Studio

**Image**
Page `/studio` : catalogue, recherche « MLO », catégories visibles.
Cut vers `/mlo/builder` : viewport Three.js, orbite lente autour d'un petit
volume de villa. Le curseur déplace une pièce ou un portail, les coordonnées
se mettent à jour, puis clic sur le bouton de génération de ressource.

Enchaîner sur l'arborescence générée et le ZIP téléchargé. Match cut vers
`/vehicles` : diagnostic de handling, score et statistiques.

Dernier plan : split screen « 3D + fichiers générés ».

**Voix off**
> FiveM Studio, ce sont cent dix-huit outils. Construisez un MLO en trois
> dimensions, exportez une ressource CodeWalker, ou générez un handling
> véhicule complet. Sans quitter le panel.

**Texte à l'écran**
- `02 · FIVEM STUDIO`
- `118 OUTILS`
- Trois badges : `MLO 3D`, `HANDLING`, `CODEWALKER`

**Son**
Whoosh sur le passage catalogue → builder. Clics de souris naturels. Bruit de
clavier très léger sur la génération.

---

### 00:26–00:36 — 03 · Sessions et rapports

**Image**
Page `/sessions` : session active, chronomètre lisible. Cut vers `/tasks` :
kanban, glisser une tâche de « En cours » vers « Terminé ». Le panneau de
validation affiche les critères satisfaits.

Retour à la session : clic sur « Terminer la session », saisie d'un résumé
court, confirmation. Toast « Rapport généré ». Afficher la première page du
PDF.

**Voix off**
> Lancez une session : le chronomètre est calculé côté serveur. Tâches, fichiers
> et bugs sont liés au travail réel. À la clôture, le rapport PDF est généré
> automatiquement.

**Texte à l'écran**
- `03 · SESSIONS & RAPPORTS`
- `Chronomètre serveur`
- `PDF automatique`

**Son**
Tick d'horloge très bas. Clic de drag & drop. Chime de complétion à l'ouverture
du rapport.

---

### 00:36–00:46 — 04 · Anticheat

**Image**
Page `/anticheat` : cartes de synthèse, heartbeat de l'agent « en ligne »,
liste d'alertes. Ouvrir une alerte générée en environnement de démo.

Le panneau de détail montre : type de détection, ressource, horodatage, nombre
d'occurrences et preuves techniques. Le joueur et la licence sont masqués.

Choisir « Résolu » ou « Faux positif », confirmer. Toast de prise en compte.
Aucun bouton de ban n'est utilisé.

**Voix off**
> L'anticheat est server-authoritative : aucune DLL, aucune ressource cliente.
> Il détecte, agrège et conserve les preuves. Vous analysez, vous décidez.
> Aucune sanction automatique.

**Texte à l'écran**
- `04 · ANTICHEAT`
- `MODE RAPPORT`
- `Server-authoritative`
- `Preuves conservées`
- `Zéro ban automatique`

**Son**
Ping radar discret. Nappe tendue mais non alarmiste. Clic de résolution.

---

### 00:46–00:56 — 05 · Éditer, déployer, communiquer

**Image**
Page `/editor` : Monaco ouvert sur un fichier Lua de démo. Modifier une ligne,
montrer l'autosave puis le diff. Ouvrir le snapshot.

Cut vers `/deployments` : ligne « En attente », clic sur « Approuver » puis
« Exécuter » sur une ressource de démo. Statut « Déployé », nombre de fichiers
sauvegardés visible. Survoler « Rollback » sans cliquer.

Cut vers `/patch-notes` : brouillon généré depuis la session, validation
humaine, aperçu du post Discord, clic sur « Publier sur Discord » via un
webhook de test. Montrer l'embed publié dans un canal de test.

**Voix off**
> Éditez dans Monaco, comparez, créez un snapshot. Déployez avec approbation
> et rollback. Puis publiez les patch notes sur Discord, sans copier-coller.

**Texte à l'écran**
- `05 · ÉDITER · DÉPLOYER · COMMUNIQUER`
- Quatre badges : `MONACO`, `SNAPSHOT`, `ROLLBACK`, `DISCORD`

**Son**
Clavier, confirmation de déploiement, notification Discord.

---

### 00:56–01:00 — Signature

**Image**
Logo 3D centré sur fond sombre, halo qui respire une dernière fois. Texte qui
apparaît en deux temps : le nom, puis la signature.

**Voix off**
> FiveM DevManager. Livrez plus vite. Gardez le contrôle.

**Texte à l'écran**
- `FIVEM DEVMANAGER`
- `Livrez plus vite. Gardez le contrôle.`
- `Self-hosted · Managed`
- `Démo privée sur demande`

**Son**
Résolution musicale. Impact doux sur le logo. Silence propre sur la dernière
image.

---

## Voix off seule

À enregistrer d'une traite, puis à caler sur les timecodes. Débit visé :
environ 150 mots par minute, avec des respirations courtes.

```text
[0:00] Un serveur FiveM, c'est une équipe, des joueurs… et des angles morts.

[0:04] Le cockpit FiveM DevManager centralise la santé du serveur, les
ressources Pterodactyl, le sprint en cours et l'activité de l'équipe, en temps
réel. Tout est là.

[0:14] FiveM Studio, ce sont cent dix-huit outils. Construisez un MLO en
  trois dimensions, exportez une ressource CodeWalker, ou générez un handling
  véhicule complet. Sans quitter le panel.

[0:26] Lancez une session : le chronomètre est calculé côté serveur. Tâches,
fichiers et bugs sont liés au travail réel. À la clôture, le rapport PDF est
généré automatiquement.

[0:36] L'anticheat est server-authoritative : aucune DLL, aucune ressource
cliente. Il détecte, agrège et conserve les preuves. Vous analysez, vous
décidez. Aucune sanction automatique.

[0:46] Éditez dans Monaco, comparez, créez un snapshot. Déployez avec
approbation et rollback. Puis publiez les patch notes sur Discord, sans
copier-coller.

[0:56] FiveM DevManager. Livrez plus vite. Gardez le contrôle.
```

---

## Préparation du tournage

### 1. Environnement de démo

- Utiliser une **instance de démonstration dédiée**, jamais la production.
- Préparer un compte `lead dev` avec les permissions nécessaires et un compte
  `developer` pour la partie session/tâches.
- Créer les données avant le tournage : un sprint actif, 3 à 5 tâches, un bug,
  une session en cours, un projet MLO simple, une ressource de déploiement de
  test et 2 ou 3 alertes anticheat synthétiques.
- Pour l'anticheat, utiliser `fdmac test` ou un payload de test avec un joueur
  factice. Ne jamais filmer une alerte réelle avec des données de joueur.
- Pour Discord, utiliser un **webhook de test** et un salon privé.

### 2. Données à masquer impérativement

- clé de licence et jeton admin ;
- clés API Pterodactyl, SFTP et Discord ;
- URL de webhook Discord ;
- licences FiveM, Steam Hex, adresses IP et identifiants de joueurs réels ;
- toute donnée personnelle ou secret présent dans un fichier ouvert.

Prévoir un flou de sécurité en post-production, même si les données semblent
inoffensives. Mieux vaut flouter trop que publier une clé.

### 3. Navigateur et machine

- Chrome ou Edge, profil propre, 1920 × 1080, zoom 100 %.
- Barre de favoris masquée, notifications système coupées, mode sombre.
- Curseur agrandi et mouvements lents ; activer la surbrillance des clics.
- Fermer les onglets et extensions inutiles.
- Désactiver les animations système trop rapides ; garder les transitions de
  l'interface visibles.

### 4. Capture

- Enregistrement 1920 × 1080, 30 fps minimum ; 60 fps si disponible.
- Débit master élevé (H.264, 15–20 Mbps) pour préserver les textes fins.
- Enregistrer la voix off séparément, en 48 kHz, avec un micro cardioïde.
- Prévoir une piste de SFX séparée : clics, whoosh, chimes, notification.

---

## Montage et export

### Rythme

- Coupes franches entre les fonctionnalités ; pas de transitions spectaculaires.
- Les lower-thirds entrent en 8 images et sortent en 6 images.
- Laisser respirer chaque plan au moins 1,5 seconde après une action.
- Ne jamais filmer un écran statique plus de 2 secondes sans mouvement de
  curseur, de graphique ou de texte.

### Habillage

- Utiliser le kit `public/brand/` : logo 3D, violet `#5865F2`, cyan `#38BDF8`,
  vert `#22C55E`.
- Incrustations en bas à gauche, avec une marge de sécurité de 64 px.
- Textes blancs ou `#CBD2E5`, jamais plus de deux tailles de police à l'écran.
- Sous-titres français incrustés pour les lecteurs sans son.

### Exports

| Usage | Réglage |
|---|---|
| Master | 1920 × 1080, H.264, 30 fps, AAC 48 kHz, ~12–16 Mbps |
| Discord | 1280 × 720, H.264, 30 fps, ~1,2–1,5 Mbps, viser moins de 10 Mo |
| Réseaux sociaux | 1080 × 1080 ou 1080 × 1920, recadrage avec marges de sécurité |

Vérifier le rendu sur un écran de téléphone : les textes du cockpit et des
badges doivent rester lisibles en 720p.

---

## Checklist avant publication

- [ ] Aucune clé, aucun token, aucune donnée joueur réelle visible.
- [ ] Les cinq fonctionnalités sont nommées et illustrées.
- [ ] Le mot « démo » ou « environnement de démonstration » est mentionné si
      les données ne sont pas de production.
- [ ] La voix off tient en 60 secondes, sans accélération artificielle.
- [ ] Le fichier Discord fait moins de 10 Mo et reste lisible.
- [ ] Les sous-titres sont synchronisés et sans faute.
- [ ] Le logo et les couleurs correspondent au kit `public/brand/`.
- [ ] Le CTA final est clair : démo privée sur demande, sans exposer l'URL du
      panel.
