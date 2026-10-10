# La vitesse vécue par les visiteurs : règles de /pulse:perf

Référence de `/pulse:perf`, valable pour toutes les technologies. Les corrections propres à une pile viennent du pack de pile (section « Pack de pile » du contexte). Faits relevés le 2026-10-07 sur Lighthouse 13.5.0 et les documentations officielles de Google (web.dev, developer.chrome.com, developers.google.com).

## 1. Ce que l'on mesure, et pourquoi

La vitesse sert **d'abord les visiteurs** : une page qui s'affiche vite, ne saute pas et réagit tout de suite garde ses visiteurs.

Phrase juste sur Google, à reprendre telle quelle : « Google tient compte de l'expérience des vrais visiteurs, parmi beaucoup d'autres signaux ; la pertinence du contenu passe avant. Le score de la simulation Lighthouse n'est pas utilisé pour le classement. » Sources : developers.google.com/search/docs/appearance/page-experience (« There is no single signal », « Google Search always seeks to show the most relevant content, even if the page experience is sub-par »).

Trois mesures comptent pour les visiteurs (les **Core Web Vitals**) :

| Mesure | Nom affiché | Image du quotidien |
|---|---|---|
| LCP (Largest Contentful Paint) | Affichage du contenu principal | le plat principal arrive sur la table |
| CLS (Cumulative Layout Shift) | Stabilité de la page | la page qui saute au moment où l'on veut cliquer |
| INP (Interaction to Next Paint) | Réaction aux clics | le serveur du restaurant qui vous entend tout de suite, ou pas |

En simulation, l'INP n'existe pas (il faut de vraies interactions) : on lit à sa place le **TBT** (« Blocages pendant le chargement »).

## 2. Les seuils

| Mesure | Bon | À améliorer | Mauvais | Statut |
|---|---|---|---|---|
| LCP | ≤ 2,5 s | 2,5 à 4 s | > 4 s | Core Web Vital |
| INP | ≤ 200 ms | 200 à 500 ms | > 500 ms | Core Web Vital (terrain seulement) |
| CLS | ≤ 0,1 | 0,1 à 0,25 | > 0,25 | Core Web Vital |
| FCP (premier affichage) | ≤ 1,8 s | 1,8 à 3 s | > 3 s | diagnostic |
| TTFB (réponse du serveur) | ≤ 0,8 s | 0,8 à 1,8 s | > 1,8 s | diagnostic |
| TBT (simulation) | ≤ 200 ms | 200 à 600 ms | > 600 ms | équivalent de laboratoire de l'INP |
| Score de performance (simulation) | ≥ 90 | 50 à 89 | < 50 | indicateur de diagnostic |

- Feux : 🟢 bon, 🟠 à améliorer, 🔴 mauvais. `pulse-aidd perf` les calcule.
- Sur le terrain, une page « réussit » les Core Web Vitals quand **les trois** (LCP, INP, CLS) sont bons au **75e centile** des visites, séparément sur mobile et sur ordinateur (web.dev/articles/vitals).
- Au-dessus de 90, le gain n'est plus perceptible pour les visiteurs : visez le vert, sans courir après le 100.
- Score de performance (Lighthouse 10 à 13) : TBT 30 %, LCP 25 %, CLS 25 %, FCP 10 %, Speed Index 10 %.

## 3. Deux sources, toujours séparées

| | Simulation (laboratoire) | Vrais visiteurs (terrain) |
|---|---|---|
| Outil | Lighthouse : par PageSpeed Insights (serveurs de Google, clé) ou en local (`npx lighthouse`, sans clé) | API CrUX (clé), ou mesure réelle installée sur le site (recette du pack) |
| Ce que c'est | un chargement simulé : téléphone moyen, 4G lente (150 ms de latence, 1,6 Mbit/s), processeur ralenti 4 fois | les visites de Chrome des 28 derniers jours, 75e centile |
| Sert à | trouver les causes, comparer avant et après | savoir ce que vivent les visiteurs ; c'est ce que Google regarde |
| Limites | varie d'un passage à l'autre ; ne voit pas l'INP | Chrome seulement (pas d'iPhone, de Safari ni de Firefox) ; un seuil de trafic non publié ; premier chargement de chaque visite seulement |

- Chaque chiffre affiché dit sa source : « Simulation : téléphone moyen en 4G lente » ou « Vos vrais visiteurs (Chrome), sur 28 jours ». Un tableau présente une seule source.
- **Pas de données CrUX** (`pulse-aidd perf terrain` répond « Pas encore de données ») : c'est normal pour un site récent ou peu visité. Proposer la mesure réelle (`/pulse:perf suivre`), qui donne des chiffres dès les premières visites.
- **Navigations internes** : un site qui change de page sans recharger (application d'une seule page) n'est mesuré qu'au premier chargement par CrUX et la simulation.
- Le terrain renvoyé par PageSpeed Insights est en sursis (retrait annoncé par Google, sans date) : `pulse-aidd perf` le garde à part dans le JSON (`terrainPsi`) ; lisez le terrain avec `pulse-aidd perf terrain`.

## 4. Mesurer correctement

**Les pages.** Une page par gabarit, 3 à 5 au total : l'accueil, une liste, un détail, une page publique de formulaire (contact, connexion). La personne valide la liste ; elle s'écrit dans « Pages suivies » de `docs/performance.md`, et chaque mesure reprend ces pages. Les pages réservées aux personnes connectées restent hors de la mesure : le dire.

**Ce qui est mesuré.** Le site **construit pour la production** : le site en ligne (PageSpeed Insights ou local), ou la construction locale lancée en mode production (commandes « construire » puis « lancer en production » de `docs/technical.md`). Le mode développement donne des chiffres sans rapport avec la réalité. Les adresses de prévisualisation protégées par l'hébergeur restent inaccessibles à PageSpeed Insights.

**Choisir la source.**
- Clé Google présente et site en ligne : PageSpeed Insights (chiffres comparables d'un poste à l'autre).
- Sinon : Lighthouse en local, sur Chrome ou le Chromium de Playwright (Node.js 22.19 ou plus). Ses chiffres se comparent seulement avec une autre mesure faite sur la même machine : le dire.

**Passages et médiane.**
- 3 passages par page pour un état des lieux ; 5 pour un avant/après qui doit trancher. Les passages se suivent, un à la fois.
- `pulse-aidd perf mesurer` préchauffe chaque page (2 requêtes) pour éviter de mesurer un démarrage à froid, puis prend la **médiane** de chaque mesure ; les diagnostics viennent du **passage médian** (score médian).
- **Instable** : le LCP varie de plus d'1 s ou de plus de 30 % de sa médiane, ou le score de plus de 10 points. Montrer la valeur sans conclure, relancer avec 2 passages de plus ; si l'instabilité reste, chercher un contenu qui change d'un chargement à l'autre (image chargée en différé, carrousel, animation, contenu aléatoire).
- **Avant/après** (`pulse-aidd perf comparer`) : « mieux » seulement si toutes les mesures d'après battent toutes celles d'avant et que l'écart compte vraiment (50 ms ou 5 % pour une durée, 0,01 pour le CLS, 2 points de score) ; sinon « dans le bruit ».

**Mobile d'abord**, ordinateur sur demande (`--appareil ordinateur`).

## 5. La clé Google (PageSpeed Insights et CrUX)

Une clé personnelle, gratuite, valable pour tous les projets de la personne. Sans clé, PageSpeed Insights refuse en pratique toute demande (erreur 429, quota de 0), et CrUX exige une clé.

**Créer la clé** (une fois, par la personne, guidée pas à pas ; libellés de la console Google Cloud à vérifier à l'écran) :
1. Ouvrir https://console.cloud.google.com et se connecter avec un compte Google.
2. Créer un projet (sélecteur de projet → « Nouveau projet »), par exemple « mesure-vitesse ».
3. « API et services » → « Bibliothèque » : activer **PageSpeed Insights API**, puis **Chrome UX Report API**.
4. « API et services » → « Identifiants » → « Créer des identifiants » → « Clé API ».
5. Restreindre la clé : « Restrictions d'API » → « Restreindre la clé » → cocher seulement **PageSpeed Insights API** et **Chrome UX Report API** → Enregistrer. Une clé restreinte ne sert à rien d'autre si elle fuit.

**La ranger sur le poste**, dans la variable d'environnement `PULSE_PSI_CLE`, hors de tout projet. La personne colle la valeur elle-même, dans la fenêtre de son système ; la clé reste hors de la conversation.
- Windows : menu Démarrer → « Modifier les variables d'environnement pour votre compte » → « Nouvelle… » → nom `PULSE_PSI_CLE`, valeur : la clé → OK.
- macOS et Linux : ouvrir `~/.zshrc` (macOS) ou `~/.bashrc` (Linux) dans un éditeur de texte, ajouter la ligne `export PULSE_PSI_CLE="<la clé>"`, enregistrer.
- Puis fermer et rouvrir le terminal et Claude Code (la variable est lue au démarrage), et lancer `pulse-aidd perf cle` : il vérifie que la clé est présente et acceptée, sans l'afficher.

**Ailleurs** : pour la tâche hebdomadaire de CI, la clé va dans les secrets du dépôt (nom `PULSE_PSI_CLE`), saisie par la personne dans les réglages du dépôt. Le garde-fou anti-secrets de Pulse bloque une clé Google écrite dans un fichier du projet.

**Clé compromise** (collée dans une conversation, un fichier ou un message) : la supprimer dans « Identifiants », en créer une nouvelle, mettre à jour la variable du poste et le secret de CI.

Quota gratuit indiqué dans la console (« Quotas ») ; CrUX : 150 requêtes par minute.

## 6. Lire les diagnostics de Lighthouse 13

`pulse-aidd perf mesurer` liste les diagnostics en échec de la catégorie performance (groupes « insights » et « diagnostics » de Lighthouse 13, score < 0,9), du plus grand gain estimé au plus petit, avec l'élément ou la ressource en cause. Identifiants relevés sur un rapport réel de Lighthouse 13.5.0 ; le JSON de chaque mesure garde la version (`lighthouse`). À chaque nouvelle version majeure, relire cette table.

| Identifiant | Ce que vit le visiteur | Cause en mots simples | Correction générique | Qui décide |
|---|---|---|---|---|
| `image-delivery-insight` | la grande image arrive tard | image trop lourde, trop grande pour l'écran, ou dans un format ancien | format moderne (WebP, AVIF), taille adaptée à l'écran (plusieurs tailles proposées au navigateur), compression | Pulse |
| `lcp-discovery-insight` | le contenu principal s'affiche tard | l'image principale est découverte tard, ou chargée « en différé » | image principale présente dans le HTML de départ, chargement immédiat (`loading="eager"`), priorité haute (`fetchpriority="high"`) | Pulse |
| `lcp-breakdown-insight` | (explication) | répartition du LCP : réponse du serveur, attente avant chargement, chargement, affichage | corriger la plus longue des quatre parties | — |
| `render-blocking-insight` | page blanche au début | des feuilles de style ou scripts bloquent l'affichage | styles essentiels intégrés à la page, scripts différés | Pulse |
| `cls-culprits-insight`, `unsized-images` | la page saute | image, vidéo, publicité ou bloc sans dimensions ; police qui change la mise en page ; contenu inséré au-dessus | largeur et hauteur (ou proportions) sur chaque image et bloc, place réservée pour ce qui arrive plus tard | Pulse |
| `font-display-insight` | texte invisible ou qui change d'aspect | la police web arrive tard | police hébergée sur le site, peu de graisses, `font-display: swap`, police de repli ajustée | Pulse (choix de police : la personne) |
| `document-latency-insight` | tout commence tard | serveur lent, redirections, page non compressée | cache, compression, redirection supprimée, serveur proche des visiteurs et de la base | Pulse, ou choix d'hébergement (la personne) |
| `cache-insight` | les visites suivantes restent lentes | les fichiers ne restent pas en mémoire du navigateur | en-têtes de cache longs sur les fichiers versionnés | Pulse |
| `third-parties-insight` | la page rame | scripts d'autres sociétés (discussion, statistiques, vidéo, carte, publicité) | les retirer, les charger après la page, ou une façade cliquable | **la personne** (chaque outil tiers est un choix) |
| `unused-javascript`, `unused-css-rules`, `duplicated-javascript-insight` | chargement plus long | du code envoyé sans servir sur cette page, ou envoyé deux fois | découper le code par page, charger à la demande, retirer les bibliothèques en double | Pulse |
| `legacy-javascript-insight` | chargement un peu plus long | du code adapté à de très vieux navigateurs | viser les navigateurs actuels | Pulse |
| `unminified-javascript`, `unminified-css` | chargement plus long | fichiers non compactés | construction de production (minification) | Pulse |
| `total-byte-weight` | page longue à charger, forfait consommé | page trop lourde | images d'abord, puis code, puis polices | Pulse |
| `dom-size-insight` | réactions lentes | page très chargée en éléments | pagination, listes plus courtes, contenu replié | Pulse (contenu : la personne) |
| `forced-reflow-insight`, `long-tasks`, `bootup-time`, `mainthread-work-breakdown`, `inp-breakdown-insight` | clics qui réagissent tard | trop de travail d'un coup dans le navigateur | découper le travail, alléger le code exécuté au chargement | Pulse |
| `non-composited-animations` | animations saccadées, page qui bouge | animation de propriétés qui déplacent la mise en page | animer seulement `transform` et `opacity` | Pulse |
| `bf-cache` | retour arrière lent | la page ne peut pas être gardée en mémoire au retour | retirer les blocages signalés (gestionnaire `unload`, en-tête `no-store` sur une page publique) | Pulse |
| `modern-http-insight` | chargement un peu plus long | protocole HTTP ancien | HTTP/2 ou HTTP/3 (réglage de l'hébergeur) | hébergement |
| `viewport-insight` | délai au toucher sur téléphone | page non adaptée aux écrans mobiles | balise `viewport` | Pulse |
| `network-dependency-tree-insight` | (explication) | chaîne de fichiers qui s'attendent les uns les autres | à lire avec `render-blocking-insight` ; souvent sans action propre | — |

- **Le socle d'un framework** : sur une page presque vide, un peu de JavaScript « inutilisé » ou « ancien » venant du framework lui-même est normal. Le dire, et concentrer les efforts sur ce que le projet ajoute (images, polices, scripts tiers, bibliothèques).
- **Côté serveur** : un TTFB mauvais ou `document-latency-insight` en échec relève du serveur (requêtes en base, démarrage à froid, région). Une ligne « côté serveur » dans le rapport, puis `/pulse:fix` ou une user story.
- Les identifiants s'affichent pour le profil « Développeur » ; pour les autres, la cause en mots simples et l'élément désigné (« la grande photo de l'accueil », « le bouton de discussion en bas à droite »).

## 7. Le budget

Un budget fixe des limites sur les **mesures** (pas sur le score seul, qui mélange cinq mesures). Il se note dans la section « Budget » de `docs/performance.md`, un tableau `| Mesure | Limite |` lu par `pulse-aidd perf budget` :

| Mesure | Limite proposée au départ | Unités acceptées |
|---|---|---|
| LCP | 2,5 s | `s`, `ms` |
| CLS | 0,1 | sans unité |
| TBT | 200 ms | `s`, `ms` |
| Poids | la mesure actuelle arrondie au-dessus, au plus 2 Mo | `Ko`, `Mo` |
| Requêtes | la mesure actuelle plus 10 | sans unité |
| Score | 90 (minimum) | sans unité |

Mesures reconnues : LCP, CLS, TBT, FCP, SI, TTFB, Poids, Requêtes, Score. Une limite vide (« — ») est ignorée. `pulse-aidd perf budget <mesure.json> docs/performance.md` sort avec le code 1 si une médiane dépasse sa limite, ce qui fait échouer une tâche de CI.

## 8. Mythes à corriger

1. « Le score Lighthouse fait le classement Google. » Google regarde les vrais visiteurs, parmi beaucoup d'autres signaux.
2. « 100/100 ou rien. » Au-dessus de 90, le gain n'est plus perceptible.
3. « Une mesure suffit. » La médiane de 5 passages est deux fois plus stable qu'un passage seul (documentation de Lighthouse sur la variabilité).
4. « Le mode développement donne une idée. » Il mesure un autre site : construire en mode production d'abord.
5. « Mesurer avant la mise en ligne montre la correction. » PageSpeed Insights mesure ce qui est en ligne.
6. « Le LCP de la simulation est le vrai LCP. » C'est une projection ; le terrain peut être meilleur ou pire.
7. « Pas de données CrUX, donc site lent. » Seulement pas assez de visiteurs de Chrome.
8. « Accessibilité à 100 = site accessible. » Seule la partie automatisable est vérifiée : `/pulse:ui audit` et les tests manuels la complètent.
9. « Le CO2 par visite est une mesure. » C'est une estimation de méthode ; le poids de la page et le nombre de requêtes sont, eux, mesurés.
10. « Lighthouse CI est à jour. » Au 2026-10-07, `@lhci/cli` embarque encore Lighthouse 12 : `pulse-aidd perf` appelle Lighthouse 13 directement.

## 9. Frontières

| Question | Commande |
|---|---|
| Vitesse, stabilité, réactivité, poids de ce que le visiteur télécharge | `/pulse:perf` |
| Accessibilité réelle, apparence, textes de l'interface | `/pulse:ui audit` (le score d'accessibilité de Lighthouse n'en est qu'un indice) |
| En-têtes de sécurité (CSP, HSTS…) | `/pulse:security entetes` |
| Coût et lenteur côté serveur (requêtes en base, quotas) | ligne « côté serveur » du rapport, puis `/pulse:fix` ou une user story |
