import { logger } from "@src/lib/logger";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  creerLimiteur,
  recevoirErreurClient,
  TAILLE_MAX,
} from "../erreur-client";

vi.mock("@src/lib/logger", () => ({ logger: { error: vi.fn() } }));

const SITE = "http://localhost:3000";
const toujours = () => true;

function envoi(
  corps: string | ReadableStream<Uint8Array>,
  entetes: Record<string, string> = { origin: SITE },
) {
  return new NextRequest(`${SITE}/api/erreur-client`, {
    method: "POST",
    body: corps,
    headers: { "x-forwarded-for": "203.0.113.7", ...entetes },
    // Node exige duplex pour un corps lu en flux.
    ...(typeof corps === "string" ? {} : { duplex: "half" }),
  });
}

describe("Erreurs du navigateur", () => {
  beforeEach(() => vi.mocked(logger.error).mockClear());

  it("une erreur envoyée par le site est journalisée : chemin sans requête, message coupé", async () => {
    const r = await recevoirErreurClient(
      envoi(
        JSON.stringify({
          message: "x".repeat(500),
          chemin: "/compte?token=jeton-secret",
        }),
      ),
      toujours,
    );
    expect(r.status).toBe(204);
    const [champs, message] = vi.mocked(logger.error).mock.calls[0];
    expect(message).toBe("Erreur dans le navigateur");
    expect(champs).toMatchObject({ source: "navigateur", chemin: "/compte" });
    expect((champs as { message: string }).message).toHaveLength(200);
    expect(JSON.stringify(champs)).not.toContain("jeton-secret");
  });

  it("adresses citées dans le message : sans requête, sans ancre, sans identifiants", async () => {
    await recevoirErreurClient(
      envoi(
        JSON.stringify({
          message:
            "échec https://user:pass@api.exemple.fr/a?token=jeton-1 puis /reset#code=jeton-2 Pourquoi ?",
          chemin: "/",
        }),
      ),
      toujours,
    );
    const [champs] = vi.mocked(logger.error).mock.calls[0];
    expect((champs as { message: string }).message).toBe(
      "échec https://api.exemple.fr/a puis /reset Pourquoi ?",
    );
  });

  it("refus sans rien écrire : autre site, sans origine, trop gros, illisible, incomplet", async () => {
    const cas: [NextRequest, number][] = [
      [envoi('{"chemin":"/"}', { origin: "https://autre-site.fr" }), 403],
      [envoi('{"chemin":"/"}', {}), 403],
      [
        envoi(JSON.stringify({ chemin: "/", message: "x".repeat(TAILLE_MAX) })),
        413,
      ],
      [envoi("pas du JSON"), 400],
      [envoi('{"message":"sans chemin"}'), 400],
    ];
    for (const [requete, statut] of cas) {
      expect((await recevoirErreurClient(requete, toujours)).status).toBe(
        statut,
      );
    }
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("taille annoncée trop grande : 413 sans lire le corps", async () => {
    const requete = envoi('{"chemin":"/"}', {
      origin: SITE,
      "content-length": String(TAILLE_MAX + 1),
    });
    expect((await recevoirErreurClient(requete, toujours)).status).toBe(413);
    expect(requete.bodyUsed).toBe(false);
  });

  it("corps sans taille annoncée : la lecture s'arrête au-delà de la limite", async () => {
    let morceauxLus = 0;
    const flux = new ReadableStream<Uint8Array>({
      pull(controleur) {
        morceauxLus += 1;
        controleur.enqueue(new TextEncoder().encode("x".repeat(1_000)));
      },
    });
    const r = await recevoirErreurClient(envoi(flux), toujours);
    expect(r.status).toBe(413);
    expect(morceauxLus).toBeLessThan(10);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("trop d'envois depuis la même adresse : 429, rien n'est écrit", async () => {
    const r = await recevoirErreurClient(envoi('{"chemin":"/"}'), () => false);
    expect(r.status).toBe(429);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("limiteur : 10 envois par minute et par adresse, de nouveau après une minute", () => {
    let instant = 0;
    const accepter = creerLimiteur(() => instant);
    const verdicts = Array.from({ length: 11 }, () => accepter("203.0.113.7"));
    expect(verdicts.filter(Boolean)).toHaveLength(10);
    expect(accepter("198.51.100.1")).toBe(true);
    instant = 60_000;
    expect(accepter("203.0.113.7")).toBe(true);
  });
});
