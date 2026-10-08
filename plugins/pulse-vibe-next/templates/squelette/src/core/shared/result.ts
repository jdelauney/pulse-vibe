// Résultat d'une opération du métier : une erreur attendue est une valeur, jamais une exception.
export type Result<T, E extends string> =
  | { ok: true; valeur: T }
  | { ok: false; raison: E };

export function ok<T>(valeur: T): Result<T, never> {
  return { ok: true, valeur };
}

export function echec<E extends string>(raison: E): Result<never, E> {
  return { ok: false, raison };
}
