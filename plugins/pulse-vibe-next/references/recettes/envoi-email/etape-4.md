### 4. Le service et l'assemblage

`ServiceEmail` est ce que le métier reçoit : il ajoute l'expéditeur et l'en-tête de développement, confie l'e-mail au transport reçu par son constructeur, puis journalise l'envoi sans adresse. `getEnvoyeurEmail()` lit `env` et crée l'envoyeur une seule fois, à la première demande.

<!-- fichier: src/adapters/email/email.adapter.ts -->
```ts
// src/adapters/email/email.adapter.ts
import "server-only";
import { env } from "@src/config/env";
import type {
  EmailSortant,
  EnvoyeurEmail,
  MessageEmail,
  TransportEmail,
} from "@src/core/email/email.port";
import { logger } from "@src/lib/logger";
import { NodemailerTransport } from "./nodemailer.adapter";

/** Les réglages de l'envoi, lus dans `env` par getEnvoyeurEmail(). */
export type ReglagesEnvoi = {
  /** Expéditeur de chaque e-mail, ex. « Mon projet <ne-pas-repondre@exemple.fr> ». */
  expediteur: string;
  /** En développement, chaque e-mail porte l'en-tête X-Environment. */
  enDeveloppement: boolean;
};

// La marque passe par un en-tête : un sujet balisé est pénalisé par certains filtres des indésirables.
const EN_TETES_DEVELOPPEMENT = { "X-Environment": "development" };

/** Les e-mails de l'application (patron Façade) : expéditeur, en-têtes et journal ; le transport envoie. */
export class ServiceEmail implements EnvoyeurEmail {
  constructor(
    private readonly transport: TransportEmail,
    private readonly reglages: ReglagesEnvoi,
  ) {}

  async envoyer(message: MessageEmail): Promise<void> {
    const accuse = await this.transport.transmettre(this.preparer(message));
    // Journal sans adresse (donnée personnelle) : l'identifiant, le sujet, le nombre de destinataires.
    const destinataires = typeof message.a === "string" ? 1 : message.a.length;
    logger.info(
      { messageId: accuse.identifiant, sujet: message.sujet, destinataires },
      "E-mail envoyé",
    );
    if (accuse.refuses > 0) {
      logger.warn(
        { messageId: accuse.identifiant, refuses: accuse.refuses },
        "E-mail refusé pour une partie des destinataires",
      );
    }
  }

  private preparer(message: MessageEmail): EmailSortant {
    return {
      ...message,
      de: this.reglages.expediteur,
      enTetes: this.reglages.enDeveloppement
        ? EN_TETES_DEVELOPPEMENT
        : undefined,
    };
  }
}

let instance: EnvoyeurEmail | undefined;

/** L'envoyeur de l'application, créé une seule fois, à la première demande (racine de composition). */
export function getEnvoyeurEmail(): EnvoyeurEmail {
  instance ??= new ServiceEmail(
    new NodemailerTransport({
      hote: env.SMTP_HOST,
      port: env.SMTP_PORT,
      utilisateur: env.SMTP_USER,
      motDePasse: env.SMTP_PASSWORD,
    }),
    {
      expediteur: env.MAIL_FROM,
      enDeveloppement: process.env.NODE_ENV === "development",
    },
  );
  return instance;
}
```

Un seul expéditeur, celui de `MAIL_FROM` : le serveur SMTP refuse, ou range dans les indésirables, un e-mail qui part au nom d'une autre adresse. Pour qu'une réponse aille à quelqu'un d'autre (la personne qui a rempli le formulaire de contact), le message porte `repondreA`.

