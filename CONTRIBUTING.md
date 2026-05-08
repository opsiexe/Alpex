# Contribuer à Alpex

Merci pour votre intérêt.

## Workflow recommandé

1. Fork + branche dédiée.
2. Faites des changements ciblés et atomiques.
3. Vérifiez localement avant PR :
   - `cd frontend && npm run lint`
   - `cd frontend && npm run build`
4. Ouvrez une Pull Request claire avec contexte + impact.

## Bonnes pratiques

- Ne commitez jamais de secrets, clés API, ou `.env`.
- Gardez le mode paper trading.
- Préférez des changements simples, testables et documentés.

## Signalement de problèmes de sécurité

Ne pas ouvrir de ticket public pour une faille de sécurité.
Utiliser la procédure décrite dans `SECURITY.md`.
