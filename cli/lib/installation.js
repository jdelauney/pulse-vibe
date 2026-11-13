// Le registre d'installation (~/.pulseia/installation.json) : chaque fichier posé par pulseia, avec son empreinte.
// Mettre à jour ou désinstaller touche seulement ces fichiers ; un fichier modifié par la personne est gardé et signalé.
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { dossierPulseia, lireJson, versionPaquet } = require("./chemins");
const { planifier } = require("./plan");

const empreinte = (contenu) => crypto.createHash("sha256").update(contenu).digest("hex");

function empreinteDisque(chemin) {
  try {
    return empreinte(fs.readFileSync(chemin));
  } catch {
    return null;
  }
}

/** Retire les dossiers vides d'un skill pulse-* (jamais les dossiers des outils eux-mêmes). */
function retirerDossiersVides(fichier) {
  let d = path.dirname(fichier);
  while (d.split(/[\\/]/).some((s) => s.startsWith("pulse-"))) {
    try {
      if (fs.readdirSync(d).length > 0) return;
      fs.rmdirSync(d);
    } catch {
      return;
    }
    d = path.dirname(d);
  }
}

class Installation {
  constructor() {
    this.fichierRegistre = path.join(dossierPulseia(), "installation.json");
    this.registre = { version: null, outils: [], packs: [], fichiers: {}, ...lireJson(this.fichierRegistre, {}) };
  }

  get outils() {
    return this.registre.outils;
  }

  get packs() {
    return this.registre.packs;
  }

  /** Les fichiers du registre modifiés depuis leur pose. */
  modifies() {
    return Object.entries(this.registre.fichiers)
      .filter(([chemin, f]) => {
        const e = empreinteDisque(chemin);
        return e !== null && e !== f.empreinte;
      })
      .map(([chemin]) => chemin);
  }

  /**
   * Pose les fichiers des outils donnés et retire ceux qui ne servent plus.
   * Rapport : { ecrits, inchanges, retires, gardes: [{ chemin, raison }] }.
   */
  appliquer({ outils, packs }) {
    const plan = planifier(outils);
    const rapport = { ecrits: 0, inchanges: 0, retires: 0, gardes: [] };
    const fichiers = {};
    for (const [chemin, { contenu, outils: pour }] of plan) {
      const tampon = Buffer.isBuffer(contenu) ? contenu : Buffer.from(contenu, "utf8");
      const nouvelle = empreinte(tampon);
      const connu = this.registre.fichiers[chemin];
      const surDisque = empreinteDisque(chemin);
      if (surDisque !== null && connu && surDisque !== connu.empreinte) {
        rapport.gardes.push({ chemin, raison: "modifié depuis son installation : gardé tel quel" });
        fichiers[chemin] = connu;
        continue;
      }
      if (surDisque !== null && !connu && surDisque !== nouvelle) {
        rapport.gardes.push({ chemin, raison: "déjà présent, installé par autre chose que pulseia : laissé en place" });
        continue;
      }
      if (surDisque === nouvelle) rapport.inchanges++;
      else {
        fs.mkdirSync(path.dirname(chemin), { recursive: true });
        fs.writeFileSync(chemin, tampon);
        rapport.ecrits++;
      }
      fichiers[chemin] = { empreinte: nouvelle, outils: pour };
    }
    for (const [chemin, connu] of Object.entries(this.registre.fichiers)) {
      if (plan.has(chemin)) continue;
      const surDisque = empreinteDisque(chemin);
      if (surDisque === null) continue;
      if (surDisque !== connu.empreinte) {
        rapport.gardes.push({ chemin, raison: "modifié depuis son installation : gardé, à retirer vous-même si besoin" });
        continue;
      }
      fs.rmSync(chemin, { force: true });
      retirerDossiersVides(chemin);
      rapport.retires++;
    }
    this.registre = { version: versionPaquet(), outils, packs, fichiers };
    this.enregistrer();
    return rapport;
  }

  enregistrer() {
    if (this.registre.outils.length === 0 && Object.keys(this.registre.fichiers).length === 0) {
      fs.rmSync(this.fichierRegistre, { force: true });
      try {
        fs.rmdirSync(path.dirname(this.fichierRegistre));
      } catch {
        // dossier non vide ou absent
      }
      return;
    }
    fs.mkdirSync(path.dirname(this.fichierRegistre), { recursive: true });
    fs.writeFileSync(this.fichierRegistre, `${JSON.stringify(this.registre, null, 2)}\n`);
  }
}

module.exports = { Installation, empreinte };
