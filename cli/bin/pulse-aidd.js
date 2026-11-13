#!/usr/bin/env node
// pulse-aidd hors de Claude Code : relaie vers l'outil bash du plugin pulse (lib/relais.js).
"use strict";

require("../lib/relais")
  .lancer(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  });
