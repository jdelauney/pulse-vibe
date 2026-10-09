// Avertissements de version au démarrage (scripts/version.js) : sans réseau, à partir des fichiers de Claude Code.
// Lancer : node --test plugins/pulse-vibe/tests/version.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { comparerVersions, avertissementsVersion, JOURS_CATALOGUE } = require(path.join(__dirname, "..", "scripts", "version.js"));

const JOUR = 24 * 60 * 60 * 1000;
const MAINTENANT = Date.parse("2026-10-09T12:00:00Z");

function ecrire(fichier, objet) {
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  fs.writeFileSync(fichier, typeof objet === "string" ? objet : JSON.stringify(objet));
}

// Un poste : le plugin qui tourne, la copie locale du catalogue pulseia, et les fichiers de Claude Code.
function poste({ installes, publiee = "0.35.0", nextPubliee = "0.20.0", jours = 1, enCours = "0.35.0" }) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-version-"));
  const plugin = path.join(base, "cache", "pulse");
  const catalogue = path.join(base, "marketplaces", "pulseia");
  const claude = path.join(base, "claude");
  ecrire(path.join(plugin, ".claude-plugin", "plugin.json"), { name: "pulse", version: enCours });
  ecrire(path.join(catalogue, ".claude-plugin", "marketplace.json"), {
    name: "pulseia",
    plugins: [
      { name: "pulse", source: "./plugins/pulse-vibe" },
      { name: "pulse-next", source: "./plugins/pulse-vibe-next" },
    ],
    renames: { "pulse-vibe": "pulse", "pulse-vibe-next": "pulse-next" },
  });
  ecrire(path.join(catalogue, "plugins", "pulse-vibe", ".claude-plugin", "plugin.json"), { name: "pulse", version: publiee });
  ecrire(path.join(catalogue, "plugins", "pulse-vibe-next", ".claude-plugin", "plugin.json"), { name: "pulse-next", version: nextPubliee });
  ecrire(path.join(claude, "plugins", "known_marketplaces.json"), {
    autre: { installLocation: path.join(base, "marketplaces", "absent"), lastUpdated: "2020-01-01T00:00:00Z" },
    pulseia: { source: { source: "github", repo: "jdelauney/pulse-vibe" }, installLocation: catalogue, lastUpdated: new Date(MAINTENANT - jours * JOUR).toISOString() },
  });
  ecrire(path.join(claude, "plugins", "installed_plugins.json"), { version: 2, plugins: installes });
  return { racinePlugin: plugin, dossierClaude: claude, base };
}
const utilisateur = (version) => [{ scope: "user", version }];

test("comparerVersions : numérique, morceaux manquants ou illisibles à 0", () => {
  assert.strictEqual(comparerVersions("0.9.0", "0.10.0"), -1);
  assert.strictEqual(comparerVersions("0.35.0", "0.35.0"), 0);
  assert.strictEqual(comparerVersions("1.0", "0.99.9"), 1);
  assert.strictEqual(comparerVersions("abc", "0.0.0"), 0);
});

test("à jour, catalogue récent : rien à signaler", () => {
  const p = poste({ installes: { "pulse@pulseia": utilisateur("0.35.0"), "pulse-next@pulseia": utilisateur("0.20.0") } });
  assert.deepStrictEqual(avertissementsVersion({ ...p, maintenant: MAINTENANT }), []);
});

test("versions en retard : chaque plugin, sa version publiée et sa commande", () => {
  const p = poste({ publiee: "0.36.0", nextPubliee: "0.21.0", installes: { "pulse@pulseia": utilisateur("0.35.0"), "pulse-next@pulseia": utilisateur("0.20.0") } });
  const lignes = avertissementsVersion({ ...p, maintenant: MAINTENANT });
  assert.match(lignes[0], /mise à jour disponible : pulse 0\.36\.0 \(installé : 0\.35\.0\), pulse-next 0\.21\.0 \(installé : 0\.20\.0\)/);
  assert.match(lignes[0], /`claude plugin update pulse@pulseia`, puis `claude plugin update pulse-next@pulseia`/);
  assert.match(lignes.at(-1), /Dites-le à la personne dès votre première réponse/);
});

test(`catalogue pas actualisé depuis ${JOURS_CATALOGUE} jours : la commande qui l'actualise`, () => {
  const p = poste({ jours: 20, installes: { "pulse@pulseia": utilisateur("0.35.0") } });
  const lignes = avertissementsVersion({ ...p, maintenant: MAINTENANT });
  assert.match(lignes.join("\n"), /catalogue pulseia n'a pas été actualisé depuis 20 jours/);
  assert.match(lignes.join("\n"), /`claude plugin marketplace update pulseia`/);
  assert.deepStrictEqual(avertissementsVersion({ ...poste({ jours: JOURS_CATALOGUE - 1, installes: { "pulse@pulseia": utilisateur("0.35.0") } }), maintenant: MAINTENANT }), []);
});

test("ancien nom : à côté du nouveau (désinstaller l'ancien), ou seul (installer le nouveau)", () => {
  const double = avertissementsVersion({ ...poste({ installes: { "pulse@pulseia": utilisateur("0.35.0"), "pulse-vibe@pulseia": utilisateur("0.13.0") } }), maintenant: MAINTENANT }).join("\n");
  assert.match(double, /pulse-vibe@pulseia \(ancien nom\) est encore installé à côté de pulse@pulseia/);
  assert.match(double, /`claude plugin uninstall pulse-vibe@pulseia`/);
  const seul = avertissementsVersion({ ...poste({ installes: { "pulse-vibe@pulseia": utilisateur("0.13.0") } }), maintenant: MAINTENANT }).join("\n");
  assert.match(seul, /installé sous l'ancien nom pulse-vibe@pulseia/);
  assert.match(seul, /`claude plugin install pulse@pulseia`, puis `claude plugin uninstall pulse-vibe@pulseia`/);
});

test("installations de portée projet : seulement celles de ce dossier", () => {
  const p = poste({ publiee: "0.36.0", installes: { "pulse@pulseia": [{ scope: "project", projectPath: path.join(os.tmpdir(), "autre-projet"), version: "0.30.0" }] } });
  assert.deepStrictEqual(avertissementsVersion({ ...p, projet: path.join(os.tmpdir(), "ce-projet"), maintenant: MAINTENANT }), []);
  const ici = path.join(os.tmpdir(), "ce-projet");
  const q = poste({ publiee: "0.36.0", installes: { "pulse@pulseia": [{ scope: "local", projectPath: ici, version: "0.30.0" }] } });
  assert.match(avertissementsVersion({ ...q, projet: ici, maintenant: MAINTENANT })[0], /pulse 0\.36\.0 \(installé : 0\.30\.0\)/);
});

test("fichiers absents, illisibles ou d'une autre forme : rien à signaler, sans erreur", () => {
  const p = poste({ publiee: "0.36.0", installes: { "pulse@pulseia": utilisateur("0.35.0") } });
  ecrire(path.join(p.dossierClaude, "plugins", "installed_plugins.json"), "{ pas du JSON");
  assert.deepStrictEqual(avertissementsVersion({ ...p, maintenant: MAINTENANT }), []);
  ecrire(path.join(p.dossierClaude, "plugins", "installed_plugins.json"), { version: 3, plugins: [["pulse@pulseia", "0.35.0"]] });
  assert.deepStrictEqual(avertissementsVersion({ ...p, maintenant: MAINTENANT }), []);
  assert.deepStrictEqual(avertissementsVersion({ racinePlugin: p.racinePlugin, dossierClaude: path.join(p.base, "rien"), maintenant: MAINTENANT }), []);
  assert.deepStrictEqual(avertissementsVersion({ racinePlugin: path.join(p.base, "rien"), dossierClaude: p.dossierClaude, maintenant: MAINTENANT }), []);
});
