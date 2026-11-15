# Uso de IA — declaração

Declaração exigida pelo curso (Módulo 4). O objetivo não é listar cada mensagem, mas registrar
o que a IA fez, o que foi decidido pelo autor e como o resultado foi verificado.

## O que a IA fez

- **Andaime do projeto**: estrutura de pastas, `Dockerfile`, `docker-compose.yml`, workflow de CI.
- **Primeira versão do CSS da carta** a partir do layout original que o autor já tinha
  (`yu-gi-oh-card-crush`): moldura metálica, estrelas, caixa de texto e efeito holográfico.
- **Rascunho dos testes** de domínio e de integração, revisados e ajustados pelo autor.
- **Revisão de texto** do README e deste documento.
- **Login por e-mail** (auth própria) e a **cota de 5 uploads**: rotas, `AuthService`, hashing
  com scrypt, JWT e testes.
- **Tema visual "duel field"** inspirado no Master Duel: paleta, painéis chanfrados, pips de cota.
- **Padronização da arte**: recorte central 1:1 + downscale sem upscale + WebP.
- **Sistema de raridades** (Comum → Starlight): motor de foil pointer-driven (`--px`, `--py`,
  `--o`, inclinação 3D) com padrão e movimento próprios por raridade — rainbow diagonal do
  Secret, escovado da Rara, relevo da Ultimate, estrelas da Starlight.
- **Fluidez do editor**: `useDeferredValue` na prévia, `memo` na carta, exportação sob demanda e
  animações holográficas apenas no hover.

## O que foi decidido pelo autor

- Nível **Projeto B** e o escopo (3 tipos de carta, upload, PNG, link público).
- **FastAPI** em vez de Node, e o **Repository Pattern** com SQLite/Supabase — alternativa e
  consequências registradas no [ADR 0001](adr/0001-arquitetura-em-camadas.md).
- **Auth própria por e-mail** (scrypt + JWT) em vez de Supabase Auth, para o fluxo rodar e ser
  testado sem depender de SMTP/credenciais —[ADR 0002](adr/0002-autenticacao.md).
- **Cota vitalícia de 5 uploads** por conta (apagar carta não devolve upload).
- Página pública renderizada no servidor (Jinja) para ter Open Graph de verdade.
- Troca do `prometheus-fastapi-instrumentator` (quebrou com o FastAPI 0.163) por middleware
  próprio usando `prometheus_client`.
- Correções de layout encontradas em execução: nome longo estourando a barra, `h1` do hero
  aplicando 38 px ao nome da carta, grid estourando no mobile.
- **Raridade como dado** (`rarity` no modelo/banco), não como classe de CSS no front: o mesmo
  acabamento sai na prévia e na página pública renderizada no servidor.
- O primeiro foil de Secret Rare cobria demais a arte (o rosto ficava arco-íris); as opacidades
  foram calibradas e o nome ganhou contraste com gradiente mais escuro + `drop-shadow`.

## Como foi verificado

Nada foi aceito sem execução:

| Verificação | Resultado |
| --- | --- |
| `pytest` | 93 testes, 92,7% de cobertura (mínimo declarado: 80%) |
| `ruff check` / `ruff format --check` | limpo |
| `pnpm lint` / `pnpm build` / `tsc --noEmit` | limpo |
| `node scripts/smoke.mjs` | 16/16 verificações (cadastro, login, cota, cartas, upload, 401/403, OG) |
| `k6 run load/k6-smoke.js` | p95 = 65,2 ms, 0% de falhas (ver [desempenho](desempenho.md)) |
| Inspeção visual | screenshots em `docs/img/` (desktop e mobile) |

## O que não foi aceito sem revisão

- Validações de domínio: a IA sugeriu permitir DEF em monstros de Link; foi corrigido para
  rejeitar, e há teste cobrindo (`test_link_nao_aceita_def`).
- O primeiro rascunho do middleware de métricas usava `request.scope["route"]` sem proteção;
  foi adicionado fallback para `unmatched` para não quebrar em 404.
- O CSS inicial tinha `border-image` que não funcionava no export PNG; foi trocado por moldura
  em `padding` + gradient.
- A padronização de imagem começou com upscale para 1024; foi corrigida para **nunca** aumentar
  uma arte menor (só recortar e reduzir), com teste cobrindo (`test_imagem_pequena_nao_sofre_upscale`).
