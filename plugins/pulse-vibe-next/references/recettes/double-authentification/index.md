# Recette : double-authentification

> Quand l'utiliser : un code à 6 chiffres reçu par e-mail s'ajoute au mot de passe à chaque connexion ; chacun l'active dans « Mon compte ».

## Prérequis

- Recettes `connexion`, `envoi-email` et `email` appliquées : `creerAuth` avec son `envoyeur` (un `EnvoyeurEmail` de `envoi-email`), `EmailsCompte`, `utilisateurConnecte()` (avec `email`), « Mon compte » de la recette `email` (sections `aria-labelledby`), Mailpit et les aides Playwright `e2e/aides/connexion.ts` (recette `email`) et `e2e/aides/mailpit.ts` (recette `envoi-email`).
- Aucun paquet nouveau : le plugin `twoFactor` est inclus dans `better-auth` (`better-auth/plugins/two-factor` ; recette vérifiée avec better-auth 1.7.25).
- Recette `limite` conseillée : elle borne les essais de code et les renvois (étape 7 de `limite`).
- Vérifiée automatiquement par la CI du pack, à chaque modification et chaque semaine, aux dernières versions (chaîne `connexion,envoi-email,email,double-authentification` de `verifier-recettes.js`) : contrôles, types, tests unitaires et d'intégration, construction. Le test de bout en bout (`e2e/double-authentification.spec.ts`, avec Mailpit) se lance à la main.

## Variables d'environnement

Aucune nouvelle variable : le code part par le serveur d'e-mail de la recette `envoi-email`.

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/db/compte/auth.table.ts` (modifié), `drizzle/<numéro>_<nom>.sql` | Colonne `two_factor_enabled` et table `two_factor` du plugin, et leur migration |
| `src/adapters/auth/auth.adapter.ts` (modifié) | Plugin `twoFactor` : code à 6 chiffres par e-mail, 5 minutes, 5 essais, gardé haché ; ses chemins HTTP fermés |
| `src/core/compte/emails-compte.rules.ts` (modifié) | `codeDeConnexion` : le code dans le corps, jamais dans l'objet |
| `src/features/compte/queries/utilisateur-connecte.query.ts` (modifié) | `doubleAuthentification` : l'état du réglage |
| `src/features/compte/schemas/compte.schema.ts` (modifié) | `schemaCodeConnexion`, `schemaReglageDoubleAuthentification` |
| `src/features/compte/actions/connecter.action.ts` (modifié) | Envoie le code et mène à `/connexion/code` quand la double authentification est active |
| `src/features/compte/actions/verifier-code.action.ts`, `renvoyer-code.action.ts` | Actions `verifierCode` et `renvoyerCode` |
| `src/features/compte/actions/activer-double-authentification.action.ts`, `desactiver-double-authentification.action.ts` | Actions `activerDoubleAuthentification` et `desactiverDoubleAuthentification` (mot de passe demandé) |
| `src/features/compte/components/sections/formulaire-code.tsx`, `containers/code-connexion.container.tsx` | Saisie du code et renvoi |
| `src/features/compte/components/sections/formulaire-double-authentification.tsx`, `containers/double-authentification.container.tsx` | Le réglage dans « Mon compte » |
| `src/features/compte/components/containers/compte.container.tsx` (modifié) | Section « Double authentification » |
| `app/(public)/connexion/code/page.tsx` | Page « Code de connexion » |
| `src/core/compte/__tests__/code-de-connexion.rules.test.ts`, `src/adapters/auth/__tests__/auth-double-authentification.test.ts` | Tests unitaire et d'intégration |
| `e2e/double-authentification.spec.ts` | Parcours de bout en bout (Mailpit) |

## Étapes

Le parcours une fois la recette en place :

1. Dans « Mon compte », Camille saisit son mot de passe et active la double authentification.
2. À sa connexion suivante, le mot de passe ne suffit plus : better-auth n'ouvre pas de session, pose un cookie `two_factor` (10 minutes) et l'action `connecter` envoie un code à 6 chiffres par e-mail. La page « Code de connexion » s'affiche.
3. Camille saisit le code (valable 5 minutes, 5 essais) : la session s'ouvre, « Mon compte » s'affiche. Code perdu ou expiré : « Renvoyer le code ».
4. Pour désactiver, elle saisit son mot de passe dans « Mon compte ».

- Étape 1 – Les tables : `pulse-aidd pile recette double-authentification etape 1`
- Étape 2 – better-auth : `pulse-aidd pile recette double-authentification etape 2`
- Étape 3 – L'e-mail du code : `pulse-aidd pile recette double-authentification etape 3`
- Étape 4 – La session et les schémas : `pulse-aidd pile recette double-authentification etape 4`
- Étape 5 – Les actions : `pulse-aidd pile recette double-authentification etape 5`
- Étape 6 – Les formulaires : sections et containers : `pulse-aidd pile recette double-authentification etape 6`
- Étape 7 – La page du code et « Mon compte » : `pulse-aidd pile recette double-authentification etape 7`
- Étape 8 – Essayer en local : `pulse-aidd pile recette double-authentification etape 8`
- Étape 9 – Mettre en ligne : `pulse-aidd pile recette double-authentification etape 9`
## Scénarios Gherkin à ajouter à la spec

```gherkin
# language: fr
Fonctionnalité: Double authentification

  Règle: Avec la double authentification, un code reçu par e-mail s'ajoute au mot de passe

    @US-XXX-1 @bout-en-bout
    Exemple: Camille se connecte avec le code reçu
      Étant donné Camille a activé la double authentification
      Quand Camille se connecte avec son mot de passe
      Alors la page « Code de connexion » s'affiche
      Et le code reçu par e-mail ouvre « Mon compte »

    @US-XXX-1 @integration @securite
    Exemple: Un code faux est refusé
      Étant donné Camille a donné son mot de passe
      Quand Camille saisit un code faux
      Alors le message « Code incorrect. Vérifiez les 6 chiffres reçus par e-mail. » s'affiche

    @US-XXX-1 @unitaire @securite
    Exemple: Le code n'apparaît pas dans l'objet de l'e-mail
      Quand l'e-mail du code « 482913 » est préparé
      Alors son objet est « Votre code de connexion »

  Règle: Les essais de code sont comptés

    @US-XXX-2 @integration @securite
    Exemple: Après 5 codes faux, il faut un nouveau code
      Étant donné Camille a saisi 5 codes faux
      Quand Camille saisit le bon code
      Alors le message « Trop d'essais. Demandez un nouveau code. » s'affiche

  Règle: Activer et désactiver demandent le mot de passe

    @US-XXX-3 @integration @securite
    Exemple: Mauvais mot de passe : rien ne change
      Étant donné Camille est connectée
      Quand Camille active la double authentification avec un mauvais mot de passe
      Alors le message « Mot de passe incorrect. » s'affiche
      Et la double authentification reste désactivée
```

## Tâches de plan prêtes

> US terminée quand : une personne active la double authentification, se connecte avec le code reçu par e-mail, et la désactive avec son mot de passe.

- [ ] **T1 – Le plugin et ses tables** · US-XXX
  - Objectif : better-auth sait demander, envoyer et vérifier un code de connexion
  - Dépend de : —
  - Fichiers : à modifier : `src/db/compte/auth.table.ts`, `src/adapters/auth/auth.adapter.ts`, `src/core/compte/emails-compte.rules.ts` · à créer : migration dans `drizzle/`, `src/core/compte/__tests__/code-de-connexion.rules.test.ts`, `src/adapters/auth/__tests__/auth-double-authentification.test.ts`
  - Vérification : US-XXX critères 1 à 3 – `npm test` passe ; `npm run db:migrate` ajoute la colonne et la table
  - Tests : « Un code faux est refusé », « Après 5 codes faux… », « Mauvais mot de passe : rien ne change » (intégration) ; « Le code n'apparaît pas dans l'objet de l'e-mail » (unitaire)
- [ ] **T2 – Les écrans** · US-XXX
  - Objectif : la personne active, désactive, et saisit son code depuis l'écran
  - Dépend de : T1
  - Fichiers : à modifier : `src/features/compte/queries/utilisateur-connecte.query.ts`, `src/features/compte/schemas/compte.schema.ts`, `src/features/compte/actions/connecter.action.ts`, `src/features/compte/components/containers/compte.container.tsx` · à créer : `src/features/compte/actions/verifier-code.action.ts`, `renvoyer-code.action.ts`, `activer-double-authentification.action.ts`, `desactiver-double-authentification.action.ts`, `src/features/compte/components/sections/formulaire-code.tsx`, `formulaire-double-authentification.tsx`, `src/features/compte/components/containers/code-connexion.container.tsx`, `double-authentification.container.tsx`, `app/(public)/connexion/code/page.tsx`
  - Vérification : US-XXX critère 1 – `npm run check`, `npm run typecheck` et `npm run build` passent ; parcours à la main avec Mailpit
  - Attention : avec la recette `limite`, gardez `exigerLimite("connexion")` en tête de `connecter` et ajoutez les lignes des nouvelles actions (étape 7 de `limite`)
- [ ] **T3 – Parcours de bout en bout** · US-XXX
  - Objectif : le parcours complet est vérifié automatiquement
  - Dépend de : T2
  - Fichiers : à créer : `e2e/double-authentification.spec.ts`
  - Vérification : US-XXX critère 1 – Mailpit lancé, `npm run test:e2e` passe
  - Tests : « Camille se connecte avec le code reçu » (bout en bout)

## Tests
Le code des tests : `pulse-aidd pile recette double-authentification tests`
## Points de sécurité

- **S4 – Session** : avec la double authentification active, aucune session ne s'ouvre au mot de passe seul ; le cookie `two_factor` (signé, 10 minutes) désigne seulement la connexion en attente du code.
- **S5 – Validation des entrées** : le code passe par `schemaCodeConnexion` (6 chiffres) dans l'action ; les chemins HTTP `/two-factor/…` sont fermés (`disabledPaths`), le test des chemins ouverts de la recette `connexion` le vérifie.
- **Code** : 6 chiffres tirés au hasard, valable 5 minutes, 5 essais, gardé haché dans la base (`storeOTP: "hashed"`) ; dans le corps de l'e-mail seulement, jamais dans son objet (visible sur un écran verrouillé). Activer et désactiver demandent le mot de passe.
- **S9 – Journaux** : un code refusé est journalisé avec son motif et l'identifiant de la requête, jamais le code ni l'adresse.
- **S10 – Abus** : sans la recette `limite`, rien ne borne les renvois de code. Avec elle : 5 codes par minute et 3 renvois par 10 minutes par adresse IP, 5 réglages par minute par compte.
- **Limite connue** : le code part à l'adresse du compte. Quelqu'un qui lit déjà la boîte e-mail de la personne peut aussi changer son mot de passe (« mot de passe oublié ») ; la double authentification protège d'abord contre un mot de passe deviné ou réutilisé ailleurs.

## Pièges connus

- **Page « Code de connexion » avec « Le temps de connexion est dépassé »** : le cookie `two_factor` dure 10 minutes. Reprendre depuis la page de connexion.
- **Code jamais reçu** : Mailpit éteint en local, ou serveur d'e-mail en panne en ligne (better-auth journalise « Failed to send two-factor OTP »). « Renvoyer le code » en envoie un nouveau.
- **`authClient.twoFactor.*` répond 404** : ces chemins sont fermés par `disabledPaths`. Passez par les actions `verifierCode`, `renvoyerCode`, `activerDoubleAuthentification` et `desactiverDoubleAuthentification`.
- **Deux champs « Mot de passe actuel » sur « Mon compte »** : le réglage s'appelle « Mot de passe du compte », pour que chaque libellé reste unique sur la page (Playwright, lecteurs d'écran).
- **Langues** : avec la recette `langues`, la page du code va sous `app/[locale]/(public)/connexion/code/`.

## Sources

- better-auth 1.7.25, code du paquet (lu le 2026-11-16) : `dist/plugins/two-factor/index.mjs` (`enableTwoFactor` avec `method: "otp"`, `disableTwoFactor`, crochet après `/sign-in/email` qui supprime la session et pose le cookie `two_factor`, `twoFactorCookieMaxAge`) ; `dist/plugins/two-factor/otp/index.mjs` (`otpOptions` : `period` en minutes, `digits`, `allowedAttempts`, `storeOTP`, `sendOTP` envoyé par `runInBackgroundOrAwait`) ; `dist/plugins/two-factor/verify-two-factor.mjs` ; `dist/plugins/two-factor/error-code.mjs` (codes d'erreur) ; tables : `npx auth@1.7.25 generate` avec le plugin
- https://www.better-auth.com/docs/plugins/2fa
- Rejoué le 2026-11-23 (better-auth 1.7.27) par `verifier-recettes.js` (chaîne `connexion,envoi-email,email,double-authentification`) : contrôles, types, tests, construction.

## Points à vérifier

- Le parcours de bout en bout avec un vrai serveur d'e-mail (Gmail, Infomaniak, Brevo) : délai de réception du code.
- La lecture du cookie `two_factor` par `enTetesDeSession()` dans l'action `connecter`, juste après sa pose : couverte par le test de bout en bout (Mailpit), à rejouer à chaque version majeure de Next.js.
