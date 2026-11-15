# Contribuidores

Trabalho **individual**.

## Mateus Jairan

- **Domínio e API**: modelos, regras de validação (Pydantic), serviço de cartas, posse por chave
  anônima, geração de slug e página pública SSR com Open Graph.
- **Persistência**: repositório SQLite e adaptador Supabase/PostgREST; migrations do Supabase
  (tabela, índices, RLS, função de contagem de views, bucket de imagens).
- **Frontend**: editor com prévia em tempo real, molduras por atributo, upload com preview,
  exportação em PNG 2×, galeria, "minhas cartas" e compartilhamento.
- **Infra**: Dockerfile da API e do front (nginx), `docker-compose.yml`, Cloudflare Pages
  (`_redirects`) e workflow de CI (lint, testes, cobertura, build e imagens).
- **Qualidade**: suíte pytest (73 testes, 92,5%), smoke test em `scripts/smoke.mjs`, k6 e
  documentação (README, ADR, desempenho).

Histórico de commits e PRs no repositório é a evidência de autoria.
