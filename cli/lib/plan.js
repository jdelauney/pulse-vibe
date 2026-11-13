// Le plan d'installation : chaque fichier à poser pour les outils choisis, calculé sans rien écrire.
"use strict";

const fs = require("fs");
const path = require("path");
const { racineContenu, COEUR, maison } = require("./chemins");
const { lireFrontmatter, valeur, reecrire, skillPortable } = require("./textes");
const { lireAgents } = require("./agents");
const { cible } = require("./cibles");

/** Dossier commun des skills, lu par Codex, Cursor, OpenCode et Copilot (standard Agent Skills). */
const dossierSkills = () => path.join(maison(), ".agents", "skills");

/** Une commande du cœur (skills/<nom>/). */
class Commande {
  constructor(nom, dossierSource) {
    this.nom = nom;
    this.dossierSource = dossierSource;
    this.original = fs.readFileSync(path.join(dossierSource, "SKILL.md"), "utf8");
    this.manuelleSeulement = valeur(lireFrontmatter(this.original).champs.get("disable-model-invocation")) === "true";
  }

  get dossierSkill() {
    return path.join(dossierSkills(), `pulse-${this.nom}`);
  }

  /** Le skill commun : SKILL.md transformé, et ses fichiers (références, modèles, scripts) copiés, les .md réécrits. */
  fichiersSkill() {
    const fichiers = [{ chemin: path.join(this.dossierSkill, "SKILL.md"), contenu: skillPortable(this.nom, this.original) }];
    for (const relatif of lister(this.dossierSource)) {
      if (relatif === "SKILL.md") continue;
      const source = path.join(this.dossierSource, relatif);
      const contenu = relatif.endsWith(".md") ? reecrire(fs.readFileSync(source, "utf8")) : fs.readFileSync(source);
      fichiers.push({ chemin: path.join(this.dossierSkill, relatif), contenu });
    }
    return fichiers;
  }
}

/** Les fichiers d'un dossier, chemins relatifs, triés. */
function lister(dossier, prefixe = "") {
  const resultat = [];
  for (const e of fs.readdirSync(path.join(dossier, prefixe), { withFileTypes: true })) {
    const relatif = path.join(prefixe, e.name);
    if (e.isDirectory()) resultat.push(...lister(dossier, relatif));
    else resultat.push(relatif);
  }
  return resultat.sort();
}

function lireCommandes() {
  const dossier = path.join(racineContenu(), COEUR, "skills");
  return fs
    .readdirSync(dossier)
    .filter((n) => fs.existsSync(path.join(dossier, n, "SKILL.md")))
    .sort()
    .map((n) => new Commande(n, path.join(dossier, n)));
}

/**
 * Plan pour une liste d'outils : Map<chemin absolu, { contenu, outils: string[] }>.
 * Les skills sont communs ; agents et fichiers propres à chaque outil s'y ajoutent, et ses hooks avec `gardes`.
 */
function planifier(outils, { gardes = false } = {}) {
  const plan = new Map();
  const ajouter = (fichiers, outil) => {
    for (const f of fichiers) {
      const existant = plan.get(f.chemin);
      if (f.fusion) plan.set(f.chemin, { fusion: f.fusion, outils: [outil] });
      else if (existant) existant.outils = [...new Set([...existant.outils, outil])];
      else plan.set(f.chemin, { contenu: f.contenu, outils: [outil] });
    }
  };
  if (outils.length === 0) return plan;
  const commandes = lireCommandes();
  const agents = lireAgents(path.join(racineContenu(), COEUR));
  for (const id of outils) {
    const c = cible(id);
    if (!c) throw new Error(`outil inconnu : ${id}`);
    for (const commande of commandes) {
      ajouter(commande.fichiersSkill(), id);
      ajouter(c.fichiersCommande(commande), id);
    }
    for (const agent of agents) ajouter(c.fichiersAgent(agent), id);
    if (gardes) ajouter(c.fichiersHooks(), id);
  }
  return plan;
}

module.exports = { planifier, lireCommandes, Commande, dossierSkills };
