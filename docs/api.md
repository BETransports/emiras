# Contrato da API

O contrato vive em `lib/api-spec/openapi.yaml`. Depois de qualquer alteração:

```bash
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck:libs
```

## Superfícies atuais

- `GET /api/healthz`
- `GET /api/dashboard/summary`
- `GET /api/activity`
- `GET|POST /api/categories`
- `PATCH /api/categories/:id`
- `GET|POST /api/products`
- `PATCH /api/products/:id`
- `GET|POST /api/stock/movements`
- `GET|POST /api/customers`
- `GET|POST /api/sales`
- `POST /api/storage/uploads/request-url`
- `GET /api/storage/objects/:path`

Todas as rotas, exceto health check, exigem sessão Clerk válida.

O upload de imagens usa um fluxo em duas etapas: a API cria uma URL pré-assinada,
o browser envia o ficheiro diretamente para o App Storage e o produto guarda apenas
o caminho servido pela API. Os ficheiros aceites pela interface são PNG, JPG e WebP
até 8 MB.

## Cliente

Importar hooks de `@workspace/api-client-react`. As respostas são os dados diretamente,
sem envelope adicional. Após mutações, invalidar as query keys afetadas.