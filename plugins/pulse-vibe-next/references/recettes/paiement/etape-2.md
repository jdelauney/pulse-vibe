### 2. Le métier : entité, erreur et ports

Le métier ne dépend que de `src/core/`. Les deux ports décrivent ce dont les use-cases ont besoin : le repository de l'étape 5 et l'adapter de l'étape 6 les fournissent, et un test passe des doublures en mémoire.

Le prix vit côté serveur (`OFFRE`, étape 7) : le navigateur ne choisit jamais le montant. L'`EvenementPaiement` décrit un message de Stripe déjà vérifié, sans vocabulaire Stripe : l'adapter décide si l'événement est un paiement encaissé et remplit `confirmation` dans ce cas seulement.

<!-- fichier: src/core/paiement/commande.entity.ts -->
```ts
// src/core/paiement/commande.entity.ts
/** « en_attente » : paiement demandé ; « payee » : confirmé par le service de paiement. */
export const STATUTS_COMMANDE = ["en_attente", "payee"] as const;
export type StatutCommande = (typeof STATUTS_COMMANDE)[number];

/** Ce que la personne achète. Le prix vit côté serveur : le navigateur ne choisit jamais le montant. */
export type Offre = {
  libelle: string;
  /** Montant en centimes (entier) : 1900 = 19,00 €. */
  montantCentimes: number;
  devise: string;
};

/**
 * Message reçu du service de paiement, déjà vérifié. `confirmation` n'existe que pour un
 * paiement réellement encaissé ; pour tout autre événement, elle vaut null.
 */
export type EvenementPaiement = {
  id: string;
  type: string;
  confirmation: { commandeId: string; montantCentimes: number } | null;
};

/** « payee » : la commande passe payée ; « deja_traite » : événement déjà reçu ; « ignore » : rien à faire. */
export type ResultatConfirmation = "payee" | "deja_traite" | "ignore";
```

<!-- fichier: src/core/paiement/paiement.errors.ts -->
```ts
// src/core/paiement/paiement.errors.ts
export type ErreurPaiement = "signature-invalide";
```

<!-- fichier: src/core/paiement/commande-repository.port.ts -->
```ts
// src/core/paiement/commande-repository.port.ts
import type { Offre, ResultatConfirmation } from "./commande.entity";

/** Ce dont les use-cases ont besoin pour ranger les commandes en base. */
export type CommandeRepository = {
  /** Crée une commande « en_attente » pour cette personne. */
  creer(donnees: {
    utilisateurId: string;
    offre: Offre;
  }): Promise<{ id: string }>;
  /** Relie la commande de cette personne à la session de paiement. */
  attacherSession(
    id: string,
    utilisateurId: string,
    sessionId: string,
  ): Promise<void>;
  /**
   * Note l'événement (une seule fois) et passe la commande en « payee » si elle est
   * « en_attente » et que le montant payé est le sien, le tout d'un seul bloc.
   */
  enregistrerConfirmation(confirmation: {
    evenementId: string;
    type: string;
    commandeId: string;
    montantCentimes: number;
  }): Promise<ResultatConfirmation>;
};
```

<!-- fichier: src/core/paiement/passerelle-paiement.port.ts -->
```ts
// src/core/paiement/passerelle-paiement.port.ts
import type { Result } from "@src/core/shared/result";
import type { EvenementPaiement, Offre } from "./commande.entity";
import type { ErreurPaiement } from "./paiement.errors";

/** Le service de paiement (Stripe). L'adapter `payment` l'implémente ; un test passe une doublure. */
export type PasserellePaiement = {
  /**
   * Ouvre une page de paiement hébergée. `{SESSION_ID}` dans `urlSucces` est remplacé
   * par l'identifiant de la session.
   */
  creerSession(params: {
    commandeId: string;
    offre: Offre;
    urlSucces: string;
    urlAnnulation: string;
  }): Promise<{ id: string; url: string }>;
  /** Vérifie la signature du message reçu (corps brut) puis le décrit. */
  lireEvenement(
    corps: string,
    signature: string,
  ): Result<EvenementPaiement, ErreurPaiement>;
};
```

