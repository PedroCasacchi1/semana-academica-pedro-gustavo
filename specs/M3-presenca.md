# Spec - M3 Presenca por QR

## 1. Objetivo

Permitir que participantes registrem presenca em encontros por QR online ou offline, que a organizacao registre presencas manuais dentro das regras definidas e que a organizacao consulte as presencas de um encontro, mantendo registro unico, origem e instantes auditaveis.

## 2. Fora de escopo

- Apagar, corrigir ou alterar uma presenca ja registrada.
- Registrar saida (check-out).
- Gerar certificado ou calcular percentual de presenca; isso pertence ao M4.
- Criar ou alterar inscricoes; isso pertence ao M2.
- Criar ou alterar encontros e atividades; isso pertence ao M1.
- Exportar presencas em planilha; isso pertence ao M5.
- Login e senha.
- Mais de um evento.

## 3. Modelo

### CodigoDoEncontro

- `encontroId`: string, identificador do encontro.
- `codigo`: string de 6 caracteres, gerado para o encontro e para o minuto corrente.
- `trocaEm`: data-hora ISO 8601, inicio do minuto seguinte em que a tela deve buscar o proximo codigo.
- `validoAte`: data-hora ISO 8601, primeiro instante em que o codigo deixa de ser aceito.

### Presenca

- `id`: string, gerado pela API com o formato de identificador definido pelo contrato.
- `encontroId`: string, identificador do encontro.
- `participanteId`: string, derivado do participante autenticado no registro por QR ou informado pela organizacao no registro manual.
- `origem`: string, derivado da rota e da presenca do campo `lidoEm`: `qr`, `qr_offline` ou `manual`.
- `lidoEm`: data-hora ISO 8601, instante que valeu para as regras; no QR offline pode vir do cliente e, se for posterior ao instante do envio, e substituido pelo instante do envio.
- `registradaEm`: data-hora ISO 8601, instante do registro usando o relogio controlado.
- `justificativa`: string ou nulo; informada na rota manual e retornada exatamente como enviada, ou nula para registros nao manuais.

## 4. Endpoints

- `GET /encontros/:id/codigo`: rota de organizacao; retorna `200 CodigoDoEncontro` dentro da janela de QR.
- `POST /encontros/:id/presencas`: rota de participante; recebe `{ "codigo": "...", "lidoEm": "..." }`, com `lidoEm` opcional; retorna `201 Presenca` na primeira presenca e `200 Presenca` em reenvio da mesma presenca.
- `POST /encontros/:id/presencas/manual`: rota de organizacao; recebe `{ "participanteId": "...", "justificativa": "..." }`; retorna `201 Presenca` na primeira presenca e `200 Presenca` em repeticao.
- `GET /encontros/:id/presencas`: rota de organizacao; retorna `200 [Presenca]`, ordenado por `registradaEm` crescente e depois por `id`.

## 5. Regras

- R1. A janela de QR para obter codigo e registrar presenca online vai de 15 minutos antes ate 30 minutos depois do inicio do encontro, com ambos os limites inclusivos. Fora dela, a API retorna `422 FORA_DA_JANELA`. Origem: P-01 e P-07. Fonte: RN-301 e RN-302.
- R2. A janela de presenca manual vai de 15 minutos antes do inicio ate 2 horas depois do fim do encontro, com os dois limites inclusivos; fora dela, a API retorna `422 FORA_DA_JANELA`. Origem: P-01. Fonte: RN-312.
- R3. O codigo QR muda a cada minuto em janelas alinhadas ao relogio, de `hh:mm:00` a `hh:mm:59`; `trocaEm` e o inicio do minuto seguinte e `validoAte` e o inicio do minuto depois desse. Origem: P-02. Fonte: RN-303.
- R4. Sao aceitos o codigo do minuto atual e o do minuto anterior durante a janela aplicavel. Codigo de outro encontro ou de qualquer minuto mais antigo que o anterior retorna `422 CODIGO_INVALIDO`; no instante de `validoAte`, o codigo deixa de ser aceito. Origem: P-02 e P-13. Fonte: RN-304.
- R5. O codigo QR usa 6 caracteres do alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`; na leitura, a API aceita minusculas e ignora espacos. O mesmo codigo e retornado em chamadas repetidas dentro do mesmo minuto. Origem: P-13. Fonte: RN-305 e RN-303.
- R6. A presenca e unica por participante e encontro, independentemente de ser registrada por QR, QR offline ou manual. O primeiro registro retorna `201`; qualquer reenvio, inclusive uma tentativa manual para quem ja tem presenca QR ou uma tentativa QR para quem ja tem presenca manual, retorna `200` com a mesma presenca, sem alterar `origem`, `lidoEm`, `registradaEm` ou demais campos. Origem: P-04 e P-16. Fonte: RN-307.
- R7. No registro por QR, depois das verificacoes gerais do contrato, a ordem das regras do recurso e: encontro inexistente, presenca ja existente, participante nao inscrito, sincronizacao tardia, fora da janela e codigo invalido. Origem: P-08. Fonte: RN-314.
- R8. No registro manual, depois das verificacoes gerais do contrato, a ordem das regras do recurso e: justificativa, presenca ja existente, participante nao inscrito, fora da janela e limite de manuais. Origem: P-08 e P-16. Fonte: RN-314.
- R9. Somente inscricao com status `confirmada` permite registrar presenca. Inscricoes `em_espera`, `convocada`, `cancelada` ou `expirada` retornam `403 NAO_INSCRITO`. Origem: P-06. Fonte: RN-306.
- R10. Quando o registro por QR contem `lidoEm`, a janela e a validade do codigo sao verificadas no instante de `lidoEm`, nao no instante do envio. Se `lidoEm` estiver fora da janela, retorna `422 FORA_DA_JANELA`. Origem: P-03. Fonte: RN-308.
- R11. Um registro por QR com `lidoEm` e aceito ate 2 horas depois do fim do encontro. Depois desse prazo, retorna `422 SINCRONIZACAO_TARDIA`; nao existe limite de atraso entre a leitura e o envio enquanto esse prazo absoluto nao for excedido. Origem: P-03. Fonte: RN-310.
- R12. Se `lidoEm` for posterior ao instante do envio, ele e descartado e o instante do envio passa a valer para as regras. A origem continua `qr_offline` porque o campo foi enviado. Origem: P-03 e P-12. Fonte: RN-309 e RN-315.
- R13. Sem `lidoEm`, a origem da presenca e `qr`; com `lidoEm`, a origem e `qr_offline`; na rota manual, a origem e `manual`. Origem: P-12. Fonte: RN-315.
- R14. Toda regra temporal usa o relogio controlado. `registradaEm` e o instante da sincronizacao ou registro segundo esse relogio, e `lidoEm` e o instante efetivo que valeu para as regras. Origem: P-11. Fonte: `contrato-api.md`, secao 3 e modelo `Presenca`.
- R15. Presenca manual exige `justificativa` com pelo menos 10 caracteres uteis, considerando o texto sem espacos nas extremidades. Campo ausente, vazio, somente com espacos ou com menos de 10 caracteres uteis retorna `422 JUSTIFICATIVA_OBRIGATORIA`; nao ha tamanho maximo definido. Origem: P-10 e P-15. Fonte: RN-311.
- R16. A justificativa manual e validada sem os espacos das extremidades, mas e armazenada e retornada exatamente como enviada, preservando maiusculas, minusculas e quebras de linha. Origem: P-10 e P-15. Fonte: RN-311; decisao do usuario registrada em P-15.
- R17. A verificacao de presenca ja existente e comum a QR, QR offline e manual. Se o participante ja possui presenca no encontro, qualquer nova tentativa, de qualquer origem, retorna `200` com a presenca original, sem alterar dados nem consumir limite de manuais; na rota manual, essa verificacao ocorre depois da justificativa. Origem: P-04 e P-16. Fonte: RN-307 e RN-314.
- R18. O limite de presencas manuais e por encontro: no maximo 10% das inscricoes confirmadas daquele encontro, arredondando para cima. Depois de justificativa, duplicidade, inscricao e janela serem aprovadas, uma tentativa excedente retorna `422 LIMITE_DE_MANUAIS`. Origem: P-05. Fonte: RN-313 e RN-314.
- R19. `GET /encontros/:id/presencas` retorna as presencas em ordem crescente de `registradaEm`; em empate, ordena pelo `id` da presenca. Origem: P-14. Fonte: decisao do usuario; a ordenacao nao e definida pelo contrato.
- R20. Codigo, presenca e consulta respeitam identificacao, perfil, existencia e corpo conforme a ordem geral do contrato, com erro no formato `{"erro": "CODIGO", "mensagem": "texto livre"}`. Origem: P-01, P-07 e P-08. Fonte: `contrato-api.md`, secoes 1 e 6.
- R21. `GET /encontros/:id/codigo` para encontro de atividade cancelada retorna `422 ATIVIDADE_CANCELADA`, independentemente de o relogio estar dentro da janela. Origem: P-07. Fonte: RN-302.

## 6. Criterios de aceite

1. (R1, R3) Com o relogio 15 minutos antes do inicio, `GET /encontros/:id/codigo` retorna `200`; com o relogio 30 minutos depois do inicio ainda retorna `200`; um segundo depois retorna `422 FORA_DA_JANELA`.
2. (R2) Com uma justificativa valida, uma presenca manual exatamente 15 minutos antes do inicio e exatamente 2 horas depois do fim e aceita; depois disso retorna `422 FORA_DA_JANELA`.
3. (R3, R4, R5) Durante um minuto, chamadas repetidas retornam o mesmo codigo; no minuto seguinte o novo codigo e aceito e o anterior ainda e aceito; um codigo de dois minutos antes retorna `422 CODIGO_INVALIDO`.
4. (R4, R5) Um codigo valido de `enc_a` enviado para `enc_b` retorna `422 CODIGO_INVALIDO`; o mesmo codigo com letras minusculas e espacos ao redor e aceito.
5. (R6, R17) O primeiro registro de um participante retorna `201`; o mesmo participante reenviado retorna `200` com os mesmos campos, mesmo usando codigo invalido ou estando fora da janela, sem alterar a presenca.
6. (R7, R9) Uma tentativa QR de participante `em_espera`, `convocada`, `cancelada` ou `expirada` retorna `403 NAO_INSCRITO`, mesmo com codigo invalido.
7. (R10, R11) Uma leitura offline dentro da janela enviada depois do encontro, mas antes de 2 horas apos o fim, e aceita; a mesma leitura enviada depois desse prazo retorna `422 SINCRONIZACAO_TARDIA`.
8. (R10) Uma leitura offline com `lidoEm` fora da janela retorna `422 FORA_DA_JANELA`, ainda que o envio ocorra dentro da janela atual.
9. (R12, R13, R14) Um envio com `lidoEm` posterior ao instante do envio registra `origem: "qr_offline"`, usa o instante do envio para as regras e usa o relogio controlado em `registradaEm`.
10. (R15, R16) Presenca manual sem justificativa, com apenas espacos ou com 9 caracteres uteis retorna `422 JUSTIFICATIVA_OBRIGATORIA`; justificativa valida com espacos, quebras de linha e maiusculas e retornada exatamente como enviada.
11. (R8, R17) Uma presenca manual duplicada com justificativa valida retorna `200`, preserva a presenca original e nao consome limite; com justificativa ausente, retorna `422 JUSTIFICATIVA_OBRIGATORIA` antes de verificar a duplicidade.
12. (R18) Para um encontro com 11 inscricoes confirmadas, ate 2 presencas manuais sao aceitas; a terceira, depois de passar pelas demais validacoes, retorna `422 LIMITE_DE_MANUAIS`.
13. (R19) Com presencas registradas em instantes distintos, `GET /encontros/:id/presencas` retorna a lista por `registradaEm` crescente; com empate, retorna primeiro o menor `id`.
14. (R20) Rota M3 sem `X-Usuario`, com usuario inexistente ou com papel incorreto retorna respectivamente o codigo de identificacao ou perfil definido pelo contrato, sempre no formato de erro contratado.
15. (R21) Com o relogio dentro da janela, `GET /encontros/:id/codigo` para encontro de atividade cancelada retorna `422 ATIVIDADE_CANCELADA`.
16. (R6, R17) Depois de registrar presenca por QR, uma tentativa manual para o mesmo participante e encontro retorna `200` com a presenca QR original; depois de registrar manualmente, uma tentativa QR retorna `200` com a presenca manual original.

## 7. Como isto sera verificado

Os testes devem verificar a API pela costura HTTP exposta pelo servidor da aplicacao, preferencialmente usando `criarServidor()` se esta for a costura existente do projeto. Essa costura cobre rotas, papeis, status HTTP, corpo JSON, codigos de erro, unicidade e ordenacao observaveis de fora. As regras temporais devem usar `POST /_teste/reset`, `PUT /_teste/relogio` e `GET /_teste/relogio`; nunca devem usar a hora real do sistema.

## 8. Fatias de entrega

1. Codigo e registro QR online: R1, R3-R9, R13-R14, R20-R21, cobrindo obtencao do codigo, atividade cancelada, rotacao, normalizacao, inscricao confirmada, unicidade e ordem de validacao.
2. Registro QR offline: R10-R12, cobrindo `lidoEm`, janela no instante da leitura, sincronizacao tardia, relogio adiantado e origem `qr_offline`.
3. Registro manual: R2, R8, R15-R18, cobrindo justificativa, janela manual, duplicidade e limite de 10%.
4. Consulta e acabamento: R19, junto dos cenarios de contrato, ordenacao deterministica, campos da resposta e verificacoes de erro das fatias anteriores.
