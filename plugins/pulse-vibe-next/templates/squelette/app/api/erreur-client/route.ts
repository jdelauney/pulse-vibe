import { recevoirErreurClient } from "@src/lib/errors/erreur-client";
import type { NextRequest } from "next/server";

// Erreurs du navigateur envoyées par app/error.tsx et app/global-error.tsx.
export async function POST(requete: NextRequest) {
  return recevoirErreurClient(requete);
}
