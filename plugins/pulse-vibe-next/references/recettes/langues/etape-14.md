### 14. Adapter le test du lien d'évitement

Le lien d'évitement du squelette porte maintenant le texte des messages. Dans `e2e/accueil.spec.ts`, le test « le lien d'évitement est le premier arrêt au clavier » cherche le lien par son texte : `Aller au contenu` reste juste tant que le navigateur de test est en français (étape 13) ; si vous changez la langue du test ou le texte du message `Accessibilite.allerAuContenu`, le texte cherché suit la traduction.

