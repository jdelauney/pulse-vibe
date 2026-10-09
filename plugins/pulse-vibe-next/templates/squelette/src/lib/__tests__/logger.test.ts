import { Writable } from "node:stream";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { optionsJournal } from "../logger";

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
