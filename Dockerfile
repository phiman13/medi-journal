# Build-Stage: kompiliert Frontend (Vite) und Backend (tsc). Enthält
# Build-Toolchain für native Module (better-sqlite3, argon2), s.
# docs/superpowers/specs/2026-07-17-m1-scaffolding-design.md (Fix 2).
FROM node:26-slim AS build
WORKDIR /repo

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY app/package.json app/package.json
COPY server/package.json server/package.json
RUN npm install

COPY . .
RUN npm run build

# Runtime-Stage: nur Production-Dependencies + gebaute Artefakte.
FROM node:26-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY app/package.json app/package.json
COPY server/package.json server/package.json
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && npm install --omit=dev \
  && apt-get purge -y python3 make g++ && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /repo/server/dist ./server/dist
COPY --from=build /repo/app/dist ./app/dist

EXPOSE 3000
CMD ["node", "server/dist/index.js"]
