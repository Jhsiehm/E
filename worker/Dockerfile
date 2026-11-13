# Casevex background worker: one small image that runs worker/index.ts.
# Build from the repository root:  docker build -f worker/Dockerfile -t casevex-worker .
# Run:  docker run -e CASEVEX_WORKER_DATABASE_URL=postgres://... casevex-worker

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY worker ./worker
COPY lib ./lib
RUN npm run worker:build

# The runtime image holds one bundled file and no source, dev tools or keys.
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/dist/worker.mjs ./worker.mjs
USER node
CMD ["node", "worker.mjs"]
