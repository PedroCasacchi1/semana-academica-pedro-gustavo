---
name: nova-tela
description: Cria telas React que consomem somente as rotas e campos do contrato-api.md, com API mockada e testes de interface.
---

# Nova tela

Use esta skill para implementar uma tela ou fluxo novo em `app/`.

## Regras

- Leia `contrato-api.md` e a spec do modulo antes de editar codigo.
- Use somente rotas, metodos, cabecalhos, campos e codigos de erro contratados.
- Preserve o padrao visual e de composicao existente em `app/src/App.jsx`.
- A tela deve exibir os erros relevantes retornados pela API.
- Nao acesse banco, servico interno ou estado de teste diretamente.
- Substitua a API real por um mock nos testes da interface.

## Fluxo TDD

1. Extraia da spec um criterio de aceite observavel pela interface.
2. Adicione um teste com React Testing Library e API mockada.
3. Rode `npm test` e confirme que o teste falha antes da implementacao.
4. Implemente o menor fluxo que consuma o contrato e faca o teste passar.
5. Rode a suite inteira antes de iniciar o proximo criterio.

## Checklist de entrega

- [ ] Cada chamada usa uma rota existente no contrato.
- [ ] O metodo, corpo e cabecalho da chamada estao contratados.
- [ ] Estados de carregamento, vazio e erro estao visiveis.
- [ ] A resposta e transformada apenas com campos do contrato.
- [ ] Existe teste para o caminho feliz e para a acao principal.
- [ ] `npm test` terminou verde.
