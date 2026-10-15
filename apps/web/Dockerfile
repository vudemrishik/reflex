FROM node:20-alpine

WORKDIR /app

# Workspace manifests first (better layer caching)
COPY package.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/engine/package.json ./packages/engine/package.json
RUN npm install --workspace @reflex/web --workspace @reflex/engine

# Sources (dev bind-mounts overlay src/ at runtime)
COPY apps/web ./apps/web
COPY packages/engine ./packages/engine

WORKDIR /app/apps/web

EXPOSE 5173
CMD ["npm", "run", "dev"]
