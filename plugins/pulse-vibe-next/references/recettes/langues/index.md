# Recette : langues

> Quand l'utiliser : le site s'affiche en français, sa langue par défaut, et en anglais, avec une adresse par langue (`/compte`, `/en/compte`).

## Prérequis

- Squelette du pack (Next.js 16.4, `cacheComponents: true`) et recette `connexion` appliquée (`proxy.ts` à la racine, qui renvoie vers `/connexion`).
- Paquet à installer : `npm install next-intl` (dernière version ; recette vérifiée avec 4.14.9).
- Next.js 16.3 ou plus récent : `next/root-params` y est actif sans réglage.
- À appliquer **tôt** dans le projet : la recette déplace toutes les pages sous `app/[locale]/`.

## Variables d'environnement

Aucune.

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/config/i18n.ts` | Langues, langue par défaut, préfixe : lus au démarrage par le proxy, la navigation et les pages |
| `src/lib/i18n/request.ts` | Langue et messages de chaque requête |
| `src/lib/i18n/navigation.ts` | `Link`, `redirect`, `usePathname`, `useRouter` qui gardent la langue |
| `src/lib/i18n/chemins.ts` | Lecture de la langue dans une adresse et adresse dans une langue (fonctions pures) |
| `src/lib/i18n/referencement.ts` | Adresse officielle et versions de langue d'une page (`alternates`) |
| `src/lib/i18n/messages/fr.json`, `en.json` | Dictionnaires : un texte par clé, les mêmes clés dans les deux langues |
| `src/lib/i18n/__tests__/chemins.test.ts`, `referencement.test.ts` | Tests unitaires des fonctions pures |
| `next.config.ts` (modifié) | Extension next-intl |
| `app/layout.tsx` → `app/[locale]/layout.tsx` | Layout racine, avec la langue |
| `app/page.tsx`, `error.tsx`, `not-found.tsx`, `(public)/`, `(connecte)/` → sous `app/[locale]/` | Pages déplacées |
| `app/[locale]/[...reste]/page.tsx` | Adresse inconnue : page « introuvable » du site |
| `app/api/`, `global-error.tsx`, `globals.css`, `favicon.ico`, `robots.ts`, `sitemap.ts`, `opengraph-image.tsx`, `icon.tsx`, `apple-icon.tsx` | Restent dans `app/` |
| `app/[locale]/page.tsx` (modifié) | Exemple d'une page publique qui déclare ses versions de langue |
| `app/sitemap.ts` (modifié) | Une entrée par page et par langue, avec ses versions de langue |
| `src/components/shared/elements/choix-langue.tsx` | Sélecteur de langue (affichage : tout arrive en props) |
| `src/features/langues/components/containers/choix-langue.container.tsx` | Container client du sélecteur : lit la langue courante, l'adresse et les textes |
| `proxy.ts` (réécrit) | Renvoi vers la connexion + langues |
| `src/features/compte/components/containers/compte.container.tsx`, `app/[locale]/(connecte)/compte/page.tsx` (modifiés) | Exemples d'écrans traduits |
| `src/features/contact/schemas/contact.schema.ts`, `src/features/contact/actions/envoyer-message.action.ts` | Exemple d'action qui traduit ses messages |
| `playwright.config.ts` (modifié) | Navigateur de test en français |
| `e2e/langues.spec.ts` | Parcours de bout en bout |

## Étapes

- Étape 1 – Le routage : `pulse-aidd pile recette langues etape 1`
- Étape 2 – La langue de chaque requête : `pulse-aidd pile recette langues etape 2`
- Étape 3 – Les liens et redirections qui gardent la langue : `pulse-aidd pile recette langues etape 3`
- Étape 4 – L'extension next-intl : `pulse-aidd pile recette langues etape 4`
- Étape 5 – Les versions de langue pour Google : `pulse-aidd pile recette langues etape 5`
- Étape 6 – Les messages : `pulse-aidd pile recette langues etape 6`
- Étape 7 – Déplacer les pages : `pulse-aidd pile recette langues etape 7`
- Étape 8 – Le layout racine : `pulse-aidd pile recette langues etape 8`
- Étape 9 – Les adresses inconnues : `pulse-aidd pile recette langues etape 9`
- Étape 10 – Le proxy : connexion et langues : `pulse-aidd pile recette langues etape 10`
- Étape 11 – Traduire les écrans : `pulse-aidd pile recette langues etape 11`
- Étape 12 – Traduire les messages d'une action : `pulse-aidd pile recette langues etape 12`
- Étape 13 – Playwright en français : `pulse-aidd pile recette langues etape 13`
- Étape 14 – Adapter le test du lien d'évitement : `pulse-aidd pile recette langues etape 14`
- Étape 15 – Vérifier : `pulse-aidd pile recette langues etape 15`
## Scénarios Gherkin à ajouter à la spec

```gherkin
# language: fr
Fonctionnalité: Langues

  Règle: La langue se lit dans le début de l'adresse

    @US-XXX-1 @unitaire
    Plan du scénario: Une adresse donne sa langue et sa page
      Étant donné l'adresse « <adresse> »
      Quand on lit sa langue
      Alors la langue est « <langue> » et la page est « <page> »

      Exemples:
        | adresse    | langue | page    |
        | /en/compte | en     | /compte |
        | /compte    | fr     | /compte |

  Règle: Le site s'affiche dans la langue choisie

    @US-XXX-2 @bout-en-bout
    Exemple: Une visiteuse francophone voit le site en français
      Étant donné le navigateur de Camille est réglé en français
      Quand Camille ouvre l'accueil
      Alors la page est en français

    @US-XXX-2 @bout-en-bout
    Exemple: Camille passe en anglais depuis le sélecteur de langue
      Étant donné Camille est sur l'accueil en français
      Quand Camille choisit « English »
      Alors l'adresse devient « /en » et la page est en anglais

  Règle: La page de connexion garde la langue de la personne

    @US-XXX-3 @unitaire
    Plan du scénario: La page de connexion se trouve dans la langue courante
      Étant donné la langue « <langue> »
      Quand on construit l'adresse de connexion
      Alors l'adresse est « <adresse> »

      Exemples:
        | langue | adresse       |
        | en     | /en/connexion |
        | fr     | /connexion    |

    @US-XXX-3 @bout-en-bout @securite
    Exemple: Sans session, la page compte anglaise mène à la connexion anglaise
      Étant donné personne n'est connecté
      Quand on ouvre « /en/compte »
      Alors on arrive sur « /en/connexion »

  Règle: Chaque page publique déclare ses versions de langue

    @US-XXX-4 @unitaire
    Exemple: Une page déclare toutes ses versions, x-default comprise
      Étant donné la page « /tarifs »
      Quand on construit ses versions de langue
      Alors on obtient « fr : /tarifs », « en : /en/tarifs » et « x-default : /tarifs »
```

## Tâches de plan prêtes

- [ ] **Tn – Installer les langues** · US-XXX
  - Objectif : le site répond en français sans préfixe et en anglais sous `/en`
  - Dépend de : —
  - Fichiers : à créer : `src/config/i18n.ts`, `src/lib/i18n/request.ts`, `navigation.ts`, `chemins.ts`, `src/lib/i18n/messages/fr.json`, `en.json`, `src/lib/i18n/__tests__/chemins.test.ts`, `src/components/shared/elements/choix-langue.tsx`, `src/features/langues/components/containers/choix-langue.container.tsx`, `app/[locale]/layout.tsx`, `app/[locale]/[...reste]/page.tsx` · à modifier : `next.config.ts`, `proxy.ts` · à déplacer : les pages sous `app/[locale]/`
  - Vérification : US-XXX critères 1 et 3 – `npm run build` passe et liste `/fr` et `/en` ; `/en/compte` sans session mène à `/en/connexion`
  - Tests : « Une adresse donne sa langue et sa page », « La page de connexion se trouve dans la langue courante » (unitaires)
  - Attention : `app/api/` reste hors de `[locale]` ; reprendre polices, `NuqsAdapter` et `Toaster` de l'ancien layout ; ajouter `[locale]` aux clés de `PageProps` et `LayoutProps`
- [ ] **Tn+1 – Choisir sa langue** · US-XXX
  - Objectif : le sélecteur de langue (créé par Tn) permet de passer du français à l'anglais sur chaque page, et les parcours le prouvent
  - Dépend de : Tn
  - Fichiers : à créer : `e2e/langues.spec.ts` · à modifier : `playwright.config.ts`
  - Vérification : US-XXX critère 2 – sur l'accueil, cliquer sur « English » : l'adresse devient `/en`
  - Tests : « Une visiteuse francophone voit le site en français », « Camille passe en anglais depuis le sélecteur de langue », « Sans session, la page compte anglaise mène à la connexion anglaise » (bout en bout)
- [ ] **Tn+2 – Traduire les écrans** · US-XXX
  - Objectif : chaque texte affiché vient de `src/lib/i18n/messages/fr.json` et `en.json` ; chaque page publique déclare ses versions de langue
  - Dépend de : Tn+1
  - Fichiers : à créer : `src/lib/i18n/referencement.ts`, `src/lib/i18n/__tests__/referencement.test.ts` · à modifier : pages, containers et actions qui affichent du texte, `app/sitemap.ts`
  - Vérification : US-XXX critères 2 et 4 – parcourir le site en anglais : aucun texte français ne reste ; `pulse-aidd seo http://localhost:3000` : contrôle L23 sans constat
  - Tests : « Une page déclare toutes ses versions, x-default comprise » (unitaire) ; les tests existants vérifient les textes français

## Tests
Le code des tests : `pulse-aidd pile recette langues tests`
## Points de sécurité

- **S4 – Pages réservées** : le proxy reste un renvoi rapide ; chaque page connectée et chaque action vérifient la session comme avant (`utilisateurConnecte()`, `actionConnectee`).
- **S5 – Validation** : une langue inconnue dans l'adresse donne une page 404 (`hasLocale`, puis `notFound()`) ; la langue reçue par une action passe par `z.enum(routing.locales)`.
- **S6 – Affichage** : les valeurs insérées dans un texte (`t("connecteEnTantQue", { nom })`) s'affichent comme du texte ; `t.rich` et `t.markup` restent réservés aux textes écrits par l'équipe.
- Les fichiers `src/lib/i18n/messages/*.json` partent vers le navigateur : ils ne contiennent aucun secret.

## Pièges connus

- **Construction en échec sur `generateStaticParams`** : avec Cache Components, `app/[locale]/layout.tsx` déclare chaque langue dans `generateStaticParams`.
- **`PageProps<"/…">` ou `LayoutProps<"/">` refusé par `npm run typecheck`** : la clé prend `[locale]` (`PageProps<"/[locale]/…">`, `LayoutProps<"/[locale]">`).
- **Page oubliée dans `app/`** : elle n'a plus de layout racine. Tout déplacer, sauf `api/`, `global-error.tsx`, `globals.css`, `favicon.ico` et les fichiers du référencement (`robots.ts`, `sitemap.ts`, `opengraph-image.tsx`, `icon.tsx`, `apple-icon.tsx`).
- **Avertissement `metadataBase` à la construction** : il vient des routes d'images (`opengraph-image`, `icon`, `apple-icon`) laissées dans `app/`, hors du layout `[locale]`. Les pages gardent leur `metadataBase` et leurs adresses complètes.
- **Le proxy laisse passer toutes les pages (404 sur `/compte`, `/connexion`)** : le `matcher` écrit dans une chaîne TypeScript garde le double antislash de `.*\\..*`. Avec un seul antislash, il exclut toute adresse non vide.
- **`next-intl` ne trouve pas `request.ts`** : il le cherche d'office dans `src/i18n/`. Le pack le range dans `src/lib/i18n/` ; `createNextIntlPlugin("./src/lib/i18n/request.ts")` donne le chemin.
- **`next/root-params` dans une action ou un Route Handler** : indisponible. Passer la langue en paramètre (`getTranslations({ locale, namespace })`).
- **Tests Playwright redirigés vers `/en`** : le navigateur de test annonce l'anglais par défaut ; régler `locale: "fr-FR"`.
- **Détection automatique** : un navigateur réglé en anglais qui ouvre `/` part sur `/en` ; le choix fait avec le sélecteur est gardé dans le cookie `NEXT_LOCALE`.
- **Adresses avec un point** (`/profil/jean.dupont`) : exclues par le `matcher` ; ajouter une entrée de `matcher` dédiée.
- **Versions de langue non réciproques** : chaque version cite toutes les autres et elle-même ; sinon Google ignore ces liens (`pulse-aidd seo`, contrôle L23).
- **Liens qui perdent `/en`** : `next/link` et `redirect` de `next/navigation` ignorent la langue ; utiliser ceux de `@src/lib/i18n/navigation`.
- **Liens des e-mails, retour de Stripe, redirections des actions de la recette `connexion`** : ils visent les adresses françaises (sans préfixe), qui restent valides.

## Sources

- next-intl 4.14.9 : https://next-intl.dev/docs/routing/setup (source `docs/src/pages/docs/routing/setup.mdx` du dépôt amannn/next-intl : `next/root-params`, `setRequestLocale` ancien) ; `routing/middleware.mdx` (composition du proxy, `matcher`) ; `environments/actions-metadata-route-handlers.mdx` (actions : `getTranslations({ locale, namespace })`) ; code du paquet (argument de `createNextIntlPlugin` : chemin de `request.ts`, cookie `NEXT_LOCALE`)
- Next.js 16.4, documentation embarquée : `01-app/02-guides/internationalization.md` ; `01-app/03-api-reference/04-functions/next-root-params.md` (indisponible dans les actions et les Route Handlers ; `generateStaticParams` obligatoire avec Cache Components) ; `01-app/01-getting-started/16-proxy.md` ; `01-app/03-api-reference/03-file-conventions/not-found.md`
- better-auth 1.7.7 : `dist/cookies/index.d.mts` (`getSessionCookie`)
- Vérifications locales (squelette du pack + recette `connexion`, puis cette recette) : `npm run check`, `npm run typecheck`, Vitest (47 tests) et `next build` passent (sélecteur découpé en élément et container, textes de « Mon compte » traduits) ; `next start` : `/` → 200 (`lang="fr"`), `/en` → 200 (`lang="en"`), `/fr` → 307 `/`, `/compte` → 307 `/connexion`, `/en/compte` → 307 `/en/connexion`, navigateur anglais sur `/` → 307 `/en`, adresse inconnue (`/xyz`, `/en/xyz`, `/xx/compte`) → 404 ; sitemap : une entrée par langue avec ses versions ; Playwright (`langues.spec.ts`, `referencement.spec.ts`) : 14 tests passent sur ordinateur et sur téléphone ; `seo-code.js` : aucun constat Critique ou Haute

## Points à vérifier

- Le texte de la page 404 (« Page introuvable ») pour une adresse inconnue : la réponse est bien 404, mais son contenu se construit dans le navigateur ; à regarder une fois dans un vrai navigateur.
- Une redirection `redirect("/compte")` d'une action pour une personne qui a choisi l'anglais : next-intl devrait la renvoyer vers `/en/compte` grâce au cookie `NEXT_LOCALE` ; à constater.
- « Mon compte » en anglais pour une personne connectée (« Signed in as … ») : écrit, mais non constaté, faute de base de données dans l'essai.
- `NextIntlClientProvider` sans `messages` transmet tous les messages de la langue aux composants clients ; pour un gros fichier de messages, ne transmettre que les espaces de noms utiles.
- Le serveur de développement journalise une erreur « Could not validate `instant` » pour `app/[locale]/[...reste]/page.tsx` (la page appelle `notFound()` par conception) ; la réponse reste 404 et les tests passent.
