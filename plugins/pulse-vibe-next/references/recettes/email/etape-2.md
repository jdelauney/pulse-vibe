### 2. Le port et l'envoi

Le port décrit ce que le métier attend d'un envoi ; l'adapter `email` l'implémente avec Nodemailer. Un test passe à la place une doublure qui garde les messages.

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
export type EnvoyeurEmail = (message: MessageEmail) => Promise<void>;
```

<!-- fichier: src/adapters/email/email.adapter.ts -->
```ts
// src/adapters/email/email.adapter.ts
import "server-only";
import { env } from "@src/config/env";
import type { EnvoyeurEmail, MessageEmail } from "@src/core/compte/email.port";
import { ErreurService } from "@src/lib/errors/erreur-service";
import { logger } from "@src/lib/logger";
import nodemailer, { type Transporter } from "nodemailer";

let transporteur: Transporter | undefined;

function obtenirTransporteur(): Transporter {
  if (!transporteur) {
    transporteur = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      // 465 : chiffrement dès la connexion. 587 : chiffrement STARTTLS, exigé ci-dessous.
      secure: env.SMTP_PORT === 465,
      requireTLS: env.SMTP_PORT === 587,
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transporteur;
}

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
export const envoyerEmail: EnvoyeurEmail = async ({
  a,
  sujet,
  texte,
  html,
}: MessageEmail) => {
  try {
    const info = await obtenirTransporteur().sendMail({
      from: env.MAIL_FROM,
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
};
```

`secure: true` seulement pour le port 465 ; sur 587, Nodemailer passe en chiffré par STARTTLS, et `requireTLS` refuse d'envoyer en clair. Avec Mailpit (port 1025), ni chiffrement ni identifiant. Une panne du serveur d'e-mail devient une `ErreurService("email", …)` : son message ne contient ni adresse ni secret. Sa `cause` garde seulement trois champs techniques de l'erreur d'origine (`code`, `command`, `responseCode`), lus un par un ; le texte de l'erreur n'y entre pas, car un refus du serveur peut citer l'adresse du destinataire (architecture.md §8).

