### 15. Hook, section et container

Le hook attend aussi la réponse du widget. Après chaque envoi, `apresEnvoi()` relance le widget (sa `key` change) : une réponse ne sert qu'une fois. Si le widget ne peut pas se charger (bloqueur de publicités, réseau d'entreprise, erreur de Cloudflare), la section le dit et propose quoi faire.

```ts
// src/hooks/use-protection-formulaire.ts
"use client";

import { envPublic } from "@src/config/env-public";
import {
  CHAMP_JETON,
  CHAMP_PIEGE,
  CHAMP_TURNSTILE,
} from "@src/lib/helpers/formulaire-public/champs";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

// Clé publique du widget Turnstile (option) : absente, la protection fonctionne sans widget.
const CLE_TURNSTILE = envPublic.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export type ProtectionFormulaire = {
  /** Vrai quand le jeton est arrivé (et que Turnstile a répondu, s'il est actif). */
  pret: boolean;
  /** Vrai si le jeton n'a pas pu être obtenu : la section propose de recharger la page. */
  echec: boolean;
  refPiege: RefObject<HTMLInputElement | null>;
  /** Clé publique Turnstile, vide si l'option n'est pas utilisée. */
  cleTurnstile: string;
  /** Change après chaque envoi : sert de `key` au widget, qui repart avec une réponse neuve. */
  tourTurnstile: number;
  surTurnstile: (jeton: string | null) => void;
  /** Vrai si le widget Turnstile n'a pas pu se charger : la section dit quoi faire. */
  echecTurnstile: boolean;
  surErreurTurnstile: () => void;
  /** Valeurs de protection à ajouter aux données envoyées : { ...valeurs, ...champs() }. */
  champs: () => Record<string, string>;
  /** À appeler après chaque envoi : une réponse Turnstile ne sert qu'une fois. */
  apresEnvoi: () => void;
};

/** Protection d'un formulaire public : à appeler dans son container. */
export function useProtectionFormulaire(
  formulaire: string,
): ProtectionFormulaire {
  const refPiege = useRef<HTMLInputElement>(null);
  const [jeton, setJeton] = useState<string | null>(null);
  const [echec, setEchec] = useState(false);
  const [reponseTurnstile, setReponseTurnstile] = useState<string | null>(null);
  const [tourTurnstile, setTourTurnstile] = useState(0);
  const [echecTurnstile, setEchecTurnstile] = useState(false);

  useEffect(() => {
    const controleur = new AbortController();
    fetch(
      `/api/jeton-formulaire?formulaire=${encodeURIComponent(formulaire)}`,
      { cache: "no-store", signal: controleur.signal },
    )
      .then((reponse) => (reponse.ok ? reponse.json() : null))
      .then((corps: { jeton?: string } | null) => {
        if (corps?.jeton) setJeton(corps.jeton);
        else setEchec(true);
      })
      .catch(() => {
        if (!controleur.signal.aborted) setEchec(true);
      });
    return () => controleur.abort();
  }, [formulaire]);

  const surTurnstile = useCallback((reponse: string | null) => {
    setReponseTurnstile(reponse);
    if (reponse) setEchecTurnstile(false);
  }, []);

  const surErreurTurnstile = useCallback(() => {
    setEchecTurnstile(true);
  }, []);

  return {
    pret: jeton !== null && (CLE_TURNSTILE === "" || reponseTurnstile !== null),
    echec,
    refPiege,
    cleTurnstile: CLE_TURNSTILE,
    tourTurnstile,
    surTurnstile,
    echecTurnstile,
    surErreurTurnstile,
    champs: () => ({
      [CHAMP_JETON]: jeton ?? "",
      [CHAMP_PIEGE]: refPiege.current?.value ?? "",
      ...(reponseTurnstile ? { [CHAMP_TURNSTILE]: reponseTurnstile } : {}),
    }),
    apresEnvoi: () => {
      if (CLE_TURNSTILE === "") return;
      setReponseTurnstile(null);
      setTourTurnstile((tour) => tour + 1);
    },
  };
}
```

```tsx
// src/features/contact/components/sections/formulaire-contact.tsx
"use client";

import { ChampPiege } from "@src/components/shared/elements/champ-piege";
import { WidgetTurnstile } from "@src/components/shared/elements/widget-turnstile";
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
  /** Clé publique Turnstile ; vide : pas de widget. */
  cleTurnstile: string;
  /** Change après chaque envoi : le widget repart avec une réponse neuve. */
  tourTurnstile: number;
  surTurnstile: (jeton: string | null) => void;
  /** Le widget Turnstile n'a pas pu se charger. */
  echecTurnstile: boolean;
  surErreurTurnstile: () => void;
};

export function FormulaireContact({
  envoyer,
  erreurServeur,
  enCours,
  pret,
  echecPreparation,
  refPiege,
  cleTurnstile,
  tourTurnstile,
  surTurnstile,
  echecTurnstile,
  surErreurTurnstile,
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
        {cleTurnstile && (
          <WidgetTurnstile
            key={tourTurnstile}
            cleSite={cleTurnstile}
            surReponse={surTurnstile}
            surErreur={surErreurTurnstile}
          />
        )}
        {echecTurnstile && (
          <p role="alert" className="text-sm text-destructive">
            La vérification anti-robot n'a pas pu se charger. Rechargez la page,
            ou désactivez le bloqueur de publicités pour ce site.
          </p>
        )}

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
        protection.apresEnvoi();
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
      cleTurnstile={protection.cleTurnstile}
      tourTurnstile={protection.tourTurnstile}
      surTurnstile={protection.surTurnstile}
      echecTurnstile={protection.echecTurnstile}
      surErreurTurnstile={protection.surErreurTurnstile}
    />
  );
}
```

