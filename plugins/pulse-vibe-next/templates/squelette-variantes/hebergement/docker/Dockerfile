# syntax=docker/dockerfile:1
# Image de production du site (hébergement docker), construite sur le serveur par scripts/deployer.sh
# (docker compose -f compose.production.yml up --build). Modèle : l'exemple with-docker de Next.js
# (https://github.com/vercel/next.js/tree/canary/examples/with-docker), sortie standalone.
# Version de Node.js : la LTS active, à monter avec les dépendances du projet.
ARG NODE_VERSION=26-slim

# 1. Dépendances, toutes (les tests et la construction en ont besoin), d'après package-lock.json.
FROM node:${NODE_VERSION} AS dependances
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

# 2. Tests, puis construction. Un test qui échoue arrête tout : le site en ligne reste celui d'avant.
# Les secrets ne servent pas ici (ils resteraient lisibles dans l'image) : ils arrivent au démarrage,
# depuis le fichier .env du serveur. SITE_URL (pas un secret) sert aux pages construites d'avance.
FROM dependances AS construction
COPY . .
ARG SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1 PULSE_SORTIE=standalone SKIP_ENV_VALIDATION=1 SITE_URL=${SITE_URL}
RUN test -n "$SITE_URL" || { echo "SITE_URL manque dans le fichier .env du serveur (ex. https://www.mon-site.fr)." >&2; exit 1; }
RUN npm test
RUN npm run build

# 3. Migrations de la base, lancées par le service « migrations » avant le site (scripts/migrer.mjs).
FROM dependances AS migrations
COPY . .
CMD ["node", "scripts/migrer.mjs", "--en-ligne"]

# 4. Le site : le serveur autonome seul, sans les outils de construction. Les fichiers appartiennent
# à root et se lisent seulement ; le site tourne sous l'utilisateur « node », sans droits d'administration,
# et n'écrit que dans son cache.
FROM node:${NODE_VERSION} AS production
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=construction /app/.next/standalone ./
COPY --from=construction /app/.next/static ./.next/static
COPY --from=construction /app/public ./public
RUN mkdir -p .next/cache && chown node:node .next/cache
USER node
EXPOSE 3000
CMD ["node", "server.js"]
