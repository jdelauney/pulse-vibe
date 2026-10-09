### 4. Le limiteur en base

Une seule requête compte la tentative : elle crée la ligne, ou l'incrémente, ou la remet à 1 si la fenêtre est écoulée (`onConflictDoUpdate`, c'est-à-dire `INSERT … ON CONFLICT DO UPDATE` de Postgres). Postgres verrouille la ligne pendant la mise à jour : deux envois simultanés sont comptés l'un après l'autre, sans dépasser la limite. Environ une vérification sur cinquante efface au passage des compteurs de plus d'un jour, sans tâche planifiée.

```ts
// src/db/limite/limite.repository.ts
import "server-only";
import type { Limiteur } from "@src/core/shared/limiteur.port";
import type { Db } from "@src/db/db-client";
import { inArray, lt, sql } from "drizzle-orm";
import { limites } from "./limite.table";

const UN_JOUR_MS = 86_400_000;
const LOT_DE_MENAGE = 500;

/**
 * Limiteur rangé dans Postgres (Neon) : une ligne par clé, comptée en une seule requête.
 * Postgres verrouille la ligne pendant la mise à jour : deux envois simultanés sont comptés l'un après l'autre.
 */
export function limiteurBase(
  db: Db,
  options: { nettoyer?: () => boolean } = {},
): Limiteur {
  // Environ une vérification sur cinquante efface au passage des compteurs de plus d'un jour.
  const nettoyer = options.nettoyer ?? (() => Math.random() < 0.02);
  return {
    async verifier(cle, { nombre, fenetreMs }, maintenant) {
      const instant = new Date(maintenant).toISOString();
      const finDeLaFenetrePrecedente = new Date(
        maintenant - fenetreMs,
      ).toISOString();
      const fenetreEcoulee = sql`${limites.debut} <= ${finDeLaFenetrePrecedente}::timestamptz`;
      const [ligne] = await db
        .insert(limites)
        .values({ cle, compte: 1, debut: new Date(maintenant) })
        .onConflictDoUpdate({
          target: limites.cle,
          set: {
            compte: sql`case when ${fenetreEcoulee} then 1 else ${limites.compte} + 1 end`,
            debut: sql`case when ${fenetreEcoulee} then ${instant}::timestamptz else ${limites.debut} end`,
          },
        })
        .returning({ compte: limites.compte, debut: limites.debut });
      if (nettoyer()) {
        await effacerAnciens(db, maintenant);
      }
      return {
        accepte: ligne.compte <= nombre,
        reset: ligne.debut.getTime() + fenetreMs,
      };
    },
  };
}

async function effacerAnciens(db: Db, maintenant: number) {
  const anciens = db
    .select({ cle: limites.cle })
    .from(limites)
    .where(lt(limites.debut, new Date(maintenant - UN_JOUR_MS)))
    .limit(LOT_DE_MENAGE);
  await db.delete(limites).where(inArray(limites.cle, anciens));
}
```

