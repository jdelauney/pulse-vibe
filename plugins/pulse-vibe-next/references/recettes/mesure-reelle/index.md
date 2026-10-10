# Recette : mesure-reelle

> Quand l'utiliser : le site est en ligne et la personne veut connaître la vitesse vécue par ses vrais visiteurs (affichage du contenu principal, réaction aux clics, stabilité), page par page, sans attendre les données publiées par Google.

## Prérequis

- Le squelette du pack est en place (`pulse-aidd pile squelette`), mis en ligne sur Vercel (`/pulse:deploy`) : `src/db/db-client.ts` exporte `getDb()` et le type `Db` ; `src/lib/errors/reponse-erreur.ts` fournit `reponseErreur()` ; `tests/helpers/base-de-test.ts` fournit `creerBaseDeTest()` ; `vitest.config.ts` tourne en environnement `node`, avec les alias `@src` et `@app`.
- Deux options ; la personne choisit (AskUserQuestion), après lecture de leurs limites :

| | A. Speed Insights de Vercel | B. Mesure envoyée au site lui-même |
|---|---|---|
| Mise en place | un paquet, une ligne dans le layout, un réglage dans Vercel | une table, une route, un composant (code ci-dessous, testé) |
| Coût | gratuit jusqu'à 10 000 mesures sur 30 jours glissants pour toute l'équipe (une visite en envoie 3 à 6) ; au-delà, collecte arrêtée au moins 14 jours | gratuit (base Neon déjà en place) |
| Ce que l'on voit | offre gratuite : seulement le « Real Experience Score » dans le tableau de bord ; le détail par mesure et par page demande Speed Insights Plus (offre Pro, payante) | le 75e centile de chaque mesure, par page, lu dans Neon (SQL Editor) |
| Navigations internes | premier chargement de la visite seulement | aussi les changements de page sans rechargement (Chrome récents) |
| Données | chez Vercel ; anonymes (ni IP ni identifiant) | dans votre base ; anonymes, effacées après 90 jours |
| Recommandé pour | voir une tendance générale sans code | lire les chiffres par page, garder les données chez soi |

- Option B : `DATABASE_URL` et `DATABASE_URL_DIRECT` remplies (`.env` et Vercel), comme pour toute table.
- Paquets : option A, `npm install @vercel/speed-insights` (dernière version ; recette vérifiée avec 2.0.0). Option B : aucun paquet ; `useReportWebVitals` est fourni par Next.js 16.4.
- Vérifiée automatiquement par la CI du pack, chaque semaine aux dernières versions (chaîne `mesure-reelle` de `verifier-recettes.js`) : contrôles, types, tests unitaires et d'intégration (PGlite), construction. Les deux options sont posées ensemble pour cette vérification ; un projet n'en garde qu'une. La réception réelle des mesures (Speed Insights, ou lignes dans Neon) se constate en ligne, après quelques visites.

## Variables d'environnement

Aucune nouvelle variable.

## Fichiers créés ou modifiés

| Fichier | Option | Rôle |
|---|---|---|
| `app/layout.tsx` (modifié) | A et B | Ajoute `<SpeedInsights />` (A) ou `<MesureVitesse />` (B) |
| `next.config.ts` (modifié) | A | Script de diagnostic de Speed Insights autorisé par la CSP, en développement |
| `src/core/vitesse/mesure.entity.ts` | B | Mesures et notes acceptées, durée de conservation, types |
| `src/core/vitesse/mesure.rules.ts` | B | Chemin sans identifiant, date limite de conservation (fonctions pures) |
| `src/core/vitesse/mesure-repository.port.ts` | B | Ce dont le use-case a besoin : enregistrer, effacer les anciennes |
| `src/core/vitesse/use-cases/enregistrer-mesure.use-case.ts` | B | Use-case « enregistrer une mesure » |
| `src/db/vitesse/mesure-vitesse.table.ts` | B | Table `mesures_vitesse` |
| `drizzle/<numéro>_<nom>.sql` | B | Migration générée par `npm run db:generate` |
| `src/db/vitesse/mesure-vitesse.repository.ts` | B | `mesureVitesseRepository(db)` : `enregistrer`, `effacerAvant`, `p75ParPage` |
| `src/features/vitesse/schemas/mesure.schema.ts` | B | Schéma Zod d'une mesure reçue |
| `src/features/vitesse/webhooks/recevoir-mesure.webhook.ts` | B | Contrôles de la requête, puis use-case |
| `app/api/vitesse/route.ts` | B | Route qui reçoit les mesures des navigateurs |
| `src/components/shared/elements/mesure-vitesse.tsx` | B | Composant client qui mesure et envoie |
| `src/core/vitesse/__tests__/mesure.rules.test.ts`, `src/core/vitesse/__tests__/enregistrer-mesure.use-case.test.ts` | B | Tests unitaires des règles et du use-case |
| `src/features/vitesse/schemas/__tests__/mesure.schema.test.ts`, `src/features/vitesse/webhooks/__tests__/recevoir-mesure.webhook.test.ts` | B | Tests unitaires du schéma et de la réception |
| `src/db/vitesse/__tests__/mesure-vitesse.repository.test.ts` | B | Tests d'intégration avec PGlite |
| Mention de confidentialité du site (modifiée) | A et B | Mesure de la vitesse, anonyme |

## Étapes

- Étape option-a – Option A – Speed Insights de Vercel : `pulse-aidd pile recette mesure-reelle etape option-a`
- Étape option-b – Option B – Mesure envoyée au site : `pulse-aidd pile recette mesure-reelle etape option-b`
- Étape mention-de-confidentialite – Mention de confidentialité (A et B) : `pulse-aidd pile recette mesure-reelle etape mention-de-confidentialite`
## Scénarios Gherkin à ajouter à la spec

```gherkin
# language: fr
Fonctionnalité: Mesure réelle de la vitesse

  Règle: Les mesures se regroupent par gabarit, sans identifiant

    @US-XXX-1 @unitaire
    Exemple: Adresse d'une facture : l'identifiant devient [id]
      Étant donné une mesure prise sur « /factures/3f2b8c1e-9d4a-4c7b-a1e2-0b9c8d7e6f50?tri=date »
      Quand l'adresse est préparée pour l'enregistrement
      Alors la page enregistrée est « /factures/[id] »

    @US-XXX-1 @unitaire
    Exemple: Page ordinaire : le chemin reste lisible
      Étant donné une mesure prise sur « /tarifs/offre-pro »
      Quand l'adresse est préparée pour l'enregistrement
      Alors la page enregistrée est « /tarifs/offre-pro »

  Règle: Seules des mesures valides, venues du site, sont acceptées

    @US-XXX-2 @unitaire @securite
    Exemple: Mesure valide envoyée par le site : enregistrée sans identifiant
      Étant donné le navigateur d'un visiteur envoie un INP de 180 ms pour « /factures/1234 »
      Quand la route reçoit la mesure
      Alors elle répond 204 et enregistre la page « /factures/[id] »

    @US-XXX-2 @unitaire @securite
    Exemple: Envoi depuis un autre site ou corps illisible : refusé
      Étant donné un envoi depuis « https://autre.example », un corps qui n'est pas du JSON, ou un corps de 3 000 caractères
      Quand la route le reçoit
      Alors elle répond 403, 400 ou 413 et n'enregistre rien

    @US-XXX-2 @unitaire @securite
    Exemple: Base indisponible : réponse générique, sans détail
      Étant donné la base de données ne répond pas
      Quand la route reçoit une mesure valide
      Alors elle répond 500 sans afficher le détail de l'erreur, qui reste dans le journal du serveur

  Règle: Les chiffres se lisent au 75e centile, et les anciennes mesures s'effacent

    @US-XXX-3 @integration
    Exemple: Quatre LCP sur l'accueil : le 75e centile est calculé par page
      Étant donné des LCP de 1 000, 2 000, 3 000 et 4 000 ms sur « / »
      Quand le 75e centile des 28 derniers jours est calculé
      Alors l'accueil affiche 3 250 ms sur 4 mesures

    @US-XXX-3 @integration
    Exemple: Mesure de plus de 90 jours : effacée
      Étant donné une mesure de 91 jours et une de 89 jours
      Quand les anciennes mesures sont effacées
      Alors seule celle de 89 jours reste

    @US-XXX-3 @unitaire
    Exemple: L'effacement des anciennes mesures a lieu au plus une fois par heure
      Étant donné aucun effacement encore fait
      Quand deux mesures arrivent à 12 h 00, une à 12 h 59, puis une à 13 h 00
      Alors l'effacement a lieu à 12 h 00 (première mesure) et à 13 h 00 seulement

    @US-XXX-3 @unitaire
    Exemple: La limite de conservation est à 90 jours
      Étant donné la date du 8 octobre 2026
      Quand la limite de conservation est calculée
      Alors elle tombe le 10 juillet 2026

    @US-XXX-4 @manuel
    Exemple: Visite réelle : les mesures arrivent dans la base
      Étant donné le site en ligne avec la mesure réelle
      Quand Camille ouvre deux pages sur son téléphone, puis ferme l'onglet
      Alors la requête du SQL Editor de Neon montre des lignes pour ces deux pages
```

## Tâches de plan prêtes

- [ ] **Tn – Mesurer la vitesse chez les vrais visiteurs** · US-XXX
  - Objectif : chaque visite envoie ses mesures de vitesse au site, anonymes, lisibles par page
  - Dépend de : —
  - Fichiers : à créer : `src/core/vitesse/mesure.entity.ts`, `mesure.rules.ts`, `mesure-repository.port.ts`, `use-cases/enregistrer-mesure.use-case.ts`, `src/db/vitesse/mesure-vitesse.table.ts`, `mesure-vitesse.repository.ts`, `src/features/vitesse/schemas/mesure.schema.ts`, `webhooks/recevoir-mesure.webhook.ts`, `app/api/vitesse/route.ts`, `src/components/shared/elements/mesure-vitesse.tsx`, les cinq fichiers de test (dans les `__tests__/` de chaque dossier), migration dans `drizzle/` · à modifier : `app/layout.tsx`, mention de confidentialité
  - Vérification : US-XXX critères 1 à 3 – `npm test` passe ; `npm run build` garde l'accueil statique (○)
  - Tests : « Adresse d'une facture… », « Page ordinaire… », « L'effacement… au plus une fois par heure », « La limite de conservation… » (`src/core/vitesse/__tests__/mesure.rules.test.ts`) ; « Mesure valide : enregistrée sans identifiant… » (`enregistrer-mesure.use-case.test.ts`, avec « Effacement fait il y a moins d'une heure… ») ; « Mesure LCP valide… », « Mesure inconnue… » (`mesure.schema.test.ts`) ; « Mesure valide envoyée par le site… », « Envoi depuis un autre site… », « Base indisponible… », « Les anciennes mesures s'effacent au plus une fois par heure » (`recevoir-mesure.webhook.test.ts`, horloge simulée) ; « Quatre LCP sur l'accueil… », « Mesure de plus de 90 jours… » (`mesure-vitesse.repository.test.ts`, intégration) ; « Visite réelle… » (manuel)
  - Action manuelle : appliquer la migration en production (`npm run db:migrate`), puis, après quelques jours, lancer la requête dans le SQL Editor de Neon

## Tests
Le code des tests : `pulse-aidd pile recette mesure-reelle tests`
## Points de sécurité

- **S10 – Abus et coûts** : la route est publique (un navigateur l'appelle sans session). Elle refuse les autres origines, les corps de plus de 2 000 caractères et tout ce qui sort du schéma ; chaque envoi ajoute une petite ligne. Avec la recette `limite`, ajouter en tête de `recevoirMesure` une vérification `verifierLimite("formulairePublic", ipDepuis(request.headers))` (`verifierLimite` de `@src/lib/limite`, `ipDepuis` de `@src/lib/helpers/limite/ip-et-message`) qui répond 429 quand la limite est atteinte.
- **S9 – Données personnelles** : ni IP, ni cookie, ni identifiant de compte, ni adresse complète (les identifiants des adresses deviennent `[id]`) ; effacement après 90 jours ; mention de confidentialité à jour.
- **S11 – Messages d'erreur** : la route répond par un code seul pour une requête refusée, et par le message générique de `reponseErreur()` pour une panne ; l'erreur de base va dans le journal du serveur, sans le contenu reçu.
- Option A : les données vont chez Vercel (sous-traitant déjà utilisé pour l'hébergement) ; les citer dans la mention.

## Pièges connus

- **Composant monté hors du layout racine** : `<MesureVitesse />` va dans `app/layout.tsx`, une seule fois ; ailleurs, les mesures d'une page arrivent en double ou manquent.
- **Fonction de rappel recréée à chaque rendu** : `envoyer` est définie hors du composant ; une fonction créée dans le composant fait renvoyer les mesures déjà envoyées (documentation de `useReportWebVitals`).
- **Rien en développement** : `npm run dev` n'envoie rien (voulu) ; pour essayer, `npm run build` puis `npx next start`.
- **CLS et INP arrivent à la sortie de la page** : ils partent quand l'onglet est caché ou fermé ; un essai qui reste sur la page voit seulement TTFB, FCP et LCP.
- **Selon le navigateur** : le CLS et les navigations internes se mesurent seulement sous Chrome et Edge ; les autres mesures dépendent de la version du navigateur. Les chiffres décrivent donc surtout les visiteurs de Chrome et Edge.
- **Effacement des anciennes mesures** : il a lieu au plus une fois par heure et par instance du serveur (date gardée en mémoire dans le webhook), pas à chaque mesure. Après un redémarrage ou sur une nouvelle instance, le premier envoi efface ; une mesure de plus de 90 jours peut donc rester jusqu'à une heure de plus. Pour un effacement indépendant des visites, une tâche planifiée de Vercel (cron) peut appeler `effacerAvant`.
- **Mesure perdue** : un bloqueur de contenu ou une coupure réseau en perd quelques-unes ; le 75e centile reste fiable avec assez de visites.
- **Speed Insights gratuit** : seulement le score global dans le tableau de bord ; pour lire le LCP par page sans payer, l'option B.

## Sources

- Next.js 16.4, documentation livrée : `01-app/02-guides/analytics.md`, `01-app/03-api-reference/04-functions/use-report-web-vitals.md` (`rating`, `navigationType` dont `soft-navigation`, `navigationURL`, référence de fonction stable).
- `@vercel/speed-insights` 2.0.0, paquet installé : `README.md`, `dist/next/index.d.mts` (`SpeedInsights`, `sampleRate`, `beforeSend`) ; Vercel : https://vercel.com/docs/speed-insights/limits-and-pricing, https://vercel.com/docs/speed-insights/privacy-policy (relevés le 2026-10-06).
- Seuils et 75e centile : web.dev/articles/vitals ; CNIL : cnil.fr/fr/cookies-solutions-pour-les-outils-de-mesure-daudience.
- Vérifications locales (squelette du pack, 2026-10-08) : `npm run check`, `npm run typecheck`, `npm test` et `npm run build` passent (accueil statique, `/api/vitesse` dynamique) ; l'option A (`<SpeedInsights />`) passe `typecheck` et `build` avec `@vercel/speed-insights` 2.0.0 ; en 2026-10-07, dans Chromium (Playwright), une visite de deux pages envoyait TTFB, FCP et LCP avec la page et la note attendues et `<SpeedInsights />` chargeait `/_vercel/speed-insights/script.js`.

## Points à vérifier

- L'en-tête `Origin` derrière Vercel : `request.nextUrl.origin` vaut-il bien l'adresse publique du site (domaine personnalisé compris) ? Vérifier la première mesure enregistrée après la mise en ligne ; une réponse 403 sur `/api/vitesse` dans les journaux de Vercel signale l'écart.
- Speed Insights sur l'offre Hobby : les mesures par page sont-elles lisibles avec `vercel metrics` sans Speed Insights Plus ?
- Les libellés exacts de l'onglet Speed Insights dans Vercel.
