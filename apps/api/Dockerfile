# syntax=docker/dockerfile:1
# Build context is the repository root: docker build -f apps/api/Dockerfile .

FROM node:24-alpine AS build
RUN npm install --global pnpm@12.8.1
WORKDIR /workspace

# Manifests first, so the dependency layer is reused until they change.
# The lockfile covers every workspace project, so all their manifests must be present.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY e2e/package.json e2e/
# Scripts are skipped: the contracts `prepare` build needs sources that are copied later
RUN pnpm install --frozen-lockfile --filter api... --ignore-scripts

COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @genialtanken/contracts build \
  && pnpm --filter api build \
  && pnpm --filter api --prod deploy --ignore-scripts /out

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/package.json ./
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
