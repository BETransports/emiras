# Plano de validação

## Comandos

```bash
pnpm run typecheck
PORT=19792 BASE_PATH=/ pnpm --filter @workspace/emiras-stock run build
pnpm --filter @workspace/api-server run typecheck
curl -i http://localhost:80/api/healthz
```

## Fluxos críticos do MVP

- visitante vê a página pública e consegue abrir login/cadastro;
- utilizador autenticado chega ao dashboard;
- criar e editar categoria;
- criar e pesquisar produto;
- registar entrada e saída de stock;
- bloquear saída superior ao stock disponível;
- criar cliente;
- criar venda com mais de um produto;
- confirmar que venda, itens, baixa de stock e movimentos são atómicos;
- confirmar que uma request sem sessão recebe 401;
- confirmar que os dados carregam novamente após refresh.

## Fora do primeiro corte

Testes E2E completos, devoluções, exportações, scanner de câmera e permissões de funcionário
serão adicionados junto dos respectivos módulos.