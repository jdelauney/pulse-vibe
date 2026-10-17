#!/usr/bin/env node
// Pulse – point d'entrée unique du hook PostToolUse (Write, Edit, MultiEdit), actif seulement
// dans un projet Pulse : note le fichier écrit dans le relevé du tour (tour.js) et régénère le
// guide de réalisation quand c'est un plan de aidd_docs/tasks/. Silencieux, sans jamais bloquer.
"use strict";

const fs = require("fs");

function principal() {
  const texte = fs.readFileSync(0, "utf8");
  const entree = JSON.parse(texte);
  const cwd = entree && entree.cwd && fs.existsSync(entree.cwd) ? entree.cwd : process.cwd();
  if (!require("./garde").projetPulse(cwd)) return;
  try {
    const { noter, racineGit } = require("./tour");
    const racine = racineGit(cwd);
    if (racine) noter(entree, racine);
  } catch (e) {
    // le relevé ne doit pas empêcher le guide
  }
  const { modifiePlan, generer } = require("./guide");
  if (modifiePlan(texte)) {
    // generer() lit le projet depuis le dossier courant.
    const projet = process.env.CLAUDE_PROJECT_DIR;
    process.chdir(projet && fs.existsSync(projet) ? projet : cwd);
    generer();
  }
}

try {
  principal();
} catch (e) {
  // silencieux
}
