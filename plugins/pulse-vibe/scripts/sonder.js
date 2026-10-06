#!/usr/bin/env node
// Pulse – sonde de mise en ligne (`pulse-aidd sonder`, /pulse:deploy et /pulse:tech).
//
//   pulse-aidd sonder <adresse> [--texte "<texte attendu>"] [--essais 5] [--delai 6000]
//
// Vérifie qu'un site en ligne répond : code 200, et le texte attendu dans la page s'il est donné.
// Plusieurs essais espacés, car un hébergeur met parfois quelques secondes à publier.
// Sort avec le code 0 si le site répond comme prévu, 1 sinon (avec la cause, en français).
"use strict";

const USAGE = 'Usage : pulse-aidd sonder <adresse> [--texte "<texte attendu>"] [--essais 5] [--delai 6000]';

function lireArguments(argv) {
  const opts = { adresse: null, texte: null, essais: 5, delai: 6000 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--texte") opts.texte = argv[++i];
    else if (a === "--essais") opts.essais = Number(argv[++i]);
    else if (a === "--delai") opts.delai = Number(argv[++i]);
    else if (!a.startsWith("--") && opts.adresse === null) opts.adresse = a;
  }
  return opts;
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/** Un essai : rend null si tout va bien, sinon la cause du problème. */
async function essayer(adresse, texte) {
  let reponse;
  try {
    reponse = await fetch(adresse, { redirect: "follow", signal: AbortSignal.timeout(15000) });
  } catch (e) {
    return `le site ne répond pas (${(e.cause && e.cause.code) || e.name})`;
  }
  if (reponse.status !== 200) return `le site répond avec le code ${reponse.status} au lieu de 200`;
  if (texte) {
    const corps = await reponse.text();
    if (!corps.includes(texte)) return `la page ne contient pas le texte attendu « ${texte} »`;
  }
  return null;
}

async function principal() {
  const opts = lireArguments(process.argv.slice(2));
  if (!opts.adresse || !/^https?:\/\/\S+$/.test(opts.adresse)) {
    console.error(USAGE);
    process.exit(1);
  }
  const essais = Number.isInteger(opts.essais) && opts.essais > 0 ? opts.essais : 5;
  let cause = null;
  for (let n = 1; n <= essais; n++) {
    cause = await essayer(opts.adresse, opts.texte);
    if (!cause) {
      console.log(`✅ ${opts.adresse} répond (code 200${opts.texte ? `, texte « ${opts.texte} » présent` : ""}), essai ${n}/${essais}.`);
      return;
    }
    if (n < essais) await attendre(opts.delai);
  }
  console.error(`❌ ${opts.adresse} : ${cause}, après ${essais} essai${essais > 1 ? "s" : ""}.`);
  process.exit(1);
}

principal();
