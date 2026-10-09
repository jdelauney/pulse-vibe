// Tests du découpage des recettes (scripts/decouper-recette.js) : aucune ligne perdue.
// Lancer : node --test plugins/pulse-vibe-next/tests/decouper-recette.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { decouper, recomposer, texteRecette, identifiant } = require("../scripts/decouper-recette.js");

const RECETTES = path.join(__dirname, "..", "references", "recettes");

const EXEMPLE = [
  "# Recette : essai", "", "> Quand l'utiliser : un essai.", "",
  "## Prérequis", "", "- rien", "",
  "## Étapes", "", "Introduction des étapes.", "",
  "### 1. Le premier", "", "```ts", "### pas un titre", "## pas une section", "```", "",
  "### Option : Redis (Upstash), pour un site à fort trafic", "", "Texte de l'option.", "",
  "### 2. Le second (`proxy.ts`)", "", "Code.", "",
  "## Tests", "", "### Unitaires", "", "```ts", "test();", "```", "",
  "## Points de sécurité", "", "- S1", "",
].join("\n");

test("identifiant : le numéro, sinon le titre court en minuscules sans accents", () => {
  assert.deepStrictEqual(identifiant("3. better-auth côté serveur"), { id: "3", libelle: "better-auth côté serveur" });
  assert.strictEqual(identifiant("Option : Redis (Upstash), pour un site à fort trafic").id, "option-redis");
  assert.strictEqual(identifiant("Option A – Speed Insights de Vercel").id, "option-a");
  assert.strictEqual(identifiant("Mention de confidentialité (A et B)").id, "mention-de-confidentialite");
  assert.deepStrictEqual(identifiant("Étape 2 – Configurer"), { id: "2", libelle: "Configurer" });
});

test("decouper : une vue d'ensemble, une étape par titre de « ## Étapes », les tests à part", () => {
  const f = decouper(EXEMPLE, "essai");
  assert.deepStrictEqual(Object.keys(f).sort(), ["etape-1.md", "etape-2.md", "etape-option-redis.md", "index.md", "tests.md"]);
  assert.ok(f["index.md"].includes("Introduction des étapes."));
  assert.ok(f["index.md"].includes("- Étape 1 – Le premier : `pulse-aidd pile recette essai etape 1`"));
  assert.ok(f["index.md"].includes("- Étape option-redis – Option : Redis (Upstash), pour un site à fort trafic : `pulse-aidd pile recette essai etape option-redis`"));
  assert.ok(f["index.md"].includes("- Étape 2 – Le second (`proxy.ts`) : `pulse-aidd pile recette essai etape 2`"));
  assert.ok(f["index.md"].includes("## Tests\nLe code des tests : `pulse-aidd pile recette essai tests`\n## Points de sécurité"));
  assert.ok(f["etape-1.md"].startsWith("### 1. Le premier\n"));
  assert.ok(f["etape-1.md"].includes("### pas un titre\n## pas une section"), "un titre dans un bloc de code reste du code");
  assert.ok(f["tests.md"].includes("### Unitaires"));
  assert.ok(!f["index.md"].includes("test();"));
});

test("recomposer(decouper(texte)) rend le texte d'origine", () => {
  assert.strictEqual(recomposer(decouper(EXEMPLE, "essai")), EXEMPLE);
});

test("decouper : une étape en double est refusée", () => {
  const double = ["# Recette : x", "", "## Étapes", "", "### 1. A", "", "### 1. B", ""].join("\n");
  assert.throws(() => decouper(double, "x"), /en double/);
});

test("chaque recette du pack se recompose à l'identique", () => {
  for (const entree of fs.readdirSync(RECETTES)) {
    if (entree.endsWith(".md")) {
      const texte = fs.readFileSync(path.join(RECETTES, entree), "utf8");
      assert.strictEqual(recomposer(decouper(texte, entree.slice(0, -3))), texte, entree);
    } else {
      const texte = texteRecette(entree);
      assert.match(texte, new RegExp(`^# Recette : ${entree}$`, "m"), entree);
      assert.ok(texte.includes("\n## Étapes\n") && texte.includes("\n## Tests\n"), entree);
    }
  }
});

test("recettes découpées : vue d'ensemble ≤ 30 000 caractères, chaque étape ≤ 15 000", () => {
  for (const entree of fs.readdirSync(RECETTES)) {
    const dossier = path.join(RECETTES, entree);
    if (!fs.statSync(dossier).isDirectory()) continue;
    for (const f of fs.readdirSync(dossier)) {
      const taille = fs.readFileSync(path.join(dossier, f), "utf8").length;
      if (f === "index.md") assert.ok(taille <= 30000, `${entree}/${f} : ${taille}`);
      if (f.startsWith("etape-")) assert.ok(taille <= 15000, `${entree}/${f} : ${taille}`);
    }
  }
});
