### 12. Payer avec les cartes de test

Date d'expiration future, n'importe quel code à 3 chiffres :

| Carte | Résultat |
|---|---|
| `4242 4242 4242 4242` | paiement accepté |
| `4000 0000 0000 3220` | authentification 3D Secure demandée, puis paiement accepté |
| `4000 0000 0000 0002` | refusé (`card_declined`) |
| `4000 0000 0000 9995` | refusé, fonds insuffisants |

