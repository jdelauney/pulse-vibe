import { describe, expect, test } from "vitest";
import {
  ROBOTS_ENTRAINEMENT,
  ROBOTS_REPONSES_IA,
  reglesRobots,
} from "./politique-robots";

describe("Politique des robots IA", () => {
  test("A : tout est ouvert", () => {
    expect(reglesRobots("A")).toEqual([{ userAgent: "*", allow: "/" }]);
  });

  test("B : entraînement bloqué, réponses des assistants ouvertes", () => {
    const regles = reglesRobots("B");
    expect(regles).toEqual([
      { userAgent: "*", allow: "/" },
      { userAgent: ROBOTS_ENTRAINEMENT, disallow: "/" },
    ]);
    expect(ROBOTS_ENTRAINEMENT).not.toContain("OAI-SearchBot");
  });

  test("C : entraînement et réponses des assistants bloqués ; Googlebot reste ouvert", () => {
    const [, bloques] = reglesRobots("C") as { userAgent: string[] }[];
    expect(bloques.userAgent).toEqual([
      ...ROBOTS_ENTRAINEMENT,
      ...ROBOTS_REPONSES_IA,
    ]);
    expect(bloques.userAgent).not.toContain("Googlebot");
  });

  test("D : rien n'est exploré", () => {
    expect(reglesRobots("D")).toEqual([{ userAgent: "*", disallow: "/" }]);
  });

  test("chemins fermés et Content-Signal dans le groupe de tous les robots", () => {
    expect(
      reglesRobots("A", {
        fermes: ["/api/"],
        signal: "search=yes, ai-train=no",
      }),
    ).toEqual([
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
        other: { "Content-Signal": "search=yes, ai-train=no" },
      },
    ]);
  });
});
