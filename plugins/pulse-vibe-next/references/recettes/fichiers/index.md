# Recette : fichiers

> Quand l'utiliser : les personnes connectées envoient des fichiers (photos, PDF) et les retrouvent ensuite ; les fichiers sont rangés dans Cloudflare R2.

## Prérequis

- Le squelette du pack est en place (`pulse-aidd pile squelette`) : `src/db/db-client.ts` (`getDb()`, type `Db`), `src/config/env.ts` (objet `env`, t3 env), `src/core/shared/result.ts` (`Result`, `ok()`, `echec()`), `src/lib/errors/{erreur-service,reponse-erreur}.ts`, `tests/helpers/base-de-test.ts` (`creerBaseDeTest()`).
- `next.config.ts` avec la CSP et son objet `sources` (squelette de pulse-vibe-next 0.9.0 ou plus). Projet créé avec une version plus ancienne : lancez d'abord `/pulse:security entetes`, qui pose les en-têtes du squelette.
- La recette `connexion` est faite (`pulse-aidd pile recette connexion`). Elle fournit :
  - `utilisateurConnecte()` dans `src/features/compte/queries/utilisateur-connecte.query.ts` (renvoie `{ id, nom }`, ou redirige vers `/connexion` sans session) ;
  - `actionConnectee` dans `src/lib/safe-action.ts` (`ctx.utilisateur` = `{ id, nom }`) ;
  - la table `user` dans `src/db/compte/auth.table.ts` ;
  - le groupe de routes `app/(connecte)/` et le renvoi rapide `proxy.ts` (racine du projet) ;
  - l'aide de test `e2e/aides/connexion.ts` (`connecterNouvelUtilisateur(page)`).
- Paquets à installer : `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` (dernières versions ; recette vérifiée avec 3.1147.0 pour les deux). Le reste vient du squelette (`next`, `next-safe-action`, `zod`, `drizzle-orm`, `sonner`) ; pour les tests : `vitest`, `@electric-sql/pglite`, `@playwright/test`.
- Un compte Cloudflare avec R2. Offre gratuite (stockage Standard) : 10 Go-mois de stockage, 1 million d'opérations d'écriture (classe A) et 10 millions de lectures (classe B) par mois ; la sortie de données est gratuite.
- Dans le tableau de bord Cloudflare :
  1. **R2 object storage** → **Create bucket** → nom du bucket (ex. `mon-projet-fichiers`) → **Location** : **Specify jurisdiction** → **EU**. La juridiction UE garantit que les fichiers restent dans l'Union européenne. Elle se choisit à la création, sans retour possible.
  2. **R2 object storage** → **Manage** (API Tokens) → créer un jeton avec la permission **Object Read & Write**, limité à ce bucket. Copier **Access Key ID** et **Secret Access Key** dans `.env` : la clé secrète s'affiche une seule fois.
  3. Relever l'**Account ID** du compte.
  4. Bucket → **Settings** → **CORS Policy** → **Add CORS policy**, coller (remplacer l'adresse Vercel par celle du projet) :

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://mon-projet.vercel.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Le bucket reste **privé** : pas d'accès public, pas de domaine public.

## Variables d'environnement

| Nom | Rôle |
|---|---|
| `R2_ACCOUNT_ID` | Identifiant du compte Cloudflare |
| `R2_ACCESS_KEY_ID` | Identifiant du jeton R2 |
| `R2_SECRET_ACCESS_KEY` | Secret du jeton R2 (`VOTRE_CLE_ICI`) |
| `R2_BUCKET` | Nom du bucket |

Ajoutez ces lignes dans `server: { … }` de `src/config/env.ts` :

<!-- ajout: src/config/env.ts après: server: { -->
```ts
    R2_ACCOUNT_ID: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_BUCKET: z.string().min(1),
```

Pour les tests qui vérifient la validation, ajouter des valeurs de test dans `VARIABLES_VALIDES` de `tests/helpers/env-de-test.ts` (aide du squelette) :

<!-- ajout: tests/helpers/env-de-test.ts après: export const VARIABLES_VALIDES: Record<string, string> = { -->
```ts
  R2_ACCOUNT_ID: "compte",
  R2_ACCESS_KEY_ID: "cle-acces",
  R2_SECRET_ACCESS_KEY: "secret-de-test",
  R2_BUCKET: "bucket-de-test",
```

Ajoutez les quatre noms, **sans valeur**, à `.env.example` :

<!-- ajout: .env.example -->
```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
```

Dans Vercel, saisissez-les pour Production et Preview.

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/config/env.ts`, `.env.example` (modifiés) | Les quatre variables R2 |
| `next.config.ts` (modifié) | L'adresse R2 dans `connect-src` de la CSP |
| `src/core/fichiers/fichier.entity.ts` | Types autorisés, taille maximale, statuts, type `Fichier` |
| `src/core/fichiers/fichier.errors.ts` | Codes des erreurs attendues |
| `src/core/fichiers/fichier.rules.ts` | Clé d'objet, propriété de la clé, envoi conforme (fonctions pures) |
| `src/core/fichiers/fichier-repository.port.ts` | Ce que les use-cases attendent de la base |
| `src/core/fichiers/stockage-fichiers.port.ts` | Ce que les use-cases attendent du stockage |
| `src/core/fichiers/use-cases/preparer-envoi.use-case.ts` | Réserve une ligne, signe l'adresse d'envoi |
| `src/core/fichiers/use-cases/confirmer-envoi.use-case.ts` | Compare ce que R2 a reçu, valide ou efface |
| `src/core/fichiers/use-cases/supprimer-fichier.use-case.ts` | Supprime la ligne, puis l'objet |
| `src/db/fichiers/fichier.table.ts` | Table `fichiers` |
| `drizzle/<numéro>_<nom>.sql` | Migration générée |
| `src/db/fichiers/fichier.repository.ts` | `fichierRepository(db)` : écritures et lectures, condition de propriété |
| `src/adapters/storage/storage.adapter.ts` | Client R2, adresses signées, pannes en `ErreurService` |
| `src/features/fichiers/constants/fichiers.ts`, `constants/erreur-messages.ts` | Message d'échec, message de chaque code d'erreur |
| `src/features/fichiers/schemas/fichier.schema.ts` | Types et taille autorisés (Zod) |
| `src/features/fichiers/actions/preparer-envoi.action.ts`, `confirmer-envoi.action.ts`, `supprimer-fichier.action.ts` | Les trois actions |
| `src/features/fichiers/queries/lister-fichiers.query.ts`, `trouver-fichier.query.ts` | Les deux lectures (`server-only`) |
| `src/features/fichiers/components/sections/champ-envoi-fichier.tsx` | Champ d'envoi (props) |
| `src/features/fichiers/components/sections/liste-fichiers.tsx` | Liste des fichiers (props) |
| `src/features/fichiers/components/containers/envoi-fichier.container.tsx` | Branche les actions et l'envoi vers R2 |
| `src/features/fichiers/components/containers/liste-fichiers.container.tsx` | Lit la session et la liste |
| `app/api/fichiers/[id]/route.ts` | Téléchargement par adresse signée |
| `app/(connecte)/fichiers/page.tsx` | Page « Mes fichiers » |
| `proxy.ts` (modifié) | `"/fichiers/:path*"` dans le `matcher` |
| `src/core/fichiers/__tests__/fichier.rules.test.ts` | Tests unitaires des règles |
| `src/core/fichiers/use-cases/__tests__/sut-fichiers.ts` | Doublures en mémoire des deux ports, partagées par les tests des use-cases |
| `src/core/fichiers/use-cases/__tests__/preparer-envoi.use-case.test.ts`, `confirmer-envoi.use-case.test.ts`, `supprimer-fichier.use-case.test.ts` | Tests unitaires des trois use-cases, un fichier chacun |
| `src/features/fichiers/schemas/__tests__/fichier.schema.test.ts` | Tests unitaires du schéma |
| `src/adapters/storage/__tests__/storage.adapter.test.ts` | Tests de l'adapter (SDK doublé) |
| `src/db/fichiers/__tests__/fichier.repository.test.ts` | Tests d'intégration avec PGlite |
| `e2e/fichiers.spec.ts` | Tests de bout en bout Playwright |

## Étapes

<!-- commande: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner -->

Le parcours d'un envoi :

1. Le navigateur demande une adresse d'envoi à l'action `preparerEnvoiAction`, avec le nom, le type et la taille du fichier.
2. Le serveur vérifie la session, le type et la taille. Il réserve une ligne en base (statut `en_attente`), puis signe une adresse **PUT** valable 5 minutes, pour ce type et cette taille exacts.
3. Le navigateur envoie le fichier **directement à R2** : le fichier ne passe pas par Vercel (le corps d'une Server Action est limité à 1 Mo).
4. Le navigateur appelle `confirmerEnvoiAction` : le serveur demande à R2 ce qu'il a reçu, compare, puis passe la ligne en `envoye`.
5. Pour lire, le lien `/api/fichiers/<id>` vérifie la session et la propriétaire, puis redirige vers une adresse **GET** signée de 5 minutes.

Le domaine s'appelle `fichiers` : `src/core/fichiers/` (les règles), `src/db/fichiers/` (le stockage en base), `src/features/fichiers/` (l'écran, les actions, les lectures). Le service R2 vit dans `src/adapters/storage/`.

- Étape 1 – Cloudflare et les variables : `pulse-aidd pile recette fichiers etape 1`
- Étape 2 – Le métier : entité, erreurs, règles et ports : `pulse-aidd pile recette fichiers etape 2`
- Étape 3 – Les use-cases : `pulse-aidd pile recette fichiers etape 3`
- Étape 4 – La table et sa migration : `pulse-aidd pile recette fichiers etape 4`
- Étape 5 – Le repository : `pulse-aidd pile recette fichiers etape 5`
- Étape 6 – L'adapter de stockage : `pulse-aidd pile recette fichiers etape 6`
- Étape 7 – Les constantes et le schéma : `pulse-aidd pile recette fichiers etape 7`
- Étape 8 – Les actions et les lectures : `pulse-aidd pile recette fichiers etape 8`
- Étape 9 – Le téléchargement : `pulse-aidd pile recette fichiers etape 9`
- Étape 10 – L'écran : sections, containers et page : `pulse-aidd pile recette fichiers etape 10`
- Étape 11 – Le renvoi vers la connexion : `pulse-aidd pile recette fichiers etape 11`
- Étape 12 – La CSP autorise R2 : `pulse-aidd pile recette fichiers etape 12`
- Étape 13 – Essayer : `pulse-aidd pile recette fichiers etape 13`
- Étape 14 – Mettre en ligne : `pulse-aidd pile recette fichiers etape 14`
## Scénarios Gherkin à ajouter à la spec

```gherkin
# language: fr
Fonctionnalité: Fichiers

  Règle: Seuls les types et tailles autorisés sont acceptés

    @US-XXX-1 @unitaire
    Exemple: Une photo PNG de 2 Mo est acceptée
      Étant donné Camille choisit « facture-mars.png », une image PNG de 2 Mo
      Quand le serveur contrôle la demande d'envoi
      Alors la demande est acceptée

    @US-XXX-2 @unitaire @securite
    Plan du scénario: Un fichier interdit ou trop lourd est refusé avec un message clair
      Étant donné Camille choisit « <fichier> »
      Quand le serveur contrôle la demande d'envoi
      Alors Camille lit « <message> »

      Exemples:
        | fichier                     | message                                                    |
        | gros.pdf de 5 Mo et 1 octet | Fichier trop lourd : 5 Mo au maximum.                       |
        | outil.exe                   | Type de fichier refusé : JPEG, PNG, WebP ou PDF seulement.  |

  Règle: La clé d'un fichier commence par l'identifiant de sa propriétaire

    @US-XXX-3 @unitaire @securite
    Exemple: La clé du fichier de Camille commence par l'identifiant de Camille
      Étant donné Camille envoie une image PNG
      Quand la clé de l'objet est construite
      Alors elle commence par l'identifiant de Camille

  Règle: Un envoi se prépare avec une adresse signée et une ligne en attente

    @US-XXX-3 @unitaire
    Exemple: Camille reçoit une adresse d'envoi et une ligne en attente est réservée
      Étant donné Camille choisit une image PNG autorisée
      Quand le serveur prépare l'envoi
      Alors Camille reçoit une adresse d'envoi pour sa clé
      Et une ligne « en_attente » est réservée

  Règle: Une personne accède seulement à ses propres fichiers

    @US-XXX-4 @integration
    Exemple: Camille ouvre sa facture
      Étant donné Camille a envoyé « facture-mars.png »
      Quand Camille ouvre ce fichier
      Alors le fichier est trouvé

    @US-XXX-4 @integration @securite
    Exemple: Léo ne peut pas ouvrir la facture de Camille
      Étant donné Camille a envoyé « facture-mars.png »
      Et Léo est connecté avec son propre compte
      Quand Léo demande ce fichier par son identifiant
      Alors le fichier est introuvable

    @US-XXX-4 @integration @securite
    Exemple: La liste de Léo ne contient pas la facture de Camille
      Étant donné Camille a envoyé « facture-mars.png »
      Et Léo est connecté avec son propre compte
      Quand Léo affiche ses fichiers
      Alors sa liste est vide

    @US-XXX-4 @integration @securite
    Exemple: La base refuse à Léo de confirmer ou d'effacer la ligne de Camille
      Étant donné Camille a réservé un envoi « en_attente »
      Quand la base reçoit de Léo la confirmation puis l'effacement de cette ligne
      Alors rien n'est supprimé
      Et l'envoi de Camille reste « en_attente »

    @US-XXX-4 @unitaire @securite
    Exemple: Léo ne peut pas confirmer l'envoi de Camille
      Étant donné Camille a préparé l'envoi d'une image PNG
      Quand Léo demande au serveur de confirmer cet envoi
      Alors le fichier est introuvable
      Et l'envoi de Camille reste « en_attente »

    @US-XXX-4 @unitaire
    Exemple: Camille supprime son fichier : la ligne et l'objet disparaissent
      Étant donné Camille a envoyé une image PNG
      Quand Camille supprime ce fichier
      Alors la ligne et l'objet sont supprimés

    @US-XXX-4 @unitaire @securite
    Exemple: Léo ne peut pas supprimer le fichier de Camille
      Étant donné Camille a envoyé une image PNG
      Quand Léo essaie de supprimer ce fichier
      Alors le fichier est introuvable
      Et la ligne et l'objet de Camille restent en place

    @US-XXX-4 @manuel @securite
    Exemple: Un lien de téléchargement copié ne sert plus après 5 minutes
      Étant donné Camille a copié l'adresse de téléchargement de sa facture
      Quand quelqu'un ouvre cette adresse 6 minutes plus tard, en navigation privée
      Alors R2 refuse l'accès

  Règle: Un envoi n'est confirmé que s'il correspond à ce qui était annoncé

    @US-XXX-6 @unitaire
    Exemple: L'envoi conforme passe la ligne à « envoye »
      Étant donné Camille a préparé l'envoi d'une image PNG de 1000 octets
      Et R2 a reçu une image PNG de 1000 octets
      Quand le serveur confirme l'envoi
      Alors la ligne est « envoye »

    @US-XXX-6 @unitaire @securite
    Plan du scénario: Un envoi différent de l'annonce est effacé avec sa ligne
      Étant donné Camille a préparé l'envoi d'une image PNG de 1000 octets
      Et <réception>
      Quand le serveur confirme l'envoi
      Alors Camille lit « L'envoi n'a pas abouti. Réessayez. »
      Et la ligne et l'objet sont supprimés

      Exemples:
        | réception                                 |
        | R2 n'a rien reçu                          |
        | R2 a reçu un objet de 999 octets          |
        | R2 a reçu un PDF de 1000 octets           |

  Règle: Un envoi non confirmé reste invisible

    @US-XXX-6 @integration @securite
    Exemple: Un fichier « en_attente » n'apparaît ni dans la liste ni au téléchargement
      Étant donné Camille a réservé un envoi « en_attente »
      Quand Camille affiche ses fichiers et ouvre ce fichier
      Alors sa liste est vide
      Et le fichier est introuvable

  Règle: Une panne du stockage est signalée comme une panne de service

    @US-XXX-7 @unitaire @securite
    Exemple: Un refus de R2 lève une erreur de service « stockage » sans la clé de l'objet
      Étant donné R2 refuse l'accès à un objet de Camille
      Quand le serveur lit cet objet
      Alors une erreur de service « stockage » est levée
      Et son message et sa cause ne contiennent ni la clé de l'objet ni le texte d'origine

    @US-XXX-7 @unitaire
    Exemple: Un objet absent n'est pas une panne : le stockage répond « rien reçu »
      Étant donné R2 répond « NotFound »
      Quand le serveur lit cet objet
      Alors le serveur obtient « rien reçu »

  Règle: Les adresses signées durent 5 minutes et figent le type et la taille

    @US-XXX-8 @unitaire @securite
    Exemple: L'adresse d'envoi signe le type et la taille exacts
      Quand le serveur signe l'adresse d'envoi d'une image PNG de 1000 octets
      Alors l'adresse expire au bout de 300 secondes
      Et le type et la taille font partie de la signature

    @US-XXX-8 @unitaire @securite
    Exemple: L'adresse de lecture force le téléchargement sous un nom nettoyé
      Quand le serveur signe l'adresse de lecture d'un fichier au nom piégé
      Alors l'adresse expire au bout de 300 secondes
      Et le fichier se télécharge en pièce jointe sous un nom nettoyé

  Règle: Un fichier envoyé apparaît dans la liste

    @US-XXX-5 @bout-en-bout
    Exemple: Camille envoie une photo et la voit dans sa liste
      Étant donné Camille est connectée
      Quand Camille envoie « photo-chantier.png »
      Alors « photo-chantier.png » apparaît dans « Mes fichiers »

    @US-XXX-5 @bout-en-bout
    Exemple: L'envoi échoue en route : un message clair, la page reste en place
      Étant donné Camille est connectée
      Et le stockage des fichiers ne répond pas
      Quand Camille envoie « photo-chantier.png »
      Alors le message « L'envoi n'a pas abouti. Réessayez. » s'affiche
      Et la page « Mes fichiers » reste affichée
```

## Tâches de plan prêtes

> US terminée quand : une personne connectée envoie une image ou un PDF autorisé, le retrouve dans sa liste et le télécharge par un lien temporaire ; personne d'autre n'y accède.

- [ ] **Tn – Relier le projet à R2** · US-XXX
  - Objectif : le projet a un bucket R2 privé, en Europe, une table pour ses fichiers et un adapter de stockage
  - Dépend de : —
  - Fichiers : à créer : `src/core/fichiers/fichier.entity.ts`, `fichier.errors.ts`, `fichier.rules.ts`, `fichier-repository.port.ts`, `stockage-fichiers.port.ts`, `src/db/fichiers/fichier.table.ts`, `src/db/fichiers/fichier.repository.ts`, `src/adapters/storage/storage.adapter.ts`, `src/adapters/storage/__tests__/storage.adapter.test.ts`, `src/db/fichiers/__tests__/fichier.repository.test.ts`, migration dans `drizzle/` · à modifier : `src/config/env.ts`, `.env.example`
  - Vérification : US-XXX critères 4 et 6 – `npm test` passe ; `npm run db:migrate` crée la table `fichiers`
  - Tests : « Camille ouvre sa facture », « Léo ne peut pas ouvrir la facture de Camille », « La liste de Léo ne contient pas la facture de Camille », « La base refuse à Léo de confirmer ou d'effacer la ligne de Camille », « Un fichier « en_attente » n'apparaît ni dans la liste ni au téléchargement » (intégration) ; « Un refus de R2 lève une erreur de service « stockage » sans la clé de l'objet », « Un objet absent n'est pas une panne : le stockage répond « rien reçu » », « L'adresse d'envoi signe le type et la taille exacts », « L'adresse de lecture force le téléchargement sous un nom nettoyé » (unitaires)
  - Action manuelle : créer le bucket (juridiction UE), le jeton R2 et la règle CORS dans Cloudflare ; remplir `.env`
- [ ] **Tn+1 – Envoyer un fichier** · US-XXX
  - Objectif : une personne connectée envoie une image ou un PDF, contrôlé par le serveur, puis confirmé après vérification dans R2
  - Dépend de : Tn
  - Fichiers : à créer : `src/core/fichiers/use-cases/preparer-envoi.use-case.ts`, `confirmer-envoi.use-case.ts`, `supprimer-fichier.use-case.ts`, `src/features/fichiers/constants/fichiers.ts`, `constants/erreur-messages.ts`, `schemas/fichier.schema.ts`, `actions/preparer-envoi.action.ts`, `actions/confirmer-envoi.action.ts`, `actions/supprimer-fichier.action.ts`, `components/sections/champ-envoi-fichier.tsx`, `components/containers/envoi-fichier.container.tsx`, `src/core/fichiers/__tests__/fichier.rules.test.ts`, `src/core/fichiers/use-cases/__tests__/sut-fichiers.ts`, `preparer-envoi.use-case.test.ts`, `confirmer-envoi.use-case.test.ts`, `supprimer-fichier.use-case.test.ts`, `src/features/fichiers/schemas/__tests__/fichier.schema.test.ts` · à modifier : `next.config.ts` (CSP, étape 12)
  - Vérification : US-XXX critères 1 à 3 – une image PNG passe ; un `.exe` et un PDF de 6 Mo sont refusés avec le message prévu
  - Tests : « Une photo PNG de 2 Mo est acceptée », « Un fichier interdit ou trop lourd est refusé avec un message clair », « La clé du fichier de Camille commence par l'identifiant de Camille », « Camille reçoit une adresse d'envoi et une ligne en attente est réservée », « L'envoi conforme passe la ligne à « envoye » », « Un envoi différent de l'annonce est effacé avec sa ligne », « Léo ne peut pas confirmer l'envoi de Camille », « Camille supprime son fichier : la ligne et l'objet disparaissent », « Léo ne peut pas supprimer le fichier de Camille » (unitaires)
  - Attention : le serveur contrôle le type et la taille, même si le champ `accept` filtre déjà ; un fichier d'`actions/` commence par `"use server"` et n'exporte que son action
- [ ] **Tn+2 – Retrouver et télécharger ses fichiers** · US-XXX
  - Objectif : une personne voit ses fichiers et les télécharge par un lien temporaire
  - Dépend de : Tn+1
  - Fichiers : à créer : `src/features/fichiers/queries/lister-fichiers.query.ts`, `queries/trouver-fichier.query.ts`, `components/sections/liste-fichiers.tsx`, `components/containers/liste-fichiers.container.tsx`, `app/api/fichiers/[id]/route.ts`, `app/(connecte)/fichiers/page.tsx`, `e2e/fichiers.spec.ts` · à modifier : `proxy.ts`
  - Vérification : US-XXX critères 4 et 5 – envoyer un fichier, le voir dans la liste, le télécharger ; connecté avec un autre compte, `/api/fichiers/<id>` répond « Fichier introuvable. »
  - Tests : « Camille envoie une photo et la voit dans sa liste », « L'envoi échoue en route : un message clair, la page reste en place » (bout en bout) ; « Un lien de téléchargement copié ne sert plus après 5 minutes » (manuel : ouvrir le lien copié en navigation privée après 6 minutes)
  - Action manuelle : saisir les variables R2 dans Vercel ; ajouter l'adresse du site en ligne à la règle CORS

## Tests
Le code des tests : `pulse-aidd pile recette fichiers tests`
## Points de sécurité

- **S1, S2 – Secrets** : les quatre variables R2 restent côté serveur (`server-only`, sans `NEXT_PUBLIC_`). Le navigateur reçoit seulement des adresses signées de 5 minutes. Les pannes du stockage sortent sans secret ni clé d'objet (`ErreurService` à `cause` technique).
- **S3 – Contrôle d'accès** : chaque requête du repository et chaque action filtrent par `utilisateurId` (venu de la session) ; la clé d'objet commence par l'identifiant de la propriétaire.
- **S5, S7 – Fichiers** : type (liste blanche) et taille (5 Mo) contrôlés par le schéma Zod de l'action ; la signature PUT fige le type et la taille ; `confirmerEnvoi` compare ce que R2 a reçu et efface tout écart.
- **S6 – Affichage** : le nom du fichier s'affiche comme du texte ; il n'entre jamais dans la clé d'objet ; il est nettoyé avant l'en-tête de téléchargement.
- **S7 – Stockage privé** : bucket privé ; le Route Handler vérifie la session et la propriétaire avant de signer une adresse GET de 5 minutes. Le fichier est téléchargé (`attachment`), jamais affiché sur le domaine du site.
- **S9 – Données personnelles** : la suppression d'un compte efface ses lignes (`onDelete: "cascade"`) ; prévoyez aussi la suppression des objets R2 du préfixe `<id utilisateur>/`.

## Pièges connus

- **Erreur CORS à l'envoi** : l'adresse de la page (protocole et port compris) doit figurer dans `AllowedOrigins`. Une règle met jusqu'à 30 secondes à s'appliquer. Chaque prévisualisation Vercel a sa propre adresse : ajoutez celles qui servent.
- **403 `SignatureDoesNotMatch`** : le navigateur doit envoyer exactement le `Content-Type` signé (`choisi.type`) et le fichier annoncé (même taille).
- **Bucket UE** : il répond seulement à `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com`. Sans juridiction, retirez `.eu` dans `src/adapters/storage/storage.adapter.ts` et dans `connect-src` de `next.config.ts`.
- **Envoi bloqué, console « Refused to connect … violates the following Content Security Policy directive: connect-src »** : l'adresse R2 manque à `connect-src`. Vérifiez l'étape « La CSP autorise R2 », la présence de `R2_BUCKET` et `R2_ACCOUNT_ID` au moment de la construction (Vercel : Production et Preview), puis reconstruisez. L'hôte bloqué, affiché dans le message, doit être identique à celui écrit dans `connect-src`.
- **Clé secrète perdue** : Cloudflare l'affiche une seule fois. Créez un nouveau jeton, puis supprimez l'ancien.
- **Objet orphelin à la suppression** : `supprimerFichier` efface la ligne, puis l'objet (la personne ne voit plus jamais un fichier cassé). Si l'effacement de l'objet échoue après celui de la ligne, l'objet reste dans R2 sans ligne : il occupe de la place et rien ne le retrouve. Journalisez l'échec avec la clé (l'erreur de service ne la contient pas), puis prévoyez une tâche de ménage qui compare les objets du bucket aux lignes de `fichiers` et efface les objets sans ligne. Inverser l'ordre (objet d'abord) laisserait à la place une ligne qui pointe vers un objet disparu.
- **Lignes « en_attente »** : un envoi abandonné laisse une ligne sans fichier. Elle reste invisible ; une tâche de ménage pourra les effacer plus tard.
- **Type déclaré par le navigateur** : `File.type` vient de l'extension ; le contenu n'est pas inspecté. Le téléchargement forcé (`attachment`) évite qu'un fichier piégé s'exécute dans le site.
- **Les quatre variables R2 deviennent obligatoires** : `env` les valide au chargement ; la construction, le site et les tests de bout en bout les exigent. Renseignez-les dans `.env` (une valeur factice suffit tant qu'aucun envoi réel n'a lieu). Construction de vérification sans elles (CI) : `SKIP_ENV_VALIDATION=1 npm run build`.
- **Langues** : avec la recette `langues`, la page va sous `app/[locale]/(connecte)/fichiers/` ; `app/api/fichiers/` reste à sa place.

## Sources

- Cloudflare R2 : https://developers.cloudflare.com/r2/api/s3/presigned-urls/ ; https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/ ; https://developers.cloudflare.com/r2/buckets/cors/ ; https://developers.cloudflare.com/r2/api/tokens/ ; https://developers.cloudflare.com/r2/reference/data-location/ ; https://developers.cloudflare.com/r2/pricing/
- AWS SDK 3.1147.0 : adresses signées générées localement et inspectées ; option `signableHeaders` (`@smithy/types`)
- Next.js 16.4, documentation embarquée : `01-app/01-getting-started/15-route-handlers.md` ; `01-app/02-guides/server-actions.md` (corps limité à 1 Mo) ; `01-app/03-api-reference/04-functions/refresh.md`
- next-safe-action 8.7.3 : `dist/index.d.mts` (`returnServerError`), `dist/hooks.d.mts` (`useAction`, `executeAsync`)
- Vérifications locales du 2026-10-08 (squelette du pack + recettes `connexion`, `liste`, `email` + cette recette, dans l'architecture hexagonale) : `npm run check`, `npm run typecheck`, `npm test` et `npm run build` (sans les variables R2, puis avec des valeurs factices) passent ; `next start` : `/fichiers` et `/api/fichiers/<id>` sans session répondent 307 vers `/connexion`, et `/api/fichiers/pas-un-uuid` répond 404.

## Points à vérifier

- Un envoi réel vers R2 (test de bout en bout et parcours manuel) : non exécuté lors de la rédaction (pas de compte R2).
- Le refus par R2 d'un PUT dont la taille diffère de `content-length` signé : attendu d'après la signature SigV4, à constater une fois.
- Le nom d'erreur `NotFound` renvoyé par `HeadObjectCommand` avec R2 : le test de l'adapter le double, un essai réel reste à faire.
- `refresh()` dans une action appelée depuis `startTransition` (hors `<form action>`) : la liste doit se mettre à jour ; sinon, appelez `router.refresh()` après `confirmerEnvoiAction`.
- L'obligation d'enregistrer un moyen de paiement pour activer R2, même avec l'offre gratuite : non précisée par les pages consultées.
- Essai réel du 2026-10-06 (ancienne organisation, base PGlite, R2 factice) : le test « L'envoi échoue en route » passait 3 fois sur 3, sur ordinateur et sur téléphone ; il a révélé qu'une coupure réseau faisait basculer la page sur l'écran d'erreur (corrigé : `try/catch` autour du `fetch`). Parcours Playwright à rejouer dans la nouvelle organisation.
