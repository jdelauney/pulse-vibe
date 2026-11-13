#!/usr/bin/env node
// pulseia – installe la méthode Pulse dans Codex, Cursor, OpenCode et GitHub Copilot (voir pulseia aide).
"use strict";

require("../lib/cli")
  .principal(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((erreur) => {
    console.error(`pulseia : ${erreur.message}`);
    process.exitCode = 1;
  });
