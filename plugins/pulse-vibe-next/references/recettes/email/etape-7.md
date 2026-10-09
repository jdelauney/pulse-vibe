### 7. Les formulaires existants

Dans `src/features/compte/components/sections/formulaire-inscription.tsx`, ajoutez la prop `message` (réponse de l'action) au type `Props` :

```tsx
  /** Réponse de l'action : demande d'ouvrir l'e-mail de confirmation. */
  message?: string;
```

puis aux paramètres de la fonction :

```tsx
export function FormulaireInscription({
  envoyer,
  erreurServeur,
  message,
  enCours,
}: Props) {
```

et affichez-la juste avant `{erreurServeur && (` :

```tsx
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
```

Le container `inscription.container.tsx` la transmet :

```tsx
      message={result.data?.message}
```

(à placer après `erreurServeur={result.serverError}`).

Dans `src/features/compte/components/sections/formulaire-connexion.tsx`, après le lien « Créer un compte » :

```tsx
          {" · "}
          <Link href="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
```

