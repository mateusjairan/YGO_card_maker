# Deploy — Cloudflare Pages (front) + Render (API) + Supabase (banco)

Tempo estimado: **35–45 min**, sem alterar código.

```mermaid
flowchart LR
    U[Navegador] -->|HTTPS| CF[Cloudflare Pages<br/>SPA + proxy]
    CF -->|/api /c /static /media| API[Render<br/>FastAPI em Docker]
    API --> DB[(Supabase Postgres)]
    API --> ST[(Supabase Storage)]
```

O Pages faz proxy de `/api`, `/c`, `/media`, `/static`, `/docs` para a API — o navegador vê **uma
origem só**: sem CORS, link curto `/c/{slug}` e Open Graph funcionando.

---

## 1. Supabase (~10 min)

1. Crie o projeto em [supabase.com](https://supabase.com) (free), região **South America (São Paulo)**
   se estiver disponível na sua conta.
2. Aplique as migrations (CLI ou SQL Editor):

   ```bash
   supabase link --project-ref SEU_REF
   supabase db push
   ```

   Ou cole, nesta ordem, `supabase/migrations/20261115000000_init.sql` e
   `20261115000100_storage.sql` no SQL Editor.
3. **Atalho**: o script valida as chaves, aplica as migrations e escreve o `.env`:

   ```bash
   python scripts/setup-supabase.py \
     --url https://SEU-REF.supabase.co \
     --service-key "$SUPABASE_SERVICE_ROLE_KEY" \
     --access-token "$SUPABASE_ACCESS_TOKEN"   # opcional: aplica as migrations
   ```

   Ele também detecta se você colou a `anon` key por engano e avisa se faltar tabela/bucket.
4. Confira no dashboard:
   - `public.users` e `public.cards` existem e estão com **RLS habilitado**;
   - funções `increment_card_views` e `sync_user_uploads` criadas;
   - bucket `card-images` **público** (leitura) com limite de 6 MB.
4. Anote `Project URL` e `service_role key` (Project Settings → API). A `service_role` **nunca**
   vai para o front.

## 2. API no Render (~15 min)

O repositório tem `render.yaml` (Blueprint). No dashboard: **New → Blueprint → selecione o repo**.

Se preferir manual: **New → Web Service → Runtime Docker**, branch `prod`, Health Check `/health`.

Variáveis (as `sync: false` você preenche):

| Variável | Valor |
| --- | --- |
| `APP_ENV` | `production` |
| `LOG_FORMAT` | `json` |
| `STORAGE_BACKEND` | `supabase` |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | segredo do Supabase |
| `SUPABASE_BUCKET` | `card-images` |
| `SECRET_KEY` | `openssl rand -hex 32` (o Blueprint gera sozinho) |
| `PUBLIC_BASE_URL` | `https://ygo-card-maker-api.onrender.com` |
| `FRONTEND_BASE_URL` | `https://ygo-card-maker.pages.dev` |
| `CORS_ORIGINS` | a URL do Pages |
| `MAX_UPLOADS_PER_USER` | `5` |
| `IMAGE_OUTPUT_PX` | `1024` |

Valide:

```bash
curl -s https://SEU-SERVICO.onrender.com/health
# {"status":"ok",...,"checks":{"database":true}}

curl -s https://SEU-SERVICO.onrender.com/ | head -c 200   # URL pública do front
# {"name":"...","version":"1.0.0","docs":"/docs",...,"frontend":"https://seu-site.pages.dev"}

curl -s https://SEU-SERVICO.onrender.com/docs | head -c 80   # Swagger
```

> **Confira antes da demo:** `/health` tem que mostrar `"env":"production"` (se mostrar
> `development`, `APP_ENV` não foi preenchida) e a raiz `/` tem que mostrar `frontend` com a URL
> pública do front. Abra uma carta em `/c/{slug}` e veja se os links não apontam para `localhost` —
> com `PUBLIC_BASE_URL` ou `FRONTEND_BASE_URL` erradas, o Open Graph e os botões da página pública
> quebram. Desde esta versão, `create_app` loga `configuracao_de_producao` (WARNING) nesses casos.

> **Cold start:** no plano free o serviço hiberna após ~15 min sem tráfego. A primeira requisição
> leva ~30–50 s. Para eliminar (Starter) ou disfarçar isso (keep-alive gratuito + front resiliente),
> veja a seção [5](#5-evitar-o-cold-start-api-hibernando). Para uma apresentação, abra `/health`
> 2 minutos antes.

## 3. Front no Cloudflare Pages (~10 min)

1. **Workers & Pages → Create → Pages → Connect to Git** e escolha o repositório.
2. Configuração de build:

   | Campo | Valor |
   | --- | --- |
   | Framework preset | *None* / Vite |
   | Root directory | `web` |
   | Build command | `pnpm build` |
   | Build output directory | `dist` |
   | Env var | `NODE_VERSION=22` |

3. Aponte o proxy para a sua API: edite `web/public/_redirects` trocando
   `https://ygo-card-maker-api.onrender.com` pela URL do Render.

   ```bash
   sed -i 's|https://SEU-SERVICO.onrender.com|https://SUA-API.onrender.com|g' web/public/_redirects
   ```

   O arquivo precisa continuar em `web/public/` (o Vite copia para `dist/`).
4. Commit na `prod` → o Pages builda e publica. URL: `https://SEU-PROJETO.pages.dev`.

Se usar domínio próprio, adicione em **Custom domains** e ajuste `FRONTEND_BASE_URL`/`CORS_ORIGINS`
no Render.

## 4. Validação pós-deploy (~10 min)

```bash
# fluxo completo (auth, cota, posse, XSS, CORS) contra produção
node scripts/e2e-api.mjs https://SEU-SERVICO.onrender.com
```

No navegador, com o site do Pages:

1. criar conta → criar carta → salvar;
2. subir uma arte (deve padronizar em 1024×1024 WebP e a cota ir para 1/5);
3. **Baixar PNG** (840×1224);
4. copiar o link `/c/{slug}` e abrir no WhatsApp/Discord — a prévia deve mostrar a arte;
5. testar no celular (390 px) e conferir “Minhas cartas”.

## 5. Evitar o cold start (API hibernando)

No plano free o Render **hiberna a instância após ~15 min sem tráfego**. A próxima requisição
espera o container subir: neste projeto (imagem Python + FastAPI) são ~30–50 s. Há duas frentes:
não deixar dormir e tornar o sono indolor para quem usa o site.

### 5.1 Opções

| Opção | Custo | Efeito | Quando usar |
| --- | --- | --- | --- |
| **Plano Starter** (`plan: starter` no `render.yaml`) | US$ 7/mês | nunca hiberna, zero cold start | apresentação e uso real |
| **Keep-alive externo** (cron-job.org, UptimeRobot, BetterStack ou GitHub Actions) | grátis | 1 ping a cada 10 min mantém acordado; consome horas das 750 h/mês do free | janela de demo |
| **Aceitar o sono + front resiliente** (já no código) | grátis | a 1ª visita espera com aviso "Acordando a API" | portfólio de baixo tráfego |
| **Trocar de host** (Cloud Run, Fly.io, VPS) | grátis–baixo | cold start de 1–3 s ou nenhum | quando o projeto crescer |

### 5.2 Keep-alive (gratuito)

Use **`/health/live`**, não `/health`: `/health/live` responde 200 sem consultar o Supabase, então
um ping a cada 10 min não gasta conexões do banco nem marca a instância como doente.

- **cron-job.org / UptimeRobot (mais confiável):** monitor HTTP GET em
  `https://SEU-SERVICO.onrender.com/health/live`, a cada 10 min, timeout de 60 s. O Render
  hiberna com 15 min, então 10 min absorve o atraso do agendador.
- **GitHub Actions:** o workflow [`.github/workflows/keepalive.yml`](../.github/workflows/keepalive.yml)
  já faz isso a cada 10 min (06h–24h de Brasília). Configure a variável de repositório
  `API_BASE_URL` (Settings → Secrets and variables → Actions → Variables) e rode uma vez com
  *Run workflow*. Limites: o cron do GitHub pode atrasar alguns minutos, só roda no branch
  padrão (`main`) e, em repositório **privado**, consome minutos do plano free.
- **Do seu PC (Agendador de Tarefas do Windows):** a cada 10 min,
  `node scripts/keepalive.mjs https://SEU-SERVICO.onrender.com`.

Orçamento do free: **750 h de instância por mês**. Acordado 24/7 são 720–744 h/mês — cabe, mas
sem margem para deploys extras ou um segundo serviço. A janela padrão do workflow (18 h/dia)
gasta ~540 h/mês; para 24/7 troque o `cron` do workflow por `'*/10 * * * *'`.

Se a API hibernar mesmo com keep-alive, confira: URL correta, workflow/monitor ativo, resposta 200
e se o serviço não está recebendo deploy (todo deploy reinicia a instância).

### 5.3 Sono indolor (já implementado)

- **`GET /health/live`** — liveness barato (uptime em segundos, sem I/O). `/health` continua sendo
  a readiness que checa o Supabase. O `render.yaml` usa `/health/live` como health check: se o
  banco oscilar, o Render não reinicia a API por causa disso.
- **Front (`web/src/lib`)** — ao abrir o app, `api.warmup()` pinga `/health/live`; se demorar
  mais de 1,5 s aparece o aviso "Acordando a API (plano free do Render)". As requisições usam
  timeout de 75 s (cobre o cold start) e GET ganha uma 2ª tentativa em 502/503/504. Erro de
  rede/timeout **não desloga** o usuário — só 401 faz isso, então o token sobrevive ao sono da API.
- **Proxy (`workers/proxy.js` e `_redirects`)** — o Worker repete GET em 502/503/504 após 2 s e,
  se ainda falhar, `/api/*` responde `503` com `{"code":"api_waking"}` e uma mensagem legível em
  vez de um 502 vazio.

## 6. Operação

- **Logs**: Render → Logs (JSON, `request_completed` com `status` e `duration_ms`). Filtre por
  `"level": "ERROR"`.
- **Métricas**: `https://SEU-SERVICO.onrender.com/metrics` (Prometheus). Grafana Cloud free ou
  VictoriaMetrics free fazem o scrape.
- **Uptime**: BetterStack/cron-job batendo em `/health/live` a cada 5–10 min — é o mesmo monitor
  que segura o cold start (seção [5](#5-evitar-o-cold-start-api-hibernando)).
- **Rollback**: Render → Deploys → *Rollback* para o deploy anterior. As migrations são aditivas,
  então voltar a API não exige voltar o banco.
- **Rotação de segredo**: trocar `SECRET_KEY` invalida os JWT emitidos (todo mundo reloga).

## 7. Alternativa: tudo em Docker numa VPS

```bash
git clone https://github.com/mateusjairan/YGO_card_maker && cd YGO_card_maker
cp .env.example .env   # STORAGE_BACKEND=supabase + chaves
docker compose up -d --build
```

O `docker-compose.yml` sobe a API (com healthcheck) e o nginx servindo o SPA + proxy na porta 8080.
Ponha Caddy/Traefik na frente para TLS. Sem cold start.

## Troubleshooting

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| 502 no Pages | API dormiu / URL errada em `_redirects` | abrir `/health/live`; conferir a URL; ver seção 5 |
| `CORS` bloqueando | `CORS_ORIGINS` sem a URL do Pages | ajustar no Render e redeployar |
| Imagem some | bucket privado | deixar `card-images` público (leitura) |
| OG sem imagem | `og:image` relativo | conferir `PUBLIC_BASE_URL` (precisa ser a URL pública da API) |
| 500 no `/health` | chave do Supabase errada | conferir `SUPABASE_URL`/`SERVICE_ROLE` |
| `database: false` | migrations não aplicadas | rodar `supabase db push` |
| `403 permission denied for table` | projeto sem GRANT para a `service_role` | rodar `supabase/migrations/20261115000200_grants.sql` (ou `supabase/setup.sql`) |
| `401 Secret API key required` | usou a chave publishable no backend | usar a secret (`sb_secret_…`) em `SUPABASE_SERVICE_ROLE_KEY` |
| `/health` com `"env":"development"` ou `/c/{slug}` com links `localhost` | `APP_ENV`/`PUBLIC_BASE_URL`/`FRONTEND_BASE_URL`/`CORS_ORIGINS` não preenchidas no Render | preencher (seção 2) e redeployar; o log mostra `configuracao_de_producao` |
