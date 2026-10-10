### 8. Protéger un formulaire : l'exemple de contact

Le nom du formulaire est une constante du schéma : le container l'utilise pour demander le jeton, l'action pour le vérifier.

<!-- fichier: src/features/contact/schemas/contact.schema.ts -->
```ts
// src/features/contact/schemas/contact.schema.ts
import { z } from "zod";

// Nom du formulaire : le même dans le container (jeton demandé) et dans l'action (jeton vérifié).
export const FORMULAIRE_CONTACT = "contact";

export const schemaMessage = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Écrivez votre message.")
    .max(2000, "2 000 caractères au plus."),
});

export type MessageContact = z.infer<typeof schemaMessage>;
```

<!-- fichier: src/features/contact/actions/envoyer-message.action.ts -->
```ts
// src/features/contact/actions/envoyer-message.action.ts
"use server";

import { actionFormulairePublic } from "@src/lib/formulaire-public";
import { logger } from "@src/lib/logger";
import { FORMULAIRE_CONTACT, schemaMessage } from "../schemas/contact.schema";

// Le schéma retire les champs de protection : parsedInput ne contient que le message.
export const envoyerMessage = actionFormulairePublic(FORMULAIRE_CONTACT)
  .metadata({ nom: "envoyerMessage" })
  .inputSchema(schemaMessage)
  .action(async ({ parsedInput }) => {
    logger.info({ longueur: parsedInput.message.length }, "Message reçu");
    return { ok: true };
  });
```

La section affiche le champ piège et désactive le bouton tant que le jeton n'est pas arrivé :

<!-- fichier: src/features/contact/components/sections/formulaire-contact.tsx -->
```tsx
// src/features/contact/components/sections/formulaire-contact.tsx
"use client";

import { ChampPiege } from "@src/components/shared/elements/champ-piege";
import { Button } from "@src/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@src/components/ui/field";
import { Textarea } from "@src/components/ui/textarea";
import { useForm } from "@tanstack/react-form";
import { type Ref, useId } from "react";
import {
  type MessageContact,
  schemaMessage,
} from "../../schemas/contact.schema";

type Props = {
  envoyer: (valeurs: MessageContact) => Promise<boolean>;
  erreurServeur?: string;
  enCours: boolean;
  /** Le jeton du formulaire est arrivé. */
  pret: boolean;
  /** Le jeton n'a pas pu être obtenu. */
  echecPreparation: boolean;
  refPiege: Ref<HTMLInputElement>;
};

export function FormulaireContact({
  envoyer,
  erreurServeur,
  enCours,
  pret,
  echecPreparation,
  refPiege,
}: Props) {
  const prefixe = useId();
  const form = useForm({
    defaultValues: { message: "" },
    validators: { onSubmit: schemaMessage },
    onSubmit: async ({ value, formApi }) => {
      if (await envoyer(value)) formApi.reset();
    },
  });

  return (
    <form
      noValidate
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="message">
          {(field) => {
            const invalide =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={invalide}>
                <FieldLabel htmlFor={`${prefixe}-${field.name}`}>
                  Votre message
                </FieldLabel>
                <Textarea
                  id={`${prefixe}-${field.name}`}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={invalide}
                  rows={6}
                />
                {invalide && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>

        <ChampPiege ref={refPiege} />

        {echecPreparation && (
          <p role="alert" className="text-sm text-destructive">
            Le formulaire n'a pas pu se préparer. Rechargez la page.
          </p>
        )}
        {erreurServeur && (
          <p role="alert" className="text-sm text-destructive">
            {erreurServeur}
          </p>
        )}

        <Button type="submit" disabled={enCours || !pret}>
          {enCours ? "Envoi en cours…" : "Envoyer"}
        </Button>
      </FieldGroup>
    </form>
  );
}
```

Le container appelle le hook et ajoute les champs de protection aux valeurs envoyées :

<!-- fichier: src/features/contact/components/containers/contact.container.tsx -->
```tsx
// src/features/contact/components/containers/contact.container.tsx
"use client";

import { useProtectionFormulaire } from "@src/hooks/use-protection-formulaire";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { envoyerMessage } from "../../actions/envoyer-message.action";
import { FORMULAIRE_CONTACT } from "../../schemas/contact.schema";
import { FormulaireContact } from "../sections/formulaire-contact";

export function ContactContainer() {
  const protection = useProtectionFormulaire(FORMULAIRE_CONTACT);
  const { executeAsync, result, isPending } = useAction(envoyerMessage);
  return (
    <FormulaireContact
      envoyer={async (valeurs) => {
        const reponse = await executeAsync({
          ...valeurs,
          ...protection.champs(),
        });
        if (reponse?.data?.ok) {
          toast.success("Message envoyé. Merci !");
          return true;
        }
        return false;
      }}
      erreurServeur={result.serverError}
      enCours={isPending}
      pret={protection.pret}
      echecPreparation={protection.echec}
      refPiege={protection.refPiege}
    />
  );
}
```

<!-- fichier: app/(public)/contact/page.tsx -->
```tsx
// app/(public)/contact/page.tsx
import { ContactContainer } from "@src/features/contact/components/containers/contact.container";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "Écrivez-nous : nous répondons rapidement.",
};

export default function PageContact() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Nous écrire</h1>
      <ContactContainer />
    </main>
  );
}
```

Pour un autre formulaire public : un nom de formulaire (lettres minuscules, chiffres, tirets), `actionFormulairePublic(<nom>)` dans l'action, `useProtectionFormulaire(<nom>)` dans le container, `<ChampPiege ref={…} />` dans la section. Pour une autre règle de limite : `actionFormulairePublic(<nom>, "inscription")`.

