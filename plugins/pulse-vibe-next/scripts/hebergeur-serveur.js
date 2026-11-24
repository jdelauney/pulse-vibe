#!/usr/bin/env node
// Pack Pulse Next.js – adaptateur d'hébergeur de pulse-aidd secrets pour un serveur (hébergements docker et serveur),
// lancé par pulse-pile-next hebergeur … quand docs/technical.md déclare « **Hébergement** : docker|serveur ».
//
//   node hebergeur-serveur.js <docker|serveur> ls                    JSON : { hebergeur, manuel, variables: [] }
//   node hebergeur-serveur.js <docker|serveur> envoyer <NOM> <env>   la marche à suivre sur le serveur (code 3)
//   node hebergeur-serveur.js <docker|serveur> redeployer <env>      la commande de redémarrage (code 3)
//
// Sur un serveur, les variables vivent dans le fichier .env du dossier du site, saisi par la personne : aucun
// programme ne peut les y écrire depuis l'ordinateur, et la valeur ne passe jamais par la conversation. L'adaptateur
// dit donc quoi faire, avec le code 3 (« à faire par la personne ») du contrat des packs. La valeur reçue sur
// l'entrée standard est lue puis oubliée : jamais affichée, jamais écrite.
// Codes de sortie : 3 marche à suivre, 1 usage incorrect.
"use strict";

const fs = require("fs");
const path = require("path");

const NOM_VALIDE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ENVIRONNEMENTS = ["production", "preview", "development"];
const A_FAIRE = 3;

/**
 * Hébergeur sans interface de programmation pour ses variables (patron Template Method) : la marche à suivre est
 * commune ; chaque hébergement dit seulement comment le site relit son .env.
 */
class HebergeurManuel {
  constructor(nomDuSite) {
    this.nomDuSite = nomDuSite;
  }

  /** Nom affiché dans l'inventaire de pulse-aidd secrets. */
  get libelle() {
    throw new Error("à définir par l'hébergement");
  }

  /** Commande, tapée sur le serveur, qui fait relire le .env au site. */
  get redemarrage() {
    throw new Error("à définir par l'hébergement");
  }

  /** Où et comment une variable se saisit : une phrase, reprise par chaque réponse. */
  get saisie() {
    return (
      "Les variables vivent dans le fichier .env du dossier du site, sur le serveur, saisi par la personne : " +
      "dans sa session SSH, nano .env, la ligne NOM=valeur, enregistrer. Valeur tirée au hasard : sur le serveur, openssl rand -hex 32. " +
      "Valeur venue d'un fournisseur : copiée depuis son tableau de bord, ou depuis .env.envoi sur l'ordinateur (ligne vidée ensuite). " +
      `Ensuite, pour que le site la lise : ${this.redemarrage}.`
    );
  }

  ls() {
    return { code: 0, sortie: JSON.stringify({ hebergeur: this.libelle, manuel: this.saisie, variables: [] }) };
  }

  envoyer(nom, env) {
    if (!NOM_VALIDE.test(nom || "") || !ENVIRONNEMENTS.includes(env)) return { code: 1, sortie: "Usage : hebergeur envoyer <NOM> <production|preview|development>" };
    if (env !== "production") return { code: A_FAIRE, sortie: `${this.libelle} : pas de prévisualisation ni d'environnement de développement en ligne ; rien à faire pour ${nom} en ${env}.` };
    return { code: A_FAIRE, sortie: `${this.libelle} : pas d'envoi automatique. Sur le serveur, la personne écrit ${nom}=<valeur> dans .env (nano .env), puis ${this.redemarrage}.` };
  }

  redeployer(env) {
    if (!["production", "preview"].includes(env)) return { code: 1, sortie: "Usage : hebergeur redeployer <production|preview>" };
    if (env !== "production") return { code: A_FAIRE, sortie: `${this.libelle} : pas de prévisualisation ; rien à relancer en ${env}.` };
    return { code: A_FAIRE, sortie: `${this.libelle} : sur le serveur, dans le dossier du site, la personne lance ${this.redemarrage}.` };
  }
}

/** Le site tourne dans un conteneur : le .env se relit quand les conteneurs sont recréés. */
class HebergeurDocker extends HebergeurManuel {
  get libelle() {
    return "Serveur (Docker)";
  }

  get redemarrage() {
    return "./scripts/deployer.sh";
  }
}

/** Le site tourne sous un service systemd du compte du site. */
class HebergeurServeur extends HebergeurManuel {
  get libelle() {
    return "Serveur";
  }

  get redemarrage() {
    return `systemctl --user restart ${this.nomDuSite}`;
  }
}

const HEBERGEURS = { docker: HebergeurDocker, serveur: HebergeurServeur };

/** Nom du service : le nom du paquet (package.json du projet), comme dans scripts/deployer.sh. */
function nomDuSite(dossier = process.cwd()) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dossier, "package.json"), "utf8")).name || "<nom du paquet>";
  } catch {
    return "<nom du paquet>";
  }
}

function repondre([hebergement, action, a1, a2]) {
  const Classe = HEBERGEURS[hebergement];
  if (!Classe) return { code: 1, sortie: `Hébergement inconnu : ${hebergement} (docker ou serveur).` };
  const hebergeur = new Classe(nomDuSite());
  if (action === "ls") return hebergeur.ls();
  if (action === "envoyer") return hebergeur.envoyer(a1, a2);
  if (action === "redeployer") return hebergeur.redeployer(a1);
  return { code: 1, sortie: "Usage : pulse-pile-next hebergeur ls | envoyer <NOM> <env> | redeployer <env>" };
}

if (require.main === module) {
  // La valeur éventuelle (envoyer) est lue pour libérer l'appelant, puis oubliée.
  try {
    if (process.argv[3] === "envoyer") fs.readFileSync(0);
  } catch {
    // entrée standard absente : rien à lire
  }
  const args = process.argv.slice(2).filter((a, i, tous) => a !== "--type" && tous[i - 1] !== "--type");
  const { code, sortie } = repondre(args);
  fs.writeSync(1, `${sortie}\n`);
  process.exit(code);
}

module.exports = { repondre, HebergeurManuel, HebergeurDocker, HebergeurServeur, A_FAIRE };
