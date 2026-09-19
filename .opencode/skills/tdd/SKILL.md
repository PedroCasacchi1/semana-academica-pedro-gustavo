---
name: tdd
description: Implementa uma spec em fatias verticais, teste primeiro — vermelho, verde, próxima fatia. Use quando existir uma spec para implementar, ou quando pedirem "TDD", "teste primeiro", "red-green".
---

# Teste primeiro, uma fatia por vez

O ciclo é: **um teste que falha → o código mínimo que faz ele passar → a próxima fatia.**
Nada de escrever a suíte inteira e depois o código inteiro.

Você precisa de uma spec com regras numeradas. Sem ela, pare: você vai acabar testando o
que você mesmo inventou. Sem contrato, verde não significa nada.

## Onde o teste mora

Teste verifica **comportamento pela interface pública**, nunca implementação. Aqui a
interface é HTTP: suba o servidor com `criarServidor()` e fale por `fetch`. Não importe
serviço nem repositório no teste — se importar, o teste quebra quando você refatorar
sem que o comportamento tenha mudado.

Padrão deste projeto: Vitest, executado com `npm test`. Os testes ficam em
`verificacoes/` e usam arquivos `*.spec.js`.

Use `describe`, `it` e `expect` do Vitest. Teste o comportamento pela API HTTP usando
`fetch`, sem importar diretamente serviços ou repositórios e sem acoplar o teste à
implementação interna.

## O ciclo, por fatia

Para cada fatia da spec, nesta ordem:

1. Escreva **um** teste que prova **um** critério de aceite. O nome do teste é a regra
   em português: `it('recusa o quarto empréstimo ativo do mesmo leitor')`.
2. Rode com `npm test`. **Ele tem que falhar.** Teste que passa antes do código existir
   não está testando nada — descubra por quê antes de seguir.
3. Escreva o mínimo de código que faz ele passar. Nada de já implementar a regra
   seguinte "que eu vou precisar mesmo".
4. Rode a suíte inteira. Verde? Próxima fatia.

Só passe para a fatia seguinte com a suíte inteira verde.

## A regra que não se quebra

**Quando o teste falha, o suspeito é o código.**

Se você mudar um teste para ele passar, você trocou o contrato pela sua implementação e
o verde virou enfeite. Só se altera um teste quando a **spec** mudou — e aí você diz, em
voz alta, qual regra da spec mudou e por quê.

Vale para o valor esperado, para o status HTTP e para o cenário. Trocar
`assert.equal(dias, 14)` por `assert.equal(dias, 7)` porque o código deu 7 é a forma mais
comum de mentir sozinho.

## Três testes que não valem nada

- **Acoplado à implementação** — chama serviço ou repositório direto, ou confere o dado
  espiando o `Map` em vez de pedir pela API. Quebra em refatoração, não em regressão.
- **Tautológico** — o esperado é calculado do mesmo jeito que o código calcula
  (`assert.equal(multa, dias * 1.5)`). Passa por construção, nunca discorda do código.
  O valor esperado vem da spec, escrito na mão: `assert.equal(multa, 4.5)`.
- **Frouxo** — confere só o status e ignora o corpo. `201` com o prazo errado passa.

## Fechamento

Terminada a última fatia, rode `npm test` para executar a suíte inteira e relate o número
real de testes que apareceu na saída. Não estime, não arredonde, não repita um número de
outra rodada.