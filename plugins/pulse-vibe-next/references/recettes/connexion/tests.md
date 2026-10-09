
### Intégration (Vitest + PGlite)

better-auth tourne sur une base PGlite neuve, avec les migrations du projet. `creerAuth` reçoit cette base : aucune variable d'environnement n'est lue.

<!-- fichier: src/adapters/auth/__tests__/auth.adapter.test.ts -->
```ts
// src/adapters/auth/__tests__/auth.adapter.test.ts
import { account } from "@src/db/compte/auth.table";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { creerBaseDeTest } from "../../../../tests/helpers/base-de-test";
import { type Auth, creerAuth } from "../auth.adapter";

type BaseDeTest = Awaited<ReturnType<typeof creerBaseDeTest>>;

const optionsDeTest = {
  secret: "secret-de-test-secret-de-test-secret-de-test",
  baseURL: "http://localhost:3000",
};

describe("connexion par e-mail et mot de passe", () => {
  let base: BaseDeTest;
  let auth: Auth;

  beforeEach(async () => {
    base = await creerBaseDeTest();
    auth = creerAuth(base.db, optionsDeTest);
  });
  afterEach(async () => {
    await base.fermer();
  });

  async function inscrireCamille() {
    return auth.api.signUpEmail({
      body: {
        name: "Camille Martin",
        email: "camille@exemple.fr",
        password: "motdepasse-solide",
      },
    });
  }

  it("US-XXX-1 – l'inscription crée un compte et ne garde pas le mot de passe en clair", async () => {
    const resultat = await inscrireCamille();

    expect(resultat.user.email).toBe("camille@exemple.fr");
    const [compte] = await base.db
      .select()
      .from(account)
      .where(eq(account.userId, resultat.user.id));
    expect(compte.password).toBeTruthy();
    expect(compte.password).not.toContain("motdepasse-solide");
  });

  it("US-XXX-2 – une deuxième inscription avec la même adresse est refusée", async () => {
    await inscrireCamille();
    const erreur = await inscrireCamille().catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(APIError);
    expect((erreur as APIError).body?.code).toBe(
      "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
    );
  });

  it("US-XXX-3 – la connexion avec un mauvais mot de passe est refusée", async () => {
    await inscrireCamille();
    const erreur = await auth.api
      .signInEmail({
        body: { email: "camille@exemple.fr", password: "mauvais-mot-de-passe" },
      })
      .catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(APIError);
    expect((erreur as APIError).status).toBe("UNAUTHORIZED");
  });

  it("US-XXX-4 – changer son mot de passe : l'ancien ne marche plus, le nouveau oui", async () => {
    await inscrireCamille();
    const { headers: reponse } = await auth.api.signInEmail({
      body: { email: "camille@exemple.fr", password: "motdepasse-solide" },
      returnHeaders: true,
    });
    const cookie = reponse.get("set-cookie") ?? "";
    const enTetes = new Headers({ cookie: cookie.split(";")[0] });

    const mauvais = await auth.api
      .changePassword({
        body: {
          currentPassword: "faux",
          newPassword: "nouveau-mot-de-passe",
          revokeOtherSessions: true,
        },
        headers: enTetes,
      })
      .catch((e: unknown) => e);
    expect((mauvais as APIError).body?.code).toBe("INVALID_PASSWORD");

    await auth.api.changePassword({
      body: {
        currentPassword: "motdepasse-solide",
        newPassword: "nouveau-mot-de-passe",
        revokeOtherSessions: true,
      },
      headers: enTetes,
    });

    await expect(
      auth.api.signInEmail({
        body: { email: "camille@exemple.fr", password: "motdepasse-solide" },
      }),
    ).rejects.toBeInstanceOf(APIError);
    const ok = await auth.api.signInEmail({
      body: { email: "camille@exemple.fr", password: "nouveau-mot-de-passe" },
    });
    expect(ok.user.email).toBe("camille@exemple.fr");
  });
});

describe("chemins HTTP fermés", () => {
  it("US-XXX-2 – l'inscription directe par l'adresse HTTP de better-auth est refusée", async () => {
    const { db, fermer } = await creerBaseDeTest();
    const auth = creerAuth(db, optionsDeTest);
    const reponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          name: "x".repeat(10_000),
          email: "b@exemple.fr",
          password: "motdepasse-solide",
        }),
      }),
    );
    expect(reponse.status).toBe(404);
    await fermer();
  });
});
```

### Unitaires (schémas)

Un test par ligne du plan « Une saisie invalide… » et un pour « Confirmation différente ».

<!-- fichier: src/features/compte/schemas/__tests__/compte.schema.test.ts -->
```ts
// src/features/compte/schemas/__tests__/compte.schema.test.ts
import { describe, expect, it } from "vitest";
import {
  schemaChangementMotDePasse,
  schemaInscription,
} from "../compte.schema";

const inscriptionValide = {
  nom: "Camille Martin",
  email: "camille@exemple.fr",
  motDePasse: "motdepasse-solide",
};

describe("Schéma d'inscription", () => {
  it.each([
    ["le nom", { nom: "" }, "Indiquez votre nom."],
    ["l'adresse", { email: "camille@" }, "Adresse e-mail invalide."],
    ["le mot de passe", { motDePasse: "court" }, "8 caractères au moins."],
  ])(
    "US-XXX-2 – Une saisie invalide est refusée : %s",
    (_champ, saisie, message) => {
      const resultat = schemaInscription.safeParse({
        ...inscriptionValide,
        ...saisie,
      });
      expect(resultat.error?.issues[0]?.message).toBe(message);
    },
  );
});

describe("Schéma de changement de mot de passe", () => {
  it("US-XXX-4 – Confirmation différente : le changement est refusé", () => {
    const resultat = schemaChangementMotDePasse.safeParse({
      motDePasseActuel: "motdepasse-solide",
      nouveauMotDePasse: "nouveau-mot-de-passe",
      confirmation: "nouveau-mot-de-passx",
    });
    expect(resultat.error?.issues[0]).toMatchObject({
      message: "Les deux mots de passe sont différents.",
      path: ["confirmation"],
    });
  });
});
```

### Bout en bout (Playwright)

L'aide `connecterNouvelUtilisateur(page)` sert aussi aux autres recettes (`liste`, par exemple).

<!-- fichier: e2e/aides/connexion.ts -->
```ts
// e2e/aides/connexion.ts
import { expect, type Page } from "@playwright/test";

export const MOT_DE_PASSE_DE_TEST = "motdepasse-de-test";

/**
 * Champ visible désigné par son libellé exact.
 * Next.js garde les pages déjà visitées, cachées, dans la page : sans `visible: true`,
 * un libellé présent sur deux pages désigne deux champs.
 */
export function champ(page: Page, libelle: string) {
  return page.getByLabel(libelle, { exact: true }).filter({ visible: true });
}

/** Crée un compte neuf (adresse unique), le connecte, et attend la page « Mon compte ». */
export async function connecterNouvelUtilisateur(
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
  await expect(page).toHaveURL(/\/compte$/);
  return { nom, email, motDePasse: MOT_DE_PASSE_DE_TEST };
}
```

<!-- fichier: e2e/compte.spec.ts -->
```ts
// e2e/compte.spec.ts
import { expect, test } from "@playwright/test";
import { champ, connecterNouvelUtilisateur } from "./aides/connexion";

test.describe("Compte", () => {
  test("US-XXX-1 – après l'inscription, « Mon compte » affiche le nom", async ({
    page,
  }) => {
    await connecterNouvelUtilisateur(page, "Camille Martin");
    await expect(
      page.getByText("Connecté en tant que Camille Martin"),
    ).toBeVisible();
  });

  test("US-XXX-3 – sans session, « Mon compte » renvoie vers la connexion", async ({
    page,
  }) => {
    await page.goto("/compte");
    await expect(page).toHaveURL(/\/connexion$/);
  });

  test("US-XXX-4 – changer son mot de passe puis se reconnecter avec le nouveau", async ({
    page,
  }) => {
    const { email, motDePasse } = await connecterNouvelUtilisateur(page);
    await champ(page, "Mot de passe actuel").fill(motDePasse);
    await champ(page, "Nouveau mot de passe").fill("nouveau-mot-de-passe");
    await champ(page, "Confirmez le nouveau mot de passe").fill(
      "nouveau-mot-de-passe",
    );
    await page
      .getByRole("button", { name: "Changer mon mot de passe" })
      .click();
    await expect(page.getByText("Mot de passe modifié.")).toBeVisible();

    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/connexion$/);
    await champ(page, "Adresse e-mail").fill(email);
    await champ(page, "Mot de passe").fill("nouveau-mot-de-passe");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/compte$/);
  });

  test("US-XXX-5 – après la déconnexion, « Mon compte » renvoie vers la connexion", async ({
    page,
  }) => {
    await connecterNouvelUtilisateur(page);
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/connexion$/);
    await page.goto("/compte");
    await expect(page).toHaveURL(/\/connexion$/);
  });
});
```

Les tests de bout en bout tournent sur une base de développement (jamais la base de production) : chaque test crée son propre compte.

Commandes : `npm test` (unitaires et intégration), `npm run test:e2e` (bout en bout).

