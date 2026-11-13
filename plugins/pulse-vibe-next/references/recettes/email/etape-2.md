### 2. Le port et l'envoi

Le port (une `interface`) décrit ce que le métier attend d'un envoi ; la classe `NodemailerEmailAdapter` de l'adapter `email` l'implémente avec Nodemailer. Elle reçoit sa configuration SMTP par le constructeur : `getAuth()` la lit dans `env`. Un test passe à la place une doublure qui garde les messages.

<!-- fichier: src/core/compte/email.port.ts -->
```ts
// src/core/compte/email.port.ts
export type MessageEmail = {
  a: string;
  sujet: string;
  texte: string;
  html?: string;
};

/** Envoie un e-mail. L'adapter `email` l'implémente ; un test passe une doublure. */
export interface EnvoyeurEmail {
  envoyer(message: MessageEmail): Promise<void>;
}
```

<!-- fichier: src/adapters/email/email.adapter.ts -->
```ts
// src/adapters/email/email.adapter.ts
import "server-only";
import type { EnvoyeurEmail, MessageEmail } from "@src/core/compte/email.port";
import { ErreurService } from "@src/lib/errors/erreur-service";
import { logger } from "@src/lib/logger";
import nodemailer, { type Transporter } from "nodemailer";

/** Le serveur SMTP et l'expéditeur, lus dans `env` par celui qui assemble les objets. */
export type ConfigEmail = {
  hote: string;
  port: number;
  utilisateur?: string;
  motDePasse?: string;
  expediteur: string;
};

/**
 * Codes techniques de l'erreur SMTP, sans son texte : le texte d'un refus peut citer l'adresse du destinataire.
 */
function causeTechnique(erreur: unknown) {
  const brute = (erreur ?? {}) as Record<string, unknown>;
  const texte = (v: unknown) => (typeof v === "string" ? v : undefined);
  return {
    code: texte(brute.code),
    command: texte(brute.command),
    responseCode:
      typeof brute.responseCode === "number" ? brute.responseCode : undefined,
  };
}

/** La seule porte de sortie des e-mails de l'application. Lève ErreurService("email", …) si l'envoi échoue. */
export class NodemailerEmailAdapter implements EnvoyeurEmail {
  private transporteur: Transporter | undefined;

  constructor(private readonly config: ConfigEmail) {}

  private obtenirTransporteur(): Transporter {
    this.transporteur ??= nodemailer.createTransport({
      host: this.config.hote,
      port: this.config.port,
      // 465 : chiffrement dès la connexion. 587 : chiffrement STARTTLS, exigé ci-dessous.
      secure: this.config.port === 465,
      requireTLS: this.config.port === 587,
      auth: this.config.utilisateur
        ? { user: this.config.utilisateur, pass: this.config.motDePasse }
        : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    return this.transporteur;
  }

  async envoyer({ a, sujet, texte, html }: MessageEmail): Promise<void> {
    try {
      const info = await this.obtenirTransporteur().sendMail({
        from: this.config.expediteur,
        to: a,
        subject: sujet,
        text: texte,
        html,
      });
      // Journal sans l'adresse du destinataire (donnée personnelle).
      logger.info({ messageId: info.messageId, sujet }, "E-mail envoyé");
    } catch (erreur) {
      throw new ErreurService("email", "Envoi de l'e-mail impossible", {
        cause: causeTechnique(erreur),
      });
    }
  }
}
```

`secure: true` seulement pour le port 465 ; sur 587, Nodemailer passe en chiffré par STARTTLS, et `requireTLS` refuse d'envoyer en clair. Avec Mailpit (port 1025), ni chiffrement ni identifiant. Une panne du serveur d'e-mail devient une `ErreurService("email", …)` : son message ne contient ni adresse ni secret. Sa `cause` garde seulement trois champs techniques de l'erreur d'origine (`code`, `command`, `responseCode`), lus un par un ; le texte de l'erreur n'y entre pas, car un refus du serveur peut citer l'adresse du destinataire (architecture.md §8).
