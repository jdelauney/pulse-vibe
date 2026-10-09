### 8. Le formulaire : section et container

La section porte les champs et le schéma Zod (`validators.onSubmit`, dans le navigateur). Elle reçoit tout par props : `envoyer(valeurs)` (qui répond `true` si l'action a réussi, `false` sinon : voir architecture.md §4), `erreursChamps` (erreurs de champ renvoyées par le serveur, affichées sous les champs concernés, jusqu'à la modification du champ), `erreurServeur` (affiché sous les champs) et `enCours` (bouton désactivé pendant l'envoi). Si la validation du navigateur passe, `onSubmit` appelle `envoyer` ; le formulaire se vide après une création réussie.

<!-- fichier: src/features/factures/components/sections/formulaire-facture.tsx -->
```tsx
// src/features/factures/components/sections/formulaire-facture.tsx
"use client";

import { Button } from "@src/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@src/components/ui/field";
import { Input } from "@src/components/ui/input";
import { useForm } from "@tanstack/react-form";
import { useId, useState } from "react";
import type { ChampFacture } from "../../constants/factures";
import {
  type CreerFactureEntree,
  creerFactureSchema,
} from "../../schemas/facture.schema";

type Props = {
  envoyer: (valeurs: CreerFactureEntree) => Promise<boolean>;
  /** Erreurs de champ renvoyées par le serveur, affichées sous les champs concernés. */
  erreursChamps?: Partial<Record<ChampFacture, { message: string }>>;
  erreurServeur?: string;
  enCours: boolean;
};

export function FormulaireFacture({
  envoyer,
  erreursChamps,
  erreurServeur,
  enCours,
}: Props) {
  const prefixe = useId();
  // Valeurs de la dernière tentative : l'erreur du serveur disparaît dès que le champ est modifié.
  const [envoyees, setEnvoyees] = useState<CreerFactureEntree | null>(null);

  const form = useForm({
    defaultValues: { client: "", montant: "" },
    validators: { onSubmit: creerFactureSchema },
    onSubmit: async ({ value, formApi }) => {
      setEnvoyees(value);
      if (await envoyer(value)) {
        formApi.reset();
      }
    },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="client">
          {(field) => {
            const erreurChamp =
              envoyees?.[field.name] === field.state.value
                ? erreursChamps?.[field.name]
                : undefined;
            const invalide =
              (field.state.meta.isTouched && !field.state.meta.isValid) ||
              Boolean(erreurChamp);
            return (
              <Field data-invalid={invalide}>
                <FieldLabel htmlFor={`${prefixe}-${field.name}`}>
                  Client
                </FieldLabel>
                <Input
                  id={`${prefixe}-${field.name}`}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={invalide}
                  autoComplete="organization"
                />
                {invalide && (
                  <FieldError
                    errors={[...field.state.meta.errors, erreurChamp]}
                  />
                )}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="montant">
          {(field) => {
            const erreurChamp =
              envoyees?.[field.name] === field.state.value
                ? erreursChamps?.[field.name]
                : undefined;
            const invalide =
              (field.state.meta.isTouched && !field.state.meta.isValid) ||
              Boolean(erreurChamp);
            return (
              <Field data-invalid={invalide}>
                <FieldLabel htmlFor={`${prefixe}-${field.name}`}>
                  Montant (€)
                </FieldLabel>
                <Input
                  id={`${prefixe}-${field.name}`}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={invalide}
                  inputMode="decimal"
                  autoComplete="off"
                />
                <FieldDescription>Par exemple 120,50.</FieldDescription>
                {invalide && (
                  <FieldError
                    errors={[...field.state.meta.errors, erreurChamp]}
                  />
                )}
              </Field>
            );
          }}
        </form.Field>

        {erreurServeur && (
          <p role="alert" className="text-sm text-destructive">
            {erreurServeur}
          </p>
        )}

        <Button type="submit" disabled={enCours}>
          {enCours ? "Création en cours…" : "Créer la facture"}
        </Button>
      </FieldGroup>
    </form>
  );
}
```

Le container (client) appelle `useAction` de `next-safe-action/hooks`, affiche les messages `toast` et passe ses props à la section.

<!-- fichier: src/features/factures/components/containers/creation-facture.container.tsx -->
```tsx
// src/features/factures/components/containers/creation-facture.container.tsx
"use client";

import { erreursDeChamps } from "@src/lib/helpers/formulaire/erreurs-de-champs";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { creerFactureAction } from "../../actions/creer-facture.action";
import { CHAMPS_FACTURE } from "../../constants/factures";
import { FormulaireFacture } from "../sections/formulaire-facture";

export function CreationFactureContainer() {
  const { executeAsync, result, isPending } = useAction(creerFactureAction);
  return (
    <FormulaireFacture
      envoyer={async (valeurs) => {
        const reponse = await executeAsync(valeurs);
        if (reponse?.data) {
          toast.success("Facture créée.");
          return true;
        }
        if (reponse?.validationErrors) {
          toast.error("Vérifiez les champs signalés.");
        }
        return false;
      }}
      erreursChamps={
        result.validationErrors
          ? erreursDeChamps(CHAMPS_FACTURE, result.validationErrors)
          : undefined
      }
      erreurServeur={result.serverError}
      enCours={isPending}
    />
  );
}
```

