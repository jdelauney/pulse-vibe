### 9. Les formulaires : sections (TanStack Form + Field)

Chaque formulaire est une section : les champs, et le **même** schéma Zod que l'action en `validators.onSubmit` (validation dans le navigateur). Elle reçoit tout par props : `envoyer(valeurs)` (qui répond `true` si l'action a réussi, `false` sinon : voir architecture.md §4), `erreurServeur` (affiché sous les champs) et `enCours` (bouton désactivé pendant l'envoi). Un `form.Field` par champ ; les `id` sont préfixés par `useId()` (voir « Pièges connus »).

<!-- fichier: src/features/compte/components/sections/formulaire-inscription.tsx -->
```tsx
// src/features/compte/components/sections/formulaire-inscription.tsx
"use client";

import { Button } from "@src/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@src/components/ui/field";
import { Input } from "@src/components/ui/input";
import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useId } from "react";
import {
  type Inscription,
  schemaInscription,
} from "../../schemas/compte.schema";

const champs = [
  { name: "nom", label: "Nom", type: "text", autoComplete: "name" },
  {
    name: "email",
    label: "Adresse e-mail",
    type: "email",
    autoComplete: "email",
  },
  {
    name: "motDePasse",
    label: "Mot de passe (8 caractères au moins)",
    type: "password",
    autoComplete: "new-password",
  },
] as const;

type Props = {
  envoyer: (valeurs: Inscription) => Promise<boolean>;
  erreurServeur?: string;
  enCours: boolean;
};

export function FormulaireInscription({
  envoyer,
  erreurServeur,
  enCours,
}: Props) {
  const prefixe = useId();

  const form = useForm({
    defaultValues: { nom: "", email: "", motDePasse: "" },
    validators: { onSubmit: schemaInscription },
    onSubmit: async ({ value }) => {
      await envoyer(value);
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
        {champs.map((c) => (
          <form.Field key={c.name} name={c.name}>
            {(field) => {
              const invalide =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={invalide}>
                  <FieldLabel htmlFor={`${prefixe}-${field.name}`}>
                    {c.label}
                  </FieldLabel>
                  <Input
                    id={`${prefixe}-${field.name}`}
                    name={field.name}
                    type={c.type}
                    autoComplete={c.autoComplete}
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
        ))}

        {erreurServeur && (
          <p role="alert" className="text-sm text-destructive">
            {erreurServeur}
          </p>
        )}

        <Button type="submit" disabled={enCours}>
          {enCours ? "Création…" : "Créer mon compte"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Déjà un compte ? <Link href="/connexion">Se connecter</Link>
        </p>
      </FieldGroup>
    </form>
  );
}
```

`formulaire-connexion.tsx` suit la même structure, avec deux champs.

<!-- fichier: src/features/compte/components/sections/formulaire-connexion.tsx -->
```tsx
// src/features/compte/components/sections/formulaire-connexion.tsx
"use client";

import { Button } from "@src/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@src/components/ui/field";
import { Input } from "@src/components/ui/input";
import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useId } from "react";
import { type Connexion, schemaConnexion } from "../../schemas/compte.schema";

const champs = [
  {
    name: "email",
    label: "Adresse e-mail",
    type: "email",
    autoComplete: "email",
  },
  {
    name: "motDePasse",
    label: "Mot de passe",
    type: "password",
    autoComplete: "current-password",
  },
] as const;

type Props = {
  envoyer: (valeurs: Connexion) => Promise<boolean>;
  erreurServeur?: string;
  enCours: boolean;
};

export function FormulaireConnexion({
  envoyer,
  erreurServeur,
  enCours,
}: Props) {
  const prefixe = useId();

  const form = useForm({
    defaultValues: { email: "", motDePasse: "" },
    validators: { onSubmit: schemaConnexion },
    onSubmit: async ({ value }) => {
      await envoyer(value);
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
        {champs.map((c) => (
          <form.Field key={c.name} name={c.name}>
            {(field) => {
              const invalide =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={invalide}>
                  <FieldLabel htmlFor={`${prefixe}-${field.name}`}>
                    {c.label}
                  </FieldLabel>
                  <Input
                    id={`${prefixe}-${field.name}`}
                    name={field.name}
                    type={c.type}
                    autoComplete={c.autoComplete}
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
        ))}

        {erreurServeur && (
          <p role="alert" className="text-sm text-destructive">
            {erreurServeur}
          </p>
        )}

        <Button type="submit" disabled={enCours}>
          {enCours ? "Connexion…" : "Se connecter"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link href="/inscription">Créer un compte</Link>
        </p>
      </FieldGroup>
    </form>
  );
}
```

Le formulaire de mot de passe se vide après un changement réussi : `envoyer` répond `true` dans ce cas (la réponse n'est lue que par ce formulaire ; les deux autres l'ignorent).

<!-- fichier: src/features/compte/components/sections/formulaire-mot-de-passe.tsx -->
```tsx
// src/features/compte/components/sections/formulaire-mot-de-passe.tsx
"use client";

import { Button } from "@src/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@src/components/ui/field";
import { Input } from "@src/components/ui/input";
import { useForm } from "@tanstack/react-form";
import { useId } from "react";
import {
  type ChangementMotDePasse,
  schemaChangementMotDePasse,
} from "../../schemas/compte.schema";

const champs = [
  {
    name: "motDePasseActuel",
    label: "Mot de passe actuel",
    autoComplete: "current-password",
  },
  {
    name: "nouveauMotDePasse",
    label: "Nouveau mot de passe",
    autoComplete: "new-password",
  },
  {
    name: "confirmation",
    label: "Confirmez le nouveau mot de passe",
    autoComplete: "new-password",
  },
] as const;

type Props = {
  /** Répond true quand le mot de passe est changé : le formulaire se vide. */
  envoyer: (valeurs: ChangementMotDePasse) => Promise<boolean>;
  erreurServeur?: string;
  enCours: boolean;
};

export function FormulaireMotDePasse({
  envoyer,
  erreurServeur,
  enCours,
}: Props) {
  const prefixe = useId();

  const form = useForm({
    defaultValues: {
      motDePasseActuel: "",
      nouveauMotDePasse: "",
      confirmation: "",
    },
    validators: { onSubmit: schemaChangementMotDePasse },
    onSubmit: async ({ value, formApi }) => {
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
        {champs.map((c) => (
          <form.Field key={c.name} name={c.name}>
            {(field) => {
              const invalide =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={invalide}>
                  <FieldLabel htmlFor={`${prefixe}-${field.name}`}>
                    {c.label}
                  </FieldLabel>
                  <Input
                    id={`${prefixe}-${field.name}`}
                    name={field.name}
                    type="password"
                    autoComplete={c.autoComplete}
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
        ))}

        {erreurServeur && (
          <p role="alert" className="text-sm text-destructive">
            {erreurServeur}
          </p>
        )}

        <Button type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Changer mon mot de passe"}
        </Button>
      </FieldGroup>
    </form>
  );
}
```

