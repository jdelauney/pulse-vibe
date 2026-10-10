import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signalerErreurClient } from "../signaler-erreur-client";

const balise = vi.fn(() => true);
const envoyer = vi.fn(async () => new Response(null, { status: 204 }));

describe("signalerErreurClient", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("window", { location: { pathname: "/compte" } });
    vi.stubGlobal("navigator", { sendBeacon: balise });
    vi.stubGlobal("fetch", envoyer);
    balise.mockClear();
    envoyer.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("envoie le message court et la page, sans attendre", () => {
    signalerErreurClient(new Error("x".repeat(500)));
    expect(balise).toHaveBeenCalledOnce();
    const [adresse, corps] = balise.mock.calls[0] as unknown as [
      string,
      string,
    ];
    expect(adresse).toBe("/api/erreur-client");
    expect(JSON.parse(corps)).toEqual({
      message: "x".repeat(200),
      chemin: "/compte",
    });
  });

  it("erreur avec référence (déjà journalisée par le serveur) : rien n'est envoyé", () => {
    signalerErreurClient(Object.assign(new Error("boum"), { digest: "123" }));
    expect(balise).not.toHaveBeenCalled();
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("navigateur sans sendBeacon accepté : envoi par fetch, sans attendre", () => {
    balise.mockReturnValueOnce(false);
    signalerErreurClient(new Error("boum"));
    expect(envoyer).toHaveBeenCalledWith(
      "/api/erreur-client",
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
  });

  it("valeur levée qui n'est pas une Error (texte, null, objet) : envoyée sans planter", () => {
    expect(() => signalerErreurClient("panne" as never)).not.toThrow();
    expect(() => signalerErreurClient(null as never)).not.toThrow();
    expect(() => signalerErreurClient({ code: 1 } as never)).not.toThrow();
    const corps = balise.mock.calls.map(
      (appel) => JSON.parse((appel as unknown as [string, string])[1]).message,
    );
    expect(corps).toEqual(["panne", "null", "[object Object]"]);
  });

  it("navigateur qui refuse l'envoi : rien ne remonte à la page d'erreur", () => {
    balise.mockImplementationOnce(() => {
      throw new TypeError("sendBeacon refusé");
    });
    expect(() => signalerErreurClient(new Error("boum"))).not.toThrow();
  });

  it("en développement : rien n'est envoyé (l'erreur s'affiche déjà à l'écran)", () => {
    vi.stubEnv("NODE_ENV", "development");
    signalerErreurClient(new Error("boum"));
    expect(balise).not.toHaveBeenCalled();
  });
});
