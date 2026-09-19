# Correcoes da auditoria M2 - 2026-09-19

## Escopo

- Parecer de entrada: auditoria do modulo M2 contra `specs/M2-inscricoes.md`.
- Testes alterados: `api/verificacoes/m2-inscricoes.spec.js`.
- Implementacao avaliada: `api/src/server.js`.
- O parecer original nao foi alterado.

## Metodo

Cada achado foi tratado isoladamente por uma prova HTTP nova ou reforcada. Os
testes foram executados antes de qualquer alteracao na implementacao. Todos os
cenarios passaram com a implementacao existente; portanto, nao houve defeito de
producao a corrigir e nenhuma mudanca foi feita em `api/src/server.js`.

## Achados corrigidos

- R3: adicionada prova de duplicidade nos estados `em_espera` e `convocada`, e
  de reinscricao no fim da fila apos cancelamento.
- R4: adicionada prova de que `ATIVIDADE_JA_INICIADA` prevalece sobre
  `INSCRICAO_INATIVA`.
- R5: adicionada prova de que cancelar uma inscricao em espera nao convoca a
  seguinte; a cobertura de cancelamento da atividade ja existia em M1.
- R6: adicionada prova de que aumento de vagas no instante do fechamento nao
  convoca a fila.
- R9: adicionada prova da precedencia de `CONFLITO_DE_HORARIO` sobre
  `LIMITE_DE_MINICURSOS` quando ambos falham.
- R10: adicionada prova de intervalos que apenas encostam e de sobreposicao em
  `11:59:59`.
- R12: adicionada prova da ordem de recusas para atividade inexistente,
  cancelada e inscricoes encerradas.
- R14: adicionada prova para atividade cancelada, convocacao expirada e
  inscricao nunca convocada.
- R15: adicionada prova de ordenacao, filtro, isolamento de participante,
  detalhe alheio e bloqueio de operacao por organizacao.
- R16: adicionada prova de reconciliacao antes do registro de presenca pela
  rota M3, alem da cobertura existente entre M1, M2 e leitura M3.
- R17: adicionada prova do formato de `id`, `criadaEm` e nulidade condicional
  dos campos de fila e convocacao.

## Achado improcedente

- Cobertura de interface M2: improcedente como defeito deste modulo porque a
  spec `specs/M2-inscricoes.md` e o contrato auditado definem a API HTTP de M2,
  sem criterio de aceite para tela ou fluxo visual; nao foi criada regra de
  interface por suposicao.

## Verificacao

- `cd api && npm test`: 3 arquivos de teste, 99 testes passando.
- `cd app && npm test`: 1 arquivo de teste, 7 testes passando.

## Resultado

As lacunas de prova apontadas no parecer foram cobertas por testes HTTP. Como
nenhum teste falhou contra a implementacao existente, nao houve correcao de
codigo de producao.
