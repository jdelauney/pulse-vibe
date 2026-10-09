### 3. Les contenus des e-mails

Des fonctions pures dans `src/core/compte/` : elles ne dépendent ni de Next ni de Nodemailer.

<!-- fichier: src/core/compte/emails-compte.rules.ts -->
```ts
// src/core/compte/emails-compte.rules.ts
// Contenus des e-mails du compte : fonctions pures, testées en unitaire.

export type ContenuEmail = { sujet: string; texte: string; html: string };

type Lien = { libelle: string; url: string };

export function echapperHtml(valeur: string): string {
  return valeur
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Chaque valeur passe par echapperHtml : un nom saisi s'affiche comme du texte.
function composer(
  sujet: string,
  paragraphes: string[],
  lien?: Lien,
): ContenuEmail {
  const corps = paragraphes.map((p) => `<p>${echapperHtml(p)}</p>`).join("");
  const bouton = lien
    ? `<p><a href="${echapperHtml(lien.url)}">${echapperHtml(lien.libelle)}</a></p>`
    : "";
  return {
    sujet,
    texte: [...paragraphes, ...(lien ? [lien.url] : [])].join("\n\n"),
    html: `<!doctype html><html lang="fr"><body style="font-family:sans-serif;line-height:1.5"><h1 style="font-size:20px">${echapperHtml(sujet)}</h1>${corps}${bouton}</body></html>`,
  };
}

export function emailVerificationAdresse({
  nom,
  url,
}: {
  nom: string;
  url: string;
}): ContenuEmail {
  return composer(
    "Confirmez votre adresse e-mail",
    [
      `Bonjour ${nom},`,
      "Cliquez sur le lien ci-dessous pour confirmer votre adresse. Le lien reste valable 24 heures.",
      "Si vous n'avez pas créé de compte, ignorez cet e-mail.",
    ],
    { libelle: "Confirmer mon adresse", url },
  );
}

export function emailMotDePasseOublie({
  nom,
  url,
}: {
  nom: string;
  url: string;
}): ContenuEmail {
  return composer(
    "Choisissez un nouveau mot de passe",
    [
      `Bonjour ${nom},`,
      "Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe. Le lien reste valable 1 heure.",
      "Si vous n'avez rien demandé, ignorez cet e-mail : votre mot de passe reste le même.",
    ],
    { libelle: "Choisir un nouveau mot de passe", url },
  );
}

export function emailCompteExistant({ nom }: { nom: string }): ContenuEmail {
  return composer("Votre compte existe déjà", [
    `Bonjour ${nom},`,
    "Quelqu'un vient de créer un compte avec votre adresse, qui en a déjà un.",
    "Si c'est vous : connectez-vous, ou choisissez « Mot de passe oublié » sur la page de connexion. Sinon, ignorez cet e-mail.",
  ]);
}
```

