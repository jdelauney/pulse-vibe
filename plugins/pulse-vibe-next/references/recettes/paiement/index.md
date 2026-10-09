# Recette : paiement

> Quand l'utiliser : une personne connectée paie un montant fixe (accès, produit, séance) sur la page de paiement de Stripe, en mode test.

## Prérequis

- Le squelette du pack est en place (`pulse-aidd pile squelette`) : `src/db/db-client.ts` (`getDb()`, type `Db`), `src/config/env.ts` (objet `env`, t3 env), `src/core/shared/result.ts` (`Result`, `ok()`, `echec()`), `src/lib/errors/{erreur-service,reponse-erreur}.ts`, `src/lib/logger.ts`, `tests/helpers/base-de-test.ts` (`creerBaseDeTest()`).
- La recette `connexion` est faite (`pulse-aidd pile recette connexion`). Elle fournit :
  - `utilisateurConnecte()` dans `src/features/compte/queries/utilisateur-connecte.query.ts` (renvoie `{ id, nom }`, ou redirige vers `/connexion` sans session) ;
  - `actionConnectee` dans `src/lib/safe-action.ts` (`ctx.utilisateur` = `{ id, nom }`) ;
  - la table `user` dans `src/db/compte/auth.table.ts` ;
  - le groupe de routes `app/(connecte)/` et le renvoi rapide `proxy.ts` (racine du projet) ;
  - la variable `BETTER_AUTH_URL`.
- La recette `liste` fournit `formaterMontant()` dans `src/lib/helpers/format/format.ts` ; sans elle, ajoutez cette fonction (voir l'étape 9).
- Paquet à installer : `npm install stripe` (dernière version ; recette vérifiée avec 23.0.0, qui épingle la version d'API `2026-09-30.endive` et demande Node.js 20 au moins). Pour les tests : `vitest` et `@electric-sql/pglite`, déjà dans le squelette.
- Un compte Stripe, utilisé **en mode test (bac à sable)** : aucune vraie carte, aucun vrai argent.
- Le Stripe CLI, pour recevoir les webhooks en local : `npm install -g @stripe/cli`, puis `stripe login` (le navigateur s'ouvre pour relier le CLI au compte).
- **Le passage en mode réel est une décision de la personne** : activation du compte Stripe (identité, compte bancaire), clés de production, conditions de vente, mentions légales. La recette s'arrête au mode test.

## Variables d'environnement

| Nom | Rôle | Où la trouver |
|---|---|---|
| `STRIPE_SECRET_KEY` | Clé secrète du mode test (commence par `sk_test_`) | Tableau de bord Stripe → Développeurs → Clés API (`VOTRE_CLE_ICI`) |
| `STRIPE_WEBHOOK_SECRET` | Secret de signature des webhooks (commence par `whsec_`) | En local : affiché par `stripe listen`. En ligne : page de la destination de webhook |

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` reste inutile : la page de paiement est hébergée par Stripe et le navigateur y arrive par une redirection. Elle servira seulement si un formulaire de carte est intégré au site.

Ajoutez ces lignes dans `server: { … }` de `src/config/env.ts` :

<!-- ajout: src/config/env.ts après: server: { -->
```ts
    STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
```

Pour les tests qui vérifient la validation, ajouter des valeurs de test dans `VARIABLES_VALIDES` de `tests/helpers/env-de-test.ts` (aide du squelette) :

<!-- ajout: tests/helpers/env-de-test.ts après: export const VARIABLES_VALIDES: Record<string, string> = { -->
```ts
  STRIPE_SECRET_KEY: "sk_test_cle-de-test",
  STRIPE_WEBHOOK_SECRET: "whsec_secret-de-test",
```

Ajoutez les deux noms, **sans valeur**, à `.env.example` :

<!-- ajout: .env.example -->
```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Le secret de webhook du poste et celui du site en ligne sont **différents** : chacun garde le sien.

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/config/env.ts`, `.env.example` (modifiés) | Les deux variables Stripe |
| `src/core/paiement/commande.entity.ts` | Statuts, offre, événement de paiement, résultat de confirmation |
| `src/core/paiement/paiement.errors.ts` | Code de l'erreur attendue (signature invalide) |
| `src/core/paiement/commande-repository.port.ts` | Ce que les use-cases attendent de la base |
| `src/core/paiement/passerelle-paiement.port.ts` | Ce que les use-cases attendent de Stripe |
| `src/core/paiement/use-cases/ouvrir-paiement.use-case.ts` | Crée la commande, ouvre la page de paiement, relie les deux |
| `src/core/paiement/use-cases/confirmer-paiement.use-case.ts` | Ne retient qu'un paiement encaissé, une fois par événement |
| `src/db/paiement/commande.table.ts`, `src/db/paiement/evenement-stripe.table.ts` | Tables `commande` et `evenement_stripe` |
| `drizzle/<numéro>_<nom>.sql` | Migration générée |
| `src/db/paiement/commande.repository.ts` | `commandeRepository(db)` : écritures, lecture, condition de propriété |
| `src/adapters/payment/payment.adapter.ts` | Client Stripe, session de paiement, vérification de signature, pannes en `ErreurService` |
| `src/features/paiement/constants/offre.ts` | Libellé et prix, côté serveur |
| `src/features/paiement/actions/payer.action.ts` | Action `payerAction` |
| `src/features/paiement/webhooks/stripe-paiement.webhook.ts` | Reçoit le message de Stripe, vérifie la signature, déclenche le use-case |
| `src/features/paiement/queries/commande-par-session.query.ts` | La commande de la personne pour une session (`server-only`) |
| `src/features/paiement/components/sections/bouton-payer.tsx`, `statut-paiement.tsx` | Bouton « Payer » et message de la page « Merci » (props) |
| `src/features/paiement/components/containers/bouton-payer.container.tsx` | Branche l'action `payerAction` |
| `src/features/paiement/components/containers/statut-paiement.container.tsx` | Lit la session et la commande |
| `app/api/stripe/webhook/route.ts` | Réception des webhooks (délègue à `features/paiement/webhooks/`) |
| `app/(connecte)/paiement/page.tsx`, `app/(connecte)/paiement/merci/page.tsx` | Pages « Paiement » et « Merci » |
| `proxy.ts` (modifié) | `"/paiement/:path*"` dans le `matcher` |
| `src/core/paiement/use-cases/__tests__/ouvrir-paiement.use-case.test.ts`, `confirmer-paiement.use-case.test.ts` | Tests unitaires des use-cases (doublures en mémoire) |
| `src/adapters/payment/__tests__/payment.adapter.test.ts` | Tests de l'adapter (Stripe doublé, signatures réelles) |
| `src/db/paiement/__tests__/commande.repository.test.ts` | Tests d'intégration avec PGlite |
| `src/features/paiement/webhooks/__tests__/stripe-paiement.webhook.test.ts` | Tests du webhook (réponses, journal) |

## Étapes

<!-- commande: npm install stripe -->

Le parcours :

1. La personne clique sur « Payer 19,00 € ». L'action `payerAction` crée une commande `en_attente`, puis une session Stripe Checkout, et redirige vers la page de Stripe.
2. Après le paiement, Stripe renvoie la personne sur `/paiement/merci`, **et** envoie un webhook signé à `/api/stripe/webhook`.
3. Le webhook vérifie la signature, note l'identifiant de l'événement (une seule fois), et passe la commande en `payee`. **Seul le webhook décide qu'une commande est payée** : la page « Merci » lit seulement le statut.

Le domaine s'appelle `paiement` : `src/core/paiement/` (les règles et les ports), `src/db/paiement/` (le stockage en base), `src/features/paiement/` (l'action, le webhook, l'écran). Le service Stripe vit dans `src/adapters/payment/`. Le Route Handler `app/api/stripe/webhook/route.ts` reste fin : il passe la requête au webhook de la feature (architecture.md §7).

- Étape 1 – Les variables : `pulse-aidd pile recette paiement etape 1`
- Étape 2 – Le métier : entité, erreur et ports : `pulse-aidd pile recette paiement etape 2`
- Étape 3 – Les use-cases : `pulse-aidd pile recette paiement etape 3`
- Étape 4 – Les tables et leur migration : `pulse-aidd pile recette paiement etape 4`
- Étape 5 – Le repository : `pulse-aidd pile recette paiement etape 5`
- Étape 6 – L'adapter de paiement : `pulse-aidd pile recette paiement etape 6`
- Étape 7 – L'offre et l'action qui ouvre le paiement : `pulse-aidd pile recette paiement etape 7`
- Étape 8 – Le webhook : `pulse-aidd pile recette paiement etape 8`
- Étape 9 – Les écrans : `pulse-aidd pile recette paiement etape 9`
- Étape 10 – Le renvoi vers la connexion : `pulse-aidd pile recette paiement etape 10`
- Étape 11 – Recevoir les webhooks en local : `pulse-aidd pile recette paiement etape 11`
- Étape 12 – Payer avec les cartes de test : `pulse-aidd pile recette paiement etape 12`
- Étape 13 – Mettre en ligne (toujours en mode test) : `pulse-aidd pile recette paiement etape 13`
## Scénarios Gherkin à ajouter à la spec

```gherkin
# language: fr
Fonctionnalité: Paiement

  Règle: Un paiement confirmé par Stripe marque la commande payée, une seule fois

    @US-XXX-1 @integration
    Exemple: Paiement de 19 € confirmé : la commande de Camille est payée
      Étant donné Camille a une commande de 19 € en attente
      Quand Stripe confirme le paiement de 19 €
      Alors la commande de Camille est payée

    @US-XXX-1 @unitaire
    Exemple: Un paiement encaissé est transmis aux commandes
      Étant donné Stripe annonce un paiement encaissé
      Quand le serveur traite l'événement
      Alors la confirmation est transmise aux commandes

    @US-XXX-1 @unitaire
    Exemple: Un événement sans paiement encaissé est ignoré
      Étant donné Stripe annonce un événement sans paiement encaissé
      Quand le serveur traite l'événement
      Alors rien n'est transmis aux commandes

    @US-XXX-1 @manuel
    Exemple: Camille paie avec la carte de test 4242 et voit la confirmation
      Étant donné Camille est connectée, en mode test
      Quand Camille paie 19 € avec la carte 4242 4242 4242 4242
      Alors Camille lit « Paiement reçu : « Accès complet » est activé. »

    @US-XXX-2 @integration @securite
    Exemple: Le même événement reçu deux fois est traité une seule fois
      Étant donné Camille a une commande de 19 € en attente
      Quand Stripe envoie deux fois la même confirmation
      Alors la confirmation est traitée une fois, puis reconnue comme déjà traitée

  Règle: Le montant payé doit être celui de la commande

    @US-XXX-3 @integration @securite
    Exemple: Un montant différent de la commande laisse la commande en attente
      Étant donné Camille a une commande de 19 € en attente
      Quand Stripe confirme un paiement de 1 €
      Alors la commande de Camille reste en attente

  Règle: Seuls les messages signés par Stripe sont acceptés

    @US-XXX-4 @unitaire @securite
    Exemple: Un message correctement signé est accepté
      Étant donné un message signé avec le secret du webhook
      Quand le message arrive sur le webhook
      Alors le webhook répond 200

    @US-XXX-4 @unitaire @securite
    Exemple: Un message à la signature fausse est refusé
      Étant donné un message signé avec un autre secret
      Quand le message arrive sur le webhook
      Alors le webhook répond 400

    @US-XXX-4 @unitaire @securite
    Exemple: Un corps modifié après la signature est refusé
      Étant donné un message signé avec le secret du webhook
      Et son contenu est modifié après la signature
      Quand le serveur vérifie le message
      Alors le message est refusé

    @US-XXX-4 @unitaire @securite
    Exemple: Un message sans signature est refusé
      Étant donné un message sans en-tête de signature
      Quand le message arrive sur le webhook
      Alors le webhook répond 400

    @US-XXX-4 @unitaire @securite
    Exemple: Un message refusé n'écrit ni son contenu ni sa signature dans le journal
      Étant donné un message signé avec un autre secret, qui contient l'adresse de Camille
      Quand le message arrive sur le webhook
      Alors le journal note seulement « signature invalide »
      Et le journal ne contient ni l'adresse de Camille ni la signature

  Règle: Seul un paiement encaissé confirme la commande

    @US-XXX-8 @unitaire
    Exemple: Un paiement différé (non payé) ne confirme rien
      Étant donné Stripe annonce une session terminée dont le paiement n'est pas encore encaissé
      Quand le serveur lit le message
      Alors aucune confirmation n'en sort

    @US-XXX-8 @unitaire
    Exemple: Le paiement différé réussi confirme la commande
      Étant donné Stripe annonce un paiement différé réussi
      Quand le serveur lit le message
      Alors la confirmation porte la commande de Camille et le montant payé

    @US-XXX-8 @unitaire
    Exemple: Un autre type d'événement ne confirme rien
      Étant donné Stripe envoie un événement d'un autre type
      Quand le serveur lit le message
      Alors aucune confirmation n'en sort

  Règle: La page de paiement s'ouvre avec le prix du serveur

    @US-XXX-6 @unitaire
    Exemple: Camille ouvre le paiement : sa commande est reliée à la session Stripe
      Étant donné Camille est connectée
      Quand Camille ouvre le paiement
      Alors sa commande est créée et reliée à la session de paiement
      Et Camille reçoit l'adresse de la page de Stripe

    @US-XXX-6 @unitaire
    Exemple: La session est ouverte avec le prix du serveur et l'adresse de retour de Stripe
      Étant donné l'offre « Accès complet » à 19 €
      Quand le serveur ouvre la session de paiement
      Alors la session porte le prix de l'offre et la commande
      Et l'adresse de retour reçoit l'identifiant de la session

  Règle: Une panne est signalée sans secret ni donnée personnelle

    @US-XXX-7 @unitaire @securite
    Exemple: Un refus de Stripe lève une erreur de service « paiement » sans donnée personnelle
      Étant donné Stripe refuse la création de la session avec un message qui cite l'adresse de Camille
      Quand le serveur ouvre la session de paiement
      Alors une erreur de service « paiement » est levée
      Et son message et sa cause ne contiennent ni l'adresse de Camille ni la clé secrète

    @US-XXX-7 @unitaire
    Exemple: Une session sans adresse de paiement est une panne de service
      Étant donné Stripe répond sans adresse de paiement
      Quand le serveur ouvre la session de paiement
      Alors une erreur de service « paiement » est levée

    @US-XXX-7 @unitaire @securite
    Exemple: Une panne de la base répond 500 avec un message générique, et Stripe renverra le message
      Étant donné un message correctement signé
      Et la base est en panne
      Quand le message arrive sur le webhook
      Alors le webhook répond 500 avec un message générique

  Règle: Une personne accède seulement à ses propres commandes

    @US-XXX-9 @integration
    Exemple: Camille retrouve sa commande par la session de paiement
      Étant donné Camille a une commande reliée à une session de paiement
      Quand Camille ouvre la page « Merci » de cette session
      Alors la commande est trouvée

    @US-XXX-9 @integration @securite
    Exemple: Léo ne voit pas la commande de Camille
      Étant donné Camille a une commande reliée à une session de paiement
      Quand Léo ouvre la page « Merci » de cette session
      Alors la commande est introuvable

    @US-XXX-9 @integration @securite
    Exemple: Léo ne peut pas relier sa session à la commande de Camille
      Étant donné Camille a une commande reliée à une session de paiement
      Quand Léo essaie de relier sa propre session à cette commande
      Alors la session de la commande de Camille reste la sienne

  Règle: Une carte refusée ne débloque rien

    @US-XXX-5 @manuel
    Exemple: Carte refusée : la commande reste en attente
      Étant donné Camille est connectée, en mode test
      Quand Camille paie avec la carte 4000 0000 0000 0002
      Alors Stripe affiche un refus et la commande de Camille reste en attente
```

## Tâches de plan prêtes

> US terminée quand : une personne connectée paie sur la page de Stripe (mode test), sa commande passe « payée » grâce au webhook signé, une seule fois, et personne d'autre ne voit sa commande.

- [ ] **Tn – Enregistrer les commandes** · US-XXX
  - Objectif : la base garde les commandes et les événements Stripe déjà traités
  - Dépend de : —
  - Fichiers : à créer : `src/core/paiement/commande.entity.ts`, `paiement.errors.ts`, `commande-repository.port.ts`, `src/db/paiement/commande.table.ts`, `evenement-stripe.table.ts`, `commande.repository.ts`, `src/db/paiement/__tests__/commande.repository.test.ts`, migration dans `drizzle/` · à modifier : `src/config/env.ts`, `.env.example`
  - Vérification : US-XXX critères 1 à 3 et 9 – `npm test` passe ; `npm run db:migrate` crée les tables `commande` et `evenement_stripe`
  - Tests : « Paiement de 19 € confirmé… », « Le même événement reçu deux fois… », « Un montant différent… », « Léo ne voit pas la commande de Camille » (intégration)
  - Action manuelle : créer le compte Stripe, rester en mode test, copier la clé secrète de test dans `.env`
- [ ] **Tn+1 – Payer sur la page de Stripe** · US-XXX
  - Objectif : une personne connectée clique sur « Payer » et arrive sur la page de paiement de Stripe
  - Dépend de : Tn
  - Fichiers : à créer : `src/core/paiement/passerelle-paiement.port.ts`, `src/core/paiement/use-cases/ouvrir-paiement.use-case.ts`, `src/adapters/payment/payment.adapter.ts`, `src/features/paiement/constants/offre.ts`, `actions/payer.action.ts`, `components/sections/bouton-payer.tsx`, `components/containers/bouton-payer.container.tsx`, `app/(connecte)/paiement/page.tsx`, `src/core/paiement/use-cases/__tests__/ouvrir-paiement.use-case.test.ts`, `src/adapters/payment/__tests__/payment.adapter.test.ts` · à modifier : `proxy.ts`
  - Vérification : US-XXX critère 6 – « Payer 19,00 € » ouvre la page Stripe avec « Accès complet » et 19,00 €
  - Tests : « Camille ouvre le paiement… », « La session est ouverte avec le prix du serveur… », « Un refus de Stripe lève une erreur de service « paiement »… » (unitaires) ; le parcours Stripe se vérifie à la main (« Camille paie avec la carte de test 4242… »)
- [ ] **Tn+2 – Confirmer le paiement par webhook** · US-XXX
  - Objectif : un paiement réussi passe la commande en « payée », une seule fois, et la page « Merci » l'affiche
  - Dépend de : Tn+1
  - Fichiers : à créer : `src/core/paiement/use-cases/confirmer-paiement.use-case.ts`, `src/features/paiement/webhooks/stripe-paiement.webhook.ts`, `queries/commande-par-session.query.ts`, `components/sections/statut-paiement.tsx`, `components/containers/statut-paiement.container.tsx`, `app/api/stripe/webhook/route.ts`, `app/(connecte)/paiement/merci/page.tsx`, `src/core/paiement/use-cases/__tests__/confirmer-paiement.use-case.test.ts`, `src/features/paiement/webhooks/__tests__/stripe-paiement.webhook.test.ts`
  - Vérification : US-XXX critères 1 à 5 – avec `stripe listen`, payer avec 4242 : « Paiement reçu » ; avec 4000 0000 0000 0002 : refus, commande en attente
  - Tests : « Un message correctement signé est accepté », « Un message à la signature fausse est refusé », « Un message refusé n'écrit ni son contenu ni sa signature dans le journal », « Une panne de la base répond 500… », « Un paiement encaissé est transmis aux commandes », « Un événement sans paiement encaissé est ignoré » (unitaires, doublures) ; « Un paiement différé (non payé) ne confirme rien » (unitaire)
  - Attention : lire le corps avec `requete.text()` avant toute autre lecture ; un `JSON.parse` puis `JSON.stringify` casse la signature
  - Action manuelle : lancer `stripe listen` et copier le secret `whsec_…` dans `.env`
- [ ] **Tn+3 – Recevoir les paiements de test sur le site en ligne** · US-XXX
  - Objectif : le site en ligne confirme les paiements de test
  - Dépend de : Tn+2
  - Fichiers : aucun
  - Vérification : US-XXX critère 1 – payer avec 4242 sur le site en ligne : « Paiement reçu »
  - Action manuelle : créer la destination de webhook dans Stripe ; saisir `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` dans Vercel ; redéployer

## Tests
Le code des tests : `pulse-aidd pile recette paiement tests`
## Points de sécurité

- **S1, S2 – Secrets** : `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` restent côté serveur (`server-only`, sans `NEXT_PUBLIC_`). Les pannes de Stripe sortent sans secret ni donnée personnelle (`ErreurService` à `cause` technique).
- **S3, S4 – Accès** : `payerAction` est une action connectée ; la commande porte `utilisateurId` venu de la session ; le repository filtre par `utilisateurId` ; la page « Merci » lit seulement une commande de la personne connectée.
- **S5 – Validation** : le prix vient de `OFFRE`, côté serveur ; le webhook compare le montant payé (`amount_total`) au montant de la commande.
- **S10 – Doublons** : l'identifiant d'événement est la clé primaire de `evenement_stripe`, écrit dans la même transaction que la mise à jour ; seule une commande `en_attente` passe en `payee`.
- **S11 – Messages d'erreur** : un webhook mal signé reçoit « Signature invalide. », sans détail, et le journal ne reçoit ni le corps ni la signature, seulement l'identifiant de l'événement pour un message accepté (Stripe ne transmet pas les numéros de carte). Une panne répond par un message générique (`reponseErreur()`).
- Le statut « payée » vient **seulement** du webhook signé, jamais de l'arrivée sur `/paiement/merci`.

## Pièges connus

- **Signature toujours invalide** : le corps a été lu deux fois ou transformé. Lire `await requete.text()` une fois et le passer tel quel à l'adapter.
- **Mauvais secret de webhook** : `stripe listen` donne le secret du poste ; la destination du site en ligne a le sien.
- **« Paiement en cours de confirmation » qui reste affiché en local** : `stripe listen` doit tourner pendant le paiement.
- **Événements en double ou dans le désordre** : Stripe peut renvoyer un événement (jusqu'à trois jours en mode réel, trois fois en quelques heures en bac à sable) et ne garantit pas l'ordre. La table `evenement_stripe` absorbe les doublons.
- **Paiements différés** (prélèvement, virement) : `checkout.session.completed` arrive avec `payment_status` à `unpaid` ; la commande passe en `payee` à l'événement `checkout.session.async_payment_succeeded`.
- **`payment_method_types`** : retiré de la création de session dans stripe 23. Les moyens de paiement se règlent dans le tableau de bord Stripe.
- **Client Stripe créé à la première utilisation** : la construction ne contacte jamais Stripe.
- **Les deux variables Stripe deviennent obligatoires** : `env` les valide au chargement. Renseignez-les dans `.env` (une valeur factice commençant par `sk_` et `whsec_` suffit tant qu'aucun paiement réel n'a lieu) avant de construire ou de lancer le site. Construction de vérification sans elles (CI) : `SKIP_ENV_VALIDATION=1 npm run build`.
- **Commande « en_attente » restée seule** : si Stripe échoue après la création de la commande, la ligne reste « en_attente », sans session. Elle est invisible pour la personne et ne passe jamais « payee » ; une tâche de ménage pourra l'effacer plus tard.
- **Événement ignoré, puis renvoyé** : un événement dont le montant ne correspond pas est noté comme reçu, la commande reste « en_attente ». Si Stripe le renvoie, la réponse est « deja_traite » : la commande ne change pas. Corrigez la cause (montant, commande) puis relancez un **nouveau** paiement.
- **Un webhook en panne répond 500 ou 503** : Stripe renvoie le message plus tard ; la table `evenement_stripe` garantit qu'il ne compte qu'une fois.
- **Langues** : avec la recette `langues`, `success_url` et `cancel_url` restent les adresses françaises (sans préfixe), toujours valides ; les pages vont sous `app/[locale]/(connecte)/paiement/` et `app/api/stripe/` reste à sa place.

## Sources

- stripe 23.0.0, paquet installé : `CHANGELOG.md` (version d'API `2026-09-30.endive`, retrait de `payment_method_types`, Node.js 20) ; `README.md` (client créé à la demande) ; `esm/Webhooks.d.ts` (`constructEvent`, `generateTestHeaderString`)
- Stripe : https://docs.stripe.com/checkout/fulfillment?payment-ui=stripe-hosted (événements, `payment_status`, traitement unique, `{CHECKOUT_SESSION_ID}`) ; https://docs.stripe.com/webhooks (doublons, ordre, nouvelles tentatives) ; https://docs.stripe.com/testing (cartes) ; https://docs.stripe.com/stripe-cli/install (`npm install -g @stripe/cli`)
- Next.js 16.4, documentation embarquée : `01-app/03-api-reference/03-file-conventions/route.md` (« Webhooks », `request.text()`) ; `01-app/01-getting-started/15-route-handlers.md`
- next-safe-action 8.7.3 : `dist/hooks.d.mts` (`useAction`, `hasNavigated`)
- Vérifications locales du 2026-10-08 (squelette du pack + recettes `connexion`, `liste`, `email`, `fichiers` + cette recette, dans l'architecture hexagonale) : `npm run check`, `npm run typecheck`, `npm test` et `npm run build` passent ; `next start` : le webhook répond 400 sans signature, 400 avec une signature fausse, 200 avec un message signé par `generateTestHeaderString` ; `/paiement` et `/paiement/merci` sans session renvoient vers `/connexion`.

## Points à vérifier

- Un paiement complet avec un vrai compte Stripe en mode test (`stripe listen`, carte 4242) : non exécuté lors de la rédaction.
- L'action `payerAction`, appelée par `useAction`, finit par `redirect()` vers une adresse externe (Stripe) : vérifier que le navigateur part bien sur la page de paiement et que `hasNavigated` garde le bouton bloqué.
- Le délai d'attente de Stripe avant la redirection vers `success_url` (jusqu'à 10 secondes pour laisser le webhook répondre, d'après la documentation de Stripe ; immédiat avec `stripe listen`).
