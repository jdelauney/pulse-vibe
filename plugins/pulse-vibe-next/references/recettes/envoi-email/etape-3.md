### 3. Le transport Nodemailer

La classe `NodemailerTransport` reçoit le serveur SMTP par le constructeur et crée le transport une seule fois : avec `pool`, les connexions au serveur servent à plusieurs e-mails.

<!-- fichier: src/adapters/email/nodemailer.adapter.ts -->
```ts
// src/adapters/email/nodemailer.adapter.ts
import "server-only";
import type {
  AccuseEnvoi,
  EmailSortant,
  TransportEmail,
} from "@src/core/email/email.port";
import { ErreurService } from "@src/lib/errors/erreur-service";
import nodemailer, { type Transporter } from "nodemailer";

/** Le serveur SMTP, lu dans `env` par getEnvoyeurEmail(). */
export type ConfigSmtp = {
  hote: string;
  port: number;
  utilisateur?: string;
  motDePasse?: string;
};

/** Port chiffré dès la connexion. */
const PORT_CHIFFRE = 465;
/** Port chiffré par STARTTLS : le chiffrement est exigé. */
const PORT_STARTTLS = 587;
// Délais bornés : sans eux, Nodemailer attend 2 minutes la connexion, 30 secondes l'accueil du serveur
// et 10 minutes une connexion muette ; l'action qui envoie resterait suspendue d'autant.
const DELAI_CONNEXION_MS = 10_000;
const DELAI_ACCUEIL_MS = 10_000;
const DELAI_INACTIVITE_MS = 20_000;

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

/** Envoi par un serveur SMTP avec Nodemailer. Lève ErreurService("email", …) si l'envoi échoue. */
export class NodemailerTransport implements TransportEmail {
  private readonly transporteur: Transporter;

  constructor(config: ConfigSmtp) {
    this.transporteur = nodemailer.createTransport({
      host: config.hote,
      port: config.port,
      secure: config.port === PORT_CHIFFRE,
      requireTLS: config.port === PORT_STARTTLS,
      // Les connexions ouvertes servent aux e-mails suivants.
      pool: true,
      auth: config.utilisateur
        ? { user: config.utilisateur, pass: config.motDePasse }
        : undefined,
      connectionTimeout: DELAI_CONNEXION_MS,
      greetingTimeout: DELAI_ACCUEIL_MS,
      socketTimeout: DELAI_INACTIVITE_MS,
    });
  }

  async transmettre(email: EmailSortant): Promise<AccuseEnvoi> {
    try {
      const info = await this.transporteur.sendMail({
        from: email.de,
        to: typeof email.a === "string" ? email.a : [...email.a],
        subject: email.sujet,
        text: email.texte,
        html: email.html,
        replyTo: email.repondreA,
        headers: email.enTetes ? { ...email.enTetes } : undefined,
        attachments: email.piecesJointes?.map((piece) => ({
          filename: piece.nomFichier,
          content:
            typeof piece.contenu === "string"
              ? piece.contenu
              : Buffer.from(piece.contenu),
          contentType: piece.typeMime,
        })),
      });
      return {
        identifiant: info.messageId,
        refuses: info.rejected?.length ?? 0,
      };
    } catch (erreur) {
      throw new ErreurService("email", "Envoi de l'e-mail impossible", {
        cause: causeTechnique(erreur),
      });
    }
  }
}
```

`secure: true` seulement pour le port 465 ; sur 587, Nodemailer passe en chiffré par STARTTLS, et `requireTLS` refuse d'envoyer en clair. Avec Mailpit (port 1025), ni chiffrement ni identifiant. Une connexion restée ouverte est fermée par Nodemailer après 4 minutes sans envoi ; une connexion coupée par le serveur est rouverte au besoin. Une panne du serveur d'e-mail devient une `ErreurService("email", …)` : son message ne contient ni adresse ni secret. Sa `cause` garde seulement trois champs techniques de l'erreur d'origine (`code`, `command`, `responseCode`), lus un par un ; le texte de l'erreur n'y entre pas, car un refus du serveur peut citer l'adresse du destinataire (architecture.md §8). Nodemailer prend une pièce jointe en texte ou en `Buffer` : le contenu binaire du contrat (`Uint8Array`, sans dépendance à Node) y est converti.

