
### Service (Vitest, transport doublé)

`ServiceEmail` reçoit une doublure du transport, une classe qui implémente `TransportEmail` et garde les e-mails au lieu de les envoyer. Le journal est observé par `vi.spyOn`.

<!-- fichier: src/adapters/email/__tests__/email.adapter.test.ts -->
```ts
// src/adapters/email/__tests__/email.adapter.test.ts
import type {
  AccuseEnvoi,
  EmailSortant,
  TransportEmail,
} from "@src/core/email/email.port";
import { logger } from "@src/lib/logger";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceEmail } from "../email.adapter";

/** Doublure du transport : les e-mails sont gardés au lieu de partir. */
class TransportEnMemoire implements TransportEmail {
  readonly transmis: EmailSortant[] = [];

  async transmettre(email: EmailSortant): Promise<AccuseEnvoi> {
    this.transmis.push(email);
    return { identifiant: "<message-1@localhost>", refuses: 0 };
  }
}

const EXPEDITEUR = "Mon projet <ne-pas-repondre@exemple.fr>";
const MESSAGE = {
  a: "camille@exemple.fr",
  sujet: "Votre réservation est confirmée",
  texte: "Bonjour Camille, votre réservation est confirmée.",
};

function createSut(enDeveloppement = false) {
  const transport = new TransportEnMemoire();
  const service = new ServiceEmail(transport, {
    expediteur: EXPEDITEUR,
    enDeveloppement,
  });
  return { transport, service };
}

describe("Envoi des e-mails", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Chaque e-mail part avec l'expéditeur du site", () => {
    it("US-XXX-1 – Un e-mail part avec l'expéditeur du site", async () => {
      const { transport, service } = createSut();

      await service.envoyer(MESSAGE);

      expect(transport.transmis).toHaveLength(1);
      expect(transport.transmis[0]).toMatchObject({
        ...MESSAGE,
        de: EXPEDITEUR,
      });
      expect(transport.transmis[0].enTetes).toBeUndefined();
    });

    it("US-XXX-1 – Un e-mail envoyé pendant le développement porte une marque", async () => {
      const { transport, service } = createSut(true);

      await service.envoyer(MESSAGE);

      expect(transport.transmis[0].enTetes).toEqual({
        "X-Environment": "development",
      });
      expect(transport.transmis[0].sujet).toBe(MESSAGE.sujet);
    });
  });

  describe("Le journal du serveur ne contient aucune adresse de destinataire", () => {
    it("US-XXX-3 – L'envoi est journalisé sans l'adresse", async () => {
      const journal = vi.spyOn(logger, "info").mockImplementation(() => {});
      const { service } = createSut();

      await service.envoyer(MESSAGE);

      expect(journal).toHaveBeenCalledWith(
        {
          messageId: "<message-1@localhost>",
          sujet: MESSAGE.sujet,
          destinataires: 1,
        },
        "E-mail envoyé",
      );
      expect(JSON.stringify(journal.mock.calls)).not.toContain(
        "camille@exemple.fr",
      );
    });
  });
});
```

### Transport (Vitest, Nodemailer doublé)

Nodemailer est doublé : le test lit les réglages du transport et l'e-mail confié au serveur, ou fait refuser l'envoi comme un serveur qui rejette le destinataire. L'erreur levée garde ses codes techniques, sans le texte du refus ni l'adresse.

<!-- fichier: src/adapters/email/__tests__/nodemailer.adapter.test.ts -->
```ts
// src/adapters/email/__tests__/nodemailer.adapter.test.ts
import { ErreurService } from "@src/lib/errors/erreur-service";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NodemailerTransport } from "../nodemailer.adapter";

// Serveur SMTP doublé : les réglages et les e-mails sont gardés.
const { createTransport, sendMail } = vi.hoisted(() => {
  const sendMail = vi.fn();
  return {
    sendMail,
    createTransport: vi.fn((_reglages: unknown) => ({ sendMail })),
  };
});
vi.mock("nodemailer", () => ({ default: { createTransport } }));

const EMAIL = {
  de: "Mon projet <ne-pas-repondre@exemple.fr>",
  a: "contact@exemple.fr",
  sujet: "Nouveau message",
  texte: "Camille vous a écrit.",
};

describe("Transport des e-mails", () => {
  beforeEach(() => {
    createTransport.mockClear();
    sendMail.mockReset();
  });

  describe("Un serveur d'e-mail lent n'immobilise pas le site", () => {
    it("US-XXX-4 – L'attente du serveur d'e-mail est bornée", async () => {
      sendMail.mockResolvedValue({ messageId: "<m@localhost>", rejected: [] });
      const transport = new NodemailerTransport({
        hote: "smtp.exemple.fr",
        port: 587,
        utilisateur: "projet@exemple.fr",
        motDePasse: "mot-de-passe-de-test",
      });

      await transport.transmettre(EMAIL);
      await transport.transmettre(EMAIL);

      // Un seul transport pour tous les e-mails, chiffrement exigé sur 587.
      expect(createTransport).toHaveBeenCalledTimes(1);
      expect(createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          secure: false,
          requireTLS: true,
          pool: true,
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 20_000,
        }),
      );
    });

    it("US-XXX-4 – Sur le port 465, la connexion est chiffrée dès le départ", () => {
      new NodemailerTransport({ hote: "smtp.exemple.fr", port: 465 });

      expect(createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ secure: true, requireTLS: false }),
      );
    });
  });

  describe("La réponse va à l'adresse choisie, et les pièces jointes suivent", () => {
    it("US-XXX-2 – La réponse à une notification va à la personne qui a écrit", async () => {
      sendMail.mockResolvedValue({ messageId: "<m@localhost>", rejected: [] });
      const transport = new NodemailerTransport({
        hote: "localhost",
        port: 1025,
      });

      const accuse = await transport.transmettre({
        ...EMAIL,
        repondreA: "camille@exemple.fr",
        piecesJointes: [
          {
            nomFichier: "rendez-vous.ics",
            contenu: new TextEncoder().encode("BEGIN:VCALENDAR"),
            typeMime: "text/calendar",
          },
        ],
      });

      expect(accuse).toEqual({ identifiant: "<m@localhost>", refuses: 0 });
      const envoye = sendMail.mock.calls[0][0];
      expect(envoye).toMatchObject({
        from: EMAIL.de,
        to: EMAIL.a,
        replyTo: "camille@exemple.fr",
      });
      expect(envoye.attachments[0]).toMatchObject({
        filename: "rendez-vous.ics",
        contentType: "text/calendar",
      });
      expect(envoye.attachments[0].content.toString()).toBe("BEGIN:VCALENDAR");
    });
  });

  describe("Une panne du serveur d'e-mail est signalée comme une panne de service", () => {
    it("US-XXX-5 – L'échec de l'envoi lève une erreur de service « email » sans l'adresse", async () => {
      sendMail.mockRejectedValue(
        Object.assign(new Error("550 5.1.1 <camille@exemple.fr> inconnue"), {
          code: "EENVELOPE",
          command: "RCPT TO",
          responseCode: 550,
        }),
      );
      const transport = new NodemailerTransport({
        hote: "localhost",
        port: 1025,
      });

      const erreur = await transport
        .transmettre({ ...EMAIL, a: "camille@exemple.fr" })
        .catch((e: unknown) => e);

      expect(erreur).toBeInstanceOf(ErreurService);
      const service = erreur as ErreurService;
      expect(service.service).toBe("email");
      expect(service.message).not.toContain("camille@exemple.fr");
      // La cause garde les codes techniques, sans le texte du refus ni l'adresse.
      expect(service.cause).toEqual({
        code: "EENVELOPE",
        command: "RCPT TO",
        responseCode: 550,
      });
      expect(JSON.stringify(service.cause)).not.toContain("camille@exemple.fr");
    });
  });
});
```

### Bout en bout (Playwright + Mailpit)

Le parcours d'une fonctionnalité qui envoie un e-mail le lit dans Mailpit. Mailpit doit tourner, et le serveur lancé par Playwright doit utiliser `SMTP_HOST=localhost` et `SMTP_PORT=1025` (valeurs de `.env` en local). En CI, ajoutez le conteneur `axllent/mailpit` comme service, ports 1025 et 8025. Chaque test utilise une adresse unique : les tests restent indépendants sans vider Mailpit.

L'aide lit l'API REST de Mailpit (`GET /api/v1/search?query=to:"…"`, résultats du plus récent au plus ancien ; `GET /api/v1/message/{ID}`, champs `Subject`, `Text`, `HTML`) :

<!-- fichier: e2e/aides/mailpit.ts -->
```ts
// e2e/aides/mailpit.ts
// Lecture des e-mails capturés par Mailpit (API REST, http://localhost:8025 par défaut).
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

type Resume = { ID: string; Subject: string };
export type EmailRecu = { Subject: string; Text: string; HTML: string };

/** Attend l'e-mail de ce sujet reçu par cette adresse (10 secondes au plus). */
export async function emailPour(
  adresse: string,
  sujet: string,
  delaiMs = 10_000,
): Promise<EmailRecu> {
  const limite = Date.now() + delaiMs;
  const recherche = encodeURIComponent(`to:"${adresse}"`);
  while (Date.now() < limite) {
    const reponse = await fetch(`${MAILPIT}/api/v1/search?query=${recherche}`);
    // Résultats triés du plus récent au plus ancien.
    const { messages } = (await reponse.json()) as { messages: Resume[] };
    const trouve = messages.find((m) => m.Subject === sujet);
    if (trouve) {
      const detail = await fetch(`${MAILPIT}/api/v1/message/${trouve.ID}`);
      return (await detail.json()) as EmailRecu;
    }
    await new Promise((resoudre) => setTimeout(resoudre, 250));
  }
  throw new Error(`Aucun e-mail « ${sujet} » reçu par ${adresse} dans Mailpit`);
}

export function premierLien(texte: string): string {
  const lien = texte.match(/https?:\/\/\S+/)?.[0];
  if (!lien) {
    throw new Error("Aucun lien dans l'e-mail");
  }
  return lien;
}
```

