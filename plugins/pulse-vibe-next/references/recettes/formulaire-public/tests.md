
Unitaires : le champ piège et le jeton.

<!-- fichier: src/lib/helpers/formulaire-public/__tests__/champs.test.ts -->
```ts
// src/lib/helpers/formulaire-public/__tests__/champs.test.ts
import { describe, expect, it } from "vitest";
import { CHAMP_PIEGE, estPiegeRempli, NOM_FORMULAIRE } from "../champs";

describe("Champ piège", () => {
  it("US-XXX-1 – vide ou absent : la personne passe", () => {
    expect(estPiegeRempli({ [CHAMP_PIEGE]: "" })).toBe(false);
    expect(estPiegeRempli({ [CHAMP_PIEGE]: "   " })).toBe(false);
    expect(estPiegeRempli({ message: "Bonjour" })).toBe(false);
    expect(estPiegeRempli(null)).toBe(false);
  });

  it("US-XXX-1 – rempli, même avec une valeur qui n'est pas du texte : c'est un robot", () => {
    expect(estPiegeRempli({ [CHAMP_PIEGE]: "https://exemple.fr" })).toBe(true);
    expect(estPiegeRempli({ [CHAMP_PIEGE]: 0 })).toBe(true);
    expect(estPiegeRempli({ [CHAMP_PIEGE]: false })).toBe(true);
    expect(estPiegeRempli({ [CHAMP_PIEGE]: {} })).toBe(true);
  });

  it("US-XXX-1 – le nom du champ piège n'évoque aucun champ que le navigateur remplit tout seul", () => {
    for (const mot of [
      "soci",
      "entreprise",
      "company",
      "organization",
      "nom",
      "name",
      "mail",
      "adresse",
      "address",
      "tel",
      "phone",
      "ville",
      "city",
    ]) {
      expect(CHAMP_PIEGE).not.toContain(mot);
    }
  });

  it("les noms de formulaire restent simples", () => {
    expect(NOM_FORMULAIRE.test("contact")).toBe(true);
    expect(NOM_FORMULAIRE.test("demande-de-devis")).toBe(true);
    expect(NOM_FORMULAIRE.test("contact.autre")).toBe(false);
    expect(NOM_FORMULAIRE.test("")).toBe(false);
  });
});
```

<!-- fichier: src/lib/helpers/formulaire-public/__tests__/jeton.test.ts -->
```ts
// src/lib/helpers/formulaire-public/__tests__/jeton.test.ts
import { describe, expect, it } from "vitest";
import { signerJeton, verifierJeton } from "../jeton";

const SECRET = "secret-de-test-assez-long-pour-hmac-0123";
const T0 = Date.UTC(2026, 9, 8, 10, 0, 0);

describe("Jeton de délai", () => {
  it("US-XXX-2 – ouvert depuis 5 secondes, pour ce formulaire : valide", () => {
    const jeton = signerJeton("contact", T0, SECRET);
    expect(verifierJeton(jeton, "contact", T0 + 5_000, SECRET)).toBe("valide");
  });

  it("US-XXX-2 – envoyé moins de 3 secondes après l'ouverture : trop rapide", () => {
    const jeton = signerJeton("contact", T0, SECRET);
    expect(verifierJeton(jeton, "contact", T0 + 2_999, SECRET)).toBe(
      "trop-rapide",
    );
  });

  it("US-XXX-2 – ouvert depuis plus de 2 heures : expiré", () => {
    const jeton = signerJeton("contact", T0, SECRET);
    expect(verifierJeton(jeton, "contact", T0 + 7_200_001, SECRET)).toBe(
      "expire",
    );
  });

  it("US-XXX-2 – jeton d'un autre formulaire : refusé", () => {
    const jeton = signerJeton("devis", T0, SECRET);
    expect(verifierJeton(jeton, "contact", T0 + 5_000, SECRET)).toBe(
      "falsifie",
    );
  });

  it("US-XXX-2 – horodatage modifié ou autre secret : refusé", () => {
    const jeton = signerJeton("contact", T0, SECRET);
    const vieilli = jeton.replace(String(T0), String(T0 - 60_000));
    expect(verifierJeton(vieilli, "contact", T0 + 5_000, SECRET)).toBe(
      "falsifie",
    );
    expect(verifierJeton(jeton, "contact", T0 + 5_000, `${SECRET}-autre`)).toBe(
      "falsifie",
    );
  });

  it("US-XXX-2 – formes inattendues : refusées sans erreur", () => {
    for (const jeton of [
      "abc",
      "a.b",
      "a.b.c.d",
      `${T0}.contact.`,
      "x.contact.y",
    ]) {
      expect(verifierJeton(jeton, "contact", T0, SECRET)).toBe("falsifie");
    }
    expect(verifierJeton("", "contact", T0, SECRET)).toBe("absent");
    expect(verifierJeton(undefined, "contact", T0, SECRET)).toBe("absent");
    expect(verifierJeton(42, "contact", T0, SECRET)).toBe("absent");
  });
});
```

Intégration : l'action complète, avec la limite en mémoire (`LIMITE_STOCKAGE: "memoire"`) et une adresse différente pour chaque test.

<!-- fichier: src/features/contact/actions/__tests__/envoyer-message.action.test.ts -->
```ts
// src/features/contact/actions/__tests__/envoyer-message.action.test.ts
import { signerJeton } from "@src/lib/helpers/formulaire-public/jeton";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "secret-de-test-assez-long-pour-hmac-0123";
const etat = vi.hoisted(() => ({ ip: "203.0.113.1" }));
const journal = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": etat.ip }),
}));
vi.mock("@src/lib/logger", () => ({ logger: journal }));
vi.mock("@src/config/env", () => ({
  env: { FORMULAIRE_SECRET: SECRET, LIMITE_STOCKAGE: "memoire" },
}));

const { envoyerMessage } = await import("../envoyer-message.action");

let compteurIp = 0;
beforeEach(() => {
  compteurIp += 1;
  etat.ip = `203.0.113.${compteurIp}`;
  journal.info.mockClear();
  journal.warn.mockClear();
});

const jetonDe = (age: number, formulaire = "contact") =>
  signerJeton(formulaire, Date.now() - age, SECRET);

describe("Formulaire public", () => {
  it("US-XXX-3 – une personne qui a pris le temps d'écrire : le message part", async () => {
    const r = await envoyerMessage({
      message: "Bonjour",
      jeton_formulaire: jetonDe(5_000),
      champ_verification: "",
    } as never);
    expect(r?.data).toEqual({ ok: true });
    expect(journal.info).toHaveBeenCalledWith({ longueur: 7 }, "Message reçu");
  });

  it("US-XXX-1 – champ piège rempli : refusé, et noté dans le journal sans le contenu", async () => {
    const r = await envoyerMessage({
      message: "Achetez",
      jeton_formulaire: jetonDe(5_000),
      champ_verification: "https://spam.example",
    } as never);
    expect(r?.serverError).toBe("Rechargez la page et réessayez.");
    expect(JSON.stringify(journal.warn.mock.calls)).not.toContain(
      "spam.example",
    );
    expect(journal.info).not.toHaveBeenCalledWith(
      { longueur: expect.any(Number) },
      "Message reçu",
    );
  });

  it("US-XXX-2 – sans jeton : refusé", async () => {
    const r = await envoyerMessage({ message: "Bonjour" });
    expect(r?.serverError).toBe("Rechargez la page et réessayez.");
  });

  it("US-XXX-2 – envoyé une seconde après l'ouverture : message « trop rapide »", async () => {
    const r = await envoyerMessage({
      message: "Bonjour",
      jeton_formulaire: jetonDe(1_000),
    } as never);
    expect(r?.serverError).toBe(
      "Envoi trop rapide. Patientez quelques secondes, puis réessayez.",
    );
  });

  it("US-XXX-2 – jeton d'un autre formulaire : refusé", async () => {
    const r = await envoyerMessage({
      message: "Bonjour",
      jeton_formulaire: jetonDe(5_000, "devis"),
    } as never);
    expect(r?.serverError).toBe("Rechargez la page et réessayez.");
  });

  it("US-XXX-4 – sixième envoi en une minute depuis la même adresse : limite atteinte", async () => {
    const envoi = () =>
      envoyerMessage({
        message: "Bonjour",
        jeton_formulaire: jetonDe(5_000),
      } as never);
    for (let i = 0; i < 5; i++) {
      expect((await envoi())?.data).toEqual({ ok: true });
    }
    expect((await envoi())?.serverError).toBe(
      "Trop de tentatives. Réessayez dans 1 minute.",
    );
  });
});
```

Bout en bout : le délai minimal se mesure côté serveur, le test attend donc vraiment 3 secondes.

<!-- fichier: e2e/formulaire-public.spec.ts -->
```ts
// e2e/formulaire-public.spec.ts
import { expect, test } from "@playwright/test";

test.describe("Formulaire public", () => {
  test("une personne qui prend le temps d'écrire envoie son message", async ({
    page,
  }) => {
    await page.goto("/contact");
    const bouton = page.getByRole("button", { name: "Envoyer" });
    await expect(bouton).toBeEnabled();
    await page
      .getByLabel("Votre message")
      .fill("Bonjour, je voudrais un devis.");
    // Le délai minimal (3 s) est mesuré par l'horloge du serveur : on attend vraiment.
    await page.waitForTimeout(3_200);
    await bouton.click();
    await expect(page.getByText("Message envoyé. Merci !")).toBeVisible();
  });

  test("un robot qui remplit le champ piège est refusé", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("button", { name: "Envoyer" })).toBeEnabled();
    await page.getByLabel("Votre message").fill("Achetez maintenant");
    await page
      .locator("#champ_verification")
      .fill("https://spam.example", { force: true });
    await page.waitForTimeout(3_200);
    await page.getByRole("button", { name: "Envoyer" }).click();
    // Next.js ajoute son propre rôle « alert » (annonce de navigation) : on cible le message.
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Rechargez la page et réessayez." }),
    ).toBeVisible();
  });

  test("sans jeton, le bouton reste désactivé et la page explique quoi faire", async ({
    page,
  }) => {
    await page.route("**/api/jeton-formulaire**", (route) =>
      route.fulfill({ status: 500 }),
    );
    await page.goto("/contact");
    await expect(
      page.getByRole("alert").filter({
        hasText: "Le formulaire n'a pas pu se préparer. Rechargez la page.",
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Envoyer" })).toBeDisabled();
  });

  test("les gestionnaires de mots de passe ignorent le champ piège", async ({
    page,
  }) => {
    await page.goto("/contact");
    const piege = page.locator("#champ_verification");
    await expect(piege).toHaveAttribute("autocomplete", "off");
    await expect(piege).toHaveAttribute("data-1p-ignore", "");
    await expect(piege).toHaveAttribute("data-lpignore", "true");
    await expect(piege).toHaveAttribute("data-bwignore", "");
  });

  test("le champ piège reste hors de portée du clavier", async ({ page }) => {
    await page.goto("/contact");
    await page.getByLabel("Votre message").focus();
    await page.keyboard.press("Tab");
    await expect(page.locator("#champ_verification")).not.toBeFocused();
  });
});
```

Option Turnstile : l'adapter, avec un faux `fetch`, et les deux clés qui vont ensemble.

<!-- fichier: src/adapters/turnstile/__tests__/turnstile.adapter.test.ts -->
```ts
// src/adapters/turnstile/__tests__/turnstile.adapter.test.ts
import { describe, expect, it, vi } from "vitest";

const journal = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("@src/lib/logger", () => ({ logger: journal }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@src/config/env", () => ({ env: {} }));

const { verifierTurnstile } = await import("../turnstile.adapter");

function repondant(corps: unknown) {
  const appels: [string, RequestInit][] = [];
  const envoyer = (async (adresse: string, options: RequestInit) => {
    appels.push([adresse, options]);
    return Response.json(corps);
  }) as unknown as typeof fetch;
  return { envoyer, appels };
}

describe("Vérification Turnstile", () => {
  it("US-XXX-5 – réponse acceptée par Cloudflare : la personne passe", async () => {
    const { envoyer, appels } = repondant({ success: true });
    expect(
      await verifierTurnstile(
        "jeton-du-widget",
        "secret",
        "203.0.113.7",
        envoyer,
      ),
    ).toBe(true);
    const corps = appels[0][1].body as URLSearchParams;
    expect(corps.get("response")).toBe("jeton-du-widget");
    expect(corps.get("remoteip")).toBe("203.0.113.7");
  });

  it("US-XXX-5 – réponse refusée : l'envoi est refusé", async () => {
    const { envoyer } = repondant({
      success: false,
      "error-codes": ["invalid-input-response"],
    });
    expect(await verifierTurnstile("x", "secret", "203.0.113.7", envoyer)).toBe(
      false,
    );
  });

  it("US-XXX-5 – réponse absente ou trop longue : refusée sans appeler Cloudflare", async () => {
    const { envoyer, appels } = repondant({ success: true });
    expect(
      await verifierTurnstile(undefined, "secret", "inconnue", envoyer),
    ).toBe(false);
    expect(
      await verifierTurnstile("x".repeat(2049), "secret", "inconnue", envoyer),
    ).toBe(false);
    expect(appels).toHaveLength(0);
  });

  it("US-XXX-5 – Cloudflare injoignable : refusé, et l'incident est journalisé", async () => {
    const enPanne = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await verifierTurnstile("x", "secret", "203.0.113.7", enPanne)).toBe(
      false,
    );
    expect(journal.error).toHaveBeenCalled();
  });

  it("adresse IP inconnue : elle n'est pas transmise", async () => {
    const { envoyer, appels } = repondant({ success: true });
    await verifierTurnstile("x", "secret", "inconnue", envoyer);
    expect((appels[0][1].body as URLSearchParams).has("remoteip")).toBe(false);
  });
});
```

<!-- fichier: src/adapters/turnstile/__tests__/variables-turnstile.test.ts -->
```ts
// src/adapters/turnstile/__tests__/variables-turnstile.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { chargerEnvValide } from "../../../../tests/helpers/env-de-test";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Variables Turnstile", () => {
  it("US-XXX-5 – clé secrète sans clé de site : le message nomme la clé manquante", async () => {
    await expect(
      chargerEnvValide({ TURNSTILE_SECRET_KEY: "secret-turnstile-de-test" }),
    ).rejects.toThrow(/NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
  });

  it("US-XXX-5 – clé de site sans clé secrète : le message nomme la clé manquante", async () => {
    await expect(
      chargerEnvValide({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "cle-de-site-de-test" }),
    ).rejects.toThrow(/TURNSTILE_SECRET_KEY/);
  });

  it("US-XXX-5 – les deux clés ensemble : acceptées", async () => {
    const env = await chargerEnvValide({
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "cle-de-site-de-test",
      TURNSTILE_SECRET_KEY: "secret-turnstile-de-test",
    });
    expect(env.TURNSTILE_SECRET_KEY).toBe("secret-turnstile-de-test");
  });
});
```

Le widget en vrai : ces tests tournent seulement quand le site est construit avec les clés (en local, les clés de test « toujours accepté » de Cloudflare dans `.env`, puis `npm run build` et `npm run test:e2e`).

<!-- fichier: e2e/turnstile.spec.ts -->
```ts
// e2e/turnstile.spec.ts
import { expect, test } from "@playwright/test";

// Option Turnstile : ces tests tournent quand le site est construit avec les clés
// (en local, les clés de test de Cloudflare « toujours accepté »).
test.skip(
  !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  "Turnstile n'est pas activé (NEXT_PUBLIC_TURNSTILE_SITE_KEY absente)",
);

test.describe("Formulaire public avec Turnstile", () => {
  test("le widget répond : le message part, puis le widget repart", async ({
    page,
  }) => {
    await page.goto("/contact");
    const bouton = page.getByRole("button", { name: "Envoyer" });
    await expect(bouton).toBeEnabled({ timeout: 15_000 });
    await page.getByLabel("Votre message").fill("Bonjour");
    await page.waitForTimeout(3_200);
    await bouton.click();
    await expect(page.getByText("Message envoyé. Merci !")).toBeVisible({
      timeout: 10_000,
    });
    // Une réponse Turnstile ne sert qu'une fois : le widget en donne une nouvelle.
    await expect(bouton).toBeEnabled({ timeout: 15_000 });
  });

  test("widget bloqué : la page explique quoi faire", async ({ page }) => {
    await page.route("**/turnstile/v0/api.js**", (route) => route.abort());
    await page.goto("/contact");
    await expect(
      page.getByRole("alert").filter({
        hasText: "La vérification anti-robot n'a pas pu se charger.",
      }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Envoyer" })).toBeDisabled();
  });
});
```

Et dans le test de l'action, une version réglable du faux `env.ts` et un test de plus. Un réglage relu à chaque test :

<!-- ajout: src/features/contact/actions/__tests__/envoyer-message.action.test.ts après: const SECRET = "secret-de-test-assez-long-pour-hmac-0123"; -->
```ts
const reglages = vi.hoisted(() => ({
  turnstile: undefined as string | undefined,
}));
```

le faux `env.ts`, qui le lit :

<!-- remplacer: src/features/contact/actions/__tests__/envoyer-message.action.test.ts -->
```ts
vi.mock("@src/config/env", () => ({
  env: {
    FORMULAIRE_SECRET: SECRET,
    LIMITE_STOCKAGE: "memoire",
    // Accesseur : la valeur est relue à chaque test.
    get TURNSTILE_SECRET_KEY() {
      return reglages.turnstile;
    },
  },
}));
```

sa remise à zéro avant chaque test :

<!-- ajout: src/features/contact/actions/__tests__/envoyer-message.action.test.ts après: journal.warn.mockClear(); -->
```ts
  reglages.turnstile = undefined;
```

et le test :

<!-- ajout: src/features/contact/actions/__tests__/envoyer-message.action.test.ts après: describe("Formulaire public", () => { -->
```ts
  it("US-XXX-5 – Turnstile actif et réponse absente : refusé", async () => {
    reglages.turnstile = "secret-turnstile-de-test";
    const r = await envoyerMessage({
      message: "Bonjour",
      jeton_formulaire: jetonDe(5_000),
    } as never);
    expect(r?.serverError).toBe(
      "La vérification anti-robot a échoué. Réessayez dans un instant.",
    );
  });

```

