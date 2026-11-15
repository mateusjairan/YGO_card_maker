# Projeto B — YGO Card Maker

**Nível declarado: Projeto B** (API de domínio único, um fluxo principal de ponta a ponta).

[![CI](https://github.com/mateusjairan/YGO_card_maker/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/mateusjairan/YGO_card_maker/actions/workflows/ci.yml)
[![Cobertura](https://img.shields.io/badge/cobertura-92%25-brightgreen)](docs/desempenho.md)
[![SLO p95](https://img.shields.io/badge/p95-65%20ms-blue)](docs/desempenho.md)
[![Licença](https://img.shields.io/badge/licen%C3%A7a-MIT-lightgrey)](#licença)

Criador de cartas customizadas de Yu-Gi-Oh!: você entra com e-mail, monta a carta no navegador
com a sua arte, moldura por atributo, brilho holográfico, exporta em PNG 2× e compartilha um link
que já abre com prévia no WhatsApp/Discord/X.

<p align="center">
  <img src="docs/img/editor.png" alt="Editor de cartas com prévia em tempo real" width="880">
</p>

| Camada | Tecnologia |
| --- | --- |
| Frontend | React 18 + TypeScript + Vite (SPA) |
| Backend | FastAPI + Pydantic v2 (Python 3.13) |
| Autenticação | E-mail + senha (scrypt) com sessão JWT HS256 |
| Banco | Supabase Postgres (produção) · SQLite (desenvolvimento e testes) |
| Storage | Supabase Storage (produção) · disco local (desenvolvimento) |
| Infra | Docker Compose · Nginx · GitHub Actions |
| Deploy | Cloudflare Pages (front) · Render (API em Docker) · Supabase (banco/storage) |

---

## Sumário

- [O que funciona](#o-que-funciona)
- [Como subir com um comando](#como-subir-com-um-comando)
- [Como rodar sem Docker](#como-rodar-sem-docker)
- [Como testar](#como-testar)
- [API](#api)
- [Interface](#interface)
- [Arquitetura](#arquitetura)
- [Supabase](#supabase)
- [Deploy](#deploy)
- [Observabilidade e SLO](#observabilidade-e-slo)
- [Branches](#branches)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Checklist da rubrica](#checklist-da-rubrica)
- [Limites conhecidos](#limites-conhecidos)

---

## O que funciona

Fluxo principal: **entrar → criar → salvar → compartilhar**.

- **Login por e-mail** (cadastro + senha) com sessão JWT de 7 dias; rotas de cartas exigem sessão.
- **Cota de 5 uploads por conta** — cada arte enviada consome 1; a API responde `403` ao exceder e
  a interface mostra os pips de cota no cabeçalho.
- **Três tipos de carta** — Monstro (9 categorias: normal, efeito, ritual, fusão, sincro, xyz,
  link, pêndulo, ficha), Magia (6) e Armadilha (3).
- **Moldura por atributo** — Luz, Trevas, Terra, Água, Fogo, Vento e Divino têm paleta própria,
  como nas cartas originais; magia e armadilha usam o verde e o rosa clássicos.
- **Nível/Rank/Link** — estrelas clicáveis, estrelas escuras para Xyz e selo `LINK-n` para Link.
- **Upload padronizado** — recorte central 1:1, downscale até 1024 px (nunca faz upscale) e
  reencode para WebP; toda arte entra no mesmo formato.
- **Nove raridades** — Comum, Rara, Super, Ultra, Secret, Prismática, Ultimate, Ghost e
  Starlight, cada uma com camadas de foil próprias (linhas arco-íris, granulado em relevo,
  campo de estrelas, nome em foil e brilho que segue o mouse).
- **Prévia em tempo real** com o mesmo CSS usado na página pública.
- **Exportação em PNG 2×** (840×1224) direto do DOM.
- **Página pública SSR** em `/c/{slug}` com Open Graph (a arte aparece na prévia do link).
- **Galeria pública** na home e **minhas cartas** por conta.
- **Editar e excluir** apenas as próprias cartas (posse por `user_id`).

<p align="center">
  <img src="docs/img/home.png" alt="Home" width="640">
  <img src="docs/img/login.png" alt="Tela de login" width="640">
</p>

## Como subir com um comando

Pré-requisitos: **Docker** (Desktop ou Engine + Compose v2).

```bash
cp .env.example .env     # opcional para o modo local (SQLite)
docker compose up --build
```

| Serviço | URL |
| --- | --- |
| Aplicação (nginx + SPA + proxy) | http://localhost:8080 |
| API (direto) | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| Métricas | http://localhost:8000/metrics |
| Health check | http://localhost:8000/health |

O `docker-compose.yml` sobe a API com healthcheck e o front só inicia depois que a API responde.
No modo padrão os dados ficam em um volume Docker (`api-data`), em SQLite — nenhuma credencial
externa é necessária para a aplicação rodar.

## Como rodar sem Docker

**API** (Python 3.11+):

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate  ·  Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt

uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
# ou: PYTHONPATH=src uvicorn app.main:create_app --factory
```

**Web** (Node 20+ e pnpm):

```bash
cd web
pnpm install
pnpm dev            # http://localhost:5173
```

O Vite faz proxy de `/api`, `/c`, `/media` e `/static` para `http://127.0.0.1:8000`, então o
link de compartilhamento funciona igual em desenvolvimento e em produção (mesma origem).

## Como testar

```bash
# Backend: 93 testes, cobertura obrigatória de 80% (atingido: 92,7%)
pytest

# Lint e formatação Python
ruff check src tests
ruff format --check src tests

# Frontend
cd web
pnpm lint
pnpm build

# Smoke test do fluxo completo contra uma API em execução
node scripts/smoke.mjs http://127.0.0.1:8000

# Carga (k6): p95 < 300 ms e < 1% de falhas
k6 run load/k6-smoke.js
```

Os testes cobrem regras de domínio (validação de tipo/atributo/nível, slug, linha de tipo),
autenticação (cadastro, login, sessão, cota), o repositório SQLite, a API inteira via HTTP,
upload padronizado, página pública e métricas.
Resultados de carga medidos em [docs/desempenho.md](docs/desempenho.md).

## API

Documentação viva em `/docs` (Swagger) e contrato versionado em
[docs/openapi.yaml](docs/openapi.yaml) — gerado do código por `python scripts/export_openapi.py`
e validado no CI (o build falha se o YAML ficar desatualizado).

| Método | Rota | Descrição | Auth |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Cria a conta e devolve o token | — |
| `POST` | `/api/auth/login` | Autentica e devolve o token | — |
| `GET` | `/api/auth/me` | Sessão atual + cota de uploads | bearer |
| `POST` | `/api/cards` | Cria carta | bearer |
| `GET` | `/api/cards` | Galeria pública (`limit`, `offset`, `q`) | — |
| `GET` | `/api/cards/mine` | Cartas do duelista | bearer |
| `GET` | `/api/cards/{id}` | Detalhe | — |
| `GET` | `/api/cards/slug/{slug}` | Detalhe pela URL amigável | — |
| `PATCH` | `/api/cards/{id}` | Atualização parcial | dono |
| `DELETE` | `/api/cards/{id}` | Remove carta + imagem | dono |
| `POST` | `/api/uploads` | Upload da arte (padroniza em 1024² WebP) | bearer |
| `GET` | `/c/{slug}` | Página pública com Open Graph | — |
| `GET` | `/health`, `/metrics` | Health check e Prometheus | — |

**Sessão:** o front guarda o JWT e envia `Authorization: Bearer <token>`. Senhas usam `scrypt`
com salt por usuário; o token é HS256 com `SECRET_KEY` do ambiente e expira em 7 dias.
A posse da carta é comparada por `user_id` — outro duelista recebe `403`.

Exemplo:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"duelista@exemplo.com","password":"senha-forte-123"}' | jq -r .access_token)

curl -X POST http://localhost:8000/api/cards \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Aurora do Véu","kind":"monster","monster_kind":"effect",
       "attribute":"light","race":"Fada","level":7,"atk":2400,"defense":1800,
       "description":"Quando esta carta é invocada, o primeiro desejo vira escudo."}'
```

## Interface

A UI segue a linguagem dos jogos online de Yu-Gi-Oh! (referência: Master Duel): fundo naval quase
preto, grade sutil, acentos ciano e dourado, painéis com cantos em "L", botões chanfrados e pips
de cota no cabeçalho. As **fontes da carta continuam as originais** (Cinzel no nome e nos tipos,
EB Garamond no texto), garantindo que a carta renderizada pareça uma carta de verdade.

Fluidez: a prévia usa `useDeferredValue` (digitar não espera a pintura da carta), o componente da
carta é `memo`, o palco de exportação só é montado durante a exportação e o brilho holográfico
só anima com o ponteiro sobre a carta — sem `backdrop-filter` no cabeçalho.

### Raridades (foil)

O acabamento é parte do modelo (`rarity` no banco), então a carta compartilhada no servidor
(Jinja) e a prévia (React) renderizam exatamente o mesmo foil. Tudo é CSS puro — o PNG exportado
sai com o acabamento.

O motor é **pointer-driven**, no esquema das cartas raras reais
([pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css) e
[ygo-ocg-secret-rare](https://github.com/jialiang/ygo-ocg-secret-rare)):

- `--pointer-x/y` (0–100%) posicionam o **glare** e a queda radial;
- `--background-x/y` são **comprimidos** (37–63% / 33–67%) e dão o **parallax** do padrão
  (`calc(((50% - var(--background-x)) * 2.6) + 50%)` em `background-position`);
- `--card-opacity` acende as camadas e `--pointer-from-*` ficam disponíveis para efeitos;
- `--rx/--ry` inclinam a carta em perspectiva.

A camada `.ygo-card__foil` usa `::before` (scanlines) e `::after` (queda radial com
`mix-blend-mode: luminosity`), o que dá a textura metálica — o foil fica **sobre a arte e sob o
texto**, com um verniz especular discreto na carta inteira.

| Raridade | Nome | Padrão de foil | Movimento |
| --- | --- | --- | --- |
| `common` | preto | nenhum | — |
| `rare` | prateado | escovado vertical | desliza na vertical |
| `super` | prateado | varredura diagonal fria | diagonal |
| `ultra` | dourado | ouro quente + reflexo | pulso de brilho |
| `secret` | arco-íris | rainbow diagonal + grid cruzado | desliza na horizontal |
| `prismatic` | arco-íris | bandas verticais finas | desliza rápido |
| `ultimate` | dourado | granulado em relevo, sem cor | luz de relevo |
| `ghost` | arco-íris | conic radial + névoa | ciclo de matiz |
| `starlight` | dourado | campo de estrelas + glitter | cintila |

Camadas: `.ygo-card__foil` (padrão da raridade), `.ygo-card__holo` (brilho na arte),
`.ygo-card__grain` (relevo), `.ygo-card__stars` (estrelas), `.ygo-card__sparkle` (glitter) e
`.ygo-card__glare` (verniz que segue o ponteiro).

![Quatro raridades](docs/img/rarities.png)

## Arquitetura

```mermaid
flowchart LR
    U[Navegador] -->|HTTPS| CF[Cloudflare Pages / Nginx]
    CF -->|/api, /c, /media| API[FastAPI]
    API --> AUTH[AuthService<br/>scrypt + JWT]
    AUTH --> UREPO{UserRepository}
    API --> SVC[CardService<br/>regras + posse]
    SVC --> REPO{CardRepository}
    REPO -->|dev| SQLITE[(SQLite)]
    REPO -->|prod| PG[(Supabase Postgres)]
    SVC --> ST{ImageStorage}
    ST -->|dev| DISK[(Disco local)]
    ST -->|prod| BUCKET[(Supabase Storage)]
```

Decisões e alternativas descartadas estão em
[docs/adr/0001-arquitetura-em-camadas.md](docs/adr/0001-arquitetura-em-camadas.md).

O **Repository Pattern** é o padrão justificado: a API não conhece SQL nem PostgREST, então o
mesmo serviço de domínio roda em SQLite (desenvolvimento/testes) e Supabase (produção). O
`CardService` concentra as regras de posse, limite por duelista e geração de slug; as rotas
apenas traduzem HTTP.

> O CSS da carta é **uma única fonte** (`shared/card.css`), importada pelo React e servida ao
> template Jinja da página pública. Assim a prévia do editor e o compartilhamento não divergem.

## Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (plano free).
2. Rode as migrations (SQL Editor ou CLI):

   ```bash
   supabase link --project-ref SEU_REF
   supabase db push          # aplica supabase/migrations/*.sql
   ```

   As migrations criam a tabela `public.cards` com RLS habilitado (sem policies: só a
   `service_role` acessa), o índice de galeria, a função `increment_card_views` e o bucket
   público `card-images`.
3. Configure a API (nunca no front):

   ```dotenv
   STORAGE_BACKEND=supabase
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...   # segredo de servidor
   SUPABASE_BUCKET=card-images
   PUBLIC_BASE_URL=https://sua-api.onrender.com
   FRONTEND_BASE_URL=https://seu-site.pages.dev
   ```

4. Gere os segredos: `SECRET_KEY=$(openssl rand -hex 32)`.

As migrations criam `public.users` (`id`, `email` único, `password_hash`, `uploads_used`), a
tabela `cards` com `user_id` e a função `increment_user_uploads`. Com `STORAGE_BACKEND=supabase`
a API passa a usar PostgREST e o Storage; nada muda no frontend.

## Deploy

**Frontend — Cloudflare Pages (free tier):**

```bash
cd web
pnpm build
npx wrangler pages deploy dist --project-name ygo-card-maker
```

O arquivo `web/public/_redirects` faz o proxy de `/api`, `/c`, `/media`, `/static`, `/docs` e
`/openapi.json` para a API na mesma origem — sem CORS e com links curtos. **Troque a URL de
exemplo pela URL do seu deploy** antes de publicar.

**API — Render (Docker, free tier):** novo Web Service a partir do repositório, runtime Docker,
health check `/health`; variáveis conforme `.env.example`.

**Banco/Storage — Supabase:** migrations acima; a `service_role` fica só no Render.

**Alternativa 100% Docker:** `docker compose up -d --build` em qualquer VPS (o nginx já faz o
proxy da API, então o front e a API ficam no mesmo domínio).

## Observabilidade e SLO

- **Logs estruturados** em JSON, uma linha por evento, com `request_id`, método, rota, status e
  `duration_ms` (`app.access`). Exemplo:

  ```json
  {"timestamp": "2026-11-15 18:06:21,312", "level": "INFO", "logger": "app.access",
   "message": "request_completed", "request_id": "9f2c1a7b3d4e", "method": "POST",
   "path": "/api/cards", "status": 201, "duration_ms": 23.41}
  ```

- **Métricas Prometheus** em `/metrics`: `http_requests_total`, `http_request_duration_seconds`
  (RED por rota), `ygo_cards_created_total{kind}`, `ygo_card_views_total`, `ygo_uploads_total`
  e o histograma `ygo_card_create_duration_seconds`.
- **SLO:** 99% das requisições de leitura com **p95 < 300 ms** e taxa de erro < 1% em janela de
  30 dias. Medido com k6: **p95 = 65,2 ms** (4,6× de folga) e 0% de falhas — detalhes e
  metodologia em [docs/desempenho.md](docs/desempenho.md).

## Branches

| Branch | Papel |
| --- | --- |
| `main` | linha estável, o que é avaliado |
| `dev` | integração do dia a dia (feature branches saem daqui) |
| `tests` | suíte de testes, fixtures e ajustes de cobertura |
| `prod` | tag de release/deploy; só recebe merge de `main` validada |

Fluxo: `feature/*` → `dev` → `tests` (testes do que entrou) → `main` → `prod` + tag `v1.0.0`.

## Estrutura do repositório

```text
.
├─ docker-compose.yml
├─ Dockerfile                  # API (FastAPI)
├─ README.md
├─ CONTRIBUTORS.md
├─ .env.example
├─ .github/workflows/ci.yml
├─ src/app/                    # API
│  ├─ main.py                  # composition root
│  ├─ config.py
│  ├─ core/                    # logs, erros, métricas
│  ├─ domain/                  # modelos, regras, schemas
│  ├─ repositories/            # SQLite + Supabase (Repository Pattern)
│  ├─ services/                # regras de negócio e upload
│  ├─ storage/                 # disco local + Supabase Storage
│  ├─ api/routes/              # cartas, uploads, páginas, sistema
│  └─ templates/               # página pública SSR
├─ shared/card.css             # CSS da carta (React + Jinja)
├─ web/                        # React + Vite
│  ├─ src/components|pages|lib
│  ├─ Dockerfile · nginx.conf
│  └─ public/_redirects         # Cloudflare Pages
├─ supabase/migrations/        # schema + bucket
├─ tests/                      # pytest (unit + integração)
├─ load/k6-smoke.js            # carga
├─ scripts/                    # smoke manual e export do OpenAPI
└─ docs/
   ├─ adr/0001-arquitetura-em-camadas.md
   ├─ desempenho.md
   ├─ openapi.yaml
   └─ ia.md
```

## Checklist da rubrica

| Critério | Evidência |
| --- | --- |
| **M1** — funciona, código e design | `docker compose up` sobe tudo; Repository Pattern justificado no ADR; SOLID (domínio isolado, injeção em `main.py`); interface autoral |
| **M2** — testes e CI | `pytest` (93 testes, 92,7% ≥ 80%), testes de integração por fluxo (auth, cartas, upload, cota), ESLint + `tsc`, [CI verde](https://github.com/mateusjairan/YGO_card_maker/actions/workflows/ci.yml) ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) |
| **M3** — ambientes, segredos, observabilidade | `.env.example`, `SECRET_KEY` e service role só no servidor, logs JSON, `/metrics`, SLO declarado |
| **M4** — arquitetura, documentação, desempenho | [ADR 0001](docs/adr/0001-arquitetura-em-camadas.md) e [ADR 0002](docs/adr/0002-autenticacao.md), [OpenAPI](docs/openapi.yaml) validado no CI, [k6 + p95](docs/desempenho.md), README |

## Limites conhecidos

- **Sem verificação de e-mail**: o cadastro aceita qualquer e-mail válido no formato. Não há
  "esqueci a senha" nem rate limiting no login (ver [ADR 0002](docs/adr/0002-autenticacao.md)).
- **Cota vitalícia de 5 uploads**: apagar uma carta não devolve upload — é uma decisão de produto
  para manter o custo de storage previsível.
- **Sem moderação** de conteúdo na galeria pública.
- A integração Supabase está implementada em repositório e storage próprios, com migrations
  prontas; o fluxo validado em execução contínua é o SQLite local (o mesmo contrato).
- Sem testes E2E de navegador (o fluxo é coberto por API + smoke manual) e sem cache Redis —
  ambos listados em [docs/desempenho.md](docs/desempenho.md) como próximos passos.

## Uso de IA

Declarado em [docs/ia.md](docs/ia.md), conforme combinado no curso. A decisão de arquitetura e
a revisão do código são do autor.

## Licença

MIT. As artes enviadas pelos usuários continuam sendo dos respectivos autores; o projeto não
distribui material oficial de Yu-Gi-Oh! (nome e estética são usados apenas em trabalho acadêmico).
