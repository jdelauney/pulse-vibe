
### Unitaires

Les contenus d'e-mails sont composés par la classe `EmailsCompte`, sans état : aucune doublure nécessaire.

<!-- fichier: src/core/compte/__tests__/emails-compte.rules.test.ts -->
```ts
// src/core/compte/__tests__/emails-compte.rules.test.ts
import { describe, expect, it } from "vitest";
import { EmailsCompte } from "../emails-compte.rules";

describe("E-mails de compte", () => {
  const emails = new EmailsCompte();

  describe("Une adresse est confirmée par un lien reçu par e-mail avant la première connexion", () => {
    it("US-XXX-1 – L'e-mail de Camille contient son lien de confirmation", () => {
      const url =
        "http://localhost:3000/api/auth/verify-email?token=abc&callbackURL=%2Fcompte";

      const contenu = emails.verificationAdresse({ nom: "Camille", url });

      expect(contenu.sujet).toBe("Confirmez votre adresse e-mail");
      expect(contenu.texte).toContain(url);
      expect(contenu.html).toContain("token=abc&amp;callbackURL=%2Fcompte");
    });
  });

  describe("Un compte se supprime après confirmation par e-mail", () => {
    it("US-XXX-7 – L'e-mail de suppression contient le lien de la page de confirmation", () => {
      const url = "http://localhost:3000/compte/supprimer?token=abc";

      const contenu = emails.confirmationSuppression({ nom: "Camille", url });

      expect(contenu.sujet).toBe("Confirmez la suppression de votre compte");
      expect(contenu.texte).toContain(url);
    });
  });

  describe("Un nom saisi s'affiche comme du texte dans l'e-mail", () => {
    it("US-XXX-4 – Un nom contenant du HTML est neutralisé", () => {
      const contenu = emails.motDePasseOublie({
        nom: "<img src=x onerror=alert(1)>",
        url: "http://localhost:3000/api/auth/reset-password/abc",
      });

      expect(contenu.html).not.toContain("<img");
      expect(contenu.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    });
  });
});
```

Le test de l'échec d'envoi (« L'échec de l'envoi lève une erreur de service « email » sans l'adresse ») est celui du transport, dans la recette `envoi-email`.

### Intégration (Vitest + PGlite)

better-auth tourne sur une base PGlite neuve ; `creerAuth` reçoit une doublure de l'envoyeur (une classe qui implémente `EnvoyeurEmail`) qui garde les messages au lieu de les envoyer, et une doublure du service des mots de passe compromis. Les liens et jetons viennent des e-mails gardés, comme pour une vraie personne.

<!-- fichier: src/adapters/auth/__tests__/auth-email.test.ts -->
```ts
// src/adapters/auth/__tests__/auth-email.test.ts
import type { EnvoyeurEmail, MessageEmail } from "@src/core/email/email.port";
import { session, user } from "@src/db/compte/auth.table";
import type { Db } from "@src/db/db-client";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { creerBaseDeTest } from "../../../../tests/helpers/base-de-test";
import { creerAuth } from "../auth.adapter";

/** Doublure du service d'e-mail : les messages sont gardés au lieu de partir. */
class EnvoyeurEnMemoire implements EnvoyeurEmail {
  readonly envoyes: MessageEmail[] = [];

  async envoyer(message: MessageEmail): Promise<void> {
    this.envoyes.push(message);
  }
}

function createSut() {
  const envoyeur = new EnvoyeurEnMemoire();
  const envoyes = envoyeur.envoyes;
  const optionsDeTest = {
    secret: "secret-de-test-secret-de-test-secret-de-test",
    baseURL: "http://localhost:3000",
    // Doublure de Have I Been Pwned : seul « motdepasse-compromis » a fui.
    motsDePasse: {
      async estCompromis(motDePasse: string) {
        return motDePasse === "motdepasse-compromis";
      },
    },
    envoyeur,
  };
  let auth: ReturnType<typeof creerAuth>;
  let db: Db;
  let fermer: () => Promise<void>;
  let erreur: unknown;
  let reponse: unknown;
  let cookieDeSession = "";

  function dernierMessage(a: string, sujet: string): MessageEmail {
    const message = envoyes.findLast((m) => m.a === a && m.sujet === sujet);
    if (!message) throw new Error(`Aucun e-mail « ${sujet} » envoyé à ${a}`);
    return message;
  }

  function dernierLien(a: string, sujet: string): string {
    const lien = dernierMessage(a, sujet).texte.match(/https?:\/\/\S+/)?.[0];
    if (!lien) throw new Error(`E-mail « ${sujet} » sans lien`);
    return lien;
  }

  function jetonDuLien(lien: string): string {
    const jeton = new URL(lien).pathname.split("/").pop();
    if (!jeton) throw new Error("Lien sans jeton");
    return jeton;
  }

  async function capturer(promesse: Promise<unknown>) {
    erreur = await promesse.then(() => undefined).catch((e: unknown) => e);
  }

  return {
    async demarrer() {
      const base = await creerBaseDeTest();
      db = base.db;
      fermer = base.fermer;
      auth = creerAuth(base.db, optionsDeTest);
    },
    arreter: () => fermer(),
    async givenCompte(email: string, motDePasse: string, confirme: boolean) {
      await auth.api.signUpEmail({
        body: { name: "Camille Martin", email, password: motDePasse },
      });
      if (confirme) {
        const lien = dernierLien(email, "Confirmez votre adresse e-mail");
        const token = new URL(lien).searchParams.get("token");
        await auth.api.verifyEmail({ query: { token: token ?? "" } });
      }
    },
    async givenConnectee(email: string, motDePasse: string) {
      const { headers } = await auth.api.signInEmail({
        body: { email, password: motDePasse },
        returnHeaders: true,
      });
      cookieDeSession = headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; ");
    },
    async whenSeConnecte(email: string, motDePasse: string) {
      await capturer(
        auth.api.signInEmail({ body: { email, password: motDePasse } }),
      );
    },
    async whenOuvreLeLienDeConfirmation(email: string) {
      const lien = dernierLien(email, "Confirmez votre adresse e-mail");
      const token = new URL(lien).searchParams.get("token") ?? "";
      const { headers } = await auth.api.verifyEmail({
        query: { token },
        returnHeaders: true,
      });
      return { token, cookies: headers.getSetCookie().join(" ") };
    },
    async whenDemandeUnLien(email: string) {
      reponse = await auth.api.requestPasswordReset({
        body: { email, redirectTo: "/nouveau-mot-de-passe" },
      });
    },
    async whenChoisitNouveauMotDePasse(email: string, motDePasse: string) {
      const lien = dernierLien(email, "Choisissez un nouveau mot de passe");
      const token = jetonDuLien(lien.split("?")[0]);
      await capturer(
        auth.api.resetPassword({ body: { token, newPassword: motDePasse } }),
      );
      return token;
    },
    async whenReutiliseLeJeton(token: string, motDePasse: string) {
      await capturer(
        auth.api.resetPassword({ body: { token, newPassword: motDePasse } }),
      );
    },
    async whenChangeAdresse(nouvelle: string) {
      reponse = await auth.api.changeEmail({
        body: { newEmail: nouvelle, callbackURL: "/adresse-verifiee" },
        headers: new Headers({ cookie: cookieDeSession }),
      });
    },
    async whenDemandeLaSuppression() {
      reponse = await auth.api.deleteUser({
        body: {},
        headers: new Headers({ cookie: cookieDeSession }),
      });
    },
    async whenConfirmeLaSuppression(email: string, jeton?: string) {
      const lien = dernierLien(
        email,
        "Confirmez la suppression de votre compte",
      );
      await capturer(
        auth.api.deleteUser({
          body: {
            token: jeton ?? new URL(lien).searchParams.get("token") ?? "",
          },
          headers: new Headers({ cookie: cookieDeSession }),
        }),
      );
      return lien;
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
    nombreEmailsA(a: string) {
      return envoyes.filter((m) => m.a === a).length;
    },
    thenAucunEmailA(a: string) {
      expect(envoyes.filter((m) => m.a === a)).toHaveLength(0);
    },
    thenReponseGenerique() {
      expect(reponse).toMatchObject({ status: true });
    },
    async thenCompteAbsent(email: string) {
      const comptes = await db.select().from(user).where(eq(user.email, email));
      expect(comptes).toHaveLength(0);
      expect(await db.select().from(session)).toHaveLength(0);
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

    it("US-XXX-1 – Le lien confirme l'adresse sans ouvrir de session, et vaut 1 heure", async () => {
      await sut.givenCompte("camille@exemple.fr", "motdepasse-solide", false);
      const { token, cookies } =
        await sut.whenOuvreLeLienDeConfirmation("camille@exemple.fr");

      expect(cookies).not.toContain("session_token");
      const charge = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString(),
      ) as { iat: number; exp: number };
      expect(charge.exp - charge.iat).toBe(60 * 60);
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

    it("US-XXX-3 – Un mot de passe paru dans une fuite est refusé", async () => {
      await sut.givenCompte("camille@exemple.fr", "motdepasse-solide", true);
      await sut.whenDemandeUnLien("camille@exemple.fr");
      await sut.whenChoisitNouveauMotDePasse(
        "camille@exemple.fr",
        "motdepasse-compromis",
      );
      sut.thenRefuseAvecLeCode("PASSWORD_COMPROMISED");
    });

    it("US-XXX-3 – Une adresse inconnue reçoit la même réponse, sans e-mail", async () => {
      await sut.whenDemandeUnLien("inconnu@exemple.fr");
      sut.thenReponseGenerique();
      sut.thenAucunEmailA("inconnu@exemple.fr");
    });
  });

  describe("Une nouvelle adresse est confirmée par un lien, l'ancienne est prévenue", () => {
    it("US-XXX-6 – Le lien part vers la nouvelle adresse, l'alerte vers l'ancienne ; le lien change l'adresse", async () => {
      await sut.givenCompte("camille@exemple.fr", "motdepasse-solide", true);
      await sut.givenConnectee("camille@exemple.fr", "motdepasse-solide");

      await sut.whenChangeAdresse("camille.martin@exemple.fr");

      sut.thenReponseGenerique();
      sut.thenDernierEmailA(
        "camille@exemple.fr",
        "Changement de votre adresse e-mail",
      );
      sut.thenDernierEmailA(
        "camille.martin@exemple.fr",
        "Confirmez votre adresse e-mail",
      );
      await sut.whenOuvreLeLienDeConfirmation("camille.martin@exemple.fr");
      await sut.whenSeConnecte(
        "camille.martin@exemple.fr",
        "motdepasse-solide",
      );
      sut.thenAccepte();
    });

    it("US-XXX-6 – Adresse déjà prise : même réponse, aucun e-mail vers elle, l'ancienne est prévenue", async () => {
      await sut.givenCompte("dominique@exemple.fr", "motdepasse-solide", true);
      await sut.givenCompte("camille@exemple.fr", "motdepasse-solide", true);
      await sut.givenConnectee("camille@exemple.fr", "motdepasse-solide");
      const avant = sut.nombreEmailsA("dominique@exemple.fr");

      await sut.whenChangeAdresse("dominique@exemple.fr");

      sut.thenReponseGenerique();
      expect(sut.nombreEmailsA("dominique@exemple.fr")).toBe(avant);
      sut.thenDernierEmailA(
        "camille@exemple.fr",
        "Changement de votre adresse e-mail",
      );
    });
  });

  describe("Un compte se supprime après confirmation par e-mail", () => {
    it("US-XXX-7 – La demande envoie un lien vers la page de confirmation ; le lien supprime le compte et ses sessions", async () => {
      await sut.givenCompte("camille@exemple.fr", "motdepasse-solide", true);
      await sut.givenConnectee("camille@exemple.fr", "motdepasse-solide");

      await sut.whenDemandeLaSuppression();
      const lien = await sut.whenConfirmeLaSuppression("camille@exemple.fr");

      expect(lien).toMatch(
        /^http:\/\/localhost:3000\/compte\/supprimer\?token=/,
      );
      sut.thenAccepte();
      await sut.thenCompteAbsent("camille@exemple.fr");
    });

    it("US-XXX-7 – Un lien inventé ne supprime rien", async () => {
      await sut.givenCompte("camille@exemple.fr", "motdepasse-solide", true);
      await sut.givenConnectee("camille@exemple.fr", "motdepasse-solide");

      await sut.whenDemandeLaSuppression();
      await sut.whenConfirmeLaSuppression(
        "camille@exemple.fr",
        "jeton-invente",
      );

      sut.thenRefuseAvecLeCode("INVALID_TOKEN");
    });
  });
});
```

### Bout en bout (Playwright + Mailpit)

Mailpit doit tourner, et le serveur lancé par Playwright doit utiliser `SMTP_HOST=localhost` et `SMTP_PORT=1025` (valeurs de `.env` en local). En CI, ajoutez le conteneur `axllent/mailpit` comme service, ports 1025 et 8025. Chaque test utilise une adresse unique : les tests restent indépendants sans vider Mailpit.

L'aide `e2e/aides/mailpit.ts` (lecture de Mailpit) vient de la recette `envoi-email`.

`e2e/aides/connexion.ts` remplace celui de la recette `connexion` : un nouveau compte confirme son adresse, puis se connecte, avant d'arriver sur « Mon compte ». Les tests qui appellent `connecterNouvelUtilisateur` continuent de fonctionner.

<!-- fichier: e2e/aides/connexion.ts -->
```ts
// e2e/aides/connexion.ts
import { expect, type Page } from "@playwright/test";
import { emailPour, premierLien } from "./mailpit";

// Mot de passe absent des fuites connues : l'application vérifie chaque nouveau mot de passe.
export const MOT_DE_PASSE_DE_TEST = "essai-Pulse-7k2m-9vq4";

/**
 * Champ visible désigné par son libellé exact.
 * Next.js garde les pages déjà visitées, cachées, dans la page : sans `visible: true`,
 * un libellé présent sur deux pages désigne deux champs.
 */
export function champ(page: Page, libelle: string) {
  return page.getByLabel(libelle, { exact: true }).filter({ visible: true });
}

/** Adresse unique : les tests restent indépendants sans vider Mailpit. */
export function adresseUnique() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@exemple.fr`;
}

/** Crée un compte neuf (adresse unique) sans confirmer l'adresse. */
export async function inscrireNouvelUtilisateur(
  page: Page,
  nom = "Camille Martin",
) {
  const email = adresseUnique();
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

/** Se connecte depuis la page de connexion et attend « Mon compte ». */
export async function seConnecter(
  page: Page,
  email: string,
  motDePasse: string,
) {
  await page.goto("/connexion");
  await champ(page, "Adresse e-mail").fill(email);
  await champ(page, "Mot de passe").fill(motDePasse);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/compte$/);
}

/** Crée un compte neuf, confirme l'adresse avec le lien reçu dans Mailpit, se connecte, et attend « Mon compte ». */
export async function connecterNouvelUtilisateur(
  page: Page,
  nom = "Camille Martin",
) {
  const compte = await inscrireNouvelUtilisateur(page, nom);
  const email = await emailPour(compte.email, "Confirmez votre adresse e-mail");
  await page.goto(premierLien(email.Text));
  await expect(
    page.getByText("Adresse vérifiée, vous pouvez vous connecter."),
  ).toBeVisible();
  await seConnecter(page, compte.email, compte.motDePasse);
  return compte;
}
```

<!-- fichier: e2e/email.spec.ts -->
```ts
// e2e/email.spec.ts
import { expect, test } from "@playwright/test";
import {
  adresseUnique,
  champ,
  connecterNouvelUtilisateur,
  seConnecter,
} from "./aides/connexion";
import { emailPour, premierLien } from "./aides/mailpit";

test.describe("E-mails de compte", () => {
  test("US-XXX-1 – Camille s'inscrit, confirme son adresse, puis se connecte", async ({
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
    await champ(page, "Nouveau mot de passe").fill("nouveau-Pulse-6r2j-8kx3");
    await champ(page, "Confirmez le nouveau mot de passe").fill(
      "nouveau-Pulse-6r2j-8kx3",
    );
    await page.getByRole("button", { name: "Enregistrer" }).click();

    await expect(
      page.getByText("Mot de passe modifié. Connectez-vous."),
    ).toBeVisible();
  });

  test("US-XXX-6 – Camille change d'adresse : le lien arrive à la nouvelle, l'alerte à l'ancienne", async ({
    page,
  }) => {
    const { email, motDePasse } = await connecterNouvelUtilisateur(page);
    const nouvelle = adresseUnique();

    await champ(page, "Nouvelle adresse e-mail").fill(nouvelle);
    await page.getByRole("button", { name: "Changer mon adresse" }).click();
    await expect(page.getByText(/Ouvrez l'e-mail envoyé/)).toBeVisible();
    await emailPour(email, "Changement de votre adresse e-mail");
    const lien = await emailPour(nouvelle, "Confirmez votre adresse e-mail");
    await page.goto(premierLien(lien.Text));
    await expect(
      page.getByText("Adresse vérifiée, vous pouvez vous connecter."),
    ).toBeVisible();

    await page.goto("/compte");
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/connexion$/);
    await seConnecter(page, nouvelle, motDePasse);
    await expect(
      page.getByText(`Adresse actuelle : ${nouvelle}`),
    ).toBeVisible();
  });

  test("US-XXX-7 – Camille supprime son compte après confirmation par e-mail", async ({
    page,
  }) => {
    const { email, motDePasse } = await connecterNouvelUtilisateur(page);

    await page.getByRole("button", { name: "Supprimer mon compte" }).click();
    await expect(page.getByText(/Un e-mail de confirmation/)).toBeVisible();
    const recu = await emailPour(
      email,
      "Confirmez la suppression de votre compte",
    );
    await page.goto(premierLien(recu.Text));
    await page
      .getByRole("button", { name: "Supprimer définitivement" })
      .click();
    await expect(page).toHaveURL(/\/compte-supprime$/);
    await expect(
      page.getByText("Votre compte et vos données sont effacés."),
    ).toBeVisible();

    await page.goto("/connexion");
    await champ(page, "Adresse e-mail").fill(email);
    await champ(page, "Mot de passe").fill(motDePasse);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(
      page.getByText("Adresse e-mail ou mot de passe incorrect."),
    ).toBeVisible();
  });
});
```
