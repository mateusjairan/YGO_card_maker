# ADR 0002 — Login próprio por e-mail (JWT + scrypt) em vez de Supabase Auth

- **Status:** aceito
- **Data:** 2026-11-15
- **Contexto:** requisito de "login por e-mail" e cota de 5 uploads por duelista

## Contexto

O requisito novo é: **cada pessoa entra com e-mail** e **cada conta pode subir no máximo 5
artes**. A identidade deixa de ser uma chave anônima do navegador e passa a ser uma conta.

O projeto já usa Supabase como banco e storage em produção. O caminho "óbvio" seria usar o
Supabase Auth (GoTrue) e guardar o contador na tabela `users`. Isso traz e-mail verificado,
recuperação de senha e OAuth de graça — mas exige o projeto Supabase configurado (URL, anon key,
SMTP) **antes de qualquer teste**, e o fluxo de magic link depende de e-mail chegando.

Na data da entrega não havia credenciais do Supabase disponíveis para rodar o fluxo de ponta a
ponta, e a apresentação depende de `docker compose up` funcionar sem depender de terceiros.

## Decisão

Implementar autenticação **própria**, no mesmo serviço, com:

- **Senha** com `hashlib.scrypt` (stdlib: sem dependência extra, parâmetros N=2^14, r=8, p=1) e
  salt aleatório por usuário; comparação em tempo constante (`hmac.compare_digest`).
- **Sessão** com JWT HS256 (`PyJWT`), `sub = user_id`, expiração de 7 dias, assinado com
  `SECRET_KEY` vinda do ambiente.
- **Persistência** na tabela `users` (`id`, `email` único, `password_hash`, `uploads_used`),
  no repositório — funciona igual em SQLite e Supabase.
- **Cota** de 5 artes por conta: `uploads_used` é **recalculado** a partir das cartas salvas com
  arte (`sync_uploads`), então upload sem salvar não consome e remover a arte devolve; a API
  responde `403 quota_exceeded` ao exceder.
- Rotas: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`. O front guarda o
  token e envia `Authorization: Bearer`.

## Alternativas consideradas e descartadas

| Alternativa | Por que foi descartada |
| --- | --- |
| **Supabase Auth (GoTrue) + policy no banco** | É a escolha "certa" a longo prazo, mas exige projeto/keys e SMTP configurados para testar; o magic link depende de e-mail, o que quebra a demo offline e os testes automatizados. Ficaria também um segundo modelo de identidade (auth.users) para sincronizar com a tabela de cartas. |
| **Login por magic link próprio (token de uso único por e-mail)** | Sem servidor de e-mail, o link não chega — e um "link impresso no console" não é apresentável. |
| **OAuth Google como único método** | Exigiria app no Google Cloud e cliente OAuth; mais atrito para avaliar o projeto, e o requisito era e-mail. |
| **Basic Auth** | Sem sessão, o navegador reenvia credenciais em cada request e não há como "sair"; ruim para SPA. |

## Consequências

**Positivas**

- Fluxo completo testável sem rede, sem conta em terceiros e sem custo.
- O contador de uploads é uma transação no banco (`increment_user_uploads`), não um contador em
  memória — sobrevive a restart e a múltiplas instâncias.
- `scrypt` + JWT são padrões conhecidos e auditáveis; nenhum segredo vai para o front.

**Negativas**

- **Sem verificação de e-mail**: um e-mail digitado errado cria uma conta inacessível (mitigado
  pela senha escolhida na hora; não há "esqueci a senha").
- **Sem rate limiting** no login: brute force fica limitado apenas pela força da senha. Com mais
  tempo, entra um limitador por IP/e-mail (Redis) ou o Supabase Auth assume o papel.
- Comparado ao Supabase Auth, falta OAuth, 2FA e recuperação de senha.

## Migração futura

Como a API já isola a identidade em `AuthService` e a coluna `cards.user_id`, trocar para Supabase
Auth é: criar o usuário espelho no `users` no primeiro login (webhook), validar o JWT do GoTrue
(HS256 com `SUPABASE_JWT_SECRET`) e remover as rotas de senha. Nenhuma rota de cartas muda.

## Referências

- `src/app/core/security.py`, `src/app/services/auth.py`, `src/app/api/routes/auth.py`
- [OWASP — Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
