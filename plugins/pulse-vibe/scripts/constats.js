// Pulse – mise en forme partagée des contrôles verifier-plan et verifier-spec : lignes « clé: valeur », un constat par
// ligne (« - à corriger · <où> · <message> »), puis « bilan: ok | avertissements | à corriger ».
"use strict";

const numero = (id) => Number(String(id).replace(/\D/g, ""));
const normaliserUs = (id) => `US-${String(numero(id)).padStart(3, "0")}`;

/** Les lignes d'en-tête (tableau de « clé: valeur »), les compteurs, les constats, puis le bilan. */
function formaterConstats(entete, constats) {
  const n = (g) => constats.filter((c) => c.gravite === g).length;
  const bilan = n("à corriger") ? "à corriger" : n("avertissement") ? "avertissements" : "ok";
  const lignes = [...entete, `a-corriger: ${n("à corriger")}`, `avertissements: ${n("avertissement")}`];
  for (const c of constats) lignes.push(`- ${c.gravite} · ${c.ou} · ${c.message}`);
  lignes.push(`bilan: ${bilan}`);
  return lignes.join("\n");
}

/** Le point d'entrée en ligne de commande : l'US en argument, le contrôle, sa mise en forme ; jamais d'erreur de sortie. */
function lancerControle(quoi, exemple, verifier, formater) {
  const id = process.argv[2] || "";
  if (!/^US-?\d+$/i.test(id)) return console.log(`erreur: indiquez l'US ${quoi}, par exemple : ${exemple}`);
  const us = normaliserUs(id);
  try {
    console.log(formater(verifier(process.cwd(), us), us));
  } catch (e) {
    console.log(`us: ${us}\nbilan: introuvable\nraison: les fichiers n'ont pas pu être lus (${e.message})`);
  }
}

module.exports = { formaterConstats, lancerControle, normaliserUs, numero };
