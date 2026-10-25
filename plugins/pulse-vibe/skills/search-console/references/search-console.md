# Search Console : relier, lire, suivre

> Référence de `/pulse:search-console`. Faits vérifiés sur la documentation officielle (dates entre parenthèses) ; les points non confirmés sont signalés « ⚠️ à vérifier ».

« Search Console, c'est le tableau de bord que Google vous tend : ce qu'il a trouvé sur votre site, et ce que les gens ont tapé pour vous trouver. » `/pulse:seo` dit ce qui **pourrait** freiner le site ; Search Console dit ce qui **se passe** vraiment.

## 1. Calendrier à annoncer d'emblée

| Quand | Ce qui se passe |
|---|---|
| Jour 0 | Site relié (propriété vérifiée), sitemap déclaré, import dans Bing |
| Jour 2 à 3 (jusqu'à une semaine pour une propriété neuve) | Premières données |
| Jour 28 | Premier vrai rapport (`lire`) |
| Puis tous les 28 jours | `suivre` : 28 jours comparés aux 28 jours précédents |

Avant environ 28 jours et quelques centaines d'impressions, les CTR et les positions ne permettent aucune conclusion (règle Pulse). Le dire, au lieu de commenter des chiffres trop petits.

## 2. Accéder aux données

### 2.1 Export CSV (par défaut, aucun secret)

1. Search Console → **Performances** → **Résultats de recherche** → choisir la période (28 derniers jours, ou 3 mois).
2. **Exporter** → **Télécharger le fichier CSV** : une archive `.zip` arrive dans Téléchargements.
3. `pulse-aidd search-console lire --fichier <chemin du .zip>` (l'archive, son dossier décompressé ou un seul `.csv`).

L'archive contient un fichier par onglet (requêtes, pages, pays, appareils, apparence, dates, filtres). Pulse reconnaît chaque fichier par sa première colonne, en français ou en anglais, et ignore pays, appareils et apparence. Google a annoncé le 2025-12-10 que les noms de fichiers, d'onglets et certains en-têtes changent selon la granularité choisie (jour, semaine, mois) : exporter de préférence en vue **quotidienne**. ⚠️ à vérifier : les en-têtes exacts de l'export français actuel ne sont pas publiés ; si Pulse ne reconnaît pas un fichier, il le dit et liste les fichiers ignorés.

L'export ne contient ni sitemap ni inspection : le rapport le dit.

### 2.2 Connexion enregistrée (lecture seule)

La connexion Google en lecture seule se met en place une fois, avec `pulse-aidd reference search-console/relier.md`, § 1f.

Où va l'accès : le script le range **hors du projet**, dans le dossier de configuration Pulse de la personne (`%APPDATA%\pulse\search-console.json` sous Windows, `~/.config/pulse/search-console.json` ailleurs), lisible par elle seule. Il ne passe jamais par la conversation, ni par le projet, ni par l'hébergeur : c'est un accès personnel, valable pour tous ses projets. Le secret client d'une application de bureau n'est pas confidentiel selon Google ; il reste rangé au même endroit.

Durée : l'accès cesse s'il n'est pas utilisé pendant 6 mois, si la personne le retire (Compte Google → Sécurité → applications tierces), ou après 100 reconnexions avec le même client (les plus anciennes sont retirées). Pour le retirer de ce poste : `pulse-aidd search-console deconnecter` (révoque aussi chez Google).

### Codes de sortie de `pulse-aidd search-console`

| Code | Sens | Que faire |
|---|---|---|
| 0 | tout va bien | — |
| 2 | pas connecté | export CSV, ou `connecter` : `pulse-aidd reference search-console/relier.md`, § 1f |
| 3 | connexion expirée ou retirée | `connecter` à nouveau, d'après `pulse-aidd reference search-console/relier.md`, § 1f (publier l'application si elle est en « Testing ») |
| 4 | propriété inaccessible avec ce compte | vérifier le compte Google et la propriété (`proprietes`) |
| 5 | quota atteint | réessayer plus tard (inspection : 2 000 pages par jour et par propriété, 600 par minute) |
| 6 | pas encore de données | normal pour un site neuf : revenir à la date indiquée |
| 1 | autre problème | lire le message |

## 3. Lire les chiffres

| Chiffre | Ce qu'il veut dire | Image |
|---|---|---|
| Impressions | combien de fois un lien vers le site a été montré dans les résultats | votre vitrine vue depuis la rue |
| Clics | combien de fois quelqu'un a cliqué | les passants qui entrent |
| CTR | clics ÷ impressions | sur 100 passants qui voient la vitrine, combien entrent |
| Position moyenne | rang moyen du meilleur lien du site, pondéré par les impressions ; plus petit = mieux | la place de la vitrine dans la rue |

- **Heure du Pacifique** : les journées de Search Console suivent l'heure de Californie.
- **Données définitives** : les 2 à 3 derniers jours manquent toujours ; Pulse arrête la période 3 jours avant aujourd'hui pour éviter une fausse baisse.
- **Requêtes masquées** : Google omet les requêtes rares (confidentialité). La somme des requêtes est donc inférieure au total ; sur un petit site, l'écart peut dépasser la moitié. C'est normal.
- **IA dans les chiffres** : les apparitions dans AI Overviews et AI Mode comptent dans le type « Web » ; un AI Overview occupe **une seule position**, partagée par tous ses liens.
- **CTR** : il dépend surtout de la position et du type de résultat. Pulse compare chaque requête à la médiane du site au même rang, au lieu d'un seuil fixe.

## 4. États d'indexation

L'inspection (`inspecter`, ou l'échantillon de `lire`) montre l'état de la version **déjà indexée**, page par page ; ce n'est ni un test en direct, ni la couverture du site. La vue complète est dans le rapport « Indexation des pages » de l'interface (1 000 exemples au plus ; « Valider la correction » prend environ deux semaines). La demande d'indexation se fait dans l'interface, une page à la fois (Inspection de l'URL → Demander l'indexation).

| État (interface française) | Que faire |
|---|---|
| Envoyée et indexée | rien |
| Détectée, actuellement non indexée | rien tout de suite : Google viendra ; vérifier que la page est liée depuis d'autres pages |
| Explorée, actuellement non indexée | enrichir le contenu propre à la page et ses liens internes ; inutile de la renvoyer |
| Autre page avec balise canonique correcte | rien : c'est une copie qui renvoie vers la version officielle |
| Doublon (sans canonique, ou Google a choisi une autre canonique) | indiquer la version officielle, harmoniser liens et sitemap, différencier les contenus |
| Exclue par la balise « noindex », Bloquée par robots.txt | vérifier que c'est voulu (page privée) |
| Introuvable (404) | normal si la page n'existe plus ; adresse changée → redirection permanente (301) |
| Soft 404 | renvoyer un vrai 404, ou donner un vrai contenu |
| Erreur serveur (5xx) | vérifier que la page répond (`pulse-aidd sonder`) |
| Page avec redirection | rien si voulu ; mettre la page d'arrivée dans le sitemap |

Pulse interroge Google en anglais (`en-US`) pour des états stables, puis les traduit.

## 5. Requêtes à potentiel et actions (heuristiques Pulse)

Seuils choisis par Pulse, à confirmer sur de vrais petits sites :

- **Proche de la première page** : position moyenne entre 8 et 20, au moins 20 impressions → enrichir la page qui répond, ajouter des liens vers elle depuis les autres pages.
- **Bien placée, peu cliquée** : position 1 à 5, CTR inférieur à la moitié de la médiane du site au même rang (au moins 3 requêtes de comparaison) → revoir le titre et la description (`/pulse:seo textes`).
- **Page du sitemap sans impression** : vérifier qu'elle est liée depuis l'accueil et qu'elle répond à une vraie question ; l'inspecter.
- Les requêtes contenant le nom de la marque se lisent à part (filtre de marque de l'interface, s'il est disponible pour le site).
- Une page qui change d'adresse reçoit une redirection permanente (301).

Chaque action devient une demande Pulse (`/pulse:spirc "…"`) ou un passage par `/pulse:seo`.

## 6. L'IA générative dans Search Console (2026)

- **Rapport « Performances dans l'IA générative »** (annoncé le 2026-06-03, pour toutes les propriétés depuis le 2026-08-11 selon les sources secondaires) : **impressions seulement** dans AI Overviews et AI Mode, par page, pays, appareil et date ; ni clics ni requêtes. Bouton d'export. Absent de l'API à ce jour. Ces impressions figurent aussi dans le rapport général.
- **Réglage « Search generative AI »** (Paramètres → Search generative AI, pour tous les sites depuis le 2026-08-31) : « Inclure » (valeur par défaut), « Exclure » (le site disparaît des AI Overviews, d'AI Mode et des fonctions IA de Discover : ni liens, ni impressions, ni trafic venant de ces fonctions), ou « Hériter de la propriété parente ». C'est une **décision de la personne**, qui fait partie de sa politique des robots IA (`/pulse:seo ia`) : la présenter, la faire appliquer par elle dans l'interface, et noter le choix.

## 7. Pédagogie

Termes à expliquer selon le profil, avec leur image :

| Terme | Image |
|---|---|
| Propriété | la fiche de votre site chez Google |
| Vérification | prouver que la boîte aux lettres est à vous |
| Sitemap | le plan du magasin |
| Indexation | être rangé dans le catalogue de la bibliothèque |
| Canonique | la version officielle d'un document dont il existe des copies |
| Requête | les mots tapés dans Google |
| Impression, clic, CTR, position | voir § 3 |

- Chaque chiffre est suivi de son sens concret, puis d'une action ou de « rien à faire, c'est normal ».
- La seule voie d'indexation rapide pour Google est la demande dans l'interface, page par page ; l'Indexing API est réservée aux offres d'emploi et aux vidéos en direct, et les outils d'« indexation instantanée » qui l'utilisent enfreignent les règles de Google.

## 8. Rapports et données personnelles

- `docs/referencement/search-console-<AAAA-MM-JJ>.md` : le rapport (modèle `pulse-aidd modele search-console/rapport-search-console.md`).
- `docs/referencement/donnees/<AAAA-MM-JJ>.json` : l'instantané qui sert à `suivre`.
- Les requêtes tapées par les internautes peuvent contenir des noms de personnes : dans un dépôt public, proposer d'ajouter `docs/referencement/donnees/` au `.gitignore`.

## Sources (consultées le 2026-10-07)

- Search Console API : searchanalytics.query (màj 2026-08-11), limites d'usage (màj 2025-08-28), urlInspection (màj 2024-07-23), portées (developers.google.com/webmaster-tools/v1/how-tos/authorizing, màj 2025-08-28).
- OAuth 2.0 Google (màj 2026-05-26) ; applications natives (màj 2026-09-14).
- Aide Search Console : données de performances (answer/96568), indexation (answer/7440203), rapport IA générative (answer/16984139), réglage Search generative AI (answer/16908024).
- Blog Search Central : vues hebdomadaires et mensuelles, exports modifiés (2025-12) ; rapports IA générative (2026-06).
