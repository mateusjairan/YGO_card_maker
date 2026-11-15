# Uso de IA — declaração

Declaração exigida pelo curso (Módulo 4). O objetivo não é listar cada mensagem, mas registrar
o que a IA fez, o que foi decidido pelo autor e como o resultado foi verificado.

## O que a IA fez

- **Andaime do projeto**: estrutura de pastas, `Dockerfile`, `docker-compose.yml`, workflow de CI.
- **Primeira versão do CSS da carta** a partir do layout original que o autor já tinha
  (`yu-gi-oh-card-crush`): moldura metálica, estrelas, caixa de texto e efeito holográfico.
- **Rascunho dos testes** de domínio e de integração, revisados e ajustados pelo autor.
- **Revisão de texto** do README e deste documento.

## O que foi decidido pelo autor

- Nível **Projeto B** e o escopo (3 tipos de carta, upload, PNG, link público).
- **FastAPI** em vez de Node, e o **Repository Pattern** com SQLite/Supabase — alternativa e
  consequências registradas no [ADR 0001](adr/0001-arquitetura-em-camadas.md).
- Identidade anônima por chave no navegador em vez de login (velocidade de entrega × risco de
  perder a posse ao trocar de dispositivo).
- Página pública renderizada no servidor (Jinja) para ter Open Graph de verdade.
- Troca do `prometheus-fastapi-instrumentator` (quebrou com o FastAPI 0.163) por middleware
  próprio usando `prometheus_client`.
- Correções de layout encontradas em execução: nome longo estourando a barra, `h1` do hero
  aplicando 38 px ao nome da carta, grid estourando no mobile.

## Como foi verificado

Nada foi aceito sem execução:

| Verificação | Resultado |
| --- | --- |
| `pytest` | 73 testes, 92,5% de cobertura (mínimo declarado: 80%) |
| `ruff check` / `ruff format --check` | limpo |
| `pnpm lint` / `pnpm build` / `tsc --noEmit` | limpo |
| `node scripts/smoke.mjs` | 11/11 verificações do fluxo (criar, listar, editar, 403, excluir, OG) |
| `k6 run load/k6-smoke.js` | p95 = 65,2 ms, 0% de falhas (ver [desempenho](desempenho.md)) |
| Inspeção visual | screenshots em `docs/img/` (desktop e mobile) |

## O que não foi aceito sem revisão

- Validações de domínio: a IA sugeriu permitir DEF em monstros de Link; foi corrigido para
  rejeitar, e há teste cobrindo (`test_link_nao_aceita_def`).
- O primeiro rascunho do middleware de métricas usava `request.scope["route"]` sem proteção;
  foi adicionado fallback para `unmatched` para não quebrar em 404.
- O CSS inicial tinha `border-image` que não funcionava no export PNG; foi trocado por moldura
  em `padding` + gradient.
