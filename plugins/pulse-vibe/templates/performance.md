# Vitesse du site – <nom du projet>

Tenu par `/pulse:perf`. Deux sources de chiffres, jamais mélangées :
- la **simulation** (laboratoire) : Lighthouse charge la page comme un téléphone moyen en 4G lente ; elle sert à trouver les causes et à comparer avant et après ;
- les **vrais visiteurs** (terrain) : ce que vivent réellement les visiteurs ; c'est ce que Google regarde, parmi beaucoup d'autres signaux.

Seuils : 🟢 bon, 🟠 à améliorer, 🔴 mauvais (seuils officiels de Google). Mesures détaillées : `docs/performance/mesures/`.

## Pages suivies

| Page | Gabarit | Pourquoi |
|---|---|---|
| `/` | accueil | la première impression |

Appareil : mobile · Source : <PageSpeed Insights | Lighthouse sur ce poste (comparer seulement avec ce poste)> · Adresse mesurée : <adresse du site>

## Dernière mesure (simulation)

<AAAA-MM-JJ> · <source>, Lighthouse <version> · <n> passages par page, médiane · fichier : `docs/performance/mesures/<AAAA-MM-JJ>.json`

| Page | Contenu principal (LCP) | Stabilité (CLS) | Blocages (TBT) | Score | Poids · requêtes | Fiabilité |
|---|---|---|---|---|---|---|
| `/` | 🟢 <x,x s> | 🟢 <0,0x> | 🟢 <xx ms> | 🟢 <xx>/100 | <xxx Ko> · <xx> | <stable \| instable : …> |

En secondaire : accessibilité <xx>, bonnes pratiques <xx>, SEO technique <xx> (contrôles automatiques seulement) ; réponse du serveur <x,x s>.

## Vrais visiteurs (terrain)

<AAAA-MM-JJ> · <CrUX, Chrome, 28 jours, 75e centile | mesure réelle du site | pas encore de données>

| Niveau | Contenu principal (LCP) | Réaction aux clics (INP) | Stabilité (CLS) | Core Web Vitals |
|---|---|---|---|---|
| <tout le site \| page> | <…> | <…> | <…> | <réussis \| pas encore \| non évaluables> |

## Priorités

Trois au plus, de la plus utile à la moins utile.

1. **<Ce que vit le visiteur>** (`<page>`) – cause : <en mots simples> · gain attendu : <…> · décide : <Pulse corrige \| vous : …> · statut : <à faire \| corrigé le AAAA-MM-JJ \| écarté : raison>

## Budget

Limites vérifiées par `pulse-aidd perf budget` (une médiane au-delà fait échouer la vérification). Unités : `s`, `ms`, `Ko`, `Mo` ; une limite « — » est ignorée.

| Mesure | Limite |
|---|---|
| LCP | 2,5 s |
| CLS | 0,1 |
| TBT | 200 ms |
| Poids | — |
| Requêtes | — |
| Score | 90 |

## Mesure réelle et suivi

- Mesure chez les vrais visiteurs : <non installée \| outil, depuis le AAAA-MM-JJ, mention de confidentialité à jour>
- Vérification automatique : <aucune \| chaque semaine sur le site en ligne \| sur chaque demande de fusion> (<fichier de CI>)

## Historique

| Date | Action | Page | LCP | CLS | TBT | Score | Remarque |
|---|---|---|---|---|---|---|---|
| <AAAA-MM-JJ> | mesure | `/` | <…> | <…> | <…> | <…> | point de départ |
