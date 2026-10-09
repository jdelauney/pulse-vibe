# Recette : liste

> Quand l'utiliser : la personne connectée consulte ses propres éléments (ici ses factures) dans une liste filtrable, triable et paginée, et en ajoute de nouveaux depuis la même page.

## Prérequis

- Le squelette du pack est en place (`pulse-aidd pile squelette`) : `next.config.ts` contient `cacheComponents: true`, `partialPrefetching: true` et `reactCompiler: true` ; `src/db/db-client.ts` exporte `getDb()` et le type `Db` ; `src/core/shared/result.ts` fournit `Result`, `ok()` et `echec()` ; `tests/helpers/base-de-test.ts` fournit `creerBaseDeTest()` ; `vitest.config.ts` tourne en environnement `node`, avec les alias `@src` et `@app`, et remplace `server-only` par un module vide.
- La recette `connexion` est faite (`pulse-aidd pile recette connexion`). Elle fournit :
  - `utilisateurConnecte()` dans `src/features/compte/queries/utilisateur-connecte.query.ts` (`server-only`, `React.cache`) : renvoie `{ id, nom }`, ou redirige vers `/connexion` sans session ; elle s'appelle dans un container placé sous `<Suspense>` ;
  - `actionConnectee` dans `src/lib/safe-action.ts`, qui fournit `ctx.utilisateur` = `{ id, nom }` et garde la forme d'erreurs de validation par défaut de next-safe-action (forme « formatée » : `{ champ: { _errors: [...] } }`) ;
  - `getAuth()` dans `src/adapters/auth/auth.adapter.ts` et la table `user` dans `src/db/compte/auth.table.ts` ;
  - le groupe de routes `app/(connecte)/` et le renvoi rapide `proxy.ts` (racine du projet) ;
  - l'aide de test `e2e/aides/connexion.ts` (fonctions `connecterNouvelUtilisateur(page)` et `champ(page, libellé)`).
- Paquets du squelette : `next`, `react`, `next-safe-action`, `zod`, `@tanstack/react-form`, `nuqs`, `drizzle-orm`, `sonner` (recette vérifiée avec les versions du squelette du 2026-10-08). Pour les tests : `vitest`, `@electric-sql/pglite`, `@playwright/test`. Si l'un manque, l'installer à sa dernière version : `npm install <paquet>`.
- Composants shadcn (Base UI) : le squelette fournit déjà `button`, `card`, `field`, `input`, `label`, `separator`, `skeleton`, `sonner`. Ajoutez ceux de la liste : `npx shadcn@latest add native-select table badge`.
- Le layout racine (`app/layout.tsx`) contient déjà `NuqsAdapter` (`nuqs/adapters/next/app`) et `<Toaster />` (`@src/components/ui/sonner`) ; ajoutez `<Toaster />` après `{children}` s'il manque.

## Variables d'environnement

Aucune nouvelle variable. La recette utilise la base déjà configurée par le squelette (`DATABASE_URL`).

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/core/factures/facture.entity.ts` | Type `Facture`, statuts et tris possibles |
| `src/core/factures/facture.errors.ts` | Codes des erreurs attendues |
| `src/core/factures/facture.rules.ts` | Règles du montant : format, conversion en centimes, montant positif |
| `src/core/factures/facture-repository.port.ts` | Ce dont le use-case a besoin pour enregistrer une facture |
| `src/core/factures/use-cases/creer-facture.use-case.ts` | Use-case « créer une facture » |
| `src/lib/helpers/pagination/pagination.ts` | Page valide, décalage, nombre de pages |
| `src/lib/helpers/format/format.ts` | Montant en euros et date à l'heure de Paris |
| `src/lib/helpers/formulaire/erreurs-de-champs.ts` | Erreurs de validation du serveur → erreurs de champ |
| `src/db/factures/facture.table.ts` | Table Drizzle `factures` |
| `drizzle/<numéro>_<nom>.sql` | Migration générée par `npm run db:generate` |
| `src/db/factures/facture.repository.ts` | `factureRepository(db)` : `lister`, `inserer`, condition de propriété |
| `src/features/factures/constants/factures.ts` | Libellés des statuts et des tris, filtres de statut, taille de page, noms des champs |
| `src/features/factures/constants/erreur-messages.ts` | Message affiché pour chaque code d'erreur |
| `src/features/factures/schemas/facture.schema.ts` | Schéma Zod partagé par le formulaire et l'action |
| `src/features/factures/schemas/filtres.schema.ts` | Paramètres d'adresse (nuqs), lus côté serveur et côté client |
| `src/features/factures/queries/lister-factures.query.ts` | Lecture de la liste filtrée (`server-only`) |
| `src/features/factures/actions/creer-facture.action.ts` | Action « créer une facture » (next-safe-action) |
| `src/features/factures/components/sections/formulaire-facture.tsx` | Champs et validation du formulaire (TanStack Form + Field) |
| `src/features/factures/components/sections/tableau-factures.tsx` | Tableau des factures et états vides |
| `src/features/factures/components/containers/creation-facture.container.tsx` | Branche l'action sur le formulaire |
| `src/features/factures/components/containers/filtres-factures.container.tsx` | Contrôles client : statut, recherche, tri |
| `src/features/factures/components/containers/pagination-factures.container.tsx` | Contrôles client : page précédente, page suivante |
| `src/features/factures/components/containers/liste-factures.container.tsx` | Container serveur : lit la session, les filtres et la liste |
| `app/(connecte)/factures/page.tsx` | La page, avec ses zones `<Suspense>` |
| `app/(connecte)/factures/error.tsx` | État d'erreur de la page |
| `proxy.ts` (modifié) | Ajoute `/factures` au renvoi rapide vers `/connexion` |
| `src/core/factures/__tests__/facture.rules.test.ts` | Tests unitaires des règles du montant |
| `src/core/factures/__tests__/creer-facture.use-case.test.ts` | Tests unitaires du use-case (doublure en mémoire) |
| `src/lib/helpers/pagination/__tests__/pagination.test.ts` | Tests unitaires de la pagination |
| `src/lib/helpers/format/__tests__/format.test.ts` | Tests unitaires de l'affichage des montants et des dates |
| `src/lib/helpers/formulaire/__tests__/erreurs-de-champs.test.ts` | Tests unitaires des erreurs de champ |
| `src/features/factures/schemas/__tests__/facture.schema.test.ts` | Tests unitaires du schéma |
| `src/db/factures/__tests__/facture.repository.test.ts` | Tests d'intégration avec PGlite |
| `e2e/factures.spec.ts` | Test de bout en bout Playwright |

## Étapes

<!-- commande: npx shadcn@latest add native-select table badge -->

Exemple fil rouge : les **factures** d'une personne connectée. Remplacez `factures` par le mot du glossaire du projet, et `US-XXX` par le numéro de l'US. Le domaine `factures` a ses trois dossiers miroirs : `src/core/factures/` (les règles), `src/db/factures/` (le stockage), `src/features/factures/` (l'écran, l'action, la lecture).

- Étape 1 – Le métier : entité, erreurs, règles : `pulse-aidd pile recette liste etape 1`
- Étape 2 – Le use-case « créer une facture » : `pulse-aidd pile recette liste etape 2`
- Étape 3 – Les aides techniques génériques : `pulse-aidd pile recette liste etape 3`
- Étape 4 – La table et sa migration : `pulse-aidd pile recette liste etape 4`
- Étape 5 – Le repository : `pulse-aidd pile recette liste etape 5`
- Étape 6 – Les constantes, le schéma Zod et les filtres : `pulse-aidd pile recette liste etape 6`
- Étape 7 – La lecture et l'action : `pulse-aidd pile recette liste etape 7`
- Étape 8 – Le formulaire : section et container : `pulse-aidd pile recette liste etape 8`
- Étape 9 – Les contrôles de filtre et de pagination (containers client) : `pulse-aidd pile recette liste etape 9`
- Étape 10 – La liste : container serveur et tableau : `pulse-aidd pile recette liste etape 10`
- Étape 11 – La page, le chargement et l'erreur : `pulse-aidd pile recette liste etape 11`
- Étape 12 – Quand utiliser TanStack Query ou Zustand : `pulse-aidd pile recette liste etape 12`
## Scénarios Gherkin à ajouter à la spec

```gherkin
# language: fr
Fonctionnalité: Consulter et créer mes factures

  Règle: Chaque personne ne voit que ses propres factures

    @US-XXX-1 @integration @securite
    Exemple: Camille ne voit pas les factures de Léo
      Étant donné Camille a une facture pour « Atelier Dupont »
      Et Léo a une facture pour « Boulangerie Martin »
      Quand Camille consulte ses factures
      Alors la liste contient « Atelier Dupont »
      Et la liste ne contient pas « Boulangerie Martin »

    @US-XXX-1 @manuel @securite
    Exemple: Une création envoyée sans être connecté est refusée
      Étant donné personne n'est connecté
      Quand quelqu'un envoie directement la création d'une facture de 50 €
      Alors la création est refusée
      Et aucune facture n'est enregistrée

  Règle: On peut filtrer par statut et rechercher un client

    @US-XXX-2 @integration
    Exemple: Filtre « Payée » : seules les factures payées restent
      Étant donné Camille a une facture payée pour « Atelier Dupont » et une facture brouillon pour « Café Leroy »
      Quand Camille filtre sur le statut « Payée »
      Alors la liste contient seulement « Atelier Dupont »

    @US-XXX-2 @integration
    Exemple: La recherche ignore les majuscules
      Étant donné Camille a une facture pour « Atelier Dupont »
      Quand Camille recherche « dupont »
      Alors la liste contient « Atelier Dupont »

    @US-XXX-2 @integration
    Exemple: Le signe % est cherché comme un caractère
      Étant donné Camille a une facture pour « Remise 100% » et une pour « Atelier Dupont »
      Quand Camille recherche « 100% »
      Alors la liste contient seulement « Remise 100% »

    @US-XXX-2 @integration
    Exemple: Le signe _ est cherché comme un caractère
      Étant donné Camille a une facture pour « Client_1 » et une pour « Client11 »
      Quand Camille recherche « Client_1 »
      Alors la liste contient seulement « Client_1 »

    @US-XXX-2 @integration
    Exemple: La barre oblique inverse est cherchée comme un caractère
      Étant donné Camille a une facture pour « Atelier\Dupont » et une pour « Atelier Dupont »
      Quand Camille recherche « Atelier\Dupont »
      Alors la liste contient seulement « Atelier\Dupont »

  Règle: On peut trier par date ou par montant

    @US-XXX-3 @integration
    Exemple: Tri par montant décroissant
      Étant donné Camille a des factures de 45 €, 120,50 € et 80 €
      Quand Camille trie par « Montant décroissant »
      Alors la liste montre 120,50 €, puis 80 €, puis 45 €

  Règle: La liste affiche 10 factures par page

    @US-XXX-4 @integration
    Exemple: 12 factures : 10 en page 1, 2 en page 2
      Étant donné Camille a 12 factures
      Quand Camille ouvre la page 2
      Alors la liste montre 2 factures
      Et le total indique 12 factures

    @US-XXX-4 @unitaire
    Plan du scénario: Nombre de pages selon le nombre de factures
      Étant donné Camille a <total> factures
      Quand on calcule la pagination
      Alors il y a <pages> page(s)

      Exemples:
        | total | pages |
        | 0     | 1     |
        | 10    | 1     |
        | 11    | 2     |

  Règle: Les filtres restent dans l'adresse de la page

    @US-XXX-5 @bout-en-bout
    Exemple: Après un rechargement, la recherche est conservée
      Étant donné Camille a une facture pour « Atelier Dupont » et une pour « Boulangerie Martin »
      Et Camille a recherché « dupont »
      Quand Camille recharge la page
      Alors la recherche contient toujours « dupont »
      Et la liste contient seulement « Atelier Dupont »

  Règle: Une facture créée apparaît aussitôt dans la liste

    @US-XXX-6 @bout-en-bout
    Exemple: Création d'une facture de 120,50 € pour « Atelier Dupont »
      Étant donné Camille n'a aucune facture
      Quand Camille crée une facture de « 120,50 » pour « Atelier Dupont »
      Alors le message « Facture créée. » s'affiche
      Et la liste montre « Atelier Dupont » pour 120,50 €

    @US-XXX-6 @unitaire
    Plan du scénario: Le montant saisi en euros est enregistré en centimes
      Quand Camille saisit le montant « <saisie> »
      Alors le montant enregistré vaut <centimes> centimes

      Exemples:
        | saisie  | centimes |
        | 120,50  | 12050    |
        | 120.5   | 12050    |
        | 0,05    | 5        |
        | 45      | 4500     |

    @US-XXX-6 @unitaire
    Plan du scénario: Un montant invalide est refusé avec un message
      Quand Camille saisit le montant « <saisie> »
      Alors le message « <message> » s'affiche sous le champ

      Exemples:
        | saisie | message                                             |
        | 0      | Le montant doit être supérieur à 0 €.               |
        | 12,345 | Écrivez un montant en euros, par exemple 120,50.    |
        | abc    | Écrivez un montant en euros, par exemple 120,50.    |

  Règle: La liste annonce clairement le vide, le chargement et l'erreur

    @US-XXX-7 @manuel
    Exemple: Première visite : la liste invite à créer une facture
      Étant donné Camille n'a aucune facture
      Quand Camille ouvre « Mes factures »
      Alors le message « Vous n'avez pas encore de facture. » s'affiche

    @US-XXX-7 @manuel
    Exemple: Base indisponible : un message propose de réessayer
      Étant donné la base de données ne répond pas
      Quand Camille ouvre « Mes factures »
      Alors le message « Les factures n'ont pas pu être chargées. » s'affiche
      Et un bouton « Réessayer » est proposé
```

## Tâches de plan prêtes

> US terminée quand : la personne connectée crée une facture, la voit dans sa liste, et filtre, trie et pagine cette liste, avec des filtres conservés dans l'adresse.

- [ ] **T1 – Règles des factures et aides génériques** · US-XXX
  - Objectif : les montants, dates, pages et erreurs de champ sont calculés de façon sûre
  - Dépend de : —
  - Fichiers : à créer : `src/core/factures/facture.entity.ts`, `src/core/factures/facture.errors.ts`, `src/core/factures/facture.rules.ts`, `src/core/factures/__tests__/facture.rules.test.ts`, `src/lib/helpers/pagination/pagination.ts`, `src/lib/helpers/pagination/__tests__/pagination.test.ts`, `src/lib/helpers/format/format.ts`, `src/lib/helpers/format/__tests__/format.test.ts`, `src/lib/helpers/formulaire/erreurs-de-champs.ts`, `src/lib/helpers/formulaire/__tests__/erreurs-de-champs.test.ts`
  - Vérification : US-XXX critères 4 et 6 – `npm test` passe sur les conversions de montant, la pagination et l'affichage
  - Tests : « Le montant saisi en euros est enregistré en centimes » (unitaire) ; « Nombre de pages selon le nombre de factures » (unitaire)
- [ ] **T2 – Table et repository des factures** · US-XXX
  - Objectif : la base enregistre les factures de chaque personne et les renvoie filtrées, triées et paginées
  - Dépend de : T1
  - Fichiers : à créer : `src/db/factures/facture.table.ts`, migration dans `drizzle/`, `src/db/factures/facture.repository.ts`, `src/db/factures/__tests__/facture.repository.test.ts`
  - Vérification : US-XXX critères 1 à 4 – la migration crée la table `factures` avec `utilisateur_id`, `montant_centimes` et `cree_le` en `timestamp with time zone` ; `npm test` passe sur la base PGlite
  - Tests : « Camille ne voit pas les factures de Léo » (intégration) ; « Filtre « Payée » » (intégration) ; « La recherche ignore les majuscules » (intégration) ; « Le signe % est cherché comme un caractère » (intégration) ; « Le signe _ est cherché comme un caractère » (intégration) ; « La barre oblique inverse est cherchée comme un caractère » (intégration) ; « Tri par montant décroissant » (intégration) ; « 12 factures : 10 en page 1, 2 en page 2 » (intégration)
  - Attention : relire le SQL généré avant `npm run db:migrate` ; chaque requête du repository commence par la condition `utilisateurId` (S3)
- [ ] **T3 – Création d'une facture : use-case, schéma, action, formulaire** · US-XXX
  - Objectif : la personne crée une facture et voit le message de confirmation
  - Dépend de : T2
  - Fichiers : à créer : `src/core/factures/facture-repository.port.ts`, `src/core/factures/use-cases/creer-facture.use-case.ts`, `src/core/factures/__tests__/creer-facture.use-case.test.ts`, `src/features/factures/constants/factures.ts`, `src/features/factures/constants/erreur-messages.ts`, `src/features/factures/schemas/facture.schema.ts`, `src/features/factures/schemas/__tests__/facture.schema.test.ts`, `src/features/factures/actions/creer-facture.action.ts`, `src/features/factures/components/sections/formulaire-facture.tsx`, `src/features/factures/components/containers/creation-facture.container.tsx`
  - Vérification : US-XXX critère 6 – `npm test` passe ; une facture créée apparaît dans la liste sans recharger la page ; un montant « 0 » affiche son message sous le champ
  - Tests : « Un montant invalide est refusé avec un message » (unitaire) ; « Une création envoyée sans être connecté est refusée » (manuel)
  - Attention : le propriétaire vient de `ctx.utilisateur.id`, jamais de la saisie (S3, S4) ; le fichier d'action commence par `"use server"` et n'exporte que son action
- [ ] **T4 – Page liste avec filtres, pagination et états** · US-XXX
  - Objectif : la personne consulte, filtre, trie et pagine ses factures
  - Dépend de : T3
  - Fichiers : à créer : `src/features/factures/schemas/filtres.schema.ts`, `src/features/factures/queries/lister-factures.query.ts`, `src/features/factures/components/sections/tableau-factures.tsx`, `src/features/factures/components/containers/filtres-factures.container.tsx`, `src/features/factures/components/containers/pagination-factures.container.tsx`, `src/features/factures/components/containers/liste-factures.container.tsx`, `app/(connecte)/factures/page.tsx`, `app/(connecte)/factures/error.tsx` · à modifier : `proxy.ts` (matcher), `app/layout.tsx` seulement si `<Toaster />` manque
  - Vérification : US-XXX critères 2 à 5 et 7 – `npm run check` et `npm run build` passent ; filtrer change l'adresse et la liste ; recharger garde les filtres
  - Tests : « Première visite : la liste invite à créer une facture » (manuel) ; « Base indisponible : un message propose de réessayer » (manuel)
  - Attention : chaque lecture de la requête ou de la base reste sous `<Suspense>`
- [ ] **T5 – Parcours de bout en bout** · US-XXX
  - Objectif : le parcours complet est vérifié automatiquement
  - Dépend de : T4
  - Fichiers : à créer : `e2e/factures.spec.ts`
  - Vérification : US-XXX critères 5 et 6 – `npm run test:e2e` passe
  - Tests : « Création d'une facture de 120,50 € pour « Atelier Dupont » » (bout en bout) ; « Après un rechargement, la recherche est conservée » (bout en bout)

## Tests
Le code des tests : `pulse-aidd pile recette liste tests`
## Points de sécurité

- **S3 – Contrôle d'accès aux données** : chaque requête de `facture.repository.ts` commence par la condition `utilisateurId`. L'identifiant vient de la session : `ctx.utilisateur.id` dans l'action, `utilisateurConnecte()` dans `ListeFacturesContainer`. Le test « Camille ne voit pas les factures de Léo » le prouve.
- **S4 – Pages et actions réservées** : l'action utilise `actionConnectee`, car une Server Action est joignable par une requête directe. La liste appelle `utilisateurConnecte()`, qui renvoie vers `/connexion` sans session. La route API du mini-exemple répond 401 sans session.
- **S5 – Validation des entrées** : l'action revalide avec le schéma Zod, même après la validation du formulaire, et le use-case applique encore la règle du montant. Les filtres de l'adresse passent par les parseurs nuqs : un statut ou un tri inconnu revient à sa valeur par défaut, une page invalide revient à 1. La recherche reste un paramètre de requête Drizzle, avec `%`, `_` et `\` échappés.
- **S6 – Affichage sans injection** : les textes s'affichent par JSX, en texte simple.
- **S9 – Données personnelles** : `error.tsx` journalise l'erreur dans le navigateur ; les journaux serveur gardent le nom du client hors des messages.
- **S11 – Messages d'erreur** : la personne voit un message en français, sans détail technique (`erreur-messages.ts` pour une erreur attendue, message générique de `safe-action` sinon). En production, Next.js remplace le message d'une erreur serveur par un identifiant (`digest`).
- `facture.repository.ts` et `lister-factures.query.ts` commencent par `import "server-only"` : un import depuis un composant client casse la construction au lieu d'exposer la base.

## Pièges connus

- **Composant client avec nuqs hors de `<Suspense>`** : la construction échoue (« URL data in a Client Component outside of Suspense »). Gardez `FiltresFacturesContainer` et `PaginationFacturesContainer` sous un `<Suspense>` (la pagination l'est par `ListeFacturesContainer`).
- **Adresse qui change mais liste figée** : ajoutez `shallow: false` aux options de `useQueryStates`, sinon le serveur ne refait pas la liste.
- **Parseurs importés depuis `nuqs` dans `filtres.schema.ts`** : la construction casse côté serveur. Importez-les depuis `nuqs/server` dans tout fichier partagé.
- **Écran pas à jour après la création** : la liste est lue sans cache, donc l'action appelle `refresh()`. Si un jour la lecture passe en `"use cache"` avec `cacheTag`, remplacez `refresh()` par `updateTag(<étiquette>)` (étiquette rangée dans `constants/cache-tags.ts`). `revalidateTag(…, "max")` ne met pas l'écran à jour dans la même réponse.
- **Fonction utilitaire exportée depuis un fichier d'`actions/`** : dans un fichier `"use server"`, chaque fonction exportée devient une adresse publique. Gardez l'accès à la base dans le repository et n'exportez de `creer-facture.action.ts` que l'action next-safe-action.
- **Statuts ou tris importés depuis `constants/` dans la table ou le repository** : Biome refuse l'import (`src/db/` ignore les features). Les listes partagées par la base et l'écran vivent dans `src/core/factures/facture.entity.ts`.
- **Pagination rendue par le tableau** : Biome refuse l'import d'un container dans une section. C'est le container de la liste qui compose le tableau et la pagination.
- **`loading.tsx` à la place de `<Suspense>`** : il ne couvre pas une lecture faite dans un `layout.tsx`. Placez `<Suspense>` au plus près de la lecture, comme dans la page ci-dessus.
- **`error.tsx` en Next.js 16.4** : utilisez la propriété `retry()` (elle relit les données) ; `reset()` réaffiche sans relire.
- **Montants** : calculez en centimes entiers ; `eurosEnCentimes` découpe la saisie au lieu de multiplier un nombre à virgule (`0.29 * 100` donne `28.999999999999996`).
- **Dates** : formatez avec `timeZone: "Europe/Paris"` ; le serveur Vercel tourne en UTC.
- **Pagination instable** : ajoutez toujours une colonne unique (`id`) en fin de tri, sinon deux factures de même montant peuvent changer de page.
- **Filtre changé sur la page 3** : remettez `page: 1` avec chaque changement de filtre, sinon la page affichée peut être vide.
- **Biome signale `children=` sur `form.Field`** (règle `noChildrenProp`) : passez la fonction entre les balises, comme dans le formulaire ci-dessus.
- **`FieldError` vide** : il attend des objets `{ message }`. Les erreurs du serveur passent par `erreursDeChamps`, qui les met sous cette forme.
- **Deux messages pour un montant « abc »** : un `refine` Zod s'exécute même après l'échec du `regex`. Le `refine` du schéma ignore donc les saisies hors format.
- **Test qui échoue sur « 120,50 € »** : `Intl` insère une espace insécable avant « € ». Comparez après `replace(/\s/g, " ")`, ou avec `/120,50\s€/` dans Playwright.
- **Test d'intégration qui plante sur `server-only`** : vérifiez l'alias `server-only` de `vitest.config.ts` (squelette), ou ajoutez `vi.mock("server-only", () => ({}))` en tête du fichier de test.
- **Test d'intégration refusé par `tsc` (« not assignable to type 'Db' »)** : utilisez la base de `creerBaseDeTest()` du squelette, déjà typée `Db`.
- **`next build` échoue sur une route API pendant le pré-rendu** : lisez `request.headers` sur sa propre ligne, avant `getAuth()`, comme dans `total-impaye/route.ts`. La lecture de la requête arrête le pré-rendu.
- **TanStack Query et Cache Components** : un composant qui utilise `useQuery` au premier affichage va sous `<Suspense>`, sinon la construction signale une lecture de l'heure courante.
- **Zustand** : créez le magasin dans un fournisseur (`useState(() => creer…())`) ; un magasin global serait partagé entre les visiteurs côté serveur.

## Sources

- Lecture serveur, `<Suspense>`, `loading.js` et ses limites avec les layouts : `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md` (Next.js 16.4.0).
- Cache Components, lecture de `searchParams` sous `<Suspense>`, `partialPrefetching`, promesse `searchParams` passée sans l'attendre : `01-app/01-getting-started/08-caching.md`.
- `refresh()` après une écriture, vérification de la session dans chaque Server Action : `01-app/01-getting-started/07-mutating-data.md`, `01-app/03-api-reference/04-functions/refresh.md`.
- `updateTag`, `revalidateTag`, `revalidatePath` : `01-app/01-getting-started/09-revalidating.md`.
- Re-rendu inclus dans la réponse de l'action (`refresh`, `updateTag`) mais pas avec `revalidateTag(…, "max")` : `01-app/02-guides/server-actions.md` (« A single response carries data and UI », « Choosing a cache update »).
- « Une lecture sans cache n'a pas d'étiquette à invalider » : `01-app/02-guides/client-side-data-fetching/tanstack-query.md` et `client-side-data-fetching/index.md` (« Coordinate mutations »).
- Formulaires, validation Zod côté serveur, erreurs affichées : `01-app/02-guides/forms.md`.
- Fournisseur TanStack Query, `useQuery`, `<Suspense>` avec Cache Components : `01-app/02-guides/client-side-data-fetching/tanstack-query.md`.
- `error.js` et `retry()` : `01-app/03-api-reference/03-file-conventions/error.md`.
- `useSearchParams` sous `<Suspense>` : `01-app/03-api-reference/04-functions/use-search-params.md`.
- `PageProps` global, `searchParams` asynchrone : `01-app/03-api-reference/03-file-conventions/page.md`.
- Route Handler `GET` dynamique dès qu'il lit `request.headers` : `01-app/01-getting-started/15-route-handlers.md`.
- Session better-auth côté serveur : https://www.better-auth.com/docs/integrations/next
- nuqs, adaptateur App Router : https://nuqs.dev/docs/adapters ; lecture serveur `createLoader` / `createSearchParamsCache` : https://nuqs.dev/docs/server-side ; `useQueryStates` : https://nuqs.dev/docs/batching ; `shallow`, `startTransition`, `debounce`, `clearOnDefault` : https://nuqs.dev/docs/options ; parseurs et import `nuqs/server` : https://nuqs.dev/docs/parsers/built-in. Vérifié dans le paquet `nuqs@2.10.1` : l'adaptateur n'appelle `useSearchParams` que dans les hooks ; `debounce` et `inferParserType` sont exportés par `nuqs/server`.
- next-safe-action : client et `.use()` : https://next-safe-action.dev/docs/define-actions/create-the-client ; erreurs de validation : https://next-safe-action.dev/docs/define-actions/validation-errors ; `useAction` et `executeAsync` : https://next-safe-action.dev/docs/execute-actions/hooks/useaction ; `returnServerError` : https://next-safe-action.dev/docs/concepts/error-handling. Vérifié dans le paquet `next-safe-action@8.7.3` : forme formatée `{ champ: { _errors } }`.
- TanStack Form, `onSubmit` du formulaire et `formApi.reset()` après un envoi réussi : https://tanstack.com/form/latest/docs/framework/react/guides/submission-handling. Vérifié dans `@tanstack/form-core@1.33.5` : l'envoi marque tous les champs comme touchés et n'appelle `onSubmit` que si la validation Zod passe. L'erreur de champ du serveur disparaît à la modification du champ (essai avec jsdom et Testing Library).
- shadcn + TanStack Form : https://ui.shadcn.com/docs/forms/tanstack-form ; Field : https://ui.shadcn.com/docs/components/field ; Native Select : https://ui.shadcn.com/docs/components/native-select
- Zod 4 (messages, `z.input`) : https://zod.dev/api
- Drizzle : types de colonnes https://orm.drizzle.team/docs/column-types/pg ; `$count` https://orm.drizzle.team/docs/query-utils ; PGlite https://orm.drizzle.team/docs/connect-pglite ; migrations https://orm.drizzle.team/docs/migrations
- Zustand avec Next.js (magasin par fournisseur) : https://zustand.docs.pmnd.rs/learn/guides/nextjs
- Essai réel le 2026-10-06 sur le squelette du pack (Next.js 16.4.0, nuqs 2.10.1, shadcn 4.21.3 « base-nova », Biome 2.5.15, PGlite 0.5.8, Playwright 1.63.0, TanStack Query 5.104.1, Zustand 5.0.15) : `npm run check`, `npm run typecheck`, `npm test`, `npm run build` sans variables, puis Playwright sur ordinateur et téléphone (filtres, tri, recherche, création, route 401, action refusée sans session).
- Rejoué le 2026-10-08 dans l'architecture du pack (`app/` à la racine, alias `@src/`, règles de couches de Biome, shadcn 4.21.4), après la recette `connexion` : `npm run db:generate`, `npm run check`, `npm run typecheck`, `npm test`, `npm run build` avec des valeurs factices. Les parcours Playwright restent à rejouer sur cette organisation.

## Points à vérifier

- **Connexion réelle à Neon** : la recette a été essayée de bout en bout sur PGlite (`npm test`, puis `next start` et `next dev` branchés sur PGlite pour les tests Playwright). À rejouer une fois sur Neon.
- **Erreurs de validation renvoyées par le serveur** : le formulaire valide avant l'envoi, donc l'essai n'a pas déclenché `validationErrors` côté serveur. `erreursDeChamps` est couverte par son test unitaire seulement.
- **Scénario « Base indisponible »** (`error.tsx` et `retry()`) : non essayé.
- **Parcours Playwright dans l'architecture du pack** (`e2e/factures.spec.ts`, avec `champ()`) : à rejouer.
