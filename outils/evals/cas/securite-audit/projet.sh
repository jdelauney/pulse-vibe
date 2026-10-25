#!/usr/bin/env bash
# Projet Next avec des listes enregistrées en base et deux défauts placés exprès, que l'audit doit trouver :
# - S3 (contrôle d'accès) : la route qui renomme une liste la cherche par son identifiant, sans vérifier que la liste
#   appartient à la personne connectée (modifier l'identifiant dans l'adresse suffit pour toucher la liste d'une autre) ;
# - S13 (sessions et cookies) : le cookie de session est posé sans httpOnly, sans secure ni sameSite.
# Le reste est volontairement propre pour que les deux constats ressortent.
. "$(dirname "$0")/../_communs/projet-next.sh"

git_essai() { git -c user.email=essai@example.com -c user.name=essai "$@"; }

# Le projet enregistre maintenant ses listes dans la base et a des comptes : la section « Données » de docs/technical.md le dit.
sed -i 's#^| Données | aucune pour la première version | La liste d.exemple est écrite dans le code. |#| Données | Postgres (Neon) avec Drizzle | Les listes de chaque personne sont enregistrées. |#' docs/technical.md
sed -i 's#^- Où sont les données : .*#- Où sont les données : table `liste` (Postgres, Neon), une ligne par liste, avec le compte propriétaire.#' docs/technical.md
sed -i 's#^- Qui peut lire, créer, modifier, supprimer quoi : .*#- Qui peut lire, créer, modifier, supprimer quoi : chaque personne lit et modifie seulement ses listes.#' docs/technical.md
sed -i 's#^- Où c.est vérifié : .*#- Où c'"'"'est vérifié : côté serveur, dans les routes et les actions.#' docs/technical.md

ecrire src/db/courses/liste.table.ts <<'EOT'
import { pgTable, text, uuid } from "drizzle-orm/pg-core";

/** Une liste de courses : elle appartient à un compte (proprietaireId). */
export const listeTable = pgTable("liste", {
  id: uuid("id").primaryKey().defaultRandom(),
  proprietaireId: text("proprietaire_id").notNull(),
  nom: text("nom").notNull(),
});
EOT

ecrire src/features/courses/session.ts <<'EOT'
import "server-only";
import { cookies } from "next/headers";

/** Le compte connecté, lu dans le cookie de session ; null si personne n'est connecté. */
export async function compteConnecte(): Promise<string | null> {
  const jar = await cookies();
  return jar.get("session")?.value ?? null;
}
EOT

# Défaut S13 : le cookie de session est posé sans httpOnly, sans secure ni sameSite.
ecrire src/features/courses/actions/ouvrir-session.action.ts <<'EOT'
"use server";

import { cookies } from "next/headers";

/** Garde la personne connectée : le jeton de session est posé dans un cookie du navigateur. */
export async function ouvrirSession(jeton: string) {
  const jar = await cookies();
  jar.set("session", jeton, { path: "/", maxAge: 60 * 60 * 24 * 30 });
}
EOT

# Défaut S3 : la liste est trouvée par son seul identifiant ; la route vérifie qu'une personne est connectée,
# pas que la liste est la sienne.
ecrire app/api/listes/\[id\]/route.ts <<'EOT'
import { getDb } from "@src/db/db-client";
import { listeTable } from "@src/db/courses/liste.table";
import { compteConnecte } from "@src/features/courses/session";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type Contexte = { params: Promise<{ id: string }> };

/** Renomme une liste de courses. */
export async function PATCH(requete: Request, { params }: Contexte) {
  const compte = await compteConnecte();
  if (!compte) return NextResponse.json({ erreur: "Connexion requise" }, { status: 401 });

  const { id } = await params;
  const { nom } = (await requete.json()) as { nom: string };
  const [liste] = await getDb()
    .update(listeTable)
    .set({ nom })
    .where(eq(listeTable.id, id))
    .returning();
  if (!liste) return NextResponse.json({ erreur: "Liste introuvable" }, { status: 404 });
  return NextResponse.json(liste);
}
EOT

git_essai add -A
git_essai commit -q -m "feat: listes enregistrées en base, session et renommage"
