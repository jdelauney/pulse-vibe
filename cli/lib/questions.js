// Questions posées dans le terminal, sans dépendance (node:readline).
"use strict";

const readline = require("readline/promises");

class Questions {
  constructor(entree = process.stdin, sortie = process.stdout) {
    this.rl = readline.createInterface({ input: entree, output: sortie });
  }

  /** Oui ou non ; Entrée vaut la réponse par défaut. */
  async ouiNon(question, defaut = true) {
    const r = (await this.rl.question(`${question} ${defaut ? "(O/n)" : "(o/N)"} `)).trim().toLowerCase();
    if (!r) return defaut;
    return /^o(ui)?$|^y(es)?$/.test(r);
  }

  /** Plusieurs choix parmi une liste numérotée ; Entrée vaut les choix par défaut. Rend les valeurs choisies. */
  async plusieurs(question, options, defauts) {
    options.forEach((o, i) => console.log(`  ${i + 1}. ${o.libelle}`));
    const parDefaut = options.map((o, i) => (defauts.includes(o.valeur) ? i + 1 : null)).filter(Boolean);
    for (;;) {
      const r = (await this.rl.question(`${question}${parDefaut.length ? ` (Entrée = ${parDefaut.join(",")})` : ""} : `)).trim();
      if (!r && parDefaut.length) return parDefaut.map((n) => options[n - 1].valeur);
      const numeros = r.split(/[\s,;]+/).filter(Boolean).map(Number);
      if (numeros.length && numeros.every((n) => Number.isInteger(n) && n >= 1 && n <= options.length)) return [...new Set(numeros)].map((n) => options[n - 1].valeur);
      console.log(`Tapez un ou plusieurs numéros entre 1 et ${options.length}, séparés par des virgules.`);
    }
  }

  fermer() {
    this.rl.close();
  }
}

module.exports = { Questions };
