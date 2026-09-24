# EMIRAS Stock + Vendas Inteligente

Aplicação comercial para gerir produtos, stock, vendas, clientes e atividade de pequenas e médias empresas em Angola.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/emiras-stock` — aplicação web React/Vite e experiência pública/authenticated.
- `artifacts/api-server` — API Express e middleware Clerk.
- `lib/api-spec/openapi.yaml` — contrato único da API.
- `lib/api-client-react` / `lib/api-zod` — clientes e validações gerados.
- `lib/db/src/schema/emiras.ts` — tabelas Drizzle do domínio.
- App Storage — imagens persistentes de produtos; apenas o caminho é guardado no PostgreSQL.
- `docs/` — arquitetura, API, permissões e plano de testes.

## Architecture decisions

- Clerk é a autenticação do produto; o browser usa cookies same-origin, sem bearer tokens.
- O tenant é determinado no backend a partir do utilizador Clerk e todas as queries operacionais filtram por empresa.
- A criação de venda atualiza itens, stock e movimentos numa transação PostgreSQL.
- A moeda padrão é AOA e preços monetários são persistidos como `numeric(12,2)`.

## Product

O MVP permite acompanhar KPIs reais, gerir produtos/categorias, movimentar stock, criar clientes,
registar vendas e consultar atividade recente. Devoluções, exportações, scanner e permissões
granulares estão planeados para fases seguintes.

## User preferences

O produto deve priorizar usabilidade mobile, mensagens claras e nenhuma funcionalidade falsa.

## Gotchas

- Alterar `lib/api-spec/openapi.yaml` exige executar codegen antes de usar os hooks.
- Para validar o build web fora do workflow, fornecer `PORT` e `BASE_PATH`.
- O health check é público; as restantes rotas da API exigem sessão Clerk.
- O perfil do utilizador é editado pelo `UserProfile` do Clerk em `/profile`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
