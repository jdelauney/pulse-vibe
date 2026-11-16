### 10. Changer d'adresse e-mail

La nouvelle adresse reçoit un lien ; l'adresse du compte change seulement au clic. L'ancienne adresse reçoit une alerte (crochet `hooks.after` de l'étape 4). Une adresse déjà prise reçoit la même réponse à l'écran, et aucun e-mail ne part vers elle.

<!-- fichier: src/features/compte/actions/changer-adresse-email.action.ts -->
```ts
// src/features/compte/actions/changer-adresse-email.action.ts
"use server";

import { getAuth } from "@src/adapters/auth/auth.adapter";
import { actionConnectee } from "@src/lib/safe-action";
import { headers } from "next/headers";
import { returnServerError } from "next-safe-action";
import { schemaChangementAdresse } from "../schemas/compte.schema";

// Même réponse que la nouvelle adresse soit libre ou déjà prise : personne ne peut tester les comptes.
export const changerAdresseEmail = actionConnectee
  .metadata({ nom: "changerAdresseEmail" })
  .inputSchema(schemaChangementAdresse)
  .action(async ({ parsedInput, ctx }) => {
    if (
      parsedInput.email.toLowerCase() === ctx.utilisateur.email.toLowerCase()
    ) {
      returnServerError("C'est déjà l'adresse de votre compte.");
    }
    await getAuth().api.changeEmail({
      body: { newEmail: parsedInput.email, callbackURL: "/adresse-verifiee" },
      headers: await headers(),
    });
    return {
      message:
        "Ouvrez l'e-mail envoyé à la nouvelle adresse pour confirmer le changement. D'ici là, votre adresse actuelle reste valable.",
    };
  });
```

La section affiche l'adresse actuelle et le champ de la nouvelle ; le formulaire se vide après une demande réussie.

<!-- fichier: src/features/compte/components/sections/formulaire-adresse.tsx -->
```tsx
// src/features/compte/components/sections/formulaire-adresse.tsx
"use client";

import { Button } from "@src/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@src/components/ui/field";
import { Input } from "@src/components/ui/input";
import { revalidateLogic, useForm, useStore } from "@tanstack/react-form";
import { useId } from "react";
import {
  type ChangementAdresse,
  schemaChangementAdresse,
} from "../../schemas/compte.schema";

type Props = {
  adresseActuelle: string;
  /** Répond true quand la demande est partie : le formulaire se vide. */
  envoyer: (valeurs: ChangementAdresse) => Promise<boolean>;
  erreurServeur?: string;
  /** Réponse de l'action : la même que la nouvelle adresse soit libre ou non. */
  message?: string;
  enCours: boolean;
};

export function FormulaireAdresse({
  adresseActuelle,
  envoyer,
  erreurServeur,
  message,
  enCours,
}: Props) {
  const prefixe = useId();

  const form = useForm({
    defaultValues: { email: "" },
    validationLogic: revalidateLogic({
      mode: "blur",
      modeAfterSubmission: "change",
    }),
    validators: { onDynamic: schemaChangementAdresse },
    // Envoi refusé : le focus va au premier champ en erreur (experience § 5).
    onSubmitInvalid: ({ formApi }) => {
      const champ = Object.entries(formApi.state.fieldMeta).find(
        ([, meta]) => meta?.errors.length,
      )?.[0];
      if (champ) document.getElementById(`${prefixe}-${champ}`)?.focus();
    },
    onSubmit: async ({ value, formApi }) => {
      if (await envoyer(value)) {
        formApi.reset();
      }
    },
  });
  // Erreur d'un champ : affichée une fois le champ modifié puis quitté, ou après un premier envoi
  // (jamais pendant la première saisie, où elle ferait bouger la page sous le pointeur).
  const envois = useStore(form.store, (etat) => etat.submissionAttempts);
  const montrerErreur = (meta: { isBlurred: boolean; isDirty: boolean }) =>
    (meta.isBlurred && meta.isDirty) || envois > 0;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <FieldGroup>
        <p className="text-sm text-muted-foreground">
          Adresse actuelle : {adresseActuelle}
        </p>
        <form.Field name="email">
          {(field) => {
            const invalide =
              montrerErreur(field.state.meta) && !field.state.meta.isValid;
            return (
              <Field data-invalid={invalide}>
                <FieldLabel htmlFor={`${prefixe}-email`}>
                  Nouvelle adresse e-mail
                </FieldLabel>
                <Input
                  id={`${prefixe}-email`}
                  name={field.name}
                  type="email"
                  autoComplete="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={invalide}
                />
                {invalide && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>

        {erreurServeur && (
          <p role="alert" className="text-sm text-destructive">
            {erreurServeur}
          </p>
        )}
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}

        <Button type="submit" disabled={enCours}>
          {enCours ? "Envoi…" : "Changer mon adresse"}
        </Button>
      </FieldGroup>
    </form>
  );
}
```

<!-- fichier: src/features/compte/components/containers/changement-adresse.container.tsx -->
```tsx
// src/features/compte/components/containers/changement-adresse.container.tsx
"use client";

import { useAction } from "next-safe-action/hooks";
import { changerAdresseEmail } from "../../actions/changer-adresse-email.action";
import { FormulaireAdresse } from "../sections/formulaire-adresse";

export function ChangementAdresseContainer({
  adresseActuelle,
}: {
  adresseActuelle: string;
}) {
  const { executeAsync, result, isPending } = useAction(changerAdresseEmail);
  return (
    <FormulaireAdresse
      adresseActuelle={adresseActuelle}
      envoyer={async (valeurs) => {
        const reponse = await executeAsync(valeurs);
        return Boolean(reponse?.data);
      }}
      erreurServeur={result.serverError}
      message={result.data?.message}
      enCours={isPending}
    />
  );
}
```
