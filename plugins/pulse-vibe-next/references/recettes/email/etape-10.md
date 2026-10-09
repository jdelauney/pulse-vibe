### 10. Les tests de la recette `connexion`

Avec la vérification d'adresse, `src/adapters/auth/__tests__/auth.adapter.test.ts` change à quatre endroits :

1. Importez `user` en plus de `account` : `import { account, user } from "@src/db/compte/auth.table";`.

2. `creerAuth` reçoit maintenant `envoyerEmail` : doublez l'envoi dans `optionsDeTest`, aucun e-mail ne part pendant les tests.

```ts
const optionsDeTest = {
  secret: "secret-de-test-secret-de-test-secret-de-test",
  baseURL: "http://localhost:3000",
  // Recette email : aucun e-mail ne part pendant les tests.
  envoyerEmail: async () => {},
};
```

3. Dans `inscrireCamille`, confirmez l'adresse après l'inscription :

```ts
  async function inscrireCamille() {
    const resultat = await auth.api.signUpEmail({
      body: {
        name: "Camille Martin",
        email: "camille@exemple.fr",
        password: "motdepasse-solide",
      },
    });
    // Recette email : Camille a cliqué sur le lien de confirmation.
    await base.db
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.email, "camille@exemple.fr"));
    return resultat;
  }
```

4. Remplacez le test « une deuxième inscription avec la même adresse est refusée » (elle reçoit désormais la même réponse) par :

```ts
  it("US-XXX-2 – une deuxième inscription avec la même adresse ne crée pas de second compte", async () => {
    await inscrireCamille();
    await inscrireCamille();
    const comptes = await base.db
      .select()
      .from(user)
      .where(eq(user.email, "camille@exemple.fr"));
    expect(comptes).toHaveLength(1);
  });
```

Dans la spec, l'exemple « Une adresse déjà utilisée est refusée » de la recette `connexion` devient : « Une adresse déjà utilisée reçoit la même réponse, sans second compte ».

