// Mots réservés aux consignes : la personne les voit seulement expliqués (lexique), jamais dans une description, un libellé
// ou un écran. Liste partagée par coherence.test.js et wiki.test.js.
// « MVP », « epic » et « demande de fusion » restent permis dans les consignes destinées à l'IA (décision du 2026-10-09).
"use strict";

const SIGLES_JARGON = /\b(CI|CD|PR|CSV|INVEST|MoSCoW|TBD|MVP)\b/;
const MOTS_JARGON = /\b(worktrees?|pull requests?|demandes? de fusion|lint|lighthouse|epics?|squelette|aidd_docs|test-runner|test-writer|kanban|storytelling|sous-agents?|feynman|definition of ready)\b/i;
const jargon = (texte) => SIGLES_JARGON.exec(texte) || MOTS_JARGON.exec(texte);

module.exports = { SIGLES_JARGON, MOTS_JARGON, jargon };
