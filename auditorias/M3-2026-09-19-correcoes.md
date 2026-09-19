# Auditoria M3 - 2026-09-19

## Entrada

- Spec: `specs/M3-presenca.md`.
- Entrevista: `entrevistas/M3-presenca.md`.
- Testes: `api/verificacoes/m3-presenca.spec.js`.
- Implementacao: `api/src/server.js`.
- Escopo: rastreabilidade da regra ate a entrevista, prova HTTP e comportamento observavel.

## Matriz de rastreabilidade

| Regra | Origem / fonte | Prova HTTP | Resultado |
|---|---|---|---|
| R1 | P-01/P-07; RN-301/RN-302 | Limites da janela e recusas antes/depois | COMPROVADA |
| R2 | P-01; RN-312 | Limites inclusivos e recusa tardia manual | COMPROVADA |
| R3 | P-02; RN-303 | Codigo estavel no minuto e rotacao | COMPROVADA |
| R4 | P-02/P-13; RN-304 | Minuto anterior, codigo antigo e outro encontro | COMPROVADA |
| R5 | P-13; RN-305/RN-303 | Alfabeto, tamanho, minusculas e espacos | COMPROVADA |
| R6 | P-04/P-16; RN-307 | QR, QR offline e manual, inclusive cruzados | COMPROVADA |
| R7 | P-08; RN-314 | Nao inscrito, tardia, janela e codigo invalido | COMPROVADA |
| R8 | P-08/P-16; RN-314 | Justificativa, duplicidade, janela e limite | COMPROVADA |
| R9 | P-06; RN-306 | Quatro status nao confirmados | COMPROVADA |
| R10 | P-03; RN-308 | Janela conferida pelo `lidoEm` | COMPROVADA |
| R11 | P-03; RN-310 | Antes, exatamente em e depois de `fim + 2h` | COMPROVADA |
| R12 | P-03/P-12; RN-309/RN-315 | `lidoEm` futuro descartado e origem preservada | COMPROVADA |
| R13 | P-12; RN-315 | Origens `qr`, `qr_offline` e `manual` | COMPROVADA |
| R14 | P-11; contrato | Instantes pelo relogio controlado | COMPROVADA |
| R15 | P-10/P-15; RN-311 | 9, 10 e espacos | COMPROVADA |
| R16 | P-10/P-15; RN-311 | Justificativa retornada sem normalizacao | COMPROVADA |
| R17 | P-04/P-16; RN-307/RN-314 | Duplicidade online, offline, manual e cruzada | COMPROVADA |
| R18 | P-05; RN-313/RN-314 | 5, 20, 21 e limites por encontro | COMPROVADA |
| R19 | P-14; decisao do usuario | Ordenacao e desempate por `id` | COMPROVADA |
| R20 | P-01/P-07/P-08; contrato | Identificacao, perfis e corpos invalidos | COMPROVADA |
| R21 | P-07; RN-302 | Atividade cancelada dentro da janela | COMPROVADA |

## Achados corrigidos

- R20: corpo invalido no QR e `participanteId` ausente na rota manual agora sao validados antes das regras de recurso aplicaveis; foram adicionados testes para corpo invalido antes de janela e inscricao.
- R4: adicionado teste de codigo de um encontro usado em outro.
- R6/R17: adicionado teste de reenvio `qr_offline` e preservacao da presenca original.
- R7: adicionados testes de precedencia para nao inscrito, sincronizacao tardia, janela e codigo invalido.
- R8: adicionados testes de precedencia entre justificativa, duplicidade, janela e limite.
- R9: adicionados testes para `em_espera`, `convocada`, `cancelada` e `expirada`.
- R18: adicionado teste de limite independente por encontro.
- R20: adicionado teste de usuario inexistente; os testes de perfis incorretos ja estavam presentes.

## Achados improcedentes

- Nenhum. Todos os achados do parecer original representavam lacuna de prova ou comportamento corrigivel.

## Suite

- `cd api && npm test`: `Test Files 2 passed (2); Tests 76 passed (76)`.
- A suite do `app` nao foi executada porque `vitest` nao esta instalado nesse pacote.

## Veredito

APROVADO para o escopo auditado. As 21 regras possuem origem rastreavel e prova HTTP; o comportamento de corpos invalidos, precedencia e vinculo de codigos esta coberto pela suite.
