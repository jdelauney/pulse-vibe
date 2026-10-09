import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestError } from "../instrumentation";

vi.mock("@src/lib/errors/erreur-de-requete", () => ({
  journaliserErreurDeRequete: () => {
    throw new Error("le journal est en panne");
  },
}));

const contexte = {
  routerKind: "App Router",
  routePath: "/",
  routeType: "render",
  renderSource: "react-server-components",
  revalidateReason: undefined,
  renderType: "dynamic",
} as const;

describe("onRequestError", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("ne rejette jamais, même quand le journal est en panne", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    await expect(
      onRequestError(
        new Error("boum"),
        { path: "/", method: "GET", headers: {} },
        contexte,
      ),
    ).resolves.toBeUndefined();
  });
});
