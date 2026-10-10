
### Unitaires

Les contenus d'e-mails sont des fonctions pures : aucun double nécessaire.

<!-- fichier: src/core/compte/__tests__/emails-compte.rules.test.ts -->
```ts
// src/core/compte/__tests__/emails-compte.rules.test.ts
import { describe, expect, it } from "vitest";
import {
  emailMotDePasseOublie,
  emailVerificationAdresse,
} from "../emails-compte.rules";

describe("E-mails de compte", () => {
  describe("Une adresse est confirmée par un lien reçu par e-mail avant la première connexion", () => {
    it("US-XXX-1 – L'e-mail de Camille contient son lien de confirmation", () => {
      const url =
        "http://localhost:3000/api/auth/verify-email?token=abc&callbackURL=%2Fcompte";

      const contenu = emailVerificationAdresse({ nom: "Camille", url });

      expect(contenu.sujet).toBe("Confirmez votre adresse e-mail");
      expect(contenu.texte).toContain(url);
      expect(contenu.html).toContain("token=abc&amp;callbackURL=%2Fcompte");
    });
  });

  describe("Un nom saisi s'affiche comme du texte dans l'e-mail", () => {
    it("US-XXX-4 – Un nom contenant du HTML est neutralisé", () => {
      const contenu = emailMotDePasseOublie({
        nom: "<img src=x onerror=alert(1)>",
        url: "http://localhost:3000/api/auth/reset-password/abc",
      });

      expect(contenu.html).not.toContain("<img");
      expect(contenu.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    });
  });
});
```

### Adapter `email` (Vitest, Nodemailer doublé)

Nodemailer est doublé et refuse l'envoi, comme un serveur qui rejette le destinataire. L'erreur levée garde ses codes techniques, sans le texte du refus ni l'adresse.

<!-- fichier: src/adapters/email/__tests__/email.adapter.test.ts -->
```ts
// src/adapters/email/__tests__/email.adapter.test.ts
import { ErreurService } from "@src/lib/errors/erreur-service";
import { describe, expect, it, vi } from "vitest";

// Serveur SMTP doublé : l'envoi échoue, comme avec un serveur éteint.
vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: vi.fn().mockRejectedValue(
        Object.assign(new Error("550 5.1.1 <camille@exemple.fr> inconnue"), {
          code: "EENVELOPE",
          command: "RCPT TO",
          responseCode: 550,
        }),
      ),
    }),
  },
}));
vi.mock("@src/config/env", () => ({
  env: {
    SMTP_HOST: "localhost",
    SMTP_PORT: 1025,
    MAIL_FROM: "Mon projet <ne-pas-repondre@exemple.fr>",
  },
}));

describe("Envoi d'e-mails", () => {
  describe("Un serveur d'e-mail en panne est signalé comme une panne de service", () => {
    it("US-XXX-5 – L'échec de l'envoi lève une erreur de service « email » sans l'adresse", async () => {
      const { envoyerEmail } = await import("../email.adapter");

      const erreur = await envoyerEmail({
        a: "camille@exemple.fr",
        sujet: "Bonjour",
        texte: "Bonjour",
      }).catch((e: unknown) => e);

      expect(erreur).toBeInstanceOf(ErreurService);
      expect((erreur as ErreurService).service).toBe("email");
      const service = erreur as ErreurService;
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

### Intégration (Vitest + PGlite)

better-auth tourne sur une base PGlite neuve ; `creerAuth` reçoit une doublure de l'envoi qui garde les messages au lieu de les envoyer. Les liens et jetons viennent des e-mails gardés, comme pour une vraie personne.

<!-- fichier: src/adapters/auth/__tests__/auth-email.test.ts -->
```ts
// src/adapters/auth/__tests__/auth-email.test.ts
import type { MessageEmail } from "@src/core/compte/email.port";
import { APIError } from "better-auth/api";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { creerBaseDeTest } from "../../../../tests/helpers/base-de-test";
import { creerAuth } from "../auth.adapter";

function createSut() {
  // Doublure du service d'e-mail : les messages sont gardés au lieu de partir.
  const envoyes: MessageEmail[] = [];
  const optionsDeTest = {
    secret: "secret-de-test-secret-de-test-secret-de-test",
    baseURL: "http://localhost:3000",
    envoyerEmail: async (message: MessageEmail) => {
      envoyes.push(message);
    },
  };
  let auth: ReturnType<typeof creerAuth>;
  let fermer: () => Promise<void>;
  let erreur: unknown;
  let reponse: unknown;

  function dernierLien(a: string): string {
    const message = envoyes.findLast((m) => m.a === a);
    const lien = message?.texte.match(/https?:\/\/\S+/)?.[0];
    if (!lien) throw new Error(`Aucun lien envoyé à ${a}`);
    return lien;
  }

  function jetonDuLien(lien: string): string {
    const jeton = new URL(lien).pathname.split("/").pop();
    if (!jeton) throw new Error("Lien sans jeton");
    return jeton;
  }

  return {
    async demarrer() {
      const base = await creerBaseDeTest();
      fermer = base.fermer;
      auth = creerAuth(base.db, optionsDeTest);
    },
    arreter: () => fermer(),
    async givenCompte(email: string, motDePasse: string, confirme: boolean) {
      await auth.api.signUpEmail({
        body: { name: "Camille Martin", email, password: motDePasse },
      });
      if (confirme) {
        const token = new URL(dernierLien(email)).searchParams.get("token");
        await auth.api.verifyEmail({ query: { token: token ?? "" } });
      }
    },
    async whenSeConnecte(email: string, motDePasse: string) {
      erreur = await auth.api
        .signInEmail({ body: { email, password: motDePasse } })
        .then(() => undefined)
        .catch((e: unknown) => e);
    },
    async whenDemandeUnLien(email: string) {
      reponse = await auth.api.requestPasswordReset({
        body: { email, redirectTo: "/nouveau-mot-de-passe" },
      });
    },
    async whenChoisitNouveauMotDePasse(email: string, motDePasse: string) {
      const token = jetonDuLien(dernierLien(email).split("?")[0]);
      erreur = await auth.api
        .resetPassword({ body: { token, newPassword: motDePasse } })
        .then(() => undefined)
        .catch((e: unknown) => e);
      return token;
    },
    async whenReutiliseLeJeton(token: string, motDePasse: string) {
      erreur = await auth.api
        .resetPassword({ body: { token, newPassword: motDePasse } })
        .then(() => undefined)
        .catch((e: unknown) => e);
    },
    thenRefuseAvecLeCode(code: string) {
      expect(erreur).toBeInstanceOf(APIError);
      expect((erreur as APIError).body?.code).toBe(code);
    },
    thenAccepte() {
      expect(erreur).toBeUndefined();
    },
    thenDernierEmailA(a: string, sujet: string) {
      expect(envoyes.findLast((m) => m.a === a)?.sujet).toBe(sujet);
    },
    thenAucunEmailA(a: string) {
      expect(envoyes.filter((m) => m.a === a)).toHaveLength(0);
    },
    thenReponseGenerique() {
      expect(reponse).toMatchObject({ status: true });
    },
  };
}

describe("E-mails de compte", () => {
  let sut: ReturnType<typeof createSut>;
  beforeEach(async () => {
    sut = createSut();
    await sut.demarrer();
  });
  afterEach(async () => {
    await sut.arreter();
  });

  describe("Une adresse est confirmée par un lien reçu par e-mail avant la première connexion", () => {
    it("US-XXX-1 – Adresse non confirmée : la connexion est refusée et un nouvel e-mail part", async () => {
      await sut.givenCompte("camille@exemple.fr", "motdepasse-solide", false);
      await sut.whenSeConnecte("camille@exemple.fr", "motdepasse-solide");
      sut.thenRefuseAvecLeCode("EMAIL_NOT_VERIFIED");
      sut.thenDernierEmailA(
        "camille@exemple.fr",
        "Confirmez votre adresse e-mail",
      );
    });

    it("US-XXX-1 – Adresse confirmée par le lien : la connexion est acceptée", async () => {
      await sut.givenCompte("camille@exemple.fr", "motdepasse-solide", true);
      await sut.whenSeConnecte("camille@exemple.fr", "motdepasse-solide");
      sut.thenAccepte();
    });
  });

  describe("Une inscription avec une adresse déjà prise ne révèle rien", () => {
    it("US-XXX-2 – La propriétaire de l'adresse est prévenue par e-mail", async () => {
      await sut.givenCompte("camille@exemple.fr", "motdepasse-solide", true);
      await sut.givenCompte("camille@exemple.fr", "autre-mot-de-passe", false);
      sut.thenDernierEmailA("camille@exemple.fr", "Votre compte existe déjà");
    });
  });

  describe("Un mot de passe oublié se remplace grâce à un lien valable 1 heure", () => {
    it("US-XXX-3 – Camille choisit un nouveau mot de passe et se connecte avec", async () => {
      await sut.givenCompte("camille@exemple.fr", "motdepasse-solide", true);
      await sut.whenDemandeUnLien("camille@exemple.fr");
      await sut.whenChoisitNouveauMotDePasse(
        "camille@exemple.fr",
        "nouveau-secret-42",
      );
      await sut.whenSeConnecte("camille@exemple.fr", "nouveau-secret-42");
      sut.thenAccepte();
    });

    it("US-XXX-3 – Un lien déjà utilisé ne sert plus", async () => {
      await sut.givenCompte("camille@exemple.fr", "motdepasse-solide", true);
      await sut.whenDemandeUnLien("camille@exemple.fr");
      const token = await sut.whenChoisitNouveauMotDePasse(
        "camille@exemple.fr",
        "nouveau-secret-42",
      );
      await sut.whenReutiliseLeJeton(token, "encore-un-autre-42");
      sut.thenRefuseAvecLeCode("INVALID_TOKEN");
    });

    it("US-XXX-3 – Une adresse inconnue reçoit la même réponse, sans e-mail", async () => {
      await sut.whenDemandeUnLien("inconnu@exemple.fr");
      sut.thenReponseGenerique();
      sut.thenAucunEmailA("inconnu@exemple.fr");
    });
  });
});
```

### Bout en bout (Playwright + Mailpit)

Mailpit doit tourner, et le serveur lancé par Playwright doit utiliser `SMTP_HOST=localhost` et `SMTP_PORT=1025` (valeurs de `.env` en local). En CI, ajoutez le conteneur `axllent/mailpit` comme service, ports 1025 et 8025. Chaque test utilise une adresse unique : les tests restent indépendants sans vider Mailpit.

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

`e2e/aides/connexion.ts` remplace celui de la recette `connexion` : un nouveau compte confirme son adresse avant d'arriver sur « Mon compte ». Les tests qui appellent `connecterNouvelUtilisateur` continuent de fonctionner.

<!-- fichier: e2e/aides/connexion.ts -->
```ts
// e2e/aides/connexion.ts
import { expect, type Page } from "@playwright/test";
import { emailPour, premierLien } from "./mailpit";

export const MOT_DE_PASSE_DE_TEST = "motdepasse-de-test";

/**
 * Champ visible désigné par son libellé exact.
 * Next.js garde les pages déjà visitées, cachées, dans la page : sans `visible: true`,
 * un libellé présent sur deux pages désigne deux champs.
 */
export function champ(page: Page, libelle: string) {
  return page.getByLabel(libelle, { exact: true }).filter({ visible: true });
}

/** Crée un compte neuf (adresse unique) sans confirmer l'adresse. */
export async function inscrireNouvelUtilisateur(
  page: Page,
  nom = "Camille Martin",
) {
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@exemple.fr`;
  await page.goto("/inscription");
  await champ(page, "Nom").fill(nom);
  await champ(page, "Adresse e-mail").fill(email);
  await champ(page, "Mot de passe (8 caractères au moins)").fill(
    MOT_DE_PASSE_DE_TEST,
  );
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText(/Ouvrez l'e-mail/)).toBeVisible();
  return { nom, email, motDePasse: MOT_DE_PASSE_DE_TEST };
}

/** Crée un compte neuf, confirme l'adresse avec le lien reçu dans Mailpit, et attend « Mon compte ». */
export async function connecterNouvelUtilisateur(
  page: Page,
  nom = "Camille Martin",
) {
  const compte = await inscrireNouvelUtilisateur(page, nom);
  const email = await emailPour(compte.email, "Confirmez votre adresse e-mail");
  await page.goto(premierLien(email.Text));
  await expect(page).toHaveURL(/\/compte$/);
  return compte;
}
```

<!-- fichier: e2e/email.spec.ts -->
```ts
// e2e/email.spec.ts
import { expect, test } from "@playwright/test";
import { champ, connecterNouvelUtilisateur } from "./aides/connexion";
import { emailPour, premierLien } from "./aides/mailpit";

test.describe("E-mails de compte", () => {
  test("US-XXX-1 – Camille s'inscrit puis confirme son adresse : elle arrive sur son compte", async ({
    page,
  }) => {
    await connecterNouvelUtilisateur(page, "Camille Martin");

    await expect(
      page.getByText("Connecté en tant que Camille Martin"),
    ).toBeVisible();
  });

  test("US-XXX-3 – Camille choisit un nouveau mot de passe depuis l'e-mail reçu", async ({
    page,
  }) => {
    const { email } = await connecterNouvelUtilisateur(page);
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/connexion$/);

    await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
    // Attendre la nouvelle page : la page de connexion a aussi un champ « Adresse e-mail ».
    await expect(
      page.getByRole("heading", { name: "Mot de passe oublié" }),
    ).toBeVisible();
    await champ(page, "Adresse e-mail").fill(email);
    await page.getByRole("button", { name: "Recevoir un lien" }).click();
    await expect(page.getByText(/Si un compte existe/)).toBeVisible();
    const recu = await emailPour(email, "Choisissez un nouveau mot de passe");
    await page.goto(premierLien(recu.Text));
    await champ(page, "Nouveau mot de passe").fill("nouveau-secret-42");
    await champ(page, "Confirmez le nouveau mot de passe").fill(
      "nouveau-secret-42",
    );
    await page.getByRole("button", { name: "Enregistrer" }).click();

    await expect(
      page.getByText("Mot de passe modifié. Connectez-vous."),
    ).toBeVisible();
  });
});
```

