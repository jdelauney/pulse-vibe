### Intégration (Vitest + PGlite)

better-auth tourne sur une base PGlite neuve, avec les migrations du projet. `creerAuth` reçoit cette base et une doublure du service des mots de passe compromis : aucune variable d'environnement n'est lue, aucun appel réseau ne part.

<!-- fichier: src/adapters/auth/__tests__/auth.adapter.test.ts -->
```ts
// src/adapters/auth/__tests__/auth.adapter.test.ts
import { account } from "@src/db/compte/auth.table";
import { logger } from "@src/lib/logger";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creerBaseDeTest } from "../../../../tests/helpers/base-de-test";
import { type Auth, creerAuth } from "../auth.adapter";

type BaseDeTest = Awaited<ReturnType<typeof creerBaseDeTest>>;

/** Doublure de Have I Been Pwned : seul « motdepasse-compromis » a fui. */
const motsDePasseDeTest = {
  async estCompromis(motDePasse: string) {
    return motDePasse === "motdepasse-compromis";
  },
};

const optionsDeTest = {
  secret: "secret-de-test-secret-de-test-secret-de-test",
  baseURL: "http://localhost:3000",
  motsDePasse: motsDePasseDeTest,
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

    // US-XXX-6 : un nouveau mot de passe paru dans une fuite est refusé.
    const compromis = await auth.api
      .changePassword({
        body: {
          currentPassword: "motdepasse-solide",
          newPassword: "motdepasse-compromis",
          revokeOtherSessions: true,
        },
        headers: enTetes,
      })
      .catch((e: unknown) => e);
    expect((compromis as APIError).body?.code).toBe("PASSWORD_COMPROMISED");

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

describe("mots de passe compromis", () => {
  let base: BaseDeTest;
  beforeEach(async () => {
    base = await creerBaseDeTest();
  });
  afterEach(async () => {
    await base.fermer();
    vi.restoreAllMocks();
  });

  it("US-XXX-6 – un mot de passe paru dans une fuite est refusé à l'inscription", async () => {
    const auth = creerAuth(base.db, optionsDeTest);
    const erreur = await auth.api
      .signUpEmail({
        body: {
          name: "Camille Martin",
          email: "camille@exemple.fr",
          password: "motdepasse-compromis",
        },
      })
      .catch((e: unknown) => e);
    expect((erreur as APIError).body?.code).toBe("PASSWORD_COMPROMISED");
  });

  it("US-XXX-6 – service injoignable : l'inscription passe, et l'incident est journalisé sans le mot de passe", async () => {
    const avertissement = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const auth = creerAuth(base.db, {
      ...optionsDeTest,
      motsDePasse: {
        async estCompromis() {
          throw new Error("service injoignable");
        },
      },
    });

    const resultat = await auth.api.signUpEmail({
      body: {
        name: "Camille Martin",
        email: "camille@exemple.fr",
        password: "motdepasse-solide",
      },
    });

    expect(resultat.user.email).toBe("camille@exemple.fr");
    expect(avertissement).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(avertissement.mock.calls)).not.toContain(
      "motdepasse-solide",
    );
  });
});

describe("chemins HTTP fermés", () => {
  // Lecture de la session (auth-client.ts), et deux chemins sans écriture.
  const OUVERTS = ["/error", "/get-session", "/ok"];

  it("US-XXX-2 – seuls les chemins de lecture restent ouverts", async () => {
    const { db, fermer } = await creerBaseDeTest();
    const auth = creerAuth(db, optionsDeTest);
    const fermes = auth.options.disabledPaths ?? [];
    // Les chemins à paramètre (/callback/:id) ne se ferment pas par disabledPaths.
    const ouverts = Object.values(auth.api)
      .map((point) => (point as { path?: string }).path)
      .filter((chemin): chemin is string => !!chemin && !chemin.includes(":"))
      .filter((chemin) => !fermes.includes(chemin));
    expect([...new Set(ouverts)].sort()).toEqual(OUVERTS);
    await fermer();
  });

  it("US-XXX-2 – un chemin fermé répond 404, même pour une inscription directe", async () => {
    const { db, fermer } = await creerBaseDeTest();
    const auth = creerAuth(db, optionsDeTest);
    for (const chemin of auth.options.disabledPaths ?? []) {
      const reponse = await auth.handler(
        new Request(`http://localhost:3000/api/auth${chemin}`, {
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
      expect(reponse.status, chemin).toBe(404);
    }
    await fermer();
  });
});
```

### Adapter `hibp` (Vitest, service simulé)

Le service est remplacé par une fonction `fetch` de test, passée au constructeur : aucun appel réseau.

<!-- fichier: src/adapters/hibp/__tests__/hibp.adapter.test.ts -->
```ts
// src/adapters/hibp/__tests__/hibp.adapter.test.ts
import { createHash } from "node:crypto";
import { ErreurService } from "@src/lib/errors/erreur-service";
import { describe, expect, it } from "vitest";
import { HibpMotDePasseAdapter } from "../hibp.adapter";

const empreinte = createHash("sha1")
  .update("motdepasse-compromis")
  .digest("hex")
  .toUpperCase();

/** Service simulé : garde l'adresse appelée et répond le texte donné. */
function serviceSimule(texte: string, statut = 200) {
  const appels: string[] = [];
  const recuperer = (async (adresse: string | URL | Request) => {
    appels.push(String(adresse));
    return new Response(texte, { status: statut });
  }) as typeof fetch;
  return { appels, recuperer };
}

describe("Mots de passe compromis (Have I Been Pwned)", () => {
  it("US-XXX-6 – seuls les 5 premiers caractères de l'empreinte partent ; suite trouvée : compromis", async () => {
    const { appels, recuperer } = serviceSimule(
      `0000000000000000000000000000000000A:0\r\n${empreinte.slice(5)}:42\r\n`,
    );

    const compromis = await new HibpMotDePasseAdapter(recuperer).estCompromis(
      "motdepasse-compromis",
    );

    expect(compromis).toBe(true);
    expect(appels).toEqual([
      `https://api.pwnedpasswords.com/range/${empreinte.slice(0, 5)}`,
    ]);
  });

  it("US-XXX-6 – une ligne de remplissage (nombre 0) ne compte pas", async () => {
    const { recuperer } = serviceSimule(`${empreinte.slice(5)}:0\r\n`);

    expect(
      await new HibpMotDePasseAdapter(recuperer).estCompromis(
        "motdepasse-compromis",
      ),
    ).toBe(false);
  });

  it("US-XXX-6 – service en panne : erreur de service « hibp »", async () => {
    const { recuperer } = serviceSimule("", 503);

    const erreur = await new HibpMotDePasseAdapter(recuperer)
      .estCompromis("motdepasse-compromis")
      .catch((e: unknown) => e);

    expect(erreur).toBeInstanceOf(ErreurService);
    expect((erreur as ErreurService).service).toBe("hibp");
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

### Pages réservées (Vitest)

Chaque page de `app/(connecte)/` lit la session dans un de ses containers, avec `utilisateurConnecte()` : `proxy.ts` ne voit que la présence du cookie. Le test lit le code des pages et des containers qu'elles importent ; il échoue pour une page qui l'oublie.

<!-- fichier: tests/pages-connectees.test.ts -->
```ts
// tests/pages-connectees.test.ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Les page.tsx placées sous un dossier (connecte), à toute profondeur d'app/. */
function pagesConnectees(dossier = "app", connecte = false): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = path.join(dossier, entree.name);
    if (entree.isDirectory()) {
      return pagesConnectees(chemin, connecte || entree.name === "(connecte)");
    }
    return connecte && entree.name === "page.tsx" ? [chemin] : [];
  });
}

/** Les fichiers des containers importés par une page (alias @src/ ou chemin relatif). */
function containersImportes(page: string): string[] {
  const source = readFileSync(page, "utf8");
  return [...source.matchAll(/from "([^"]+\.container)"/g)]
    .map(([, cible]) =>
      cible.startsWith("@src/")
        ? `${cible.replace("@src/", "src/")}.tsx`
        : path.join(path.dirname(page), `${cible}.tsx`),
    )
    .filter((fichier) => existsSync(fichier));
}

describe("Pages réservées", () => {
  it("US-XXX-3 – chaque page de (connecte) lit la session dans un container, par utilisateurConnecte()", () => {
    const sansSession = pagesConnectees().filter(
      (page) =>
        !containersImportes(page).some((container) =>
          readFileSync(container, "utf8").includes("utilisateurConnecte()"),
        ),
    );
    expect(
      sansSession,
      "Ajoutez à ces pages un container, sous <Suspense>, qui appelle utilisateurConnecte().",
    ).toEqual([]);
  });
});
```

### Bout en bout (Playwright)

L'aide `connecterNouvelUtilisateur(page)` sert aussi aux autres recettes (`liste`, par exemple).

<!-- fichier: e2e/aides/connexion.ts -->
```ts
// e2e/aides/connexion.ts
import { expect, type Page } from "@playwright/test";

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
import { verifierAccessibilite } from "./aides/accessibilite";
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
    await champ(page, "Nouveau mot de passe").fill("nouveau-Pulse-3h8w-5zt1");
    await champ(page, "Confirmez le nouveau mot de passe").fill(
      "nouveau-Pulse-3h8w-5zt1",
    );
    await page
      .getByRole("button", { name: "Changer mon mot de passe" })
      .click();
    await expect(page.getByText("Mot de passe modifié.")).toBeVisible();

    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/connexion$/);
    await champ(page, "Adresse e-mail").fill(email);
    await champ(page, "Mot de passe").fill("nouveau-Pulse-3h8w-5zt1");
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

  test("US-XXX-6 – inscription, connexion et « Mon compte » : accessibles", async ({
    page,
  }, testInfo) => {
    for (const chemin of ["/inscription", "/connexion"]) {
      await page.goto(chemin);
      await verifierAccessibilite(page, testInfo);
    }
    await connecterNouvelUtilisateur(page);
    await verifierAccessibilite(page, testInfo);
  });
});
```

Les tests de bout en bout tournent sur une base de développement (jamais la base de production) : chaque test crée son propre compte.

Commandes : `npm test` (unitaires et intégration), `npm run test:e2e` (bout en bout).

