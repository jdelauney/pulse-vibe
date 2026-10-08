# Recette : formulaire-public

> Quand l'utiliser : un formulaire accessible sans connexion (contact, demande de devis, inscription à une lettre, avis) doit freiner les robots et les envois en rafale.

## Prérequis

- Recette `limite` appliquée (`pulse-aidd pile recette limite`) : `exigerLimite` et `NomLimite` de `src/lib/limite.ts`.
- Paquets du squelette : `next-safe-action`, `zod`, `@tanstack/react-form`, `sonner`. Si l'un manque, l'installer à sa dernière version : `npm install <paquet>`.
- Pour l'exemple de contact : la zone de texte de shadcn, `npx shadcn@latest add textarea`.
- Option Turnstile : un compte Cloudflare (offre gratuite) et un widget créé dans **Turnstile**, pour le domaine du site et `localhost`.

## Variables d'environnement

| Nom | Rôle |
|---|---|
| `FORMULAIRE_SECRET` | Signe le jeton de délai des formulaires (32 caractères au moins, générée : `pulse-aidd secrets generer FORMULAIRE_SECRET`) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Option Turnstile : clé de site du widget, publique (elle apparaît dans la page) |
| `TURNSTILE_SECRET_KEY` | Option Turnstile : clé secrète du widget, côté serveur seulement |

Dans `src/config/env.ts`, ajouter dans `z.object({ … })` :

```ts
    // Recette formulaire-public : signe le jeton de délai des formulaires (32 caractères au moins).
    FORMULAIRE_SECRET: z.string().min(32),
```

Dans `.env.example`, ajouter `FORMULAIRE_SECRET=` (sans valeur). Les variables Turnstile vont dans `.env.example` seulement avec l'option.

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/config/env.ts`, `.env.example` (modifiés) | `FORMULAIRE_SECRET` (et `TURNSTILE_SECRET_KEY` avec l'option) |
| `src/lib/helpers/formulaire-public/champs.ts` | Noms des champs de protection, contrôle du champ piège |
| `src/lib/helpers/formulaire-public/jeton.ts` | Jeton de délai signé (fonctions pures) |
| `app/api/jeton-formulaire/route.ts` | Donne un jeton au navigateur à l'ouverture du formulaire |
| `src/hooks/use-protection-formulaire.ts` | Protection côté navigateur, appelée par le container |
| `src/components/shared/elements/champ-piege.tsx` | Le champ piège invisible |
| `src/lib/formulaire-public.ts` | `actionFormulairePublic` : les contrôles avant l'action |
| `src/features/contact/…` (schéma, action, section, container), `app/(public)/contact/page.tsx` | Exemple : formulaire de contact protégé |
| `src/components/ui/textarea.tsx` | Zone de texte de shadcn (exemple) |
| Tests : `src/lib/helpers/formulaire-public/__tests__/`, `src/features/contact/actions/__tests__/`, `e2e/formulaire-public.spec.ts` | Unitaires, intégration, bout en bout |
| `src/adapters/turnstile/turnstile.adapter.ts` et son test (option Turnstile) | Vérification de la réponse du widget auprès de Cloudflare |
| `src/components/shared/elements/widget-turnstile.tsx` (option Turnstile) | Le widget |
| `next.config.ts` (modifié, option Turnstile) | Le script et le cadre du widget autorisés par la CSP |

## Étapes

Un formulaire public reçoit trois protections, contrôlées sur le serveur avant l'action, de la moins coûteuse à la plus coûteuse :

1. **Le champ piège** : un champ invisible pour une personne. Un robot qui remplit tous les champs se trahit.
2. **Le jeton de délai** : le navigateur reçoit, à l'ouverture du formulaire, un jeton signé par le serveur. Il prouve que le formulaire a été ouvert sur le site, et quand. Envoyé moins de 3 secondes après l'ouverture, c'est probablement un robot ; après 2 heures, la page se recharge.
3. **La limite par adresse IP** de la recette `limite` (5 envois par minute).

Turnstile, en option, ajoute une vérification de Cloudflare pour les formulaires visés par les robots.

### 1. La variable `FORMULAIRE_SECRET`

Ajouter la ligne de `env.ts` (section « Variables d'environnement »), puis générer la valeur dans `.env` : `pulse-aidd secrets generer FORMULAIRE_SECRET`.

### 2. Les noms des champs

Partagés par le navigateur et le serveur.

```ts
// src/lib/helpers/formulaire-public/champs.ts
// Noms des champs de protection d'un formulaire public, communs au navigateur et au serveur.

export const CHAMP_PIEGE = "site_web_societe";
export const CHAMP_JETON = "jeton_formulaire";
export const CHAMP_TURNSTILE = "cf-turnstile-response";

/** Nom d'un formulaire : lettres minuscules, chiffres et tirets (il entre dans le jeton). */
export const NOM_FORMULAIRE = /^[a-z0-9-]{1,40}$/;

/** Vrai si le champ piège, invisible pour une personne, contient quelque chose. */
export function estPiegeRempli(entree: unknown): boolean {
  if (typeof entree !== "object" || entree === null) return false;
  const valeur = (entree as Record<string, unknown>)[CHAMP_PIEGE];
  if (valeur === undefined || valeur === null) return false;
  return typeof valeur !== "string" || valeur.trim() !== "";
}
```

### 3. Le jeton signé

Le jeton vaut `horodatage.formulaire.signature`. La signature (HMAC) est calculée avec `FORMULAIRE_SECRET` : modifier l'heure ou le nom du formulaire la rend fausse. La comparaison se fait en temps constant (`timingSafeEqual`).

```ts
// src/lib/helpers/formulaire-public/jeton.ts
// Jeton « horodatage.formulaire.signature » : prouve que le formulaire a été ouvert sur le site, et quand.
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const DELAI_MINIMUM_MS = 3_000;
export const DUREE_DE_VIE_MS = 2 * 60 * 60 * 1000;

export type EtatJeton =
  | "valide"
  | "absent"
  | "falsifie"
  | "trop-rapide"
  | "expire";

function signature(contenu: string, secret: string): string {
  return createHmac("sha256", secret).update(contenu).digest("base64url");
}

export function signerJeton(
  formulaire: string,
  maintenant: number,
  secret: string,
): string {
  const contenu = `${maintenant}.${formulaire}`;
  return `${contenu}.${signature(contenu, secret)}`;
}

export function verifierJeton(
  jeton: unknown,
  formulaire: string,
  maintenant: number,
  secret: string,
): EtatJeton {
  if (typeof jeton !== "string" || jeton === "") return "absent";
  const morceaux = jeton.split(".");
  if (morceaux.length !== 3) return "falsifie";
  const [horodatage = "", formulaireDuJeton = "", signatureRecue = ""] =
    morceaux;
  const attendue = Buffer.from(
    signature(`${horodatage}.${formulaireDuJeton}`, secret),
  );
  const recue = Buffer.from(signatureRecue);
  if (recue.length !== attendue.length || !timingSafeEqual(recue, attendue)) {
    return "falsifie";
  }
  if (formulaireDuJeton !== formulaire || !/^\d+$/.test(horodatage)) {
    return "falsifie";
  }
  const age = maintenant - Number(horodatage);
  if (age < DELAI_MINIMUM_MS) return "trop-rapide";
  if (age > DUREE_DE_VIE_MS) return "expire";
  return "valide";
}
```

### 4. La route du jeton

Le navigateur demande le jeton à l'ouverture du formulaire : la page reste statique, et le jeton n'est jamais gardé en cache (`no-store`).

```ts
// app/api/jeton-formulaire/route.ts
// Jeton de délai d'un formulaire public, demandé par le navigateur à l'ouverture du formulaire.
import { envServeur } from "@src/config/env";
import { NOM_FORMULAIRE } from "@src/lib/helpers/formulaire-public/champs";
import { signerJeton } from "@src/lib/helpers/formulaire-public/jeton";
import { connection } from "next/server";

export async function GET(request: Request) {
  // Réponse calculée à chaque demande : l'heure fait partie du jeton.
  await connection();
  const formulaire = new URL(request.url).searchParams.get("formulaire") ?? "";
  if (!NOM_FORMULAIRE.test(formulaire)) {
    return Response.json({ erreur: "Formulaire inconnu." }, { status: 400 });
  }
  const jeton = signerJeton(
    formulaire,
    Date.now(),
    envServeur().FORMULAIRE_SECRET,
  );
  return Response.json({ jeton }, { headers: { "Cache-Control": "no-store" } });
}
```

### 5. Le hook de protection

Appelé par le container. Il demande le jeton, garde la référence du champ piège, et donne `champs()` : les valeurs de protection à ajouter aux données envoyées (`{ ...valeurs, ...protection.champs() }`). Cela fonctionne avec TanStack Form comme avec un formulaire simple.

```ts
// src/hooks/use-protection-formulaire.ts
"use client";

import {
  CHAMP_JETON,
  CHAMP_PIEGE,
} from "@src/lib/helpers/formulaire-public/champs";
import { type RefObject, useEffect, useRef, useState } from "react";

export type ProtectionFormulaire = {
  /** Vrai quand le jeton est arrivé : le bouton d'envoi peut s'activer. */
  pret: boolean;
  /** Vrai si le jeton n'a pas pu être obtenu : la section propose de recharger la page. */
  echec: boolean;
  refPiege: RefObject<HTMLInputElement | null>;
  /** Valeurs de protection à ajouter aux données envoyées : { ...valeurs, ...champs() }. */
  champs: () => Record<string, string>;
};

/** Protection d'un formulaire public : à appeler dans son container. */
export function useProtectionFormulaire(
  formulaire: string,
): ProtectionFormulaire {
  const refPiege = useRef<HTMLInputElement>(null);
  const [jeton, setJeton] = useState<string | null>(null);
  const [echec, setEchec] = useState(false);

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

  return {
    pret: jeton !== null,
    echec,
    refPiege,
    champs: () => ({
      [CHAMP_JETON]: jeton ?? "",
      [CHAMP_PIEGE]: refPiege.current?.value ?? "",
    }),
  };
}
```

### 6. Le champ piège

Placé hors de l'écran, ignoré au clavier (`tabIndex={-1}`) et par les lecteurs d'écran (`aria-hidden`). Son nom n'est celui d'aucun vrai champ : c'est le seul que le serveur contrôle.

```tsx
// src/components/shared/elements/champ-piege.tsx
import { CHAMP_PIEGE } from "@src/lib/helpers/formulaire-public/champs";
import type { Ref } from "react";

// Champ placé hors de l'écran, ignoré au clavier et par les lecteurs d'écran :
// une personne ne le voit pas, un robot qui remplit tous les champs se trahit.
export function ChampPiege({ ref }: { ref: Ref<HTMLInputElement> }) {
  return (
    <div
      aria-hidden="true"
      className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
    >
      <label htmlFor={CHAMP_PIEGE}>Site web de la société</label>
      <input
        ref={ref}
        id={CHAMP_PIEGE}
        name={CHAMP_PIEGE}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
      />
    </div>
  );
}
```

### 7. Les contrôles avant l'action

`actionFormulairePublic(formulaire)` remplace `actionPublique` pour un formulaire public. Ses contrôles lisent les données brutes (`clientInput`), avant le schéma Zod : le champ piège, puis le jeton, puis la limite. Le schéma de l'action retire ensuite les champs de protection, et l'action reçoit des données propres.

```ts
// src/lib/formulaire-public.ts
// Client d'action des formulaires publics : champ piège, jeton de délai, puis limite par adresse IP.
import "server-only";
import { envServeur } from "@src/config/env";
import {
  CHAMP_JETON,
  estPiegeRempli,
} from "@src/lib/helpers/formulaire-public/champs";
import { verifierJeton } from "@src/lib/helpers/formulaire-public/jeton";
import { exigerLimite, type NomLimite } from "@src/lib/limite";
import { logger } from "@src/lib/logger";
import { actionPublique } from "@src/lib/safe-action";
import { returnServerError } from "next-safe-action";

const MESSAGE_RECHARGER = "Rechargez la page et réessayez.";
const MESSAGE_TROP_RAPIDE =
  "Envoi trop rapide. Patientez quelques secondes, puis réessayez.";

export function actionFormulairePublic(
  formulaire: string,
  limite: NomLimite = "formulairePublic",
) {
  return actionPublique.use(async ({ clientInput, next }) => {
    // Du moins coûteux au plus coûteux : rien n'est compté pour un envoi déjà refusé.
    if (estPiegeRempli(clientInput)) {
      logger.warn(
        { formulaire },
        "Formulaire public : champ piège rempli, envoi refusé",
      );
      returnServerError(MESSAGE_RECHARGER);
    }
    const jeton = (clientInput as Record<string, unknown> | null)?.[
      CHAMP_JETON
    ];
    const etat = verifierJeton(
      jeton,
      formulaire,
      Date.now(),
      envServeur().FORMULAIRE_SECRET,
    );
    if (etat !== "valide") {
      logger.warn({ formulaire, etat }, "Formulaire public : jeton refusé");
      returnServerError(
        etat === "trop-rapide" ? MESSAGE_TROP_RAPIDE : MESSAGE_RECHARGER,
      );
    }
    await exigerLimite(limite);
    return next();
  });
}
```

### 8. Protéger un formulaire : l'exemple de contact

Le nom du formulaire est une constante du schéma : le container l'utilise pour demander le jeton, l'action pour le vérifier.

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

```ts
// src/features/contact/actions/envoyer-message.action.ts
"use server";

import { actionFormulairePublic } from "@src/lib/formulaire-public";
import { logger } from "@src/lib/logger";
import { FORMULAIRE_CONTACT, schemaMessage } from "../schemas/contact.schema";

// Le schéma retire les champs de protection : parsedInput ne contient que le message.
export const envoyerMessage = actionFormulairePublic(FORMULAIRE_CONTACT)
  .inputSchema(schemaMessage)
  .action(async ({ parsedInput }) => {
    logger.info({ longueur: parsedInput.message.length }, "Message reçu");
    return { ok: true };
  });
```

La section affiche le champ piège et désactive le bouton tant que le jeton n'est pas arrivé :

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

### 9. Essayer

`npm run dev`, ouvrir `/contact`, écrire un message, attendre quelques secondes, envoyer : « Message envoyé. Merci ! » s'affiche. Puis, dans les outils du navigateur, écrire quelque chose dans le champ `site_web_societe` et envoyer : « Rechargez la page et réessayez. » s'affiche.

### 10. Mettre en ligne

`pulse-aidd secrets generer FORMULAIRE_SECRET --envoyer production,preview --sans-local` (une valeur par environnement), redéployer, refaire l'essai sur le site en ligne.

### Option : Turnstile

Turnstile (Cloudflare) vérifie sans question qu'une personne remplit le formulaire. À ajouter aux formulaires visés par les robots malgré le champ piège et le délai.

### 11. Le widget Cloudflare et les variables

Dans le tableau de bord Cloudflare : **Turnstile** → ajouter un widget, avec le domaine du site et `localhost`. Copier la clé de site et la clé secrète dans `.env` :

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=VOTRE_CLE_ICI
```

Ajouter les deux noms à `.env.example`, et dans `src/config/env.ts`, dans `z.object({ … })` :

```ts
    // Recette formulaire-public, option Turnstile : clé secrète du widget (Cloudflare).
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
```

### 12. La vérification côté serveur

La réponse du widget est vérifiée auprès de Cloudflare (`siteverify`). Une réponse ne sert qu'une fois et vaut 5 minutes. Si Cloudflare ne répond pas dans les 3 secondes, l'envoi est refusé : Turnstile ne sert qu'aux formulaires visés par les robots.

```ts
// src/adapters/turnstile/turnstile.adapter.ts
import "server-only";
import { envServeur } from "@src/config/env";
import { ErreurService } from "@src/lib/errors/erreur-service";
import { CHAMP_TURNSTILE } from "@src/lib/helpers/formulaire-public/champs";
import { ipDepuis } from "@src/lib/helpers/limite/ip-et-message";
import { logger } from "@src/lib/logger";
import { headers } from "next/headers";
import { returnServerError } from "next-safe-action";

const ADRESSE = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TAILLE_MAXIMALE = 2048;

/** Demande à Cloudflare si la réponse du widget est valable. Toute panne compte comme un refus. */
export async function verifierTurnstile(
  reponse: unknown,
  secret: string,
  ip: string,
  envoyer: typeof fetch = fetch,
): Promise<boolean> {
  if (
    typeof reponse !== "string" ||
    reponse === "" ||
    reponse.length > TAILLE_MAXIMALE
  ) {
    return false;
  }
  const corps = new URLSearchParams({ secret, response: reponse });
  if (ip !== "inconnue") corps.set("remoteip", ip);
  try {
    const resultat = await envoyer(ADRESSE, {
      method: "POST",
      body: corps,
      signal: AbortSignal.timeout(3000),
    });
    const donnees = (await resultat.json()) as { success?: boolean };
    return donnees.success === true;
  } catch (erreur) {
    logger.error(
      {
        err: new ErreurService("turnstile", "Turnstile injoignable", {
          cause: { nom: (erreur as Error | undefined)?.name },
        }),
      },
      "Turnstile injoignable : envoi refusé",
    );
    return false;
  }
}

/** Pour une action : arrête l'action si Turnstile est actif et que la réponse du widget n'est pas valable. */
export async function exigerTurnstile(entree: unknown): Promise<void> {
  const secret = envServeur().TURNSTILE_SECRET_KEY;
  if (!secret) return;
  const reponse = (entree as Record<string, unknown> | null)?.[CHAMP_TURNSTILE];
  if (!(await verifierTurnstile(reponse, secret, ipDepuis(await headers())))) {
    returnServerError(
      "La vérification anti-robot a échoué. Réessayez dans un instant.",
    );
  }
}
```

### 13. Brancher Turnstile dans les contrôles

`src/lib/formulaire-public.ts` devient (Turnstile ne s'active que si `TURNSTILE_SECRET_KEY` est définie) :

```ts
// src/lib/formulaire-public.ts
// Client d'action des formulaires publics : champ piège, jeton de délai, limite par adresse IP,
// puis Turnstile s'il est actif.
import "server-only";
import { exigerTurnstile } from "@src/adapters/turnstile/turnstile.adapter";
import { envServeur } from "@src/config/env";
import {
  CHAMP_JETON,
  estPiegeRempli,
} from "@src/lib/helpers/formulaire-public/champs";
import { verifierJeton } from "@src/lib/helpers/formulaire-public/jeton";
import { exigerLimite, type NomLimite } from "@src/lib/limite";
import { logger } from "@src/lib/logger";
import { actionPublique } from "@src/lib/safe-action";
import { returnServerError } from "next-safe-action";

const MESSAGE_RECHARGER = "Rechargez la page et réessayez.";
const MESSAGE_TROP_RAPIDE =
  "Envoi trop rapide. Patientez quelques secondes, puis réessayez.";

export function actionFormulairePublic(
  formulaire: string,
  limite: NomLimite = "formulairePublic",
) {
  return actionPublique.use(async ({ clientInput, next }) => {
    // Du moins coûteux au plus coûteux : rien n'est compté pour un envoi déjà refusé.
    if (estPiegeRempli(clientInput)) {
      logger.warn(
        { formulaire },
        "Formulaire public : champ piège rempli, envoi refusé",
      );
      returnServerError(MESSAGE_RECHARGER);
    }
    const jeton = (clientInput as Record<string, unknown> | null)?.[
      CHAMP_JETON
    ];
    const etat = verifierJeton(
      jeton,
      formulaire,
      Date.now(),
      envServeur().FORMULAIRE_SECRET,
    );
    if (etat !== "valide") {
      logger.warn({ formulaire, etat }, "Formulaire public : jeton refusé");
      returnServerError(
        etat === "trop-rapide" ? MESSAGE_TROP_RAPIDE : MESSAGE_RECHARGER,
      );
    }
    await exigerLimite(limite);
    // Option Turnstile : active seulement si TURNSTILE_SECRET_KEY est définie.
    await exigerTurnstile(clientInput);
    return next();
  });
}
```

### 14. Le widget

```tsx
// src/components/shared/elements/widget-turnstile.tsx
"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type OptionsTurnstile = {
  sitekey: string;
  language: string;
  callback: (jeton: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: OptionsTurnstile) => string;
      remove: (id: string) => void;
    };
  }
}

// Widget Cloudflare Turnstile : vérifie sans question qu'une personne remplit le formulaire.
export function WidgetTurnstile({
  cleSite,
  surReponse,
}: {
  cleSite: string;
  surReponse: (jeton: string | null) => void;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const [scriptCharge, setScriptCharge] = useState(false);

  useEffect(() => {
    if (!scriptCharge || !conteneur.current || !window.turnstile) return;
    const id = window.turnstile.render(conteneur.current, {
      sitekey: cleSite,
      language: "fr",
      callback: (jeton) => surReponse(jeton),
      "expired-callback": () => surReponse(null),
      "error-callback": () => surReponse(null),
    });
    return () => window.turnstile?.remove(id);
  }, [scriptCharge, cleSite, surReponse]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptCharge(true)}
      />
      <div ref={conteneur} />
    </>
  );
}
```

### 15. Hook, section et container

Le hook attend aussi la réponse du widget. Après chaque envoi, `apresEnvoi()` relance le widget (sa `key` change) : une réponse ne sert qu'une fois.

```ts
// src/hooks/use-protection-formulaire.ts
"use client";

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
const CLE_TURNSTILE = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

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
  }, []);

  return {
    pret: jeton !== null && (CLE_TURNSTILE === "" || reponseTurnstile !== null),
    echec,
    refPiege,
    cleTurnstile: CLE_TURNSTILE,
    tourTurnstile,
    surTurnstile,
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
          />
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
    />
  );
}
```

### 16. La CSP autorise Turnstile

Le widget charge un script et s'affiche dans un cadre venant de `https://challenges.cloudflare.com`. Dans `next.config.ts`, objet `sources` :

```ts
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    // Recette formulaire-public, option Turnstile : script du widget.
    "https://challenges.cloudflare.com",
    ...(enDeveloppement ? ["'unsafe-eval'"] : []),
  ],
  // …
  "connect-src": ["'self'"],
  // Recette formulaire-public, option Turnstile : cadre du widget.
  "frame-src": ["https://challenges.cloudflare.com"],
```

Sans ces deux lignes, le widget reste vide et la console du navigateur affiche « Refused to load the script ».

### 17. Essayer Turnstile

Cloudflare fournit des clés de test (https://developers.cloudflare.com/turnstile/troubleshooting/testing/). Dans `.env` : la clé de site de test « toujours accepté » et la clé secrète de test « toujours accepté » ; ouvrir `/contact` : le widget s'affiche, le bouton s'active, l'envoi réussit. Avec la clé secrète de test « toujours refusé », l'envoi affiche « La vérification anti-robot a échoué. Réessayez dans un instant. ». Remettre ensuite les vraies clés.

En ligne : saisir `NEXT_PUBLIC_TURNSTILE_SITE_KEY` et `TURNSTILE_SECRET_KEY` dans Vercel (Production et Preview), puis redéployer (la clé de site est lue à la construction).

## CSRF

- Les actions serveur de Next.js n'acceptent que des requêtes `POST` venues du site : Next.js compare l'en-tête `Origin` à l'adresse du site (`Host`) et refuse la requête si elles diffèrent. Avec `form-action 'self'` (déjà dans la CSP du squelette) et les cookies `SameSite`, aucun jeton CSRF supplémentaire n'est nécessaire.
- Une route API qui reçoit un formulaire vérifie elle-même l'en-tête `Origin` (modèle : recette `mesure-reelle`).
- `experimental.serverActions.allowedOrigins` (dans `next.config.ts`) sert seulement si le site est servi derrière un autre domaine (proxy) ; sinon, le laisser absent.
- Source : https://nextjs.org/docs/app/guides/data-security (section « Allowed origins »).

## Scénarios Gherkin à ajouter à la spec

```gherkin
# language: fr
Fonctionnalité: Protection des formulaires publics

  Règle: Un robot qui remplit le champ piège est refusé

    @US-XXX-1 @unitaire
    Exemple: rempli, même avec une valeur qui n'est pas du texte : c'est un robot
      Étant donné le champ piège contient « https://exemple.fr », 0, false ou un objet
      Quand le champ piège est contrôlé
      Alors l'envoi est compté comme celui d'un robot

    @US-XXX-1 @integration @securite
    Exemple: champ piège rempli : refusé, et noté dans le journal sans le contenu
      Étant donné un envoi dont le champ piège contient « https://spam.example »
      Quand l'action reçoit l'envoi
      Alors elle répond « Rechargez la page et réessayez. »
      Et le journal ne contient pas « spam.example »

    @US-XXX-1 @e2e
    Exemple: un robot qui remplit le champ piège est refusé
      Étant donné le formulaire de contact est ouvert
      Quand un robot remplit le champ piège et envoie
      Alors la page affiche « Rechargez la page et réessayez. »

  Règle: Le formulaire doit avoir été ouvert sur le site, il y a au moins 3 secondes et moins de 2 heures

    @US-XXX-2 @unitaire
    Exemple: envoyé moins de 3 secondes après l'ouverture : trop rapide
      Étant donné un jeton signé il y a 2,999 secondes
      Quand le jeton est vérifié
      Alors il est « trop rapide »

    @US-XXX-2 @unitaire
    Exemple: ouvert depuis plus de 2 heures : expiré
      Étant donné un jeton signé il y a 2 heures et 1 milliseconde
      Quand le jeton est vérifié
      Alors il est « expiré »

    @US-XXX-2 @unitaire @securite
    Exemple: horodatage modifié ou autre secret : refusé
      Étant donné un jeton dont l'heure a été modifiée
      Quand le jeton est vérifié
      Alors il est refusé

    @US-XXX-2 @integration
    Exemple: envoyé une seconde après l'ouverture : message « trop rapide »
      Étant donné un formulaire ouvert il y a une seconde
      Quand il est envoyé
      Alors l'action répond « Envoi trop rapide. Patientez quelques secondes, puis réessayez. »

  Règle: Une personne qui prend le temps d'écrire envoie son message

    @US-XXX-3 @integration
    Exemple: une personne qui a pris le temps d'écrire : le message part
      Étant donné un formulaire ouvert il y a 5 secondes, champ piège vide
      Quand il est envoyé
      Alors le message est reçu

    @US-XXX-3 @e2e
    Exemple: une personne qui prend le temps d'écrire envoie son message
      Étant donné Camille ouvre la page de contact
      Quand Camille écrit son message et l'envoie après quelques secondes
      Alors Camille lit « Message envoyé. Merci ! »

  Règle: Les envois en rafale sont limités

    @US-XXX-4 @integration @securite
    Exemple: sixième envoi en une minute depuis la même adresse : limite atteinte
      Étant donné 5 envois depuis la même adresse dans la dernière minute
      Quand un sixième envoi arrive
      Alors l'action répond « Trop de tentatives. Réessayez dans 1 minute. »

  Règle: Le formulaire explique quoi faire s'il n'a pas pu se préparer

    @US-XXX-2 @e2e
    Exemple: sans jeton, le bouton reste désactivé et la page explique quoi faire
      Étant donné la demande du jeton échoue
      Quand la page de contact s'ouvre
      Alors la page affiche « Le formulaire n'a pas pu se préparer. Rechargez la page. »
      Et le bouton « Envoyer » reste désactivé

  Règle: Turnstile refuse un envoi sans réponse valable (option)

    @US-XXX-5 @integration @securite
    Exemple: Turnstile actif et réponse absente : refusé
      Étant donné Turnstile est actif
      Quand un envoi arrive sans réponse du widget
      Alors l'action répond « La vérification anti-robot a échoué. Réessayez dans un instant. »

    @US-XXX-5 @integration
    Exemple: Cloudflare injoignable : refusé, et l'incident est journalisé
      Étant donné Cloudflare ne répond pas
      Quand la réponse du widget est vérifiée
      Alors l'envoi est refusé et l'incident est journalisé
```

## Tâches de plan prêtes

- [ ] **Tn – Préparer la protection des formulaires publics** · US-XXX
  - Objectif : le site sait reconnaître un envoi de robot (champ piège, jeton de délai) et limiter les envois en rafale
  - Dépend de : la tâche « Compter les tentatives par adresse IP » de la recette `limite`
  - Fichiers : à créer : `src/lib/helpers/formulaire-public/champs.ts`, `src/lib/helpers/formulaire-public/jeton.ts`, `app/api/jeton-formulaire/route.ts`, `src/hooks/use-protection-formulaire.ts`, `src/components/shared/elements/champ-piege.tsx`, `src/lib/formulaire-public.ts` et leurs tests · à modifier : `src/config/env.ts`, `.env.example`
  - Vérification : US-XXX critères 1 et 2 – `npm test` passe
  - Tests : « rempli, même avec une valeur qui n'est pas du texte… », « envoyé moins de 3 secondes après l'ouverture… », « ouvert depuis plus de 2 heures… », « horodatage modifié ou autre secret… » (unitaires)
  - Action manuelle : `pulse-aidd secrets generer FORMULAIRE_SECRET`
- [ ] **Tn+1 – Protéger le formulaire de contact** · US-XXX
  - Objectif : une personne envoie un message ; un robot est refusé
  - Dépend de : Tn
  - Fichiers : à créer : `src/features/contact/schemas/contact.schema.ts`, `src/features/contact/actions/envoyer-message.action.ts`, `src/features/contact/components/sections/formulaire-contact.tsx`, `src/features/contact/components/containers/contact.container.tsx`, `app/(public)/contact/page.tsx`, `src/features/contact/actions/__tests__/envoyer-message.action.test.ts`, `e2e/formulaire-public.spec.ts` (exemple : adapter au projet)
  - Vérification : US-XXX critères 1 à 4 – `npm test` et `npm run test:e2e` passent ; essai manuel de l'étape 9
  - Tests : « une personne qui a pris le temps d'écrire… », « champ piège rempli… », « sixième envoi en une minute… » (intégration) ; « une personne qui prend le temps d'écrire envoie son message », « un robot qui remplit le champ piège est refusé », « sans jeton, le bouton reste désactivé… » (bout en bout)
  - Action manuelle : `pulse-aidd secrets generer FORMULAIRE_SECRET --envoyer production,preview --sans-local`, puis redéployer
- [ ] **Tn+2 (facultative) – Ajouter Turnstile** · US-XXX
  - Objectif : les formulaires visés par les robots passent aussi par la vérification de Cloudflare
  - Dépend de : Tn+1
  - Fichiers : à créer : `src/adapters/turnstile/turnstile.adapter.ts` et son test, `src/components/shared/elements/widget-turnstile.tsx` · à modifier : `src/lib/formulaire-public.ts`, `src/hooks/use-protection-formulaire.ts`, la section et le container du formulaire, `src/config/env.ts`, `.env.example`, `next.config.ts`
  - Vérification : US-XXX critère 5 – `npm test` passe ; essai avec les clés de test de l'étape 17
  - Tests : « Turnstile actif et réponse absente : refusé », « Cloudflare injoignable… » (intégration)
  - Action manuelle : créer le widget Turnstile, saisir les deux clés dans `.env` et dans Vercel, puis redéployer

## Tests

Unitaires : le champ piège et le jeton.

```ts
// src/lib/helpers/formulaire-public/__tests__/champs.test.ts
import { describe, expect, it } from "vitest";
import { CHAMP_PIEGE, estPiegeRempli, NOM_FORMULAIRE } from "../champs";

describe("Champ piège", () => {
  it("US-XXX-1 – vide ou absent : la personne passe", () => {
    expect(estPiegeRempli({ [CHAMP_PIEGE]: "" })).toBe(false);
    expect(estPiegeRempli({ [CHAMP_PIEGE]: "   " })).toBe(false);
    expect(estPiegeRempli({ message: "Bonjour" })).toBe(false);
    expect(estPiegeRempli(null)).toBe(false);
  });

  it("US-XXX-1 – rempli, même avec une valeur qui n'est pas du texte : c'est un robot", () => {
    expect(estPiegeRempli({ [CHAMP_PIEGE]: "https://exemple.fr" })).toBe(true);
    expect(estPiegeRempli({ [CHAMP_PIEGE]: 0 })).toBe(true);
    expect(estPiegeRempli({ [CHAMP_PIEGE]: false })).toBe(true);
    expect(estPiegeRempli({ [CHAMP_PIEGE]: {} })).toBe(true);
  });

  it("les noms de formulaire restent simples", () => {
    expect(NOM_FORMULAIRE.test("contact")).toBe(true);
    expect(NOM_FORMULAIRE.test("demande-de-devis")).toBe(true);
    expect(NOM_FORMULAIRE.test("contact.autre")).toBe(false);
    expect(NOM_FORMULAIRE.test("")).toBe(false);
  });
});
```

```ts
// src/lib/helpers/formulaire-public/__tests__/jeton.test.ts
import { describe, expect, it } from "vitest";
import { signerJeton, verifierJeton } from "../jeton";

const SECRET = "secret-de-test-assez-long-pour-hmac-0123";
const T0 = Date.UTC(2026, 9, 8, 10, 0, 0);

describe("Jeton de délai", () => {
  it("US-XXX-2 – ouvert depuis 5 secondes, pour ce formulaire : valide", () => {
    const jeton = signerJeton("contact", T0, SECRET);
    expect(verifierJeton(jeton, "contact", T0 + 5_000, SECRET)).toBe("valide");
  });

  it("US-XXX-2 – envoyé moins de 3 secondes après l'ouverture : trop rapide", () => {
    const jeton = signerJeton("contact", T0, SECRET);
    expect(verifierJeton(jeton, "contact", T0 + 2_999, SECRET)).toBe(
      "trop-rapide",
    );
  });

  it("US-XXX-2 – ouvert depuis plus de 2 heures : expiré", () => {
    const jeton = signerJeton("contact", T0, SECRET);
    expect(verifierJeton(jeton, "contact", T0 + 7_200_001, SECRET)).toBe(
      "expire",
    );
  });

  it("US-XXX-2 – jeton d'un autre formulaire : refusé", () => {
    const jeton = signerJeton("devis", T0, SECRET);
    expect(verifierJeton(jeton, "contact", T0 + 5_000, SECRET)).toBe(
      "falsifie",
    );
  });

  it("US-XXX-2 – horodatage modifié ou autre secret : refusé", () => {
    const jeton = signerJeton("contact", T0, SECRET);
    const vieilli = jeton.replace(String(T0), String(T0 - 60_000));
    expect(verifierJeton(vieilli, "contact", T0 + 5_000, SECRET)).toBe(
      "falsifie",
    );
    expect(verifierJeton(jeton, "contact", T0 + 5_000, `${SECRET}-autre`)).toBe(
      "falsifie",
    );
  });

  it("US-XXX-2 – formes inattendues : refusées sans erreur", () => {
    for (const jeton of [
      "abc",
      "a.b",
      "a.b.c.d",
      `${T0}.contact.`,
      "x.contact.y",
    ]) {
      expect(verifierJeton(jeton, "contact", T0, SECRET)).toBe("falsifie");
    }
    expect(verifierJeton("", "contact", T0, SECRET)).toBe("absent");
    expect(verifierJeton(undefined, "contact", T0, SECRET)).toBe("absent");
    expect(verifierJeton(42, "contact", T0, SECRET)).toBe("absent");
  });
});
```

Intégration : l'action complète, avec la limite en mémoire (`LIMITE_STOCKAGE: "memoire"`) et une adresse différente pour chaque test.

```ts
// src/features/contact/actions/__tests__/envoyer-message.action.test.ts
import { signerJeton } from "@src/lib/helpers/formulaire-public/jeton";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "secret-de-test-assez-long-pour-hmac-0123";
const etat = vi.hoisted(() => ({ ip: "203.0.113.1" }));
const journal = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": etat.ip }),
}));
vi.mock("@src/lib/logger", () => ({ logger: journal }));
vi.mock("@src/config/env", () => ({
  envServeur: () => ({ FORMULAIRE_SECRET: SECRET, LIMITE_STOCKAGE: "memoire" }),
}));

const { envoyerMessage } = await import("../envoyer-message.action");

let compteurIp = 0;
beforeEach(() => {
  compteurIp += 1;
  etat.ip = `203.0.113.${compteurIp}`;
  journal.info.mockClear();
  journal.warn.mockClear();
});

const jetonDe = (age: number, formulaire = "contact") =>
  signerJeton(formulaire, Date.now() - age, SECRET);

describe("Formulaire public", () => {
  it("US-XXX-3 – une personne qui a pris le temps d'écrire : le message part", async () => {
    const r = await envoyerMessage({
      message: "Bonjour",
      jeton_formulaire: jetonDe(5_000),
      site_web_societe: "",
    } as never);
    expect(r?.data).toEqual({ ok: true });
    expect(journal.info).toHaveBeenCalledWith({ longueur: 7 }, "Message reçu");
  });

  it("US-XXX-1 – champ piège rempli : refusé, et noté dans le journal sans le contenu", async () => {
    const r = await envoyerMessage({
      message: "Achetez",
      jeton_formulaire: jetonDe(5_000),
      site_web_societe: "https://spam.example",
    } as never);
    expect(r?.serverError).toBe("Rechargez la page et réessayez.");
    expect(JSON.stringify(journal.warn.mock.calls)).not.toContain(
      "spam.example",
    );
    expect(journal.info).not.toHaveBeenCalled();
  });

  it("US-XXX-2 – sans jeton : refusé", async () => {
    const r = await envoyerMessage({ message: "Bonjour" });
    expect(r?.serverError).toBe("Rechargez la page et réessayez.");
  });

  it("US-XXX-2 – envoyé une seconde après l'ouverture : message « trop rapide »", async () => {
    const r = await envoyerMessage({
      message: "Bonjour",
      jeton_formulaire: jetonDe(1_000),
    } as never);
    expect(r?.serverError).toBe(
      "Envoi trop rapide. Patientez quelques secondes, puis réessayez.",
    );
  });

  it("US-XXX-2 – jeton d'un autre formulaire : refusé", async () => {
    const r = await envoyerMessage({
      message: "Bonjour",
      jeton_formulaire: jetonDe(5_000, "devis"),
    } as never);
    expect(r?.serverError).toBe("Rechargez la page et réessayez.");
  });

  it("US-XXX-4 – sixième envoi en une minute depuis la même adresse : limite atteinte", async () => {
    const envoi = () =>
      envoyerMessage({
        message: "Bonjour",
        jeton_formulaire: jetonDe(5_000),
      } as never);
    for (let i = 0; i < 5; i++) {
      expect((await envoi())?.data).toEqual({ ok: true });
    }
    expect((await envoi())?.serverError).toBe(
      "Trop de tentatives. Réessayez dans 1 minute.",
    );
  });
});
```

Bout en bout : le délai minimal se mesure côté serveur, le test attend donc vraiment 3 secondes.

```ts
// e2e/formulaire-public.spec.ts
import { expect, test } from "@playwright/test";

test.describe("Formulaire public", () => {
  test("une personne qui prend le temps d'écrire envoie son message", async ({
    page,
  }) => {
    await page.goto("/contact");
    const bouton = page.getByRole("button", { name: "Envoyer" });
    await expect(bouton).toBeEnabled();
    await page
      .getByLabel("Votre message")
      .fill("Bonjour, je voudrais un devis.");
    // Le délai minimal (3 s) est mesuré par l'horloge du serveur : on attend vraiment.
    await page.waitForTimeout(3_200);
    await bouton.click();
    await expect(page.getByText("Message envoyé. Merci !")).toBeVisible();
  });

  test("un robot qui remplit le champ piège est refusé", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("button", { name: "Envoyer" })).toBeEnabled();
    await page.getByLabel("Votre message").fill("Achetez maintenant");
    await page
      .locator("#site_web_societe")
      .fill("https://spam.example", { force: true });
    await page.waitForTimeout(3_200);
    await page.getByRole("button", { name: "Envoyer" }).click();
    // Next.js ajoute son propre rôle « alert » (annonce de navigation) : on cible le message.
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Rechargez la page et réessayez." }),
    ).toBeVisible();
  });

  test("sans jeton, le bouton reste désactivé et la page explique quoi faire", async ({
    page,
  }) => {
    await page.route("**/api/jeton-formulaire**", (route) =>
      route.fulfill({ status: 500 }),
    );
    await page.goto("/contact");
    await expect(
      page.getByRole("alert").filter({
        hasText: "Le formulaire n'a pas pu se préparer. Rechargez la page.",
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Envoyer" })).toBeDisabled();
  });

  test("le champ piège reste hors de portée du clavier", async ({ page }) => {
    await page.goto("/contact");
    await page.getByLabel("Votre message").focus();
    await page.keyboard.press("Tab");
    await expect(page.locator("#site_web_societe")).not.toBeFocused();
  });
});
```

Option Turnstile : l'adapter, avec un faux `fetch`.

```ts
// src/adapters/turnstile/__tests__/turnstile.adapter.test.ts
import { describe, expect, it, vi } from "vitest";

const journal = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("@src/lib/logger", () => ({ logger: journal }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@src/config/env", () => ({ envServeur: () => ({}) }));

const { verifierTurnstile } = await import("../turnstile.adapter");

function repondant(corps: unknown) {
  const appels: [string, RequestInit][] = [];
  const envoyer = (async (adresse: string, options: RequestInit) => {
    appels.push([adresse, options]);
    return Response.json(corps);
  }) as unknown as typeof fetch;
  return { envoyer, appels };
}

describe("Vérification Turnstile", () => {
  it("US-XXX-5 – réponse acceptée par Cloudflare : la personne passe", async () => {
    const { envoyer, appels } = repondant({ success: true });
    expect(
      await verifierTurnstile(
        "jeton-du-widget",
        "secret",
        "203.0.113.7",
        envoyer,
      ),
    ).toBe(true);
    const corps = appels[0][1].body as URLSearchParams;
    expect(corps.get("response")).toBe("jeton-du-widget");
    expect(corps.get("remoteip")).toBe("203.0.113.7");
  });

  it("US-XXX-5 – réponse refusée : l'envoi est refusé", async () => {
    const { envoyer } = repondant({
      success: false,
      "error-codes": ["invalid-input-response"],
    });
    expect(await verifierTurnstile("x", "secret", "203.0.113.7", envoyer)).toBe(
      false,
    );
  });

  it("US-XXX-5 – réponse absente ou trop longue : refusée sans appeler Cloudflare", async () => {
    const { envoyer, appels } = repondant({ success: true });
    expect(
      await verifierTurnstile(undefined, "secret", "inconnue", envoyer),
    ).toBe(false);
    expect(
      await verifierTurnstile("x".repeat(2049), "secret", "inconnue", envoyer),
    ).toBe(false);
    expect(appels).toHaveLength(0);
  });

  it("US-XXX-5 – Cloudflare injoignable : refusé, et l'incident est journalisé", async () => {
    const enPanne = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await verifierTurnstile("x", "secret", "203.0.113.7", enPanne)).toBe(
      false,
    );
    expect(journal.error).toHaveBeenCalled();
  });

  it("adresse IP inconnue : elle n'est pas transmise", async () => {
    const { envoyer, appels } = repondant({ success: true });
    await verifierTurnstile("x", "secret", "inconnue", envoyer);
    expect((appels[0][1].body as URLSearchParams).has("remoteip")).toBe(false);
  });
});
```

Et dans le test de l'action, une version réglable du faux `env.ts` et un test de plus :

```ts
const reglages = vi.hoisted(() => ({
  turnstile: undefined as string | undefined,
}));
vi.mock("@src/config/env", () => ({
  envServeur: () => ({
    FORMULAIRE_SECRET: SECRET,
    LIMITE_STOCKAGE: "memoire",
    TURNSTILE_SECRET_KEY: reglages.turnstile,
  }),
}));

// dans beforeEach : reglages.turnstile = undefined;

  it("US-XXX-5 – Turnstile actif et réponse absente : refusé", async () => {
    reglages.turnstile = "secret-turnstile-de-test";
    const r = await envoyerMessage({
      message: "Bonjour",
      jeton_formulaire: jetonDe(5_000),
    } as never);
    expect(r?.serverError).toBe(
      "La vérification anti-robot a échoué. Réessayez dans un instant.",
    );
  });
```

## Points de sécurité

- **S5 – Validation** : le schéma Zod de l'action reste vérifié côté serveur ; il retire les champs de protection.
- **S1, S2 – Secrets** : `FORMULAIRE_SECRET` et `TURNSTILE_SECRET_KEY` restent côté serveur (`server-only`, sans `NEXT_PUBLIC_`). La clé de site Turnstile est publique par nature.
- **S9 – Données personnelles** : le journal note le nom du formulaire et la raison du refus, sans l'adresse IP ni le contenu. Avec Turnstile, Cloudflare reçoit l'adresse IP du visiteur : à citer dans la mention de confidentialité.
- **S10 – Abus et coûts** : champ piège, jeton de délai signé et limite par adresse IP ; Turnstile en plus pour les formulaires visés.
- **S11 – Messages d'erreur** : chaque refus dit quoi faire (recharger, patienter, réessayer), sans détail technique.
- **S12 – En-têtes** : la CSP s'ouvre à `https://challenges.cloudflare.com` seulement avec l'option Turnstile, pour `script-src` et `frame-src`.

## Pièges connus

- **Nom de formulaire différent entre le container et l'action** : le jeton est refusé à chaque envoi. La constante du schéma (`FORMULAIRE_CONTACT`) sert aux deux.
- **Vrai champ nommé `site_web_societe`** : chaque envoi serait refusé. Ce nom reste réservé au champ piège.
- **Tests de bout en bout trop rapides** : le délai se mesure avec l'horloge du serveur (`page.clock` ne la change pas) ; le test attend 3 secondes (`page.waitForTimeout(3_200)`).
- **`getByRole("alert")` trouve deux éléments dans Playwright** : Next.js ajoute son propre élément `role="alert"` (annonce de navigation). Filtrer par le texte attendu : `page.getByRole("alert").filter({ hasText: "…" })`.
- **Limite atteinte pendant les tests de bout en bout** : en local, toutes les requêtes ont la même adresse ; espacer les essais ou relever `REGLES.formulairePublic` le temps des essais.
- **Jeton gardé dans une page en cache** : le jeton est demandé par le navigateur à l'ouverture, jamais écrit dans la page ; la route reste en `no-store`.
- **Turnstile : second envoi refusé après une erreur** : une réponse du widget ne sert qu'une fois. Le container appelle `protection.apresEnvoi()` après chaque envoi, qui relance le widget.
- **Turnstile activé sans la CSP** : le widget reste vide et la console affiche « Refused to load the script » ; appliquer l'étape 16.
- **Clé de site Turnstile changée sans reconstruire** : `NEXT_PUBLIC_TURNSTILE_SITE_KEY` est lue à la construction ; redéployer après l'avoir changée.
- **Le cadre du widget est introuvable dans un test Playwright** : Turnstile l'affiche dans un shadow DOM. Vérifier plutôt que le bouton s'active (la réponse est arrivée).

## Sources

- next-safe-action 8.7.3 : middleware (`.use`, `clientInput`, `next`) https://next-safe-action.dev/docs/define-actions/middleware ; `returnServerError` https://next-safe-action.dev/docs/concepts/error-handling
- Next.js 16.4 : Route Handlers et `connection()` (documentation embarquée, `01-app/03-api-reference/04-functions/connection.md`) ; sécurité des actions serveur https://nextjs.org/docs/app/guides/data-security
- Node.js `crypto` : `createHmac`, `timingSafeEqual` https://nodejs.org/api/crypto.html
- Cloudflare Turnstile : vérification côté serveur (adresse `siteverify`, `remoteip` facultatif, réponse de 2048 caractères au plus, valable 5 minutes, à usage unique) https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ ; rendu explicite https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/ ; CSP (`script-src` et `frame-src`) https://developers.cloudflare.com/turnstile/reference/content-security-policy/ ; clés de test https://developers.cloudflare.com/turnstile/troubleshooting/testing/
- Vérifications locales le 2026-10-08, sur le squelette du pack avec la recette `limite` (Next.js 16.4.0, next-safe-action 8.7.3, TanStack Form 1.33.5, Zod 4.6.5, Vitest 5.0.3, Playwright 1.63.0) : `npm run check`, `npm run typecheck`, `npm test`, `npm run build`, puis `npm run test:e2e` en configuration de production (ordinateur et téléphone) ; Turnstile essayé avec les clés de test de Cloudflare (accepté, refusé, widget relancé après l'envoi, aucune violation de la CSP)

## Points à vérifier

- Les libellés du tableau de bord Turnstile au moment de créer le widget.
- Le comportement du widget sur téléphone avec une vraie clé (essai fait avec les clés de test sur ordinateur).
