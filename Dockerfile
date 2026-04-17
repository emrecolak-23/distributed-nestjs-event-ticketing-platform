FROM  node:25-alpine3.22 AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
ARG SERVICE
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run proto:generate || true
RUN npx nest build ${SERVICE}

FROM node:25-alpine3.22 AS production
ARG SERVICE
ENV NODE_ENV=production
ENV SERVICE_NAME=${SERVICE}
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate \
    && pnpm install --frozen-lockfile --prod \
    && pnpm store prune

COPY --from=build /app/dist ./dist
COPY --from=build /app/libs/grpc/src/proto ./libs/grpc/src/proto

EXPOSE 3000