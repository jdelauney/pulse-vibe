### 6. Les formulaires : sections et containers

Le formulaire du code : un champ de 6 chiffres (le téléphone propose le code reçu, `autoComplete="one-time-code"`), le bouton « Valider », et « Renvoyer le code ». La section reçoit tout par props ; son container branche les deux actions.

<!-- fichier: src/features/compte/components/sections/formulaire-code.tsx -->
```tsx
// src/features/compte/components/sections/formulaire-code.tsx
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
import Link from "next/link";
import { useId } from "react";
import {
  type CodeConnexion,
  schemaCodeConnexion,
} from "../../schemas/compte.schema";

type Props = {
  envoyer: (valeurs: CodeConnexion) => Promise<boolean>;
  renvoyer: () => void;
  erreurServeur?: string;
  /** Réponse du renvoi : un nouveau code est parti. */
  message?: string;
  enCours: boolean;
  renvoiEnCours: boolean;
};

export function FormulaireCode({
  envoyer,
  renvoyer,
  erreurServeur,
  message,
  enCours,
  renvoiEnCours,
}: Props) {
  const prefixe = useId();

  const form = useForm({
    defaultValues: { code: "" },
    validationLogic: revalidateLogic({
      mode: "blur",
      modeAfterSubmission: "change",
    }),
    validators: { onDynamic: schemaCodeConnexion },
    // Envoi refusé : le focus va au premier champ en erreur (experience § 5).
    onSubmitInvalid: ({ formApi }) => {
      const champ = Object.entries(formApi.state.fieldMeta).find(
        ([, meta]) => meta?.errors.length,
      )?.[0];
      if (champ) document.getElementById(`${prefixe}-${champ}`)?.focus();
    },
    onSubmit: async ({ value }) => {
      await envoyer(value);
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
        <form.Field name="code">
          {(field) => {
            const invalide =
              montrerErreur(field.state.meta) && !field.state.meta.isValid;
            return (
              <Field data-invalid={invalide}>
                <FieldLabel htmlFor={`${prefixe}-code`}>
                  Code reçu par e-mail
                </FieldLabel>
                <Input
                  id={`${prefixe}-code`}
                  name={field.name}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
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
          {enCours ? "Vérification…" : "Valider"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={renvoiEnCours}
          onClick={renvoyer}
        >
          {renvoiEnCours ? "Envoi…" : "Renvoyer le code"}
        </Button>
        <p className="text-sm text-muted-foreground">
          <Link href="/connexion">Reprendre la connexion</Link>
        </p>
      </FieldGroup>
    </form>
  );
}
```

<!-- fichier: src/features/compte/components/containers/code-connexion.container.tsx -->
```tsx
// src/features/compte/components/containers/code-connexion.container.tsx
"use client";

import { useAction } from "next-safe-action/hooks";
import { renvoyerCode } from "../../actions/renvoyer-code.action";
import { verifierCode } from "../../actions/verifier-code.action";
import { FormulaireCode } from "../sections/formulaire-code";

export function CodeConnexionContainer() {
  const verification = useAction(verifierCode);
  const renvoi = useAction(renvoyerCode);
  return (
    <FormulaireCode
      envoyer={async (valeurs) => {
        const reponse = await verification.executeAsync(valeurs);
        return Boolean(reponse?.data);
      }}
      renvoyer={() => renvoi.execute()}
      erreurServeur={
        verification.result.serverError ?? renvoi.result.serverError
      }
      message={renvoi.result.data?.message}
      enCours={verification.isPending}
      renvoiEnCours={renvoi.isPending}
    />
  );
}
```

Le réglage dans « Mon compte » : l'état actuel, le mot de passe, un bouton qui active ou désactive. Le libellé du champ diffère de celui du changement de mot de passe (« Mot de passe actuel »), sur la même page.

<!-- fichier: src/features/compte/components/sections/formulaire-double-authentification.tsx -->
```tsx
// src/features/compte/components/sections/formulaire-double-authentification.tsx
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
  type ReglageDoubleAuthentification,
  schemaReglageDoubleAuthentification,
} from "../../schemas/compte.schema";

type Props = {
  active: boolean;
  /** Répond true quand le réglage est changé : le formulaire se vide. */
  envoyer: (valeurs: ReglageDoubleAuthentification) => Promise<boolean>;
  erreurServeur?: string;
  enCours: boolean;
};

export function FormulaireDoubleAuthentification({
  active,
  envoyer,
  erreurServeur,
  enCours,
}: Props) {
  const prefixe = useId();

  const form = useForm({
    defaultValues: { motDePasse: "" },
    validationLogic: revalidateLogic({
      mode: "blur",
      modeAfterSubmission: "change",
    }),
    validators: { onDynamic: schemaReglageDoubleAuthentification },
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
          {active
            ? "Active : un code à 6 chiffres vous est envoyé par e-mail à chaque connexion."
            : "Désactivée : votre mot de passe suffit pour vous connecter."}
        </p>
        <form.Field name="motDePasse">
          {(field) => {
            const invalide =
              montrerErreur(field.state.meta) && !field.state.meta.isValid;
            return (
              <Field data-invalid={invalide}>
                <FieldLabel htmlFor={`${prefixe}-motDePasse`}>
                  Mot de passe du compte
                </FieldLabel>
                <Input
                  id={`${prefixe}-motDePasse`}
                  name={field.name}
                  type="password"
                  autoComplete="current-password"
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

        <Button
          type="submit"
          variant={active ? "outline" : "default"}
          disabled={enCours}
        >
          {enCours
            ? "Enregistrement…"
            : active
              ? "Désactiver la double authentification"
              : "Activer la double authentification"}
        </Button>
      </FieldGroup>
    </form>
  );
}
```

Le container choisit l'action selon l'état ; la réussite s'annonce par un message (`toast`).

<!-- fichier: src/features/compte/components/containers/double-authentification.container.tsx -->
```tsx
// src/features/compte/components/containers/double-authentification.container.tsx
"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { activerDoubleAuthentification } from "../../actions/activer-double-authentification.action";
import { desactiverDoubleAuthentification } from "../../actions/desactiver-double-authentification.action";
import { FormulaireDoubleAuthentification } from "../sections/formulaire-double-authentification";

export function DoubleAuthentificationContainer({
  active,
}: {
  active: boolean;
}) {
  const activation = useAction(activerDoubleAuthentification);
  const desactivation = useAction(desactiverDoubleAuthentification);
  const courante = active ? desactivation : activation;
  return (
    <FormulaireDoubleAuthentification
      active={active}
      envoyer={async (valeurs) => {
        const reponse = await courante.executeAsync(valeurs);
        if (!reponse?.data) {
          return false;
        }
        toast.success(reponse.data.message);
        return true;
      }}
      erreurServeur={courante.result.serverError}
      enCours={courante.isPending}
    />
  );
}
```
