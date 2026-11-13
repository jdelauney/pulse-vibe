// Avant `npm pack` et `npm publish` (script prepack) : copie les plugins pulse et pulse-next du dépôt dans contenu/,
// sans leurs tests. Le paquet publié embarque ainsi la version des plugins du même commit.
"use strict";

const fs = require("fs");
const path = require("path");
const { PAQUET, PACKS, COEUR } = require("./chemins");

const PLUGINS = path.join(PAQUET, "..", "plugins");
const CONTENU = path.join(PAQUET, "contenu");

function preparer() {
  fs.rmSync(CONTENU, { recursive: true, force: true });
  for (const dossier of [COEUR, ...Object.values(PACKS)]) {
    fs.cpSync(path.join(PLUGINS, dossier), path.join(CONTENU, dossier), {
      recursive: true,
      filter: (source) => !/[\\/](tests|node_modules)([\\/]|$)/.test(path.relative(PLUGINS, source)),
    });
  }
  console.log(`contenu/ prêt : ${[COEUR, ...Object.values(PACKS)].join(", ")}`);
}

if (require.main === module) preparer();

module.exports = { preparer };
