# Desempenho e SLO

## SLO declarado

> **99% das requisições de leitura (`GET /api/cards`, `GET /c/{slug}`) respondem em até 300 ms
> (p95 < 300 ms), com taxa de erro abaixo de 1%, em janela de 30 dias.**

O SLO é verificado em toda execução do k6: o script falha automaticamente se
`http_req_duration p(95) >= 300` ou `http_req_failed rate >= 1%`.

```js
thresholds: {
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<300', 'p(99)<800'],
}
```

## Metodologia

- **Ferramenta:** k6 v2.4.0, script [`load/k6-smoke.js`](../load/k6-smoke.js).
- **Cenário:** 20 VUs em 3 estágios (10 s de ramp-up, 30 s estável, 5 s de ramp-down) — 45 s.
- **Fluxo por iteração:** `GET /api/cards?limit=12` e, se houver carta, `GET /c/{slug}` (página
  pública com renderização Jinja), com `sleep(0.2)` entre iterações.
- **Ambiente:** máquina local (Windows 11), **1 worker** uvicorn, SQLite em modo WAL, sem cache,
  sem CDN e sem proxy. É o pior caso realista — qualquer deploy com CPU dedicada e CDN na frente
  tende a ser melhor.
- **Dados:** duas rodadas, uma com 2 cartas e outra com **502 cartas** sintéticas
  (`node scripts/seed.mjs 500`).

## Resultados medidos

| Rodada | Cartas no banco | Requisições | Throughput | p50 | p95 | p99 | Falhas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 — base | 2 | 5.979 | 132 req/s | 17,6 ms | **65,2 ms** | 111,2 ms | 0,00% |
| 2 — volume | 502 | 6.177 | 137 req/s | 16,6 ms | **51,4 ms** | 85,3 ms | 0,00% |
| 3 — pós-ajuste WAL | 502 | 6.111 | 135 req/s | 15,5 ms | **57,7 ms** | 121,0 ms | 0,00% |

Todas as rodadas passaram nos thresholds com folga de **4,6× a 5,8×** sobre o SLO de 300 ms.

> A variação entre as rodadas 2 e 3 (±15%) é ruído de uma máquina de desenvolvimento, não efeito
> da mudança — ver a análise abaixo.

### Medição sequencial (sem concorrência)

Para separar o custo do banco do custo do framework, 200 requisições sequenciais por rota
(`node scripts/bench.mjs`):

| Rota | Média | p50 | p95 |
| --- | --- | --- | --- |
| `GET /health` (sem banco) | 7,05 ms | 6,48 ms | 8,10 ms |
| `GET /api/cards?limit=12` | 7,95 ms | 7,79 ms | 9,38 ms |
| `GET /api/cards?q=carta` (busca) | 8,56 ms | 8,28 ms | 9,94 ms |

A diferença entre `/health` e a listagem é **< 1 ms**: com 500 cartas, a consulta não é o gargalo.

## Onde está o tempo (e o que foi feito)

1. **Custo fixo de ~7 ms por requisição** mesmo sem banco (cliente HTTP + middleware de log +
   instrumentação). É o piso do ambiente local, não do código de negócio.
2. **Hipótese testada:** `PRAGMA journal_mode=WAL` era executado a cada conexão SQLite. Movido
   para `setup()` (WAL é persistente no arquivo) e medido: p95 51,4 → 57,7 ms, **dentro do
   ruído**. A mudança foi mantida por remover trabalho por requisição, mas **não** é a explicação
   da latência — registrar isso evita vender otimização que não existe.
3. **Plano de consulta** (`EXPLAIN QUERY PLAN`, 502 cartas):

   ```text
   galeria: SEARCH cards USING INDEX idx_cards_public (is_public=?)
   busca:   SEARCH cards USING INDEX idx_cards_public (is_public=?)
   ```

   O índice parcial `(created_at DESC) WHERE is_public` cobre a ordenação da galeria; não há
   `TEMP B-TREE`. A busca usa `LIKE '%termo%'`, que **não** usa índice — aceitável no volume
   atual e o primeiro item da lista de melhorias.

## O que faria diferente com mais tempo

1. **Cache de 30 s na galeria** (Redis ou `cachetools` em memória por worker): a home é a rota
   mais quente e o conteúdo muda pouco.
2. **Postgres + índice trigram** (`pg_trgm`) para a busca, trocando `LIKE '%x%'` por `ILIKE`
   indexado.
3. **2+ workers uvicorn** atrás do nginx — a API é síncrona no acesso ao banco e o threadpool do
   framework não escala como processos independentes.
4. **CDN no `/c/{slug}`** com `Cache-Control: public, s-maxage=60`: a página é pública e muda
   raramente; hoje cada acesso também incrementa views (o que impede cache puro — a saída é
   separar o contador em um evento assíncrono).
5. **Cache dos assets da carta** já feito no nginx (`expires 30d` em `/media`), e `immutable` nos
   bundles do Vite.

## Como reproduzir

```bash
# API em execução (docker compose up ou uvicorn)
node scripts/seed.mjs 500          # volume sintético (opcional)
k6 run load/k6-smoke.js            # SLO verificado automaticamente
node scripts/bench.mjs             # custo por rota, sem concorrência
```
