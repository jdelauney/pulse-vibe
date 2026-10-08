/**
 * Panne d'un service externe (paiement, e-mail, stockage…), levée par un adapter.
 * Le message reste sans secret ; la cause d'origine est gardée pour le journal du serveur.
 */
export class ErreurService extends Error {
  readonly service: string;

  constructor(service: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ErreurService";
    this.service = service;
  }
}
