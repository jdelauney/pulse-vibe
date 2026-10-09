import { Writable } from "node:stream";
import { DrizzleQueryError } from "drizzle-orm/errors";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { optionsJournal, serialiserErreur, sortiesDuJournal } from "../logger";

/** Un journal qui écrit dans un tableau, avec les réglages de l'application. */
function journalDeTest() {
  const lignes: Record<string, unknown>[] = [];
  const sortie = new Writable({
    write(morceau, _encodage, suite) {
      lignes.push(JSON.parse(String(morceau)));
      suite();
    },
  });
  return {
    journal: pino({ ...optionsJournal, level: "info" }, sortie),
    lignes,
  };
}

describe("Journal du serveur", () => {
  it("masque les clés sensibles à toute profondeur, tableaux compris", () => {
    const { journal, lignes } = journalDeTest();
    journal.info(
      {
        password: "a",
        utilisateur: { email: "x@exemple.fr", profil: { motDePasse: "b" } },
        req: { headers: { cookie: "c", authorization: "Bearer d" } },
        appels: [{ token: "e" }],
        compte: { reglages: { securite: { token: "f" } } },
      },
      "essai",
    );
    const texte = JSON.stringify(lignes[0]);
    for (const valeur of [
      '"a"',
      "x@exemple.fr",
      '"b"',
      '"c"',
      "Bearer d",
      '"e"',
      '"f"',
    ])
      expect(texte).not.toContain(valeur);
    expect(texte).toContain("[masqué]");
  });

  it("masque aussi les en-têtes en majuscules et les clés d'API", () => {
    const { journal, lignes } = journalDeTest();
    journal.info(
      {
        req: {
          headers: {
            Authorization: "Bearer g",
            Cookie: "h",
            "set-cookie": "i",
            "x-api-key": "j",
          },
        },
        service: { apiKey: "k", secret: "l", clientSecret: "m" },
      },
      "essai",
    );
    const texte = JSON.stringify(lignes[0]);
    for (const valeur of ["Bearer g", '"h"', '"i"', '"j"', '"k"', '"l"', '"m"'])
      expect(texte).not.toContain(valeur);
  });

  it("garde les autres champs lisibles", () => {
    const { journal, lignes } = journalDeTest();
    journal.info({ action: "creerFacture", duree: 12 }, "Action terminée");
    expect(lignes[0]).toMatchObject({ action: "creerFacture", duree: 12 });
  });
});

/** Une sortie qui garde chaque ligne écrite. */
function sortieDeTest() {
  const lignes: Record<string, unknown>[] = [];
  const flux = new Writable({
    write(morceau, _encodage, suite) {
      lignes.push(JSON.parse(String(morceau)));
      suite();
    },
  });
  return { flux, lignes };
}

const VALEURS = ["marie.dupont@exemple.fr", "Marie Dupont", "tok_secret_123"];
const REQUETE =
  'insert into "utilisateur" ("email","nom","token") values ($1,$2,$3)';

/** Inscription en double, comme dans l'essai de la revue (E:/tmp/revue2/pack/essai/fuite.cjs). */
function inscriptionEnDouble() {
  const cause = Object.assign(
    new Error(
      'duplicate key value violates unique constraint "utilisateur_email_unique"',
    ),
    {
      code: "23505",
      constraint: "utilisateur_email_unique",
      detail: "Key (email)=(marie.dupont@exemple.fr) already exists.",
    },
  );
  return { cause, erreur: new DrizzleQueryError(REQUETE, VALEURS, cause) };
}

describe("Erreurs de requête SQL dans le journal", () => {
  it("une DrizzleQueryError garde la requête et la cause, sans les valeurs", () => {
    const { journal, lignes } = journalDeTest();
    journal.error(
      { err: inscriptionEnDouble().erreur, action: "inscrire" },
      "Erreur dans une action serveur",
    );
    const texte = JSON.stringify(lignes[0]);
    for (const valeur of VALEURS) expect(texte).not.toContain(valeur);
    const err = lignes[0].err as Record<string, unknown>;
    expect(err.query).toBe(REQUETE);
    expect(err).not.toHaveProperty("params");
    expect(err.message).toContain(`Failed query: ${REQUETE}`);
    expect(err.message).toContain("duplicate key value");
    expect(err.stack).toContain(`Failed query: ${REQUETE}`);
    expect(lignes[0].action).toBe("inscrire");
  });

  it("une erreur qui enveloppe une DrizzleQueryError ne la laisse pas fuir", () => {
    const { journal, lignes } = journalDeTest();
    const enveloppe = new Error("Inscription impossible", {
      cause: inscriptionEnDouble().erreur,
    });
    journal.error({ err: enveloppe }, "Erreur dans une action serveur");
    const texte = JSON.stringify(lignes[0]);
    for (const valeur of VALEURS) expect(texte).not.toContain(valeur);
    expect((lignes[0].err as { message: string }).message).toContain(
      "Inscription impossible",
    );
  });

  it("une erreur de Postgres journalisée seule perd son détail, garde son code", () => {
    const { journal, lignes } = journalDeTest();
    journal.error({ err: inscriptionEnDouble().cause }, "Erreur de la base");
    expect(JSON.stringify(lignes[0])).not.toContain("marie.dupont@exemple.fr");
    expect(lignes[0].err).toMatchObject({
      code: "23505",
      constraint: "utilisateur_email_unique",
    });
  });

  it("une AggregateError qui contient une DrizzleQueryError ne la laisse pas fuir", () => {
    const { journal, lignes } = journalDeTest();
    const groupe = new AggregateError(
      [inscriptionEnDouble().erreur],
      "Plusieurs échecs",
    );
    journal.error({ err: groupe }, "Erreur dans une action serveur");
    const texte = JSON.stringify(lignes[0]);
    for (const valeur of VALEURS) expect(texte).not.toContain(valeur);
    const interne = (
      lignes[0].err as { aggregateErrors: { message: string; query: string }[] }
    ).aggregateErrors[0];
    expect(interne.query).toBe(REQUETE);
    expect(interne.message).toContain(`Failed query: ${REQUETE}`);
  });

  it("une erreur rangée dans une autre propriété que cause ne fuit pas", () => {
    const { journal, lignes } = journalDeTest();
    const enveloppe = Object.assign(new Error("A"), {
      original: inscriptionEnDouble().erreur,
    });
    journal.error({ err: enveloppe }, "Erreur dans une action serveur");
    const texte = JSON.stringify(lignes[0]);
    for (const valeur of VALEURS) expect(texte).not.toContain(valeur);
  });

  it("le code et la contrainte de la cause restent visibles", () => {
    const { journal, lignes } = journalDeTest();
    journal.error({ err: inscriptionEnDouble().erreur }, "Erreur de la base");
    expect(lignes[0].err).toMatchObject({
      causeCode: "23505",
      causeConstraint: "utilisateur_email_unique",
    });
  });

  it("le code de la cause est cherché le long de la chaîne des causes", () => {
    const { journal, lignes } = journalDeTest();
    const enveloppe = new Error("Inscription impossible", {
      cause: inscriptionEnDouble().erreur,
    });
    journal.error({ err: enveloppe }, "Erreur dans une action serveur");
    expect(lignes[0].err).toMatchObject({
      causeCode: "23505",
      causeConstraint: "utilisateur_email_unique",
    });
  });

  it("une référence circulaire ne laisse pas fuir les valeurs", () => {
    const { journal, lignes } = journalDeTest();
    const b = inscriptionEnDouble().erreur;
    const a = Object.assign(new Error("A"), { original: b });
    Object.assign(b, { retour: a });
    journal.error({ err: a }, "Erreur dans une action serveur");
    const texte = JSON.stringify(lignes[0]);
    for (const valeur of VALEURS) expect(texte).not.toContain(valeur);
    const original = (lignes[0].err as { original: { retour: unknown } })
      .original;
    expect(original.retour).toEqual({
      type: "Error",
      message: "[erreur déjà journalisée]",
    });
  });

  it("une erreur présente deux fois dans une AggregateError ne fuit pas", () => {
    const { journal, lignes } = journalDeTest();
    const x = inscriptionEnDouble().erreur;
    journal.error({ err: new AggregateError([x, x]) }, "Plusieurs échecs");
    const texte = JSON.stringify(lignes[0]);
    for (const valeur of VALEURS) expect(texte).not.toContain(valeur);
    const [premiere, seconde] = (
      lignes[0].err as { aggregateErrors: Record<string, unknown>[] }
    ).aggregateErrors;
    expect(premiere.query).toBe(REQUETE);
    expect(seconde).toEqual({
      type: "Error",
      message: "[erreur déjà journalisée]",
    });
  });

  it("une valeur lancée qui n'est pas une erreur reste telle quelle", () => {
    expect(serialiserErreur("texte")).toBe("texte");
    expect(serialiserErreur(undefined)).toBeUndefined();
  });
});

describe("Sorties du journal", () => {
  it("les erreurs vont sur la sortie d'erreur (Vercel : niveau Error), le reste sur la sortie standard", () => {
    const sortie = sortieDeTest();
    const erreurs = sortieDeTest();
    const journal = pino(
      { ...optionsJournal, level: "info" },
      sortiesDuJournal(sortie.flux, erreurs.flux),
    );
    journal.info("information");
    journal.warn("avertissement");
    journal.error("panne");
    expect(sortie.lignes.map((l) => l.msg)).toEqual([
      "information",
      "avertissement",
    ]);
    expect(erreurs.lignes.map((l) => l.msg)).toEqual(["panne"]);
  });
});
