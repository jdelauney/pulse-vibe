// Les outils d'IA que pulseia sait équiper.
"use strict";

const { Codex } = require("./codex");
const { Cursor } = require("./cursor");
const { OpenCode } = require("./opencode");
const { Copilot } = require("./copilot");

const CIBLES = [new Codex(), new Cursor(), new OpenCode(), new Copilot()];
const IDS = CIBLES.map((c) => c.id);
const cible = (id) => CIBLES.find((c) => c.id === id);

module.exports = { CIBLES, IDS, cible };
