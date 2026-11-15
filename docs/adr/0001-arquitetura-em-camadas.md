# ADR 0001 — Arquitetura em camadas com Repository Pattern (FastAPI + SQLite/Supabase)

- **Status:** aceito
- **Data:** 2026-11-15
- **Contexto do curso:** Projeto B — API de domínio único, fluxo de ponta a ponta

## Contexto

O projeto precisa de uma API que funcione na apresentação (sem depender de credenciais externas)
e que em produção use o Supabase como banco e storage. O frontend é React e o backend, FastAPI.
O tempo até a entrega é curto, então cada camada precisa pagar o próprio custo.

Duas forças se opõem: **simplicidade para entregar** e **demonstrar engenharia** — a rubrica
avalia design, testes e decisões registradas, não quantidade de código.

## Decisão

Organizar a API em quatro camadas explícitas, com a dependência sempre apontando para dentro:

1. `domain/` — modelos, enums e regras puras (`type_line`, `level_display`, `slugify`, validação
   de payload com Pydantic). Não importa FastAPI, banco ou disco.
2. `repositories/` — **Repository Pattern**: uma interface (`CardRepository`) e duas
   implementações (`SQLiteCardRepository`, `SupabaseCardRepository`). O resto do sistema só
   conhece a interface.
3. `storage/` — mesma ideia para imagens: `LocalImageStorage` e `SupabaseImageStorage` atrás de
   `ImageStorage`.
4. `services/` + `api/` — `CardService` concentra posse, limite por duelista, slug único e
   remoção de imagem; as rotas só traduzem HTTP (status, schema, dependência de chave).

`main.py` é o *composition root*: monta as implementações a partir de `STORAGE_BACKEND` e injeta
em `app.state`, sem service locator escondido nem singleton global.

### Escolha do backend diante do free tier

O frontend vai para o Cloudflare Pages (estático). O Cloudflare Workers não executa FastAPI
(Python/ASGI); por isso a API vai como **container Docker** em um host de containers com plano
free (Render), com o Pages fazendo proxy de `/api`, `/c` e `/media` na mesma origem. É o que
mantém o link de compartilhamento curto e dispensa CORS em produção.

## Alternativas consideradas e descartadas

| Alternativa | Por que foi descartada |
| --- | --- |
| **React falando direto com o Supabase** (supabase-js + RLS, sem backend) | O requisito é mostrar front **e** back. Além disso o link de compartilhamento precisa de HTML com Open Graph renderizado no servidor — o SPA não entrega isso para o crawler. Toda a autorização ficaria em policies SQL, difícil de testar com pytest. |
| **Next.js full-stack (Route Handlers)** | Reduziria o número de serviços, mas o autor queria praticar Python/FastAPI e o deploy do Supabase ficaria no mesmo processo do front; separar front estático (Pages) de API (container) também é mais barato no free tier. |
| **FastAPI + Prisma/Node** | Misturaria dois runtimes sem ganho: o Supabase já oferece PostgREST pronto, e o SQLite cobre o desenvolvimento. |
| **Acesso direto ao Postgres com SQLAlchemy/asyncpg** | Funciona, mas exigiria driver, pool e migrações próprias; o PostgREST do Supabase entrega o mesmo resultado com menos superfície. O custo é depender do SDK `supabase-py` — isolado no repositório, coberto pela interface. |
| **Banco em memória nos testes** | Testaria menos: o SQLite real exercita SQL, índices e constraints, e os testes de integração cobrem isso em milissegundos por caso. |

## Consequências

**Positivas**

- Trocar SQLite por Supabase não altera serviço nem rotas (só configuração).
- Os testes rodam sem Docker, sem rede e sem credenciais (92,5% de cobertura).
- Erros de domínio viram HTTP em um único ponto (`core/errors.py`), então as rotas não repetem
  `try/except`.
- Limites de negócio (ex.: link sem DEF, rank até 13) ficam no Pydantic e são testados sem HTTP.

**Negativas**

- Duas implementações de repositório para manter; o Supabase não tem testes automatizados (o CI
  não tem credenciais) — mitigado por manter o adaptador sem lógica e por smoke test manual.
- Uma camada a mais: para uma única tabela, `CardService` poderia ser considerado excesso. Foi
  mantido porque concentra posse, limite e slug — regras que não pertencem nem ao HTTP nem ao SQL.
- O front não fala direto com o Supabase, então cada leitura passa pela API: mais um hop, em
  troca de autorização testável e Open Graph no servidor.

## Referências

- [MADR](https://adr.github.io/madr/) — formato deste registro
- `src/app/repositories/base.py`, `src/app/services/cards.py`, `src/app/main.py`
