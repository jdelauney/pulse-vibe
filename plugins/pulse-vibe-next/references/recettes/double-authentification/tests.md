### Unitaire (contenu de l'e-mail)

<!-- fichier: src/core/compte/__tests__/code-de-connexion.rules.test.ts -->
```ts
// src/core/compte/__tests__/code-de-connexion.rules.test.ts
import { describe, expect, it } from "vitest";
import { EmailsCompte } from "../emails-compte.rules";

describe("E-mail du code de connexion", () => {
  it("US-XXX-1 – Le code figure dans le corps, jamais dans l'objet", () => {
    const contenu = new EmailsCompte().codeDeConnexion({
      nom: "Camille",
      code: "482913",
    });

    expect(contenu.sujet).toBe("Votre code de connexion");
    expect(contenu.sujet).not.toContain("482913");
    expect(contenu.texte).toContain("482913");
  });
});
```

### Intégration (Vitest + PGlite)

better-auth tourne sur une base PGlite neuve, avec le plugin et les migrations du projet ; l'envoyeur d'e-mails est une doublure qui garde les messages : le code se lit dans l'e-mail gardé, comme pour une vraie personne. Les cookies passent d'une étape à l'autre comme dans un navigateur.

<!-- fichier: src/adapters/auth/__tests__/auth-double-authentification.test.ts -->
```ts
// src/adapters/auth/__tests__/auth-double-authentification.test.ts
import type { EnvoyeurEmail, MessageEmail } from "@src/core/email/email.port";
import { user } from "@src/db/compte/auth.table";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { creerBaseDeTest } from "../../../../tests/helpers/base-de-test";
import { creerAuth } from "../auth.adapter";

class EnvoyeurEnMemoire implements EnvoyeurEmail {
  readonly envoyes: MessageEmail[] = [];

  async envoyer(message: MessageEmail): Promise<void> {
    this.envoyes.push(message);
  }
}

/** Les cookies posés par une réponse, à renvoyer comme un navigateur (les cookies effacés partent vides). */
function cookiesDe(reponse: Headers): string {
  return reponse
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

const EMAIL = "camille@exemple.fr";
const MOT_DE_PASSE = "motdepasse-solide";

function createSut() {
  const envoyeur = new EnvoyeurEnMemoire();
  let auth: ReturnType<typeof creerAuth>;
  let fermer: () => Promise<void>;
  let erreur: unknown;
  let cookieDeSession = "";
  let cookieDuCode = "";

  async function capturer<T>(promesse: Promise<T>): Promise<T | undefined> {
    erreur = undefined;
    return promesse.catch((e: unknown) => {
      erreur = e;
      return undefined;
    });
  }

  function dernierCode(): string {
    const message = envoyeur.envoyes.findLast(
      (m) => m.a === EMAIL && m.sujet === "Votre code de connexion",
    );
    const code = message?.texte.match(/\b\d{6}\b/)?.[0];
    if (!code) throw new Error("Aucun code envoyé");
    return code;
  }

  return {
    async demarrer() {
      const base = await creerBaseDeTest();
      fermer = base.fermer;
      auth = creerAuth(base.db, {
        secret: "secret-de-test-secret-de-test-secret-de-test",
        baseURL: "http://localhost:3000",
        motsDePasse: {
          async estCompromis() {
            return false;
          },
        },
        envoyeur,
      });
      await auth.api.signUpEmail({
        body: { name: "Camille Martin", email: EMAIL, password: MOT_DE_PASSE },
      });
      await base.db
        .update(user)
        .set({ emailVerified: true })
        .where(eq(user.email, EMAIL));
    },
    arreter: () => fermer(),
    async givenConnectee() {
      const { headers } = await auth.api.signInEmail({
        body: { email: EMAIL, password: MOT_DE_PASSE },
        returnHeaders: true,
      });
      cookieDeSession = cookiesDe(headers);
    },
    async givenDoubleAuthentificationActive() {
      await this.givenConnectee();
      await auth.api.enableTwoFactor({
        body: { password: MOT_DE_PASSE, method: "otp" },
        headers: new Headers({ cookie: cookieDeSession }),
      });
    },
    async whenActive(motDePasse: string) {
      await capturer(
        auth.api.enableTwoFactor({
          body: { password: motDePasse, method: "otp" },
          headers: new Headers({ cookie: cookieDeSession }),
        }),
      );
    },
    async whenDesactive(motDePasse: string) {
      const resultat = await capturer(
        auth.api.signInEmail({
          body: { email: EMAIL, password: MOT_DE_PASSE },
          returnHeaders: true,
        }),
      );
      cookieDuCode = resultat ? cookiesDe(resultat.headers) : "";
      await auth.api.sendTwoFactorOTP({
        headers: new Headers({ cookie: cookieDuCode }),
      });
      const session = await auth.api.verifyTwoFactorOTP({
        body: { code: dernierCode() },
        headers: new Headers({ cookie: cookieDuCode }),
        returnHeaders: true,
      });
      await capturer(
        auth.api.disableTwoFactor({
          body: { password: motDePasse },
          headers: new Headers({ cookie: cookiesDe(session.headers) }),
        }),
      );
    },
    async whenSeConnecte() {
      const resultat = await auth.api.signInEmail({
        body: { email: EMAIL, password: MOT_DE_PASSE },
        returnHeaders: true,
      });
      cookieDuCode = cookiesDe(resultat.headers);
      await auth.api.sendTwoFactorOTP({
        headers: new Headers({ cookie: cookieDuCode }),
      });
      return resultat.response;
    },
    async whenDonneSonMotDePasse() {
      return auth.api.signInEmail({
        body: { email: EMAIL, password: MOT_DE_PASSE },
      });
    },
    async whenSaisitLeCode(code: string) {
      const resultat = await capturer(
        auth.api.verifyTwoFactorOTP({
          body: { code },
          headers: new Headers({ cookie: cookieDuCode }),
          returnHeaders: true,
        }),
      );
      return resultat ? cookiesDe(resultat.headers) : "";
    },
    dernierCode,
    async estActive() {
      const session = await auth.api.getSession({
        headers: new Headers({ cookie: cookieDeSession }),
      });
      return session?.user.twoFactorEnabled === true;
    },
    thenRefuseAvecLeCode(code: string) {
      expect(erreur).toBeInstanceOf(APIError);
      expect((erreur as APIError).body?.code).toBe(code);
    },
    thenAccepte() {
      expect(erreur).toBeUndefined();
    },
  };
}

describe("Double authentification par code envoyé par e-mail", () => {
  let sut: ReturnType<typeof createSut>;
  beforeEach(async () => {
    sut = createSut();
    await sut.demarrer();
  });
  afterEach(async () => {
    await sut.arreter();
  });

  describe("Avec la double authentification, le mot de passe seul n'ouvre pas de session", () => {
    it("US-XXX-1 – Le mot de passe mène au code ; le bon code ouvre la session", async () => {
      await sut.givenDoubleAuthentificationActive();

      const reponse = await sut.whenSeConnecte();
      expect(reponse).toMatchObject({ twoFactorRedirect: true });
      const cookies = await sut.whenSaisitLeCode(sut.dernierCode());

      sut.thenAccepte();
      expect(cookies).toMatch(/session_token=[^;\s]+/);
    });

    it("US-XXX-1 – Un code faux est refusé", async () => {
      await sut.givenDoubleAuthentificationActive();
      await sut.whenSeConnecte();
      const bon = sut.dernierCode();

      await sut.whenSaisitLeCode(bon === "000000" ? "111111" : "000000");

      sut.thenRefuseAvecLeCode("INVALID_CODE");
    });

    it("US-XXX-2 – Après 5 codes faux, même le bon code est refusé : il faut en demander un nouveau", async () => {
      await sut.givenDoubleAuthentificationActive();
      await sut.whenSeConnecte();
      const bon = sut.dernierCode();
      const faux = bon === "000000" ? "111111" : "000000";
      for (let i = 0; i < 5; i++) {
        await sut.whenSaisitLeCode(faux);
      }

      await sut.whenSaisitLeCode(bon);

      sut.thenRefuseAvecLeCode("TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE");
    });

    it("US-XXX-1 – Sans double authentification, le mot de passe suffit", async () => {
      const reponse = await sut.whenDonneSonMotDePasse();

      expect(reponse).not.toHaveProperty("twoFactorRedirect");
      expect(reponse).toHaveProperty("token");
    });
  });

  describe("Activer et désactiver demandent le mot de passe", () => {
    it("US-XXX-3 – Mauvais mot de passe : rien n'est activé", async () => {
      await sut.givenConnectee();

      await sut.whenActive("mauvais-mot-de-passe");

      sut.thenRefuseAvecLeCode("INVALID_PASSWORD");
      expect(await sut.estActive()).toBe(false);
    });

    it("US-XXX-3 – Désactiver avec un mauvais mot de passe est refusé, avec le bon accepté", async () => {
      await sut.givenDoubleAuthentificationActive();

      await sut.whenDesactive("mauvais-mot-de-passe");
      sut.thenRefuseAvecLeCode("INVALID_PASSWORD");

      await sut.whenDesactive(MOT_DE_PASSE);
      sut.thenAccepte();
    });
  });
});
```

Les chemins `/two-factor/…` du plugin sont couverts par le test « seuls les chemins de lecture restent ouverts » de la recette `connexion` : il échoue si l'un d'eux reste ouvert.

### Bout en bout (Playwright + Mailpit)

Mailpit doit tourner (recette `envoi-email`). Le parcours active la double authentification sur un compte neuf, se reconnecte et lit le code dans Mailpit.

<!-- fichier: e2e/double-authentification.spec.ts -->
```ts
// e2e/double-authentification.spec.ts
import { expect, test } from "@playwright/test";
import { champ, connecterNouvelUtilisateur } from "./aides/connexion";
import { emailPour } from "./aides/mailpit";

test.describe("Double authentification", () => {
  test("US-XXX-1 – Camille active la double authentification, puis se connecte avec le code reçu", async ({
    page,
  }) => {
    const { email, motDePasse } = await connecterNouvelUtilisateur(page);
    await champ(page, "Mot de passe du compte").fill(motDePasse);
    await page
      .getByRole("button", { name: "Activer la double authentification" })
      .click();
    await expect(page.getByText(/^Active : un code/)).toBeVisible();

    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/connexion$/);
    await champ(page, "Adresse e-mail").fill(email);
    await champ(page, "Mot de passe").fill(motDePasse);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(
      page.getByRole("heading", { name: "Code de connexion" }),
    ).toBeVisible();

    const recu = await emailPour(email, "Votre code de connexion");
    const code = recu.Text.match(/\b\d{6}\b/)?.[0] ?? "";
    await champ(page, "Code reçu par e-mail").fill(code);
    await page.getByRole("button", { name: "Valider" }).click();
    await expect(page).toHaveURL(/\/compte$/);
  });
});
```

Commandes : `npm test` (unitaires et intégration), `npm run test:e2e` (bout en bout, Mailpit lancé).
