# Permissões e isolamento

## Isolamento

O utilizador autenticado é resolvido pelo Clerk. A tabela `users` associa o `clerk_user_id` a
uma empresa. O middleware define o `companyId` na request e os handlers aplicam esse valor em
leituras e escritas.

Nenhum endpoint aceita `companyId` vindo do cliente.

## Papéis

- **ADMIN:** núcleo do MVP; pode gerir catálogo, stock, clientes e vendas.
- **FUNCIONÁRIO:** estrutura reservada para permissões granulares posteriores; não é criado
  automaticamente pelo MVP atual.

## Proteções

- API protegida por `getAuth` do Clerk.
- Passwords e sessões não são armazenadas pela aplicação.
- Cookies e cabeçalhos sensíveis são removidos dos logs estruturados.
- A validação do corpo, query string e parâmetros usa os schemas gerados.