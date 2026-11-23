### 2. Les contrats

Les ports (des `interface`) décrivent ce que le métier attend d'un envoi et ce qu'un fournisseur doit fournir. Ils ne dépendent ni de Next ni de Nodemailer.

<!-- fichier: src/core/email/email.port.ts -->
```ts
// src/core/email/email.port.ts

/** Un fichier joint : son nom affiché, son contenu, son type (ex. « text/calendar »). */
export type PieceJointe = {
  nomFichier: string;
  contenu: string | Uint8Array;
  typeMime: string;
};

/** Un e-mail tel que le métier le demande. */
export type MessageEmail = {
  /** Une adresse, ou plusieurs. */
  a: string | readonly string[];
  sujet: string;
  texte: string;
  html?: string;
  /** Adresse qui reçoit la réponse (ex. la personne qui a écrit par le formulaire de contact). */
  repondreA?: string;
  piecesJointes?: readonly PieceJointe[];
};

/** Envoie un e-mail. Application : `getEnvoyeurEmail()` ; tests : une doublure qui garde les messages. */
export interface EnvoyeurEmail {
  envoyer(message: MessageEmail): Promise<void>;
}

/** Un e-mail prêt à partir : expéditeur et en-têtes ajoutés. */
export type EmailSortant = MessageEmail & {
  de: string;
  enTetes?: Readonly<Record<string, string>>;
};

/** La réponse du serveur d'e-mail, sans adresse. */
export type AccuseEnvoi = {
  identifiant: string;
  /** Destinataires refusés par le serveur (l'e-mail est parti pour les autres). */
  refuses: number;
};

/** Le contrat d'un fournisseur d'envoi (patron Adapter) : Nodemailer aujourd'hui, un autre demain. */
export interface TransportEmail {
  transmettre(email: EmailSortant): Promise<AccuseEnvoi>;
}
```

