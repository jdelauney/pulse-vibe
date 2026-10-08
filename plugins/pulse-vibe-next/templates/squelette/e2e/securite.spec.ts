import { expect, test } from "@playwright/test";

// En-têtes de sécurité réellement servis (next.config.ts). En CI, le site est construit puis
// servi (npm run start) : c'est la configuration de production qui est vérifiée.
const ENTETES = [
  "content-security-policy",
  "strict-transport-security",
  "cross-origin-opener-policy",
  "permissions-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
];
const DIRECTIVES = [
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];
const ADRESSES = ["/", "/robots.txt", "/adresse-qui-n-existe-pas"];

test.describe("Sécurité", () => {
  for (const chemin of ADRESSES) {
    test(`${chemin} : les en-têtes de sécurité sont servis`, async ({
      request,
    }) => {
      const entetes = (await request.get(chemin)).headers();
      for (const nom of ENTETES) expect(entetes[nom], nom).toBeTruthy();
      const csp = entetes["content-security-policy"];
      for (const directive of DIRECTIVES) expect(csp).toContain(directive);
      // 'unsafe-eval' sert seulement au développement (messages d'erreur de React).
      if (process.env.CI) expect(csp).not.toContain("'unsafe-eval'");
    });
  }

  for (const chemin of ["/", "/adresse-qui-n-existe-pas"]) {
    test(`${chemin} s'affiche sans violation de la CSP`, async ({ page }) => {
      const violations: string[] = [];
      page.on("console", (message) => {
        if (/CSP:|Content Security Policy/.test(message.text()))
          violations.push(message.text());
      });
      await page.addInitScript(() => {
        document.addEventListener("securitypolicyviolation", (e) =>
          console.error(`CSP: ${e.violatedDirective} ${e.blockedURI}`),
        );
      });
      await page.goto(chemin);
      await page.waitForLoadState("networkidle");
      expect(violations).toEqual([]);
    });
  }
});
