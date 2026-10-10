# Recette : formulaire-public

> Quand l'utiliser : un formulaire accessible sans connexion (contact, demande de devis, inscription à une lettre, avis) doit freiner les robots et les envois en rafale.

## Prérequis

- Recette `limite` appliquée (`pulse-aidd pile recette limite`) : `exigerLimite` et `NomLimite` de `src/lib/limite.ts`.
- Paquets du squelette : `next-safe-action`, `zod`, `@tanstack/react-form`, `sonner`. Si l'un manque, l'installer à sa dernière version : `npm install <paquet>`.
- Pour l'exemple de contact : la zone de texte de shadcn, `npx shadcn@latest add textarea`.
- Option Turnstile : un compte Cloudflare (offre gratuite) et un widget créé dans **Turnstile**, pour le domaine du site et `localhost`.
- Vérifiée automatiquement par la CI du pack, à chaque modification et chaque semaine, aux dernières versions (chaîne `connexion,limite,formulaire-public` de `verifier-recettes.js`), option Turnstile comprise : contrôles, types, tests unitaires et d'intégration, construction. Sans clés, l'option est inactive : la version vérifiée se comporte comme la base. Les tests de bout en bout (`e2e/formulaire-public.spec.ts`, et `e2e/turnstile.spec.ts` avec les clés de test de Cloudflare) se lancent à la main.

## Variables d'environnement

| Nom | Rôle |
|---|---|
| `FORMULAIRE_SECRET` | Signe le jeton de délai des formulaires (32 caractères au moins, générée : `pulse-aidd secrets generer FORMULAIRE_SECRET`) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Option Turnstile : clé de site du widget, publique (elle apparaît dans la page) |
| `TURNSTILE_SECRET_KEY` | Option Turnstile : clé secrète du widget, côté serveur seulement |

Dans `src/config/env.ts`, ajouter dans `server: { … }` :

<!-- ajout: src/config/env.ts après: server: { -->
```ts
    // Recette formulaire-public : signe le jeton de délai des formulaires (32 caractères au moins).
    FORMULAIRE_SECRET: z.string().min(32),
```

Dans `.env.example`, le nom sans valeur (les variables Turnstile s'y ajoutent seulement avec l'option) :

<!-- ajout: .env.example -->
```
FORMULAIRE_SECRET=
```

`FORMULAIRE_SECRET` devient obligatoire : une valeur de test dans `VARIABLES_VALIDES` de `tests/helpers/env-de-test.ts` (aide du squelette) :

<!-- ajout: tests/helpers/env-de-test.ts après: export const VARIABLES_VALIDES: Record<string, string> = { -->
```ts
  FORMULAIRE_SECRET: "x".repeat(32),
```

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/config/env.ts`, `.env.example` (modifiés) | `FORMULAIRE_SECRET` (et la clé secrète Turnstile avec l'option) |
| `src/config/env-public.ts` (modifié, option Turnstile) | La clé de site Turnstile, publique |
| `tests/helpers/env-de-test.ts` (modifié) | Valeur de test de `FORMULAIRE_SECRET` dans `VARIABLES_VALIDES` |
| `src/lib/helpers/formulaire-public/champs.ts` | Noms des champs de protection, contrôle du champ piège |
| `src/lib/helpers/formulaire-public/jeton.ts` | Jeton de délai signé (fonctions pures) |
| `app/api/jeton-formulaire/route.ts` | Donne un jeton au navigateur à l'ouverture du formulaire |
| `src/hooks/use-protection-formulaire.ts` | Protection côté navigateur, appelée par le container |
| `src/components/shared/elements/champ-piege.tsx` | Le champ piège invisible |
| `src/lib/formulaire-public.ts` | `actionFormulairePublic` : les contrôles avant l'action |
| `src/features/contact/…` (schéma, action, section, container), `app/(public)/contact/page.tsx` | Exemple : formulaire de contact protégé |
| `src/components/ui/textarea.tsx` | Zone de texte de shadcn (exemple) |
| Tests : `src/lib/helpers/formulaire-public/__tests__/`, `src/features/contact/actions/__tests__/`, `e2e/formulaire-public.spec.ts` | Unitaires, intégration, bout en bout |
| `src/adapters/turnstile/turnstile.adapter.ts` et ses tests (option Turnstile) | Vérification de la réponse du widget auprès de Cloudflare ; les deux clés vont ensemble |
| `e2e/turnstile.spec.ts` (option Turnstile) | Le widget en vrai, avec les clés de test de Cloudflare |
| `src/components/shared/elements/widget-turnstile.tsx` (option Turnstile) | Le widget |
| `next.config.ts` (modifié, option Turnstile) | Le script et le cadre du widget autorisés par la CSP |

## Étapes

<!-- commande: npx shadcn@latest add textarea -->

Un formulaire public reçoit trois protections, contrôlées sur le serveur avant l'action, de la moins coûteuse à la plus coûteuse :

1. **Le champ piège** : un champ invisible pour une personne. Un robot qui remplit tous les champs se trahit.
2. **Le jeton de délai** : le navigateur reçoit, à l'ouverture du formulaire, un jeton signé par le serveur. Il prouve que le formulaire a été ouvert sur le site, et quand. Envoyé moins de 3 secondes après l'ouverture, c'est probablement un robot ; après 2 heures, la page se recharge.
3. **La limite par adresse IP** de la recette `limite` (5 envois par minute).

Turnstile, en option, ajoute une vérification de Cloudflare pour les formulaires visés par les robots.

- Étape 1 – La variable `FORMULAIRE_SECRET` : `pulse-aidd pile recette formulaire-public etape 1`
- Étape 2 – Les noms des champs : `pulse-aidd pile recette formulaire-public etape 2`
- Étape 3 – Le jeton signé : `pulse-aidd pile recette formulaire-public etape 3`
- Étape 4 – La route du jeton : `pulse-aidd pile recette formulaire-public etape 4`
- Étape 5 – Le hook de protection : `pulse-aidd pile recette formulaire-public etape 5`
- Étape 6 – Le champ piège : `pulse-aidd pile recette formulaire-public etape 6`
- Étape 7 – Les contrôles avant l'action : `pulse-aidd pile recette formulaire-public etape 7`
- Étape 8 – Protéger un formulaire : l'exemple de contact : `pulse-aidd pile recette formulaire-public etape 8`
- Étape 9 – Essayer : `pulse-aidd pile recette formulaire-public etape 9`
- Étape 10 – Mettre en ligne : `pulse-aidd pile recette formulaire-public etape 10`
- Étape option-turnstile – Option : Turnstile : `pulse-aidd pile recette formulaire-public etape option-turnstile`
- Étape 11 – Le widget Cloudflare et les variables : `pulse-aidd pile recette formulaire-public etape 11`
- Étape 12 – La vérification côté serveur : `pulse-aidd pile recette formulaire-public etape 12`
- Étape 13 – Brancher Turnstile dans les contrôles : `pulse-aidd pile recette formulaire-public etape 13`
- Étape 14 – Le widget : `pulse-aidd pile recette formulaire-public etape 14`
- Étape 15 – Hook, section et container : `pulse-aidd pile recette formulaire-public etape 15`
- Étape 16 – La CSP autorise Turnstile : `pulse-aidd pile recette formulaire-public etape 16`
- Étape 17 – Essayer Turnstile : `pulse-aidd pile recette formulaire-public etape 17`
## CSRF

- Les actions serveur de Next.js n'acceptent que des requêtes `POST` venues du site : Next.js compare l'en-tête `Origin` à l'adresse du site (`Host`) et refuse la requête si elles diffèrent. Avec `form-action 'self'` (déjà dans la CSP du squelette) et les cookies `SameSite`, aucun jeton CSRF supplémentaire n'est nécessaire.
- Une route API qui reçoit un formulaire vérifie elle-même l'en-tête `Origin` (modèle : recette `mesure-reelle`).
- `experimental.serverActions.allowedOrigins` (dans `next.config.ts`) sert seulement si le site est servi derrière un autre domaine (proxy) ; sinon, le laisser absent.
- Source : https://nextjs.org/docs/app/guides/data-security (section « Allowed origins »).

## Scénarios Gherkin à ajouter à la spec

```gherkin
# language: fr
Fonctionnalité: Protection des formulaires publics

  Règle: Un robot qui remplit le champ piège est refusé

    @US-XXX-1 @unitaire
    Exemple: rempli, même avec une valeur qui n'est pas du texte : c'est un robot
      Étant donné le champ piège contient « https://exemple.fr », 0, false ou un objet
      Quand le champ piège est contrôlé
      Alors l'envoi est compté comme celui d'un robot

    @US-XXX-1 @integration @securite
    Exemple: champ piège rempli : refusé, et noté dans le journal sans le contenu
      Étant donné un envoi dont le champ piège contient « https://spam.example »
      Quand l'action reçoit l'envoi
      Alors elle répond « Rechargez la page et réessayez. »
      Et le journal ne contient pas « spam.example »

    @US-XXX-1 @bout-en-bout
    Exemple: un robot qui remplit le champ piège est refusé
      Étant donné le formulaire de contact est ouvert
      Quand un robot remplit le champ piège et envoie
      Alors la page affiche « Rechargez la page et réessayez. »

  Règle: Le formulaire doit avoir été ouvert sur le site, il y a au moins 3 secondes et moins de 2 heures

    @US-XXX-2 @unitaire
    Exemple: envoyé moins de 3 secondes après l'ouverture : trop rapide
      Étant donné un jeton signé il y a 2,999 secondes
      Quand le jeton est vérifié
      Alors il est « trop rapide »

    @US-XXX-2 @unitaire
    Exemple: ouvert depuis plus de 2 heures : expiré
      Étant donné un jeton signé il y a 2 heures et 1 milliseconde
      Quand le jeton est vérifié
      Alors il est « expiré »

    @US-XXX-2 @unitaire @securite
    Exemple: horodatage modifié ou autre secret : refusé
      Étant donné un jeton dont l'heure a été modifiée
      Quand le jeton est vérifié
      Alors il est refusé

    @US-XXX-2 @integration
    Exemple: envoyé une seconde après l'ouverture : message « trop rapide »
      Étant donné un formulaire ouvert il y a une seconde
      Quand il est envoyé
      Alors l'action répond « Envoi trop rapide. Patientez quelques secondes, puis réessayez. »

  Règle: Une personne qui prend le temps d'écrire envoie son message

    @US-XXX-3 @integration
    Exemple: une personne qui a pris le temps d'écrire : le message part
      Étant donné un formulaire ouvert il y a 5 secondes, champ piège vide
      Quand il est envoyé
      Alors le message est reçu

    @US-XXX-3 @bout-en-bout
    Exemple: une personne qui prend le temps d'écrire envoie son message
      Étant donné Camille ouvre la page de contact
      Quand Camille écrit son message et l'envoie après quelques secondes
      Alors Camille lit « Message envoyé. Merci ! »

  Règle: Les envois en rafale sont limités

    @US-XXX-4 @integration @securite
    Exemple: sixième envoi en une minute depuis la même adresse : limite atteinte
      Étant donné 5 envois depuis la même adresse dans la dernière minute
      Quand un sixième envoi arrive
      Alors l'action répond « Trop de tentatives. Réessayez dans 1 minute. »

  Règle: Le formulaire explique quoi faire s'il n'a pas pu se préparer

    @US-XXX-2 @bout-en-bout
    Exemple: sans jeton, le bouton reste désactivé et la page explique quoi faire
      Étant donné la demande du jeton échoue
      Quand la page de contact s'ouvre
      Alors la page affiche « Le formulaire n'a pas pu se préparer. Rechargez la page. »
      Et le bouton « Envoyer » reste désactivé

  Règle: Le widget Turnstile explique quoi faire s'il ne se charge pas (option)

    @US-XXX-5 @bout-en-bout
    Exemple: widget bloqué : la page explique quoi faire
      Étant donné Turnstile est actif et son script est bloqué
      Quand la page de contact s'ouvre
      Alors la page affiche « La vérification anti-robot n'a pas pu se charger. »
      Et le bouton « Envoyer » reste désactivé

  Règle: Turnstile refuse un envoi sans réponse valable (option)

    @US-XXX-5 @integration @securite
    Exemple: Turnstile actif et réponse absente : refusé
      Étant donné Turnstile est actif
      Quand un envoi arrive sans réponse du widget
      Alors l'action répond « La vérification anti-robot a échoué. Réessayez dans un instant. »

    @US-XXX-5 @integration
    Exemple: Cloudflare injoignable : refusé, et l'incident est journalisé
      Étant donné Cloudflare ne répond pas
      Quand la réponse du widget est vérifiée
      Alors l'envoi est refusé et l'incident est journalisé
```

## Tâches de plan prêtes

- [ ] **Tn – Préparer la protection des formulaires publics** · US-XXX
  - Objectif : le site sait reconnaître un envoi de robot (champ piège, jeton de délai) et limiter les envois en rafale
  - Dépend de : la tâche « Compter les tentatives par adresse IP » de la recette `limite`
  - Fichiers : à créer : `src/lib/helpers/formulaire-public/champs.ts`, `src/lib/helpers/formulaire-public/jeton.ts`, `app/api/jeton-formulaire/route.ts`, `src/hooks/use-protection-formulaire.ts`, `src/components/shared/elements/champ-piege.tsx`, `src/lib/formulaire-public.ts` et leurs tests · à modifier : `src/config/env.ts`, `.env.example`, `tests/helpers/env-de-test.ts` (`FORMULAIRE_SECRET`)
  - Vérification : US-XXX critères 1 et 2 – `npm test` passe
  - Tests : « rempli, même avec une valeur qui n'est pas du texte… », « envoyé moins de 3 secondes après l'ouverture… », « ouvert depuis plus de 2 heures… », « horodatage modifié ou autre secret… » (unitaires)
  - Action manuelle : `pulse-aidd secrets generer FORMULAIRE_SECRET`
- [ ] **Tn+1 – Protéger le formulaire de contact** · US-XXX
  - Objectif : une personne envoie un message ; un robot est refusé
  - Dépend de : Tn
  - Fichiers : à créer : `src/features/contact/schemas/contact.schema.ts`, `src/features/contact/actions/envoyer-message.action.ts`, `src/features/contact/components/sections/formulaire-contact.tsx`, `src/features/contact/components/containers/contact.container.tsx`, `app/(public)/contact/page.tsx`, `src/features/contact/actions/__tests__/envoyer-message.action.test.ts`, `e2e/formulaire-public.spec.ts` (exemple : adapter au projet)
  - Vérification : US-XXX critères 1 à 4 – `npm test` et `npm run test:e2e` passent ; essai manuel de l'étape 9
  - Tests : « une personne qui a pris le temps d'écrire… », « champ piège rempli… », « sixième envoi en une minute… » (intégration) ; « une personne qui prend le temps d'écrire envoie son message », « un robot qui remplit le champ piège est refusé », « sans jeton, le bouton reste désactivé… » (bout en bout)
  - Action manuelle : `pulse-aidd secrets generer FORMULAIRE_SECRET --envoyer production,preview --sans-local`, puis redéployer
- [ ] **Tn+2 (facultative) – Ajouter Turnstile** · US-XXX
  - Objectif : les formulaires visés par les robots passent aussi par la vérification de Cloudflare
  - Dépend de : Tn+1
  - Fichiers : à créer : `src/adapters/turnstile/turnstile.adapter.ts`, `src/adapters/turnstile/__tests__/turnstile.adapter.test.ts`, `src/adapters/turnstile/__tests__/variables-turnstile.test.ts`, `src/components/shared/elements/widget-turnstile.tsx`, `e2e/turnstile.spec.ts` · à modifier : `src/lib/formulaire-public.ts`, `src/hooks/use-protection-formulaire.ts`, la section et le container du formulaire, `src/config/env.ts`, `.env.example`, `next.config.ts`
  - Vérification : US-XXX critère 5 – `npm test` passe ; essai avec les clés de test de l'étape 17
  - Tests : « Turnstile actif et réponse absente : refusé », « Cloudflare injoignable… », « clé secrète sans clé de site… » (intégration) ; « widget bloqué : la page explique quoi faire » (bout en bout, avec les clés de test)
  - Action manuelle : créer le widget Turnstile, saisir les deux clés dans `.env` et dans Vercel, puis redéployer

## Tests
Le code des tests : `pulse-aidd pile recette formulaire-public tests`
## Points de sécurité

- **S5 – Validation** : le schéma Zod de l'action reste vérifié côté serveur ; il retire les champs de protection.
- **S1, S2 – Secrets** : `FORMULAIRE_SECRET` et `TURNSTILE_SECRET_KEY` restent côté serveur (`server-only`, sans `NEXT_PUBLIC_`). La clé de site Turnstile est publique par nature.
- **S9 – Données personnelles** : le journal note le nom du formulaire et la raison du refus, sans l'adresse IP ni le contenu. Avec Turnstile, Cloudflare reçoit l'adresse IP du visiteur : à citer dans la mention de confidentialité.
- **S10 – Abus et coûts** : champ piège, jeton de délai signé et limite par adresse IP ; Turnstile en plus pour les formulaires visés.
- **S11 – Messages d'erreur** : chaque refus dit quoi faire (recharger, patienter, réessayer), sans détail technique.
- **S12 – En-têtes** : la CSP s'ouvre à `https://challenges.cloudflare.com` seulement avec l'option Turnstile, pour `script-src` et `frame-src`.

## Pièges connus

- **Nom de formulaire différent entre le container et l'action** : le jeton est refusé à chaque envoi. La constante du schéma (`FORMULAIRE_CONTACT`) sert aux deux.
- **Vrai champ nommé `champ_verification`** : chaque envoi serait refusé. Ce nom reste réservé au champ piège.
- **Tests de bout en bout trop rapides** : le délai se mesure avec l'horloge du serveur (`page.clock` ne la change pas) ; le test attend 3 secondes (`page.waitForTimeout(3_200)`).
- **`getByRole("alert")` trouve deux éléments dans Playwright** : Next.js ajoute son propre élément `role="alert"` (annonce de navigation). Filtrer par le texte attendu : `page.getByRole("alert").filter({ hasText: "…" })`.
- **Limite atteinte pendant les tests de bout en bout** : en local, toutes les requêtes ont la même adresse ; espacer les essais ou relever `REGLES.formulairePublic` le temps des essais.
- **Jeton gardé dans une page en cache** : le jeton est demandé par le navigateur à l'ouverture, jamais écrit dans la page ; la route reste en `no-store`.
- **Turnstile : second envoi refusé après une erreur** : une réponse du widget ne sert qu'une fois. Le container appelle `protection.apresEnvoi()` après chaque envoi, qui relance le widget.
- **Turnstile activé sans la CSP** : le widget reste vide et la console affiche « Refused to load the script » ; appliquer l'étape 16.
- **Clé de site Turnstile changée sans reconstruire** : `NEXT_PUBLIC_TURNSTILE_SITE_KEY` est lue à la construction ; redéployer après l'avoir changée.
- **Widget Turnstile bloqué** (bloqueur de publicités, réseau d'entreprise) : la section affiche « La vérification anti-robot n'a pas pu se charger… » et le bouton reste désactivé ; la personne recharge la page ou autorise le site dans son bloqueur.
- **Le cadre du widget est introuvable dans un test Playwright** : Turnstile l'affiche dans un shadow DOM. Vérifier plutôt que le bouton s'active (la réponse est arrivée).

## Sources

- next-safe-action 8.7.3 : middleware (`.use`, `clientInput`, `next`) https://next-safe-action.dev/docs/define-actions/middleware ; `returnServerError` https://next-safe-action.dev/docs/concepts/error-handling
- Next.js 16.4 : Route Handlers et `connection()` (documentation embarquée, `01-app/03-api-reference/04-functions/connection.md`) ; sécurité des actions serveur https://nextjs.org/docs/app/guides/data-security
- Node.js `crypto` : `createHmac`, `timingSafeEqual` https://nodejs.org/api/crypto.html
- Cloudflare Turnstile : vérification côté serveur (adresse `siteverify`, `remoteip` facultatif, réponse de 2048 caractères au plus, valable 5 minutes, à usage unique) https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ ; rendu explicite https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/ ; CSP (`script-src` et `frame-src`) https://developers.cloudflare.com/turnstile/reference/content-security-policy/ ; clés de test https://developers.cloudflare.com/turnstile/troubleshooting/testing/
- Vérifications locales le 2026-10-08, sur le squelette du pack avec la recette `limite` (Next.js 16.4.0, next-safe-action 8.7.3, TanStack Form 1.33.5, Zod 4.6.5, Vitest 5.0.3, Playwright 1.63.0) : `npm run check`, `npm run typecheck`, `npm test`, `npm run build`, puis `npm run test:e2e` en configuration de production (ordinateur et téléphone) ; Turnstile essayé avec les clés de test de Cloudflare (accepté, refusé, widget relancé après l'envoi, aucune violation de la CSP)

## Points à vérifier

- Les libellés du tableau de bord Turnstile au moment de créer le widget.
- Le comportement du widget sur téléphone avec une vraie clé (essai fait avec les clés de test sur ordinateur).
