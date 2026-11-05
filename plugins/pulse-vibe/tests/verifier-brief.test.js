// Tests de `pulse-aidd verifier-brief` (scripts/verifier-brief.js) : le brief et le PRD contrôlés sans bloquer.
// Lancer : node --test plugins/pulse-vibe/tests/verifier-brief.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
const SCRIPT = path.join(RACINE, "scripts", "verifier-brief.js");
const { verifierBrief } = require(SCRIPT);

function projet(t, fichiers) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-brief-"));
  t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  fs.mkdirSync(path.join(d, "docs"));
  for (const [nom, contenu] of Object.entries(fichiers)) fs.writeFileSync(path.join(d, "docs", nom), contenu);
  return d;
}

const BRIEF = `# Brief – Carnet

## En une phrase

Une coiffeuse a besoin de voir ses rendez-vous pour ne plus en oublier.

## Le problème aujourd'hui

- Comment ça se passe aujourd'hui : un carnet papier

## Les acteurs

| Acteur | Qui est-ce ? | Ce qu'il veut |
|---|---|---|
| Cliente | une habituée | réserver |

## L'histoire (domain storytelling)

Chaque ligne suit la forme **acteur → action → objet**.

- La cliente choisit un créneau

## Questions ouvertes

- [ ] Annulation la veille ?
- [x] Déjà tranché

## Ce que serait une réussite

- Dans un mois, si l'outil marche, on constate que : plus aucun oubli
`;

const prd = (indispensables, pretQuand = "dix réservations faites") => `# PRD

## 5. Périmètre (MoSCoW)

| Priorité | Signification | Fonctionnalités | Origine |
|---|---|---|---|
| **Indispensable** (Must) | Première version. | ${indispensables} | vous |

### Définition de la première version

> La première version est prête quand : ${pretQuand}

## 6. Contraintes

- **Données personnelles** : nom et e-mail
`;

test("brief et PRD complets : rien à signaler, les questions ouvertes comptées", (t) => {
  const r = verifierBrief(projet(t, { "brief.md": BRIEF, "prd.md": prd("Réserver ; Voir le jour") }));
  assert.deepStrictEqual(r.constats, []);
  assert.strictEqual(r.questions, 1);
});

test("les modèles du plugin, encore vierges : chaque section vide et chaque champ signalés", (t) => {
  const modele = (f) => fs.readFileSync(path.join(RACINE, "templates", f), "utf8");
  const r = verifierBrief(projet(t, { "brief.md": modele("brief.md"), "prd.md": modele("prd.md") }));
  const textes = r.constats.map((c) => c.message).join("\n");
  for (const mot of ["phrase de synthèse", "problème", "acteurs", "histoire", "réussite", "champ\\(s\\) du modèle", "aucune fonctionnalité Indispensable", "prête quand", "contraintes"]) assert.match(textes, new RegExp(mot), mot);
  assert.strictEqual(r.questions, 0, "la case vide du modèle n'est pas une question");
});

test("plus de 6 fonctionnalités Indispensables : signalé avec la conséquence", (t) => {
  const r = verifierBrief(projet(t, { "prd.md": prd("a ; b ; c ; d ; e ; f ; g") }));
  assert.match(r.constats.map((c) => c.message).join("\n"), /7 fonctionnalités Indispensables/);
});

test("chaque constat dit sa conséquence, sans jamais bloquer", (t) => {
  const d = projet(t, { "brief.md": "# Brief\n" });
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: d, encoding: "utf8" });
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /^prd: absent$/m);
  assert.match(r.stdout, /^- avertissement · brief · la phrase de synthèse : à écrire ; sans elle/m);
  assert.match(r.stdout, /^bilan: avertissements$/m);
  assert.doesNotMatch(r.stdout, /à corriger ·/, "jamais bloquant");
});

test("ni brief ni PRD : introuvable, code de sortie 0", (t) => {
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: projet(t, {}), encoding: "utf8" });
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /^bilan: introuvable$/m);
});
