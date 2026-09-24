# EMIRAS Stock + Vendas — Arquitetura

## Objetivo

Aplicação web para pequenas e médias empresas em Angola acompanharem produtos, stock,
vendas, clientes e atividade operacional. A moeda padrão é AOA.

## Camadas

- **Web:** React + TypeScript + Vite, com Wouter, TanStack Query e hooks gerados a partir do OpenAPI.
- **API:** Express 5 em `artifacts/api-server`, com validação Zod gerada e logging estruturado.
- **Autenticação:** Clerk gerido pelo Replit. A sessão do browser é enviada por cookie; o servidor
  cria/associa o utilizador local à sua empresa na primeira operação autenticada.
- **Dados:** PostgreSQL com Drizzle em `lib/db`. Todas as entidades operacionais têm `company_id`.
- **Imagens:** App Storage para bytes de imagens; PostgreSQL guarda apenas o caminho em `products.image_url`.
- **Contrato:** `lib/api-spec/openapi.yaml` é a fonte única; `api-client-react` e `api-zod` são gerados.

## MVP implementado

Autenticação, isolamento por empresa, dashboard com dados do banco, categorias, produtos com
pesquisa/paginação, entradas e saídas de stock, clientes, criação de vendas transacionais,
histórico de vendas, atividade recente e estados de loading/erro/vazio.

## Próximas fases

Devoluções, relatórios/exportação, auditoria persistida, permissões granulares de funcionários,
scanner de código de barras e configurações completas da empresa.

## Regras de integridade

1. Stock nunca fica negativo.
2. Cada mudança de stock cria um movimento com stock anterior e posterior.
3. Uma venda recalcula os preços no backend e cria itens, baixa de stock e movimentos na mesma transação.
4. O `company_id` vem da sessão autenticada e nunca do payload do browser.
5. Códigos SKU são únicos dentro da empresa.
6. Imagens de produtos são enviadas diretamente para o App Storage através de URL pré-assinada.