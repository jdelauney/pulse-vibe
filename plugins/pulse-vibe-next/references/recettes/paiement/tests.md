
### Unitaires : use-cases

Les use-cases s'essaient sans base ni réseau : le repository et la passerelle de paiement sont remplacés par des doublures en mémoire. Un fichier par use-case, créé avec lui.

<!-- fichier: src/core/paiement/use-cases/__tests__/ouvrir-paiement.use-case.test.ts -->
```ts
// src/core/paiement/use-cases/__tests__/ouvrir-paiement.use-case.test.ts
import { describe, expect, it } from "vitest";
import type { Offre } from "../../commande.entity";
import type { CommandeRepository } from "../../commande-repository.port";
import type { PasserellePaiement } from "../../passerelle-paiement.port";
import { ouvrirPaiement } from "../ouvrir-paiement.use-case";

const OFFRE: Offre = {
  libelle: "Accès complet",
  montantCentimes: 1900,
  devise: "eur",
};

/** Doublures en mémoire des deux ports. */
function createSut() {
  const commandes: { id: string; utilisateurId: string; sessionId?: string }[] =
    [];
  const sessionsCreees: { commandeId: string; urlSucces: string }[] = [];

  const repository: CommandeRepository = {
    async creer({ utilisateurId }) {
      const id = `commande-${commandes.length + 1}`;
      commandes.push({ id, utilisateurId });
      return { id };
    },
    async attacherSession(id, utilisateurId, sessionId) {
      const ligne = commandes.find(
        (c) => c.id === id && c.utilisateurId === utilisateurId,
      );
      if (ligne) ligne.sessionId = sessionId;
    },
    async enregistrerConfirmation() {
      throw new Error("non utilisé dans ce test");
    },
  };
  const paiement: PasserellePaiement = {
    async creerSession({ commandeId, urlSucces }) {
      sessionsCreees.push({ commandeId, urlSucces });
      return { id: "cs_test_1", url: "https://paiement.exemple/cs_test_1" };
    },
    lireEvenement() {
      throw new Error("non utilisé dans ce test");
    },
  };

  return {
    async whenCamilleOuvreLePaiement() {
      return ouvrirPaiement(
        { commandes: repository, paiement },
        {
          utilisateurId: "camille-id",
          offre: OFFRE,
          urlSucces: "https://site.exemple/paiement/merci",
          urlAnnulation: "https://site.exemple/paiement",
        },
      );
    },
    thenCommandeReliee() {
      expect(commandes).toEqual([
        {
          id: "commande-1",
          utilisateurId: "camille-id",
          sessionId: "cs_test_1",
        },
      ]);
      expect(sessionsCreees).toEqual([
        {
          commandeId: "commande-1",
          urlSucces: "https://site.exemple/paiement/merci",
        },
      ]);
    },
  };
}

describe("Paiement", () => {
  describe("La page de paiement s'ouvre avec le prix du serveur", () => {
    it("US-XXX-6 – Camille ouvre le paiement : sa commande est reliée à la session Stripe", async () => {
      const sut = createSut();

      const { url } = await sut.whenCamilleOuvreLePaiement();

      expect(url).toBe("https://paiement.exemple/cs_test_1");
      sut.thenCommandeReliee();
    });
  });
});
```

<!-- fichier: src/core/paiement/use-cases/__tests__/confirmer-paiement.use-case.test.ts -->
```ts
// src/core/paiement/use-cases/__tests__/confirmer-paiement.use-case.test.ts
import { describe, expect, it } from "vitest";
import type { ResultatConfirmation } from "../../commande.entity";
import type { CommandeRepository } from "../../commande-repository.port";
import { confirmerPaiement } from "../confirmer-paiement.use-case";

/** Doublure en mémoire du repository. */
function createSut() {
  const confirmations: { evenementId: string; commandeId: string }[] = [];

  const commandes: CommandeRepository = {
    async creer() {
      throw new Error("non utilisé dans ce test");
    },
    async attacherSession() {
      throw new Error("non utilisé dans ce test");
    },
    async enregistrerConfirmation(confirmation) {
      confirmations.push(confirmation);
      return "payee" satisfies ResultatConfirmation;
    },
  };

  return {
    async whenStripeEnvoie(confirmation: boolean) {
      return confirmerPaiement(
        { commandes },
        {
          id: "evt_001",
          type: "checkout.session.completed",
          confirmation: confirmation
            ? { commandeId: "commande-1", montantCentimes: 1900 }
            : null,
        },
      );
    },
    thenConfirmationsTransmises(attendu: number) {
      expect(confirmations).toHaveLength(attendu);
    },
  };
}

describe("Paiement", () => {
  describe("Un paiement confirmé par Stripe marque la commande payée, une seule fois", () => {
    it("US-XXX-1 – Un paiement encaissé est transmis aux commandes", async () => {
      const sut = createSut();

      const resultat = await sut.whenStripeEnvoie(true);

      expect(resultat).toBe("payee");
      sut.thenConfirmationsTransmises(1);
    });

    it("US-XXX-1 – Un événement sans paiement encaissé est ignoré", async () => {
      const sut = createSut();

      const resultat = await sut.whenStripeEnvoie(false);

      expect(resultat).toBe("ignore");
      sut.thenConfirmationsTransmises(0);
    });
  });
});
```

### Unitaires : adapter

Le SDK de Stripe est doublé pour la création de session : l'erreur du service est choisie par le test. Les messages de webhook sont signés avec `generateTestHeaderString` de la bibliothèque Stripe, donc la vérification de signature est réelle. Le secret de test est une simple phrase, sans rapport avec une vraie clé.

<!-- fichier: src/adapters/payment/__tests__/payment.adapter.test.ts -->
```ts
// src/adapters/payment/__tests__/payment.adapter.test.ts
import { ErreurService } from "@src/lib/errors/erreur-service";
import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET_DE_TEST = "secret-de-test-du-webhook";

const etat = vi.hoisted(() => ({ creerSession: vi.fn() }));

// SDK doublé : la création de session répond par la valeur choisie par le test.
vi.mock("stripe", async (importOriginal) => {
  const reel = await importOriginal<typeof import("stripe")>();
  class StripeDouble extends reel.default {
    override checkout = {
      sessions: { create: etat.creerSession },
    } as unknown as Stripe["checkout"];
  }
  return { ...reel, default: StripeDouble };
});
vi.mock("@src/config/env", () => ({
  env: {
    STRIPE_SECRET_KEY: "sk_test_cle-de-test",
    STRIPE_WEBHOOK_SECRET: SECRET_DE_TEST,
  },
}));

const { passerellePaiement } = await import("../payment.adapter");

const outils = new Stripe("sk_test_cle-de-test");

function messageSigne(evenement: object, secret = SECRET_DE_TEST) {
  const corps = JSON.stringify({ object: "event", ...evenement });
  const signature = outils.webhooks.generateTestHeaderString({
    payload: corps,
    secret,
  });
  return { corps, signature };
}

function paiement(
  statut: "paid" | "unpaid",
  type = "checkout.session.completed",
) {
  return {
    id: "evt_001",
    type,
    data: {
      object: {
        payment_status: statut,
        client_reference_id: "commande-1",
        amount_total: 1900,
      },
    },
  };
}

describe("Paiement", () => {
  beforeEach(() => {
    etat.creerSession.mockReset();
  });

  describe("Seuls les messages signés par Stripe sont acceptés", () => {
    it("US-XXX-4 – Un message correctement signé est accepté", () => {
      const { corps, signature } = messageSigne(paiement("paid"));

      const lecture = passerellePaiement.lireEvenement(corps, signature);

      expect(lecture).toEqual({
        ok: true,
        valeur: {
          id: "evt_001",
          type: "checkout.session.completed",
          confirmation: { commandeId: "commande-1", montantCentimes: 1900 },
        },
      });
    });

    it("US-XXX-4 – Un message à la signature fausse est refusé", () => {
      const { corps, signature } = messageSigne(
        paiement("paid"),
        "autre-secret",
      );

      const lecture = passerellePaiement.lireEvenement(corps, signature);

      expect(lecture).toEqual({ ok: false, raison: "signature-invalide" });
    });

    it("US-XXX-4 – Un corps modifié après la signature est refusé", () => {
      const { corps, signature } = messageSigne(paiement("paid"));

      const lecture = passerellePaiement.lireEvenement(
        corps.replace("1900", "100"),
        signature,
      );

      expect(lecture).toEqual({ ok: false, raison: "signature-invalide" });
    });
  });

  describe("Seul un paiement encaissé confirme la commande", () => {
    it("US-XXX-8 – Un paiement différé (non payé) ne confirme rien", () => {
      const { corps, signature } = messageSigne(paiement("unpaid"));

      const lecture = passerellePaiement.lireEvenement(corps, signature);

      expect(lecture.ok && lecture.valeur.confirmation).toBeNull();
    });

    it("US-XXX-8 – Le paiement différé réussi confirme la commande", () => {
      const { corps, signature } = messageSigne(
        paiement("paid", "checkout.session.async_payment_succeeded"),
      );

      const lecture = passerellePaiement.lireEvenement(corps, signature);

      expect(lecture.ok && lecture.valeur.confirmation).toEqual({
        commandeId: "commande-1",
        montantCentimes: 1900,
      });
    });

    it("US-XXX-8 – Un autre type d'événement ne confirme rien", () => {
      const { corps, signature } = messageSigne(paiement("paid", "ping"));

      const lecture = passerellePaiement.lireEvenement(corps, signature);

      expect(lecture.ok && lecture.valeur.confirmation).toBeNull();
    });
  });

  describe("Une panne du service de paiement est signalée comme une panne de service", () => {
    it("US-XXX-7 – Un refus de Stripe lève une erreur de service « paiement » sans donnée personnelle", async () => {
      etat.creerSession.mockRejectedValue(
        Object.assign(
          new Error(
            "Adresse invalide pour camille@exemple.fr (sk_test_cle-de-test)",
          ),
          {
            type: "StripeInvalidRequestError",
            code: "parameter_invalid_empty",
            statusCode: 400,
            requestId: "req_123",
          },
        ),
      );

      const erreur = await passerellePaiement
        .creerSession({
          commandeId: "commande-1",
          offre: {
            libelle: "Accès complet",
            montantCentimes: 1900,
            devise: "eur",
          },
          urlSucces: "https://site.exemple/merci?session_id={SESSION_ID}",
          urlAnnulation: "https://site.exemple/paiement",
        })
        .catch((e: unknown) => e);

      expect(erreur).toBeInstanceOf(ErreurService);
      const service = erreur as ErreurService;
      expect(service.service).toBe("paiement");
      expect(service.message).not.toContain("camille");
      // La cause garde les champs techniques, sans le texte de l'erreur d'origine.
      expect(service.cause).toEqual({
        name: "Error",
        type: "StripeInvalidRequestError",
        code: "parameter_invalid_empty",
        requestId: "req_123",
        statusCode: 400,
      });
      expect(JSON.stringify(service.cause)).not.toContain("camille");
      expect(JSON.stringify(service.cause)).not.toContain("sk_test");
    });

    it("US-XXX-7 – Une session sans adresse de paiement est une panne de service", async () => {
      etat.creerSession.mockResolvedValue({ id: "cs_test_1", url: null });

      const erreur = await passerellePaiement
        .creerSession({
          commandeId: "commande-1",
          offre: {
            libelle: "Accès complet",
            montantCentimes: 1900,
            devise: "eur",
          },
          urlSucces: "https://site.exemple/merci",
          urlAnnulation: "https://site.exemple/paiement",
        })
        .catch((e: unknown) => e);

      expect(erreur).toBeInstanceOf(ErreurService);
    });

    it("US-XXX-6 – La session est ouverte avec le prix du serveur et l'adresse de retour de Stripe", async () => {
      etat.creerSession.mockResolvedValue({
        id: "cs_test_1",
        url: "https://checkout.stripe.com/c/pay/cs_test_1",
      });

      const session = await passerellePaiement.creerSession({
        commandeId: "commande-1",
        offre: {
          libelle: "Accès complet",
          montantCentimes: 1900,
          devise: "eur",
        },
        urlSucces: "https://site.exemple/merci?session_id={SESSION_ID}",
        urlAnnulation: "https://site.exemple/paiement",
      });

      expect(session).toEqual({
        id: "cs_test_1",
        url: "https://checkout.stripe.com/c/pay/cs_test_1",
      });
      expect(etat.creerSession).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "payment",
          client_reference_id: "commande-1",
          success_url:
            "https://site.exemple/merci?session_id={CHECKOUT_SESSION_ID}",
          cancel_url: "https://site.exemple/paiement",
        }),
      );
    });
  });
});
```

### Intégration : repository (Vitest + PGlite)

Le repository reçoit la base de test : aucune doublure de session ni de `getDb()`.

<!-- fichier: src/db/paiement/__tests__/commande.repository.test.ts -->
```ts
// src/db/paiement/__tests__/commande.repository.test.ts
import type { ResultatConfirmation } from "@src/core/paiement/commande.entity";
import { user } from "@src/db/compte/auth.table";
import type { Db } from "@src/db/db-client";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { creerBaseDeTest } from "../../../../tests/helpers/base-de-test";
import { commandeRepository } from "../commande.repository";
import { commande } from "../commande.table";

const OFFRE = {
  libelle: "Accès complet",
  montantCentimes: 1900,
  devise: "eur",
};

function createSut(db: Db) {
  const commandes = commandeRepository(db);
  let commandeId = "";
  let resultats: ResultatConfirmation[] = [];

  return {
    async givenCommandeEnAttenteDeCamille() {
      await db.insert(user).values([
        { id: "camille-id", name: "Camille", email: "camille@exemple.fr" },
        { id: "leo-id", name: "Léo", email: "leo@exemple.fr" },
      ]);
      const creee = await commandes.creer({
        utilisateurId: "camille-id",
        offre: OFFRE,
      });
      commandeId = creee.id;
      await commandes.attacherSession(commandeId, "camille-id", "cs_test_1");
    },
    async whenStripeEnvoie(
      evenementId: string,
      montantCentimes: number,
      nombreDeFois: number,
    ) {
      resultats = [];
      for (let i = 0; i < nombreDeFois; i++) {
        resultats.push(
          await commandes.enregistrerConfirmation({
            evenementId,
            type: "checkout.session.completed",
            commandeId,
            montantCentimes,
          }),
        );
      }
    },
    async whenLeoEssaieDeRelierSaSession() {
      await commandes.attacherSession(commandeId, "leo-id", "cs_pirate");
    },
    async thenStatutEst(statut: "en_attente" | "payee") {
      const [ligne] = await db
        .select()
        .from(commande)
        .where(eq(commande.id, commandeId));
      expect(ligne.statut).toBe(statut);
    },
    thenResultatsSont(attendus: ResultatConfirmation[]) {
      expect(resultats).toEqual(attendus);
    },
    async thenSessionDeCommandeEst(attendue: string) {
      const [ligne] = await db
        .select()
        .from(commande)
        .where(eq(commande.id, commandeId));
      expect(ligne.stripeSessionId).toBe(attendue);
    },
    async thenCommandeVisiblePar(utilisateurId: string, visible: boolean) {
      const ligne = await commandes.trouverParSession(
        "cs_test_1",
        utilisateurId,
      );
      expect(ligne !== null).toBe(visible);
    },
  };
}

describe("Paiement", () => {
  let sut: ReturnType<typeof createSut>;
  let fermer: () => Promise<void>;

  beforeEach(async () => {
    const base = await creerBaseDeTest();
    fermer = base.fermer;
    sut = createSut(base.db);
    await sut.givenCommandeEnAttenteDeCamille();
  });
  afterEach(async () => {
    await fermer();
  });

  describe("Un paiement confirmé par Stripe marque la commande payée, une seule fois", () => {
    it("US-XXX-1 – Paiement de 19 € confirmé : la commande de Camille est payée", async () => {
      await sut.whenStripeEnvoie("evt_001", 1900, 1);
      await sut.thenStatutEst("payee");
    });

    it("US-XXX-2 – Le même événement reçu deux fois est traité une seule fois", async () => {
      await sut.whenStripeEnvoie("evt_002", 1900, 2);
      sut.thenResultatsSont(["payee", "deja_traite"]);
    });
  });

  describe("Le montant payé doit être celui de la commande", () => {
    it("US-XXX-3 – Un montant différent de la commande laisse la commande en attente", async () => {
      await sut.whenStripeEnvoie("evt_003", 100, 1);
      await sut.thenStatutEst("en_attente");
    });
  });

  describe("Une personne accède seulement à ses propres commandes", () => {
    it("US-XXX-9 – Camille retrouve sa commande par la session de paiement", async () => {
      await sut.thenCommandeVisiblePar("camille-id", true);
    });

    it("US-XXX-9 – Léo ne voit pas la commande de Camille", async () => {
      await sut.thenCommandeVisiblePar("leo-id", false);
    });

    it("US-XXX-9 – Léo ne peut pas relier sa session à la commande de Camille", async () => {
      await sut.whenLeoEssaieDeRelierSaSession();
      await sut.thenSessionDeCommandeEst("cs_test_1");
    });
  });
});
```

### Unitaires : webhook

Le test appelle le webhook de la feature avec de vraies signatures. La base, le journal et le use-case sont doublés : le test vérifie les réponses, et que le journal ne reçoit ni le contenu du message ni sa signature.

<!-- fichier: src/features/paiement/webhooks/__tests__/stripe-paiement.webhook.test.ts -->
```ts
// src/features/paiement/webhooks/__tests__/stripe-paiement.webhook.test.ts
import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET_DE_TEST = "secret-de-test-du-webhook";

const etat = vi.hoisted(() => ({
  confirmer: vi.fn(),
  journal: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("@src/config/env", () => ({
  env: {
    STRIPE_SECRET_KEY: "sk_test_cle-de-test",
    STRIPE_WEBHOOK_SECRET: SECRET_DE_TEST,
  },
}));
vi.mock("@src/db/db-client", () => ({ getDb: () => ({}) }));
vi.mock("@src/lib/logger", () => ({ logger: etat.journal }));
vi.mock("@src/core/paiement/use-cases/confirmer-paiement.use-case", () => ({
  confirmerPaiement: etat.confirmer,
}));

const { recevoirWebhookStripe } = await import("../stripe-paiement.webhook");

const outils = new Stripe("sk_test_cle-de-test");
const corps = JSON.stringify({
  id: "evt_001",
  object: "event",
  type: "ping",
  data: { object: { customer_email: "camille@exemple.fr" } },
});

function requete(signature?: string) {
  return new Request("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    body: corps,
    headers: signature ? { "stripe-signature": signature } : {},
  });
}

function signature(secret: string) {
  return outils.webhooks.generateTestHeaderString({ payload: corps, secret });
}

describe("Paiement", () => {
  beforeEach(() => {
    etat.confirmer.mockReset().mockResolvedValue("ignore");
    etat.journal.warn.mockReset();
    etat.journal.info.mockReset();
    etat.journal.error.mockReset();
  });

  describe("Seuls les messages signés par Stripe sont acceptés", () => {
    it("US-XXX-4 – Un message correctement signé est accepté", async () => {
      const reponse = await recevoirWebhookStripe(
        requete(signature(SECRET_DE_TEST)),
      );

      expect(reponse.status).toBe(200);
      expect(etat.confirmer).toHaveBeenCalledOnce();
    });

    it("US-XXX-4 – Un message à la signature fausse est refusé", async () => {
      const reponse = await recevoirWebhookStripe(
        requete(signature("autre-secret")),
      );

      expect(reponse.status).toBe(400);
      expect(etat.confirmer).not.toHaveBeenCalled();
    });

    it("US-XXX-4 – Un message sans signature est refusé", async () => {
      const reponse = await recevoirWebhookStripe(requete());

      expect(reponse.status).toBe(400);
      expect(etat.confirmer).not.toHaveBeenCalled();
    });

    it("US-XXX-4 – Un message refusé n'écrit ni son contenu ni sa signature dans le journal", async () => {
      const fausse = signature("autre-secret");

      await recevoirWebhookStripe(requete(fausse));

      const journal = JSON.stringify([
        etat.journal.warn.mock.calls,
        etat.journal.info.mock.calls,
        etat.journal.error.mock.calls,
      ]);
      expect(journal).toContain("signature invalide");
      expect(journal).not.toContain("camille@exemple.fr");
      expect(journal).not.toContain(fausse);
    });
  });

  describe("Une panne est signalée sans détail", () => {
    it("US-XXX-7 – Une panne de la base répond 500 avec un message générique, et Stripe renverra le message", async () => {
      etat.confirmer.mockRejectedValue(new Error("connexion perdue"));

      const reponse = await recevoirWebhookStripe(
        requete(signature(SECRET_DE_TEST)),
      );

      expect(reponse.status).toBe(500);
      expect(JSON.stringify(await reponse.json())).not.toContain("connexion");
      expect(etat.journal.error).toHaveBeenCalled();
    });
  });
});
```

Le parcours sur la page de Stripe reste un test manuel : cette page appartient à Stripe et peut changer à tout moment.

