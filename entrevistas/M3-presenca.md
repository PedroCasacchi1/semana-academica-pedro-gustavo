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
- Resposta: consultar requisitos.
- Fonte: `contrato-api.md`, secao 6, codigo `FORA_DA_JANELA`.
- Status: PENDENTE.

### P-02 - Rotacao do codigo QR

- Pergunta: Qual e a duracao de cada codigo QR? Quando `trocaEm` acontece em relacao a `validoAte`, e codigos anteriores continuam aceitos ate `validoAte` ou deixam de ser aceitos imediatamente quando um novo codigo e gerado?
- Resposta: consultar requisitos.
- Fonte: `contrato-api.md`, campos `trocaEm` e `validoAte`, secao 6, codigo `CODIGO_INVALIDO`.
- Status: PENDENTE.

### P-03 - Sincronizacao offline

- Pergunta: Para uma presenca enviada com `lidoEm`, qual e o atraso maximo permitido entre o instante da leitura e o envio? O que deve acontecer se `lidoEm` estiver no futuro, fora da janela do encontro ou se a presenca for sincronizada depois desse limite?
- Resposta: consultar requisitos.
- Fonte: `contrato-api.md`, secao 6, codigo `SINCRONIZACAO_TARDIA`; campo opcional `lidoEm`.
- Status: PENDENTE.

### P-04 - Presenca duplicada

- Pergunta: O que caracteriza uma presenca ja registrada: uma presenca por participante em cada encontro? Quando a mesma pessoa enviar novamente uma presenca, a API deve retornar a presenca original sem alteracao, ou atualizar `origem`, `lidoEm` e `registradaEm`?
- Resposta: consultar requisitos.
- Fonte: `contrato-api.md`, retornos `201` na primeira vez e `200` depois; modelo `Presenca`.
- Status: PENDENTE.

### P-05 - Limite de presencas manuais

- Pergunta: Qual e o limite de presencas manuais permitido? O limite e por encontro, por organizacao, por participante ou por evento, e em qual momento a tentativa excedente deve retornar `LIMITE_DE_MANUAIS`?
- Resposta: consultar requisitos.
- Fonte: `contrato-api.md`, secao 6, codigo `LIMITE_DE_MANUAIS`.
- Status: PENDENTE.

### P-06 - Inscricao elegivel

- Pergunta: Quais status de inscricao permitem registrar presenca? Apenas `confirmada`, ou tambem `convocada`? Inscricoes `em_espera`, `cancelada` e `expirada` devem retornar `NAO_INSCRITO`?
- Resposta: consultar requisitos.
- Fonte: `contrato-api.md`, secao 6, codigo `NAO_INSCRITO`; estados de inscricao definidos no contrato de M2.
- Status: PENDENTE.

### P-07 - Obtencao do codigo

- Pergunta: A organizacao pode obter o codigo QR apenas durante a janela do encontro? O codigo deve ser rejeitado quando o encontro estiver fora da janela, e o que acontece para encontro de atividade cancelada?
- Resposta: consultar requisitos.
- Fonte: `contrato-api.md`, secao 6, codigos `FORA_DA_JANELA` e `ATIVIDADE_CANCELADA`.
- Status: PENDENTE.

### P-08 - Ordem entre regras de presenca

- Pergunta: Quando uma tentativa de presenca viola mais de uma regra ao mesmo tempo, qual erro deve prevalecer? Considere, por exemplo, participante nao inscrito com codigo invalido, presenca fora da janela com codigo expirado e presenca manual acima do limite com justificativa ausente.
- Resposta: consultar requisitos.
- Fonte: `contrato-api.md`, secao 1, ordem geral de verificacoes; secao 6, codigos de M3.
- Status: PENDENTE.

### P-09 - Fora do escopo de M3

- Pergunta: Alem das operacoes nao previstas no contrato, o que M3 deve declarar explicitamente como fora de escopo? Por exemplo: apagar ou corrigir presenca, registrar saida, alterar presenca existente, gerar certificado ou calcular percentual de presenca.
- Resposta: O M3 faz apenas registrar presenca por QR, QR offline e manual, e consultar as presencas de um encontro. Ficam fora de escopo apagar, corrigir ou alterar presenca; registrar saida; gerar certificado ou calcular percentual; criar ou alterar inscricoes; criar ou alterar encontros e atividades; e exportar presencas em planilha.
- Fonte: decisao do usuario; M1 e M2 no contrato; M4 e M5 no contrato.
- Status: RESPONDIDA.

### P-10 - Justificativa manual

- Pergunta: Quais conteudos sao validos para `justificativa` na presenca manual? Uma string vazia ou apenas espacos deve ser rejeitada? Existe tamanho minimo ou maximo?
- Resposta: consultar requisitos.
- Fonte: `contrato-api.md`, campo `justificativa` e codigo `JUSTIFICATIVA_OBRIGATORIA`.
- Status: PENDENTE.

### P-11 - Instantes da presenca

- Pergunta: Como devem ser definidos `lidoEm` e `registradaEm`?
- Resposta: `lidoEm` e o instante que vale para as regras e `registradaEm` e o instante do registro. Toda regra temporal usa o relogio controlado, nunca a hora do sistema. No QR offline, o `lidoEm` enviado pelo cliente vale para as regras e `registradaEm` e o instante da sincronizacao pelo relogio controlado.
- Fonte: `contrato-api.md`, secao 3 e modelo `Presenca`, linhas 176-184.
- Status: RESPONDIDA.

### P-12 - Origem da presenca

- Pergunta: Em que condicao uma presenca deve ter `origem: "qr"` e em que condicao deve ter `origem: "qr_offline"`? O criterio deve ser a presenca ou ausencia de `lidoEm`, ou existe outro criterio?
- Resposta: consultar requisitos.
- Fonte: `contrato-api.md`, campo `origem` com valores `qr` e `qr_offline`; campo opcional `lidoEm`.
- Status: PENDENTE.

### P-13 - Geracao dos codigos

- Pergunta: Como o codigo QR deve ser gerado e reutilizado? O mesmo codigo deve ser retornado em chamadas repetidas durante sua validade? Qual conjunto de caracteres e permitido e como garantir que codigos de encontros ou periodos diferentes nao sejam confundidos?
- Resposta: consultar requisitos.
- Fonte: `contrato-api.md`, modelo `CodigoDoEncontro`, codigo de 6 caracteres, campos `trocaEm` e `validoAte`.
- Status: PENDENTE.

### P-14 - Ordenacao das presencas

- Pergunta: Em que ordem `GET /encontros/:id/presencas` deve retornar as presencas? Deve ordenar por `registradaEm`, por `lidoEm`, por participante ou por outro criterio? Em caso de empate, qual desempate deve ser usado?
- Resposta: consultar requisitos.
- Fonte: `contrato-api.md`, rota `GET /encontros/:id/presencas`; a ordenacao nao e definida pelo contrato.
- Status: PENDENTE.

### P-15 - Armazenamento da justificativa

- Pergunta: A `justificativa` deve ser armazenada exatamente como enviada ou normalizada?
- Resposta: A validacao remove espacos das extremidades apenas para verificar se ha texto. A justificativa e armazenada e retornada exatamente como enviada, preservando maiusculas, minusculas e quebras de linha.
- Fonte: decisao do usuario.
- Status: RESPONDIDA.

### P-16 - Tentativas duplicadas e limite manual

- Pergunta: Quando uma presenca manual e repetida para um participante que ja possui presenca no encontro, essa tentativa deve retornar a presenca existente com `200` sem consumir o limite de manuais? E uma tentativa duplicada por QR deve seguir a mesma regra?
- Resposta: consultar requisitos.
- Fonte: `contrato-api.md`, retornos `201` na primeira vez e `200` depois; codigo `LIMITE_DE_MANUAIS`.
- Status: PENDENTE.
