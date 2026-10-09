### 8. Les deux nouveaux formulaires : sections et containers

Chaque section reçoit `envoyer`, `erreurServeur`, `message` et `enCours` par props ; son container appelle `useAction`. Le jeton du lien arrive au container (`token`), jamais à la section : il n'est pas un champ.

```tsx
// src/features/compte/components/sections/formulaire-mot-de-passe-oublie.tsx
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
  type MotDePasseOublie,
  schemaMotDePasseOublie,
} from "../../schemas/compte.schema";

type Props = {
  envoyer: (valeurs: MotDePasseOublie) => Promise<boolean>;
  erreurServeur?: string;
  /** Réponse de l'action : la même que l'adresse ait un compte ou non. */
  message?: string;
  enCours: boolean;
};

export function FormulaireMotDePasseOublie({
  envoyer,
  erreurServeur,
  message,
  enCours,
}: Props) {
  const prefixe = useId();

  const form = useForm({
    defaultValues: { email: "" },
    validators: { onSubmit: schemaMotDePasseOublie },
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
        <form.Field name="email">
          {(field) => {
            const invalide =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={invalide}>
                <FieldLabel htmlFor={`${prefixe}-email`}>
                  Adresse e-mail
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
          <p role="status" className="text-sm text-muted-foreground">
            {message}
          </p>
        )}

        <Button type="submit" disabled={enCours}>
          {enCours ? "Envoi…" : "Recevoir un lien"}
        </Button>
      </FieldGroup>
    </form>
  );
}
```

```tsx
// src/features/compte/components/sections/formulaire-nouveau-mot-de-passe.tsx
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
  type NouveauMotDePasse,
  schemaNouveauMotDePasse,
} from "../../schemas/compte.schema";

const champs = [
  { name: "nouveauMotDePasse", label: "Nouveau mot de passe" },
  { name: "confirmation", label: "Confirmez le nouveau mot de passe" },
] as const;

type Props = {
  envoyer: (valeurs: NouveauMotDePasse) => Promise<boolean>;
  erreurServeur?: string;
  /** Réponse de l'action une fois le mot de passe changé : elle remplace le formulaire. */
  message?: string;
  enCours: boolean;
};

export function FormulaireNouveauMotDePasse({
  envoyer,
  erreurServeur,
  message,
  enCours,
}: Props) {
  const prefixe = useId();

  const form = useForm({
    defaultValues: { nouveauMotDePasse: "", confirmation: "" },
    validators: { onSubmit: schemaNouveauMotDePasse },
    onSubmit: async ({ value }) => {
      await envoyer(value);
    },
  });

  if (message) {
    return (
      <p role="status">
        {message}{" "}
        <Link href="/connexion" className="underline">
          Se connecter
        </Link>
      </p>
    );
  }

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
                    autoComplete="new-password"
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
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </FieldGroup>
    </form>
  );
}
```

```tsx
// src/features/compte/components/containers/mot-de-passe-oublie.container.tsx
"use client";

import { useAction } from "next-safe-action/hooks";
import { demanderNouveauMotDePasse } from "../../actions/demander-nouveau-mot-de-passe.action";
import { FormulaireMotDePasseOublie } from "../sections/formulaire-mot-de-passe-oublie";

export function MotDePasseOublieContainer() {
  const { executeAsync, result, isPending } = useAction(
    demanderNouveauMotDePasse,
  );
  return (
    <FormulaireMotDePasseOublie
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

```tsx
// src/features/compte/components/containers/nouveau-mot-de-passe.container.tsx
"use client";

import { useAction } from "next-safe-action/hooks";
import { choisirNouveauMotDePasse } from "../../actions/choisir-nouveau-mot-de-passe.action";
import { FormulaireNouveauMotDePasse } from "../sections/formulaire-nouveau-mot-de-passe";

export function NouveauMotDePasseContainer({ token }: { token: string }) {
  const { executeAsync, result, isPending } = useAction(
    choisirNouveauMotDePasse,
  );
  return (
    <FormulaireNouveauMotDePasse
      envoyer={async (valeurs) => {
        const reponse = await executeAsync({ ...valeurs, token });
        return Boolean(reponse?.data);
      }}
      erreurServeur={result.serverError}
      message={result.data?.message}
      enCours={isPending}
    />
  );
}
```

La page « Nouveau mot de passe » lit l'adresse (`?token=…` ou `?error=…`) : c'est une lecture de la requête, faite par un container serveur sous `<Suspense>`. Il compose le container du formulaire de sa feature.

```tsx
// src/features/compte/components/containers/lien-mot-de-passe.container.tsx
import Link from "next/link";
import { NouveauMotDePasseContainer } from "./nouveau-mot-de-passe.container";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// better-auth renvoie vers la page avec ?token=… (lien valable) ou ?error=INVALID_TOKEN (lien expiré).
export async function LienMotDePasseContainer({ searchParams }: Props) {
  const { token, error } = await searchParams;
  if (error || typeof token !== "string") {
    return (
      <p>
        Ce lien n'est plus valable.{" "}
        <Link href="/mot-de-passe-oublie" className="underline">
          Demander un nouveau lien
        </Link>
      </p>
    );
  }
  return <NouveauMotDePasseContainer token={token} />;
}
```

