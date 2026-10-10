import { logger } from "@src/lib/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cheminSansRequete,
  journaliserErreurDeRequete,
} from "../erreur-de-requete";

vi.mock("@src/lib/logger", () => ({ logger: { error: vi.fn() } }));

const contexte = {
  routerKind: "App Router",
  routePath: "/factures/[id]",
  routeType: "render",
  renderSource: "react-server-components",
  revalidateReason: undefined,
  renderType: "dynamic",
} as const;

describe("journaliserErreurDeRequete", () => {
  beforeEach(() => vi.mocked(logger.error).mockClear());

  it("journalise la référence, la route et l'identifiant de requête, sans les en-têtes", () => {
    const erreur = Object.assign(new Error("boum"), { digest: "1234567890" });
    journaliserErreurDeRequete(
      erreur,
      {
        path: "/factures/42",
        method: "GET",
        headers: { "x-vercel-id": "fra1::abc", cookie: "session=secret" },
      },
      contexte,
    );
    const [champs, message] = vi.mocked(logger.error).mock.calls[0];
    expect(message).toBe("Erreur du serveur");
    expect(champs).toEqual({
      err: erreur,
      digest: "1234567890",
      requete: "fra1::abc",
      methode: "GET",
      chemin: "/factures/42",
      route: "/factures/[id]",
      type: "render",
    });
    expect(JSON.stringify(champs)).not.toContain("session=secret");
  });

  it("une valeur lancée qui n'est pas un objet : journalisée sans référence", () => {
    journaliserErreurDeRequete(
      "texte",
      { path: "/", method: "GET", headers: {} },
      contexte,
    );
    expect(vi.mocked(logger.error).mock.calls[0][0]).toMatchObject({
      err: "texte",
      digest: undefined,
      requete: undefined,
    });
  });

  it("le chemin journalisé perd sa chaîne de requête (jeton de réinitialisation)", () => {
    journaliserErreurDeRequete(
      new Error("boum"),
      {
        path: "/nouveau-mot-de-passe?token=jeton-secret&x=1",
        method: "GET",
        headers: {},
      },
      contexte,
    );
    const [champs] = vi.mocked(logger.error).mock.calls[0];
    expect(champs).toMatchObject({ chemin: "/nouveau-mot-de-passe" });
    expect(JSON.stringify(champs)).not.toContain("jeton-secret");
  });

  it("cheminSansRequete : coupe à « ? » et à « # »", () => {
    expect(cheminSansRequete("/a?b=1")).toBe("/a");
    expect(cheminSansRequete("/a#b")).toBe("/a");
    expect(cheminSansRequete("/a")).toBe("/a");
  });
});
