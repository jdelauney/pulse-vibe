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
    this.registre = { version: null, outils: [], packs: [], gardes: false, fichiers: {}, ...lireJson(this.fichierRegistre, {}) };
  }

  get outils() {
    return this.registre.outils;
  }

  get packs() {
    return this.registre.packs;
  }

  get gardes() {
    return this.registre.gardes === true;
  }

  /** Les fichiers du registre modifiés depuis leur pose. */
  modifies() {
    return Object.entries(this.registre.fichiers)
      .filter(([chemin, f]) => {
        if (f.fusion) return false;
        const e = empreinteDisque(chemin);
        return e !== null && e !== f.empreinte;
      })
      .map(([chemin]) => chemin);
  }

  /**
   * Pose les fichiers des outils donnés et retire ceux qui ne servent plus.
   * Rapport : { ecrits, inchanges, retires, gardes: [{ chemin, raison }] }.
   */
  appliquer({ outils, packs, gardes = false }) {
    const plan = planifier(outils, { gardes });
    const rapport = { ecrits: 0, inchanges: 0, retires: 0, gardes: [] };
    const fichiers = {};
    for (const [chemin, { contenu, fusion, outils: pour }] of plan) {
      if (fusion) {
        const f = this.fusionner(chemin, fusion, rapport);
        if (f) fichiers[chemin] = { ...f, outils: pour };
        continue;
      }
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
      if (connu.fusion) {
        this.defusionner(chemin, connu, rapport);
        continue;
      }
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
    this.registre = { version: versionPaquet(), outils, packs, gardes, fichiers };
    this.enregistrer();
    return rapport;
  }

  /**
   * Fichier de configuration partagé avec la personne (JSON, ex. ~/.cursor/hooks.json) : les entrées de Pulse
   * sont retirées puis remises, le reste du fichier est gardé. Rend l'entrée du registre, ou null si le fichier est illisible.
   */
  fusionner(chemin, fusion, rapport) {
    let texte = null;
    let objet = {};
    try {
      texte = fs.readFileSync(chemin, "utf8");
      objet = JSON.parse(texte);
    } catch (e) {
      if (texte !== null) {
        rapport.gardes.push({ chemin, raison: "illisible (JSON invalide) : les garde-fous n'y sont pas ajoutés" });
        return null;
      }
    }
    const nouveau = `${JSON.stringify(fusion.ajouter(fusion.retirer(objet)), null, 2)}
`;
    if (nouveau === texte) rapport.inchanges++;
    else {
      fs.mkdirSync(path.dirname(chemin), { recursive: true });
      fs.writeFileSync(chemin, nouveau);
      rapport.ecrits++;
    }
    const connu = this.registre.fichiers[chemin];
    return { fusion: fusion.id, cree: connu ? connu.cree : texte === null };
  }

  /** Retire les entrées de Pulse d'un fichier partagé ; le supprime s'il ne reste rien et que Pulse l'avait créé. */
  defusionner(chemin, connu, rapport) {
    const fusion = require("./fusions")[connu.fusion];
    let objet;
    try {
      objet = JSON.parse(fs.readFileSync(chemin, "utf8"));
    } catch {
      return;
    }
    if (!fusion) return;
    const reste = fusion.retirer(objet);
    if (connu.cree && fusion.vide(reste)) fs.rmSync(chemin, { force: true });
    else fs.writeFileSync(chemin, `${JSON.stringify(reste, null, 2)}
`);
    rapport.retires++;
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
