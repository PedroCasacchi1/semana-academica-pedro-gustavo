# Entrevista M3 - Presenca por QR

Status: Rodada 1 encerrada e confirmada.

## Escopo da sessao

- Modulo: M3 - Presenca por QR.
- Fontes fixas lidas: `contrato-api.md`, `entrevistas/M1-grade.md` e `specs/M1-grade.md`.
- Nao implementar codigo nesta sessao.
- Nao escrever spec nesta sessao.
- Quando a resposta for "consultar requisitos", registrar a pergunta como PENDENTE.
- Recomendacoes feitas pelo agente em conversa nao sao respostas do usuario e nao sao decisoes.
- A entrevista deve seguir uma pergunta por vez.
- Regras respondidas diretamente pelo `contrato-api.md` devem ser registradas com fonte, sem perguntar ao usuario.

## Fatos do contrato-api.md

- Rotas M3:
  - `GET /encontros/:id/codigo` para organizacao, sucesso `200 CodigoDoEncontro`.
  - `POST /encontros/:id/presencas` para participante, sucesso `201 Presenca` na primeira vez e `200 Presenca` depois.
  - `POST /encontros/:id/presencas/manual` para organizacao, sucesso `201 Presenca` na primeira vez e `200 Presenca` depois.
  - `GET /encontros/:id/presencas` para organizacao, sucesso `200 [Presenca]`.
- Identificacao: toda rota identificada exige `X-Usuario`; usuario ausente ou inexistente retorna `401 USUARIO_DESCONHECIDO`.
- Permissoes: as rotas de codigo e consulta sao da organizacao; o registro por QR e do participante; o registro manual e da organizacao. Fonte: `contrato-api.md`, linhas 12 e 154-159.
- Erro: toda resposta de erro tem formato `{"erro": "CODIGO", "mensagem": "texto livre"}`. Fonte: `contrato-api.md`, linha 15.
- Ordem geral de verificacoes: identificacao, perfil, existencia, corpo e regras do recurso. Fonte: `contrato-api.md`, linhas 16-17.
- `CodigoDoEncontro` responde `encontroId`, `codigo`, `trocaEm` e `validoAte`; o codigo tem 6 caracteres. Fonte: `contrato-api.md`, linhas 161-168.
- Registro por QR recebe `codigo` e `lidoEm` opcional. Fonte: `contrato-api.md`, linhas 170-172.
- Registro manual recebe `participanteId` e `justificativa`; justificativa ausente tambem e `JUSTIFICATIVA_OBRIGATORIA`. Fonte: `contrato-api.md`, linhas 173-174.
- `Presenca` responde `id`, `encontroId`, `participanteId`, `origem`, `lidoEm`, `registradaEm` e `justificativa`. Fonte: `contrato-api.md`, linhas 176-185.
- `origem` pode ser `qr`, `qr_offline` ou `manual`; `justificativa` e nula quando o registro nao e manual. Fonte: `contrato-api.md`, linhas 181-184.
- `lidoEm` e descrito como o instante que valeu para as regras; `registradaEm` e o instante do registro. Fonte: `contrato-api.md`, linhas 182-183.
- No modo de teste, `POST /_teste/reset` reinicia o relogio para `2026-10-13T09:00:00-03:00`; `PUT /_teste/relogio` altera o relogio e `GET /_teste/relogio` o consulta. Fonte: `contrato-api.md`, linhas 41-51.
- Toda regra que depende de tempo usa o relogio controlado no modo de teste, nunca a hora do sistema. Fonte: `contrato-api.md`, linha 51.
- Codigos aplicaveis a M3: `FORA_DA_JANELA` para obter codigo, registrar presenca e presenca manual; `CODIGO_INVALIDO` para registrar presenca; `NAO_INSCRITO` para registrar presenca e presenca manual; `SINCRONIZACAO_TARDIA` para registrar presenca com `lidoEm`; `JUSTIFICATIVA_OBRIGATORIA` e `LIMITE_DE_MANUAIS` para presenca manual; `ATIVIDADE_CANCELADA` para obter codigo. Fonte: `contrato-api.md`, linhas 274-288.
- O contrato nao define prazos, limites, tolerancias, arredondamentos, precedencia entre regras nem o comportamento quando o tempo passa sem acesso ao sistema. Fonte: `contrato-api.md`, linhas 292-294.

## Entrevista

### P-01 - Janela de presenca

- Pergunta: Em que intervalo uma presenca pode ser registrada para um encontro? Defina os limites para presenca por QR, QR offline (`lidoEm`) e presenca manual: quanto tempo antes do inicio, ate quando depois do fim e se os instantes exatos dos limites sao aceitos.
- Resposta: Para QR e QR offline, a janela vai de 15 minutos antes ate 30 minutos depois do inicio do encontro, com os dois instantes limite aceitos. A janela nao e contada a partir do fim do encontro. Para presenca manual, a janela vai de 15 minutos antes do inicio ate 2 horas depois do fim do encontro.
- Fonte: RN-301 e RN-312.
- Status: RESPONDIDA.

### P-02 - Rotacao do codigo QR

- Pergunta: Qual e a duracao de cada codigo QR? Quando `trocaEm` acontece em relacao a `validoAte`, e codigos anteriores continuam aceitos ate `validoAte` ou deixam de ser aceitos imediatamente quando um novo codigo e gerado?
- Resposta: O codigo muda a cada minuto, em janelas alinhadas ao relogio, de `hh:mm:00` a `hh:mm:59`. Sao aceitos o codigo do minuto atual e o do minuto anterior. `trocaEm` e o inicio do minuto seguinte, quando a tela passa a mostrar um codigo novo, e `validoAte` e o inicio do minuto depois desse; o codigo anterior continua aceito durante todo o minuto em que ja existe um novo. Codigo de outro encontro ou de qualquer minuto mais antigo que o anterior retorna `CODIGO_INVALIDO`.
- Fonte: RN-303 e RN-304.
- Status: RESPONDIDA.

### P-03 - Sincronizacao offline

- Pergunta: Para uma presenca enviada com `lidoEm`, qual e o atraso maximo permitido entre o instante da leitura e o envio? O que deve acontecer se `lidoEm` estiver no futuro, fora da janela do encontro ou se a presenca for sincronizada depois desse limite?
- Resposta: Nao existe limite de atraso entre leitura e envio. O envio com `lidoEm` e aceito ate 2 horas depois do fim do encontro; depois disso retorna `SINCRONIZACAO_TARDIA`. Quando existe `lidoEm`, a janela e a validade do codigo sao conferidas no instante da leitura, nao no envio. Se `lidoEm` for posterior ao envio, ele e descartado e vale o instante do envio. Se `lidoEm` ficar fora da janela do encontro, retorna `FORA_DA_JANELA`.
- Fonte: RN-308, RN-309 e RN-310.
- Status: RESPONDIDA.

### P-04 - Presenca duplicada

- Pergunta: O que caracteriza uma presenca ja registrada: uma presenca por participante em cada encontro? Quando a mesma pessoa enviar novamente uma presenca, a API deve retornar a presenca original sem alteracao, ou atualizar `origem`, `lidoEm` e `registradaEm`?
- Resposta: A presenca e unica por participante e encontro. O primeiro registro retorna `201`; qualquer reenvio retorna `200` com exatamente a mesma presenca, sem alterar `origem`, `lidoEm` ou `registradaEm`. A verificacao de presenca existente acontece antes das outras regras do modulo. Assim, se ja existe presenca, a API retorna `200` mesmo com codigo invalido, fora da janela ou tardio.
- Fonte: RN-307.
- Status: RESPONDIDA.

### P-05 - Limite de presencas manuais

- Pergunta: Qual e o limite de presencas manuais permitido? O limite e por encontro, por organizacao, por participante ou por evento, e em qual momento a tentativa excedente deve retornar `LIMITE_DE_MANUAIS`?
- Resposta: O limite e por encontro, nao por organizacao nem por participante: no maximo 10% das inscricoes confirmadas daquele encontro podem ser manuais, arredondando para cima. E a ultima verificacao da presenca manual, depois da justificativa, da presenca ja existente, do participante nao inscrito e da janela. So depois dessas verificacoes uma tentativa excedente retorna `LIMITE_DE_MANUAIS`.
- Fonte: RN-313 e RN-314.
- Status: RESPONDIDA.

### P-06 - Inscricao elegivel

- Pergunta: Quais status de inscricao permitem registrar presenca? Apenas `confirmada`, ou tambem `convocada`? Inscricoes `em_espera`, `cancelada` e `expirada` devem retornar `NAO_INSCRITO`?
- Resposta: So quem tem inscricao `confirmada` pode registrar presenca. Inscricao `convocada` nao basta, mesmo ocupando vaga para lotacao no M2. Inscricoes `em_espera`, `convocada`, `cancelada` e `expirada` retornam `NAO_INSCRITO`.
- Fonte: RN-306.
- Status: RESPONDIDA.

### P-07 - Obtencao do codigo

- Pergunta: A organizacao pode obter o codigo QR apenas durante a janela do encontro? O codigo deve ser rejeitado quando o encontro estiver fora da janela, e o que acontece para encontro de atividade cancelada?
- Resposta: A organizacao so obtem o codigo durante a janela do QR, de 15 minutos antes ate 30 minutos depois do inicio do encontro. Fora dela, `GET /encontros/:id/codigo` retorna `FORA_DA_JANELA`. Se o encontro for de atividade cancelada, o codigo nao e fornecido e retorna `ATIVIDADE_CANCELADA`.
- Fonte: RN-302, com a janela definida na RN-301.
- Status: RESPONDIDA.

### P-08 - Ordem entre regras de presenca

- Pergunta: Quando uma tentativa de presenca viola mais de uma regra ao mesmo tempo, qual erro deve prevalecer? Considere, por exemplo, participante nao inscrito com codigo invalido, presenca fora da janela com codigo expirado e presenca manual acima do limite com justificativa ausente.
- Resposta: As rotas tem ordens diferentes. Para presenca pelo participante, QR e QR offline, a ordem e: encontro inexistente (404), presenca ja existente (200), nao inscrito, sincronizacao tardia, fora da janela e codigo invalido. Para presenca manual, a ordem e: justificativa, presenca ja existente (200), nao inscrito, fora da janela e limite de manuais. No QR, a presenca existente vem logo depois do 404, antes de qualquer validacao; na manual, a justificativa vem antes da presenca existente. Assim, nao inscrito com codigo invalido retorna `NAO_INSCRITO`; fora da janela com codigo expirado retorna `FORA_DA_JANELA`; e manual acima do limite com justificativa ausente retorna `JUSTIFICATIVA_OBRIGATORIA`.
- Fonte: RN-314.
- Status: RESPONDIDA.

### P-09 - Fora do escopo de M3

- Pergunta: Alem das operacoes nao previstas no contrato, o que M3 deve declarar explicitamente como fora de escopo? Por exemplo: apagar ou corrigir presenca, registrar saida, alterar presenca existente, gerar certificado ou calcular percentual de presenca.
- Resposta: O M3 faz apenas registrar presenca por QR, QR offline e manual, e consultar as presencas de um encontro. Ficam fora de escopo apagar, corrigir ou alterar presenca; registrar saida; gerar certificado ou calcular percentual; criar ou alterar inscricoes; criar ou alterar encontros e atividades; e exportar presencas em planilha.
- Fonte: decisao do usuario; M1 e M2 no contrato; M4 e M5 no contrato.
- Status: RESPONDIDA.

### P-10 - Justificativa manual

- Pergunta: Quais conteudos sao validos para `justificativa` na presenca manual? Uma string vazia ou apenas espacos deve ser rejeitada? Existe tamanho minimo ou maximo?
- Resposta: A justificativa deve ter pelo menos 10 caracteres uteis. O documento nao define tamanho maximo. A validacao remove os espacos das extremidades: string vazia, apenas espacos ou com menos de 10 caracteres uteis retorna `JUSTIFICATIVA_OBRIGATORIA`, assim como o campo ausente.
- Fonte: RN-311.
- Status: RESPONDIDA.

### P-11 - Instantes da presenca

- Pergunta: Como devem ser definidos `lidoEm` e `registradaEm`?
- Resposta: `lidoEm` e o instante que vale para as regras e `registradaEm` e o instante do registro. Toda regra temporal usa o relogio controlado, nunca a hora do sistema. No QR offline, o `lidoEm` enviado pelo cliente vale para as regras e `registradaEm` e o instante da sincronizacao pelo relogio controlado.
- Fonte: `contrato-api.md`, secao 3 e modelo `Presenca`, linhas 176-184.
- Status: RESPONDIDA.

### P-12 - Origem da presenca

- Pergunta: Em que condicao uma presenca deve ter `origem: "qr"` e em que condicao deve ter `origem: "qr_offline"`? O criterio deve ser a presenca ou ausencia de `lidoEm`, ou existe outro criterio?
- Resposta: A presenca do campo `lidoEm` no envio define a origem. Sem `lidoEm`, a origem e `qr`; com `lidoEm`, a origem e `qr_offline`. A origem `manual` e exclusiva da rota de presenca manual. Mesmo quando `lidoEm` e descartado por estar adiantado, a origem continua `qr_offline`, pois o envio veio com o campo.
- Fonte: RN-315 e RN-309 para o caso do relogio adiantado.
- Status: RESPONDIDA.

### P-13 - Geracao dos codigos

- Pergunta: Como o codigo QR deve ser gerado e reutilizado? O mesmo codigo deve ser retornado em chamadas repetidas durante sua validade? Qual conjunto de caracteres e permitido e como garantir que codigos de encontros ou periodos diferentes nao sejam confundidos?
- Resposta: O codigo tem 6 caracteres do alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, que exclui `0`, `O`, `1` e `I`. Na leitura, a API aceita minusculas e ignora espacos. O mesmo codigo e devolvido em chamadas repetidas dentro do mesmo minuto. Cada codigo pertence a um encontro; codigo valido em um encontro e recusado em outro com `CODIGO_INVALIDO`.
- Fonte: RN-305, RN-303 e RN-304.
- Status: RESPONDIDA.

### P-14 - Ordenacao das presencas

- Pergunta: Em que ordem `GET /encontros/:id/presencas` deve retornar as presencas? Deve ordenar por `registradaEm`, por `lidoEm`, por participante ou por outro criterio? Em caso de empate, qual desempate deve ser usado?
- Resposta: `GET /encontros/:id/presencas` retorna as presencas ordenadas por `registradaEm` crescente e, em caso de empate, pelo `id` da presenca, para a ordem ser deterministica e testavel.
- Fonte: decisao do usuario; a ordenacao nao e definida pelo contrato.
- Status: RESPONDIDA.

### P-15 - Armazenamento da justificativa

- Pergunta: A `justificativa` deve ser armazenada exatamente como enviada ou normalizada?
- Resposta: A validacao remove espacos das extremidades apenas para verificar se ha texto. A justificativa e armazenada e retornada exatamente como enviada, preservando maiusculas, minusculas e quebras de linha.
- Fonte: decisao do usuario.
- Status: RESPONDIDA.

### P-16 - Tentativas duplicadas e limite manual

- Pergunta: Quando uma presenca manual e repetida para um participante que ja possui presenca no encontro, essa tentativa deve retornar a presenca existente com `200` sem consumir o limite de manuais? E uma tentativa duplicada por QR deve seguir a mesma regra?
- Resposta: A tentativa duplicada nao consome o limite. Tanto na manual quanto no QR, a verificacao de presenca ja existente acontece antes do limite de manuais e das demais regras do modulo; a tentativa repetida retorna `200` com a presenca original e nada e consumido nem alterado. Na manual, a unica verificacao anterior e a justificativa.
- Fonte: RN-307 e RN-314.
- Status: RESPONDIDA.
