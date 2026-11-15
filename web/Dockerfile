# syntax=docker/dockerfile:1

# --- build do frontend (contexto = raiz do repositório) ---------------------
FROM node:22-alpine AS build

RUN corepack enable

WORKDIR /app

COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY web/ ./
# o card.css é compartilhado com a API (importado como ../../shared/card.css)
COPY shared/ /shared/

RUN pnpm build

# --- runtime estático (nginx) ----------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/ || exit 1
