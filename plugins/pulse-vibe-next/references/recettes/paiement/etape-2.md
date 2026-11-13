### 2. Le métier : entité, erreur et ports

Le métier ne dépend que de `src/core/`. La commande est une classe (`Commande`) construite sur des données simples (`CommandeVue`) ; les deux ports sont des `interface` qui décrivent ce dont les use-cases ont besoin : le repository de l'étape 5 et l'adapter de l'étape 6 les implémentent, et un test passe des doublures en mémoire.

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

/** Les données d'une commande : la forme qui traverse les frontières (base, écran). */
export type CommandeVue = {
  id: string;
  utilisateurId: string;
  libelle: string;
  montantCentimes: number;
  devise: string;
  statut: StatutCommande;
};

/** Ce que la page « Merci » affiche d'une commande. */
export type CommandeAffichee = Pick<
  CommandeVue,
  "libelle" | "statut" | "montantCentimes"
>;

/** Une commande : son état reste en lecture seule. */
export class Commande {
  constructor(private readonly donnees: Readonly<CommandeVue>) {}

  get id(): string {
    return this.donnees.id;
  }

  get estPayee(): boolean {
    return this.donnees.statut === "payee";
  }

  versVue(): CommandeVue {
    return { ...this.donnees };
  }
}

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
import type {
  Commande,
  Offre,
  ResultatConfirmation,
} from "./commande.entity";

/** Ce dont les use-cases ont besoin pour ranger les commandes en base (patron Repository). */
export interface CommandeRepository {
  /** Crée une commande « en_attente » pour cette personne. */
  creer(donnees: { utilisateurId: string; offre: Offre }): Promise<Commande>;
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
}
```

<!-- fichier: src/core/paiement/passerelle-paiement.port.ts -->
```ts
// src/core/paiement/passerelle-paiement.port.ts
import type { Result } from "@src/core/shared/result";
import type { EvenementPaiement, Offre } from "./commande.entity";
import type { ErreurPaiement } from "./paiement.errors";

/** Le service de paiement (Stripe). L'adapter `payment` l'implémente ; un test passe une doublure. */
export interface PasserellePaiement {
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
}
```
