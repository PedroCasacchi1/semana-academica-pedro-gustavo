# Entrevista M2 - Inscricoes e lista de espera

Status: Rodada 1 em andamento.

## Escopo da sessao

- Modulo: M2 - Inscricoes e lista de espera.
- Fontes fixas lidas: `contrato-api.md`, `specs/M1-grade.md` e `specs/M3-presenca.md`.
- Nao implementar codigo nesta sessao.
- Nao escrever spec nesta sessao.
- Quando a resposta for "consultar requisitos", registrar a pergunta como PENDENTE.
- Recomendacoes feitas pelo agente em conversa nao sao respostas do usuario e nao sao decisoes.
- A entrevista deve seguir uma pergunta por vez.
- Regras respondidas diretamente pelo `contrato-api.md` devem ser registradas com fonte, sem perguntar ao usuario.

## Fatos do contrato-api.md

- Rotas M2:
  - `POST /atividades/:id/inscricoes` para participante, sem corpo de entrada, retorna `201 Inscricao`.
  - `GET /inscricoes` para todos, retorna `200 [Inscricao]`; participante recebe somente as proprias e aceita filtro `?atividadeId=`.
  - `GET /inscricoes/:id` para todos, retorna `200 Inscricao`.
  - `POST /inscricoes/:id/cancelamento` para participante, retorna `200 Inscricao`.
  - `POST /inscricoes/:id/confirmacao` para participante, retorna `200 Inscricao`.
  Fonte: `contrato-api.md`, linhas 129-137.
- Toda rota identificada exige `X-Usuario`; ausente ou inexistente retorna `401 USUARIO_DESCONHECIDO`. Fonte: `contrato-api.md`, linha 12.
- As rotas M2 de inscricao, cancelamento e confirmacao sao de participante; a consulta pode ser usada por todos. Fonte: `contrato-api.md`, linhas 131-137.
- A ordem geral de verificacoes e identificacao, perfil, existencia, corpo e regras do recurso. Fonte: `contrato-api.md`, linhas 16-17.
- Toda resposta de erro tem formato `{"erro": "CODIGO", "mensagem": "texto livre"}`. Fonte: `contrato-api.md`, linha 15.
- Identificadores de inscricao sao gerados com prefixo `ins_` e 8 hexadecimais minusculos. Fonte: `contrato-api.md`, linhas 13-14.
- `Inscricao` responde `id`, `atividadeId`, `participanteId`, `status`, `posicaoNaEspera`, `convocadaAte` e `criadaEm`. Fonte: `contrato-api.md`, linhas 139-149.
- Os status possiveis sao `confirmada`, `em_espera`, `convocada`, `cancelada` e `expirada`. Fonte: `contrato-api.md`, linhas 145-147.
- `posicaoNaEspera` so tem numero quando o status e `em_espera`; `convocadaAte` so tem instante quando o status e `convocada`. Fonte: `contrato-api.md`, linhas 146-147.
- Datas usam ISO 8601 com fuso; a API pode responder em qualquer fuso e o juiz compara o instante. Fonte: `contrato-api.md`, linha 13.
- O modo de teste expoe reset e relogio controlado; no modo de teste toda regra temporal usa esse relogio, nunca a hora do sistema. Fonte: `contrato-api.md`, linhas 41-53.
- Codigos aplicaveis a M2: `ATIVIDADE_JA_INICIADA` ao cancelar inscricao; `ATIVIDADE_CANCELADA` ao inscrever; `INSCRICOES_ENCERRADAS` ao inscrever; `INSCRICAO_BLOQUEADA` ao inscrever; `JA_INSCRITO` ao inscrever; `CONFLITO_DE_HORARIO` ao inscrever e confirmar convocacao; `LIMITE_DE_MINICURSOS` ao inscrever e confirmar convocacao; `INSCRICAO_INATIVA` ao cancelar; `SEM_CONVOCACAO` ao confirmar; `CONVOCACAO_EXPIRADA` ao confirmar. Fonte: `contrato-api.md`, linhas 273-282.
- O contrato nao define prazos, limites, tolerancias, precedencia entre regras nem o que ocorre quando o tempo passa sem acesso ao sistema. Fonte: `contrato-api.md`, linhas 292-294.

## Fatos de M1 relevantes para M2

- `ocupadas` conta inscricoes com status `confirmada` ou `convocada`; `cancelada` e `expirada` nao contam. Fonte: `specs/M1-grade.md`, R25.
- `emEspera` conta somente inscricoes com status `em_espera`. Fonte: `specs/M1-grade.md`, R26.
- `vagasRestantes` e `vagas - ocupadas`; inscricoes em espera nao reduzem esse valor. Fonte: `specs/M1-grade.md`, R27.
- Ao reduzir vagas, inscricoes `confirmada` ou `convocada` impedem que a nova quantidade fique abaixo do total ocupado; inscricoes `em_espera` nao entram nesse limite. Fonte: `specs/M1-grade.md`, R19.
- Ao cancelar uma atividade, todas as inscricoes ativas sao canceladas e deixam de contar nos indicadores. Fonte: `specs/M1-grade.md`, R22.
- Uma atividade so pode ser cancelada antes do inicio do primeiro encontro; no instante do inicio ela ja esta iniciada. Fonte: `specs/M1-grade.md`, R20.
- A situacao da atividade e calculada pelo relogio controlado: `prevista` antes do primeiro inicio, `em_andamento` a partir dele e `encerrada` no instante do fim do ultimo encontro; atividade cancelada prevalece como `cancelada`. Fonte: `specs/M1-grade.md`, R13-R14.

## Fatos de M3 relevantes para M2

- Somente inscricao com status `confirmada` permite registrar presenca. `em_espera`, `convocada`, `cancelada` e `expirada` retornam `403 NAO_INSCRITO`. Fonte: `specs/M3-presenca.md`, R9.
- A inscricao `convocada` ocupa vaga para a lotacao de M2, mas nao basta para registrar presenca. Fonte: `specs/M3-presenca.md`, P-06/R9.

## Entrevista

### P-01 - Prazo para inscricoes

- Pergunta: Qual e o periodo em que uma inscricao nova pode ser feita? Defina o instante em que as inscricoes se encerram em relacao ao inicio da atividade e se o limite exato e aceito.
- Resposta: As inscricoes fecham 30 minutos antes do inicio do primeiro encontro. No instante exato do prazo, a inscricao ja e recusada: para um encontro as 19:00, as 18:30:00 retorna `INSCRICOES_ENCERRADAS`.
- Fonte: RN-202 e convencao geral dos requisitos sobre prazos que fecham no proprio instante.
- Status: RESPONDIDA.

### Fronteira atual

### P-02 - Ocupacao e lista de espera

- Pergunta: Quando uma inscricao e criada, em quais condicoes ela deve nascer como `confirmada` e em quais deve nascer como `em_espera`? Quando uma vaga fica disponivel, como a lista de espera e processada: quantas pessoas sao convocadas, em que ordem e com qual criterio de desempate?
- Resposta: Se existe vaga livre no momento do pedido, a inscricao nasce como `confirmada`. Se nao existe, nasce como `em_espera`, no fim da fila; lotacao e um estado normal, nao erro. Sempre que uma vaga e liberada por cancelamento, convocacao vencida ou aumento de vagas, a pessoa na frente da fila e convocada. A fila segue ordem de chegada, e a posicao e calculada na consulta: posicao 1 e quem sera chamado em seguida.
- Fonte: RN-205, RN-211 e RN-216.
- Status: RESPONDIDA.

### P-03 - Reinscricao

- Pergunta: O que deve acontecer quando o participante tenta se inscrever novamente na mesma atividade? Inscricoes `confirmada`, `em_espera`, `convocada`, `cancelada` e `expirada` devem todas gerar `JA_INSCRITO`, ou estados inativos permitem uma nova inscricao? Se permitirem, quais estados e em que momento?
- Resposta: `JA_INSCRITO` ocorre quando ja existe inscricao ativa na atividade, isto e, `confirmada`, `em_espera` ou `convocada`. Quem cancelou ou teve a convocacao vencida pode se inscrever novamente e volta pelo fim da fila, sem herdar a posicao antiga.
- Fonte: RN-204.
- Status: RESPONDIDA.

### P-04 - Cancelamento da inscricao

- Pergunta: Quais status podem ser cancelados pelo participante, quais retornam `INSCRICAO_INATIVA` e o que acontece com a vaga ou com a fila quando uma inscricao `confirmada`, `convocada` ou `em_espera` e cancelada? O limite do cancelamento e o inicio do primeiro encontro da atividade, inclusive no instante exato?
- Resposta: So inscricoes ativas podem ser canceladas. Inscricao cancelada ou expirada retorna `INSCRICAO_INATIVA`. O participante pode cancelar enquanto a atividade nao comecou; no instante exato do primeiro encontro o cancelamento retorna `ATIVIDADE_JA_INICIADA`. O cancelamento devolve a vaga ao pool e convoca a primeira pessoa da fila. Ao cancelar a atividade, todas as inscricoes ativas sao canceladas.
- Fonte: RN-209, RN-210, RN-211 e RN-217.
- Status: RESPONDIDA.

### P-05 - Convocacao e confirmacao

- Pergunta: Quando uma inscricao em espera vira `convocada`, qual prazo ela recebe em `convocadaAte`, os limites exatos desse prazo sao aceitos, e o que acontece quando o participante confirma ou deixa o prazo passar? Uma convocacao expirada libera a vaga imediatamente e chama a proxima pessoa?
- Resposta: A convocacao concede 2 horas, registradas em `convocadaAte`, mas nunca ultrapassa o fechamento das inscricoes. Confirmar no instante exato de `convocadaAte` e aceito. Se o prazo vencer, a inscricao vira `expirada`, sai da fila e a proxima e convocada com prazo contado do vencimento; a cadeia ocorre mesmo sem acesso ao sistema. Confirmar depois retorna `CONVOCACAO_EXPIRADA`; confirmar inscricao nao convocada retorna `SEM_CONVOCACAO`. A confirmacao revalida conflito de horario e limite de minicursos; se recusada por um deles, a convocacao continua ativa ate o prazo acabar.
- Fonte: RN-211, RN-212, RN-213, RN-214 e RN-215.
- Status: RESPONDIDA.

### P-06 - Conflito de horario

- Pergunta: Como deve ser definido `CONFLITO_DE_HORARIO` entre atividades para o mesmo participante? Quais status de inscricao e quais situacoes de atividade entram na verificacao, como sao tratados encontros que apenas encostam no mesmo instante e qual e a ordem de comparacao quando ha varios encontros?
- Resposta: `CONFLITO_DE_HORARIO` so e verificado quando a inscricao ocupa vaga. A comparacao usa outras inscricoes do mesmo participante que ocupam vaga, `confirmada` ou `convocada`. Encontros que apenas se tocam nao conflitam; fim as 12:00 e inicio as 12:00 podem coexistir. Inscricao `em_espera` nao passa pela verificacao.
- Fonte: RN-206.
- Status: RESPONDIDA.

### P-07 - Limite de minicursos

- Pergunta: Qual e o limite de minicursos por participante, o que conta para esse limite e em que momento ele e liberado? O limite considera inscricoes `confirmada`, `convocada`, `em_espera`, canceladas ou expiradas, e a regra vale igualmente para inscricao nova e confirmacao de convocacao?
- Resposta: O limite e de 3 minicursos ocupando vaga por participante. Palestras e inscricoes em espera nao contam. A regra vale quando a pessoa passa a ocupar vaga, tanto na inscricao direta quanto na confirmacao de convocacao. Uma quarta inscricao pode ser convocada normalmente, mas sua confirmacao retorna `LIMITE_DE_MINICURSOS`; se outro minicurso for cancelado antes do prazo, a confirmacao passa.
- Fonte: RN-207 e RN-214.
- Status: RESPONDIDA.

### P-08 - Bloqueio de inscricao

- Pergunta: Em que condicoes um participante fica `INSCRICAO_BLOQUEADA`, por quanto tempo o bloqueio permanece e quais inscricoes ou atividades contam para criacao e remocao do bloqueio? Essa regra deve ser definida no M2 ou fica fora deste modulo por depender do M5?
- Resposta: `INSCRICAO_BLOQUEADA` fica fora do M2. Depende do bloqueio do painel da organizacao, implementado pelo M5; a ordem de recusas do M2 nao inclui esse passo.
- Fonte: RN-208, condicionada a RN-507 do M5.
- Status: RESPONDIDA.

### P-09 - Ordenacao e visibilidade das consultas

- Pergunta: Em que ordem `GET /inscricoes` deve retornar as inscricoes, em que ordem deve retornar inscricoes filtradas por `atividadeId` e existe algum criterio adicional para `GET /inscricoes/:id`? Alem das restricoes ja fixadas pelo contrato para participantes, ha alguma regra de visibilidade ou acesso ao detalhe de uma inscricao?
- Resposta: `GET /inscricoes` retorna em ordem decrescente de criacao, da mais recente para a mais antiga, com desempate pelo `id`; o mesmo vale com filtro por atividade. O participante so enxerga e manipula as proprias inscricoes; consultar a inscricao de outra pessoa retorna `404`, sem revelar existencia. A organizacao lista todas, mas nao cancela nem confirma por outra pessoa.
- Fonte: decisao do usuario para ordenacao; RN-218 e RN-219 para visibilidade.
- Status: RESPONDIDA.

### P-10 - Escopo do modulo

- Pergunta: Alem das rotas do contrato, quais comportamentos ficam explicitamente fora do M2: inscricao feita pela organizacao em nome de participante, notificacoes, pagamento, alteracao manual de posicao, troca de atividade, exclusao de historico ou qualquer outro?
- Resposta: Ficam fora do M2 inscricao pela organizacao, troca de atividade, alteracao manual de posicao, exclusao de historico, notificacoes por e-mail ou push, pagamento, login e senha, mais de um evento, bloqueio por falta, grade de atividades, presenca e certificados.
- Fonte: secao de fora de escopo do documento e RN-507 para o bloqueio.
- Status: RESPONDIDA.

### Rodada 2

### P-11 - Ordem das recusas na inscricao

- Pergunta: Quando uma nova inscricao viola mais de uma regra ao mesmo tempo, qual ordem deve prevalecer entre atividade cancelada, inscricoes encerradas, inscricao ativa duplicada, conflito de horario e limite de minicursos? Em quais dessas verificacoes uma inscricao em espera nao deve entrar?
- Resposta: A ordem e: atividade inexistente (`404`) -> atividade cancelada -> inscricoes encerradas -> ja existe inscricao ativa -> conflito de horario -> limite de minicursos. O bloqueio do M5 nao se aplica. Conflito e limite so sao verificados quando a inscricao vai ocupar vaga; quem entra em espera passa pelas verificacoes anteriores, mas nao por essas duas.
- Fonte: RN-208, com RN-206 e RN-207.
- Status: RESPONDIDA.

### P-12 - Fila sem elegibilidade para ocupar vaga

- Pergunta: Se a pessoa na frente da fila nao puder ocupar a vaga por conflito de horario ou limite de minicursos, ela deve permanecer `em_espera`, ser pulada temporariamente ou ser expirada/cancelada? A proxima pessoa pode ser convocada na mesma vaga? Como isso funciona quando varias vagas sao liberadas ao mesmo tempo?
- Resposta: A convocacao e cega. A pessoa da frente e convocada mesmo com conflito de horario ou teto de minicursos; ninguem e pulado nem expirado antecipadamente. A inscricao permanece convocada ate o vencimento, e so entao a vaga passa ao proximo. As verificacoes ocorrem na confirmacao; se a pessoa liberar a causa dentro do prazo, a confirmacao pode passar.
- Fonte: RN-211 e RN-214.
- Status: RESPONDIDA.

### P-13 - Aumento de vagas

- Pergunta: Ao aumentar `vagas`, quantas pessoas da fila devem ser convocadas, considerando vagas livres e inscricoes `convocada` que ja ocupam vaga? A promocao ocorre no proprio `PATCH` e deve continuar ate preencher todas as vagas disponiveis ou parar no primeiro impedimento?
- Resposta: Cada vaga liberada convoca uma pessoa. Se o `PATCH` aumenta vagas em tres e ha pelo menos tres pessoas esperando, tres convocacoes saem na propria requisicao; se a fila for menor, convoca-se quem houver e o restante fica vago. Depois do fechamento, aumento de vagas nao convoca ninguem.
- Fonte: RN-111 e RN-211, com RN-212 para o limite. A convocacao por vaga em aumento multiplo e leitura direta da regra de que toda vaga liberada convoca.
- Status: RESPONDIDA.

### P-14 - Fechamento das inscricoes e estados pendentes

- Pergunta: Quando chega o instante de fechamento das inscricoes, o que acontece com inscricoes `em_espera` e `convocada` que ainda estao pendentes? Convocacoes ja emitidas podem continuar ate `convocadaAte`, mesmo depois do fechamento, ou devem expirar no fechamento?
- Resposta: Depois do fechamento, nenhuma convocacao nova e emitida. Convocacoes existentes continuam validas, mas com prazo truncado no fechamento. Quando vencem no fechamento, a cadeia para e a vaga nao convoca o proximo. Inscricoes `em_espera` permanecem nesse estado, sem cancelamento ou expiracao e sem novas convocacoes.
- Fonte: RN-212 e RN-213. O destino final da espera apos o fechamento nao foi enunciado; permanece `em_espera` sem nova transicao.
- Status: RESPONDIDA.

### P-15 - Revalidacao na confirmacao

- Pergunta: Se a confirmacao de uma convocacao falhar por `CONFLITO_DE_HORARIO` ou `LIMITE_DE_MINICURSOS`, a resposta deve sempre preservar a inscricao como `convocada` sem liberar a vaga? Essas recusas devem ter alguma precedencia entre si quando ambas ocorrerem?
- Resposta: A confirmacao recusada por `CONFLITO_DE_HORARIO` ou `LIMITE_DE_MINICURSOS` preserva a inscricao como `convocada` e mantem a vaga presa ate o prazo acabar. A pessoa pode tentar novamente dentro do prazo. Se ambas as regras falharem, prevalece `CONFLITO_DE_HORARIO`.
- Fonte: RN-214 e RN-208.
- Status: RESPONDIDA.

### P-16 - Avanco automatico do relogio

- Pergunta: Quais transicoes devem ser materializadas automaticamente quando o relogio avanca sem nenhuma requisicao, especialmente vencimento de convocacao, expiracao em cadeia, fechamento das inscricoes e inicio da atividade? Ao consultar depois do avanco, o sistema deve refletir todo o encadeamento como se tivesse ocorrido no instante correto?
- Resposta: As transicoes nao dependem de acesso no instante do evento. Na proxima leitura, o estado deve refletir todo o intervalo: convocacoes vencidas viram `expirada`, cada vencimento convoca o proximo com prazo contado do instante do vencimento, e a cadeia repete ate o fechamento ou o fim da fila. Fechamento e situacao da atividade tambem usam o relogio. A fila e recalculada na leitura, sem temporizador.
- Fonte: RN-213, com RN-212 para o limite da cadeia.
- Status: RESPONDIDA.

### P-17 - Verificacao das regras

- Pergunta: Para cada regra decidida nesta rodada, quais cenarios de aceite devem provar o comportamento, incluindo limites exatos de prazo, fila, cancelamento, convocacao, conflito de horario, limite de minicursos e visibilidade?
- Resposta: Devem ser provados: aceite um segundo antes e recusa no instante do fechamento; lotacao criando espera com posicao correta; cancelamento liberando vaga e convocando o primeiro; cancelamento recusado no inicio; convocacao de 2 horas aceita no limite; truncamento pelo fechamento; vaga apos fechamento sem nova convocacao; cadeia completa com salto do relogio; encontros encostados sem conflito; sobreposicao com conflito; quarto minicurso convocado mas recusado na confirmacao; palestra fora do limite; participante alheio recebendo `404`; e organizacao listando tudo sem cancelar por terceiros.
- Fonte: RN-202, RN-204 a RN-216, RN-218 e RN-219.
- Status: RESPONDIDA.

### Rodada 3

### P-18 - Cancelamento de inscricao em espera

- Pergunta: Cancelar uma inscricao `em_espera`, que nao ocupa vaga, deve apenas removê-la da fila e marcar `cancelada`, sem convocar ninguem? As posicoes das demais inscricoes devem ser recalculadas imediatamente na proxima consulta?
- Resposta: Cancelar uma inscricao `em_espera` apenas a tira da fila e a marca como `cancelada`. Nao dispara convocacao, pois a inscricao nao ocupava vaga. As posicoes restantes nao sao armazenadas e se reacomodam pela ordem de chegada na consulta.
- Fonte: RN-205, RN-211 e RN-216; a ausencia de convocacao decorre de convocacao ser disparada por vaga liberada.
- Status: RESPONDIDA.

### P-19 - Precedencia no cancelamento

- Pergunta: Se uma inscricao esta `cancelada` ou `expirada` e a atividade ja iniciou, qual erro prevalece ao chamar o cancelamento: `INSCRICAO_INATIVA` ou `ATIVIDADE_JA_INICIADA`? A mesma ordem vale para qualquer outro estado nao ativo?
- Resposta: Se a inscricao esta `cancelada` ou `expirada` e a atividade ja iniciou, prevalece `ATIVIDADE_JA_INICIADA`. A atividade e verificada antes do estado da inscricao: primeiro se verifica se a operacao ainda e possivel naquela atividade, depois se a inscricao permite a operacao.
- Fonte: decisao do usuario, por analogia com a ordem geral do M2.
- Status: RESPONDIDA.

### P-20 - Confirmacao apos mudanca da atividade

- Pergunta: O que deve acontecer ao confirmar uma inscricao `convocada` depois que a atividade foi cancelada ou depois que o primeiro encontro iniciou? Deve prevalecer `ATIVIDADE_CANCELADA`, `ATIVIDADE_JA_INICIADA`, `CONVOCACAO_EXPIRADA` ou `SEM_CONVOCACAO`?
- Resposta: Para atividade cancelada, prevalece `ATIVIDADE_CANCELADA`. O caso de atividade iniciada nao ocorre com convocacao valida: toda convocacao vence no fechamento, que acontece 30 minutos antes do inicio. Nesse ponto, uma convocacao vencida retorna `CONVOCACAO_EXPIRADA`; uma inscricao que nunca foi convocada retorna `SEM_CONVOCACAO`.
- Fonte: decisao do usuario para a atividade cancelada; RN-212 e RN-215 para a parte derivada.
- Status: RESPONDIDA.

### P-21 - Momento da reconciliacao

- Pergunta: Quais chamadas devem reconciliar a fila e materializar vencimentos, expiracoes e convocacoes atrasadas: todas as rotas M2, apenas consultas, ou tambem leituras de atividades do M1? O resultado deve ser identico e idempotente independentemente da rota que fizer a primeira leitura depois do salto do relogio?
- Resposta: A reconciliacao roda em toda rota que leia ou altere o estado de inscricoes ou atividades: rotas M2, leituras de atividade do M1 e registro de presenca do M3. O resultado e idempotente e independe da primeira rota acessada; a fila e recalculada a partir do relogio, sem depender de efeitos acumulados.
- Fonte: RN-213 para a exigencia de ocorrer sem acesso ao sistema; decisao do usuario para a abrangencia e idempotencia.
- Status: RESPONDIDA.

### P-22 - Confirmacao e ocupacao da vaga

- Pergunta: Ao confirmar uma convocacao, a inscricao deve apenas trocar para `confirmada`, preservando `criadaEm` e limpando `convocadaAte` e `posicaoNaEspera`? A resposta deve manter esses campos como `null` quando deixam de se aplicar, conforme o modelo do contrato?
- Resposta: Ao confirmar, o status vira `confirmada`, `criadaEm` preserva o instante original da inscricao, `posicaoNaEspera` passa a `null` e `convocadaAte` passa a `null`.
- Fonte: `contrato-api.md`, modelo `Inscricao`.
- Status: RESPONDIDA.

## Resumo para confirmacao

1. Inscricoes fecham 30 minutos antes do primeiro encontro, recusando o instante exato do fechamento.
2. Vaga livre cria inscricao `confirmada`; lotacao cria `em_espera` no fim da fila.
3. A fila usa ordem de chegada; posicoes sao calculadas na consulta e nao armazenadas.
4. Inscricoes ativas sao `confirmada`, `em_espera` e `convocada`; canceladas e expiradas permitem nova inscricao pelo fim da fila.
5. Cancelamento de inscricao ativa ocorre antes do inicio; no instante do inicio retorna `ATIVIDADE_JA_INICIADA` e libera vaga quando aplicavel.
6. Cada vaga liberada convoca a primeira pessoa; cancelamento de espera nao libera vaga nem convoca.
7. Convocacao concede ate 2 horas, truncadas no fechamento; confirmacao no limite exato e aceita.
8. Convocacoes sao cegas e permanecem ativas quando a confirmacao falha por conflito ou limite.
9. Vencimento expira a convocacao e convoca a proxima, com cadeia baseada no instante do vencimento, interrompida pelo fechamento.
10. `CONFLITO_DE_HORARIO` considera apenas inscricoes `confirmada` ou `convocada`; intervalos que apenas se tocam nao conflitam.
11. O limite e de 3 minicursos ocupando vaga; palestras e espera nao contam.
12. A ordem da inscricao e atividade inexistente, atividade cancelada, inscricoes encerradas, inscricao ativa, conflito e limite; bloqueio do M5 fica fora.
13. Atividade cancelada prevalece no cancelamento e na confirmacao conforme as decisoes registradas; inscricao inativa no cancelamento perde para atividade ja iniciada.
14. A reconciliacao ocorre nas rotas M2, nas leituras de atividade do M1 e no registro de presenca do M3, de forma idempotente pelo relogio.
15. `GET /inscricoes` ordena por criacao decrescente e `id`; participante nao revela inscricoes alheias, e organizacao lista todas sem operar por terceiros.
16. Ao confirmar, `criadaEm` permanece original e `posicaoNaEspera` e `convocadaAte` ficam nulos.

Status: Rodada 3 encerrada; aguardando confirmacao final.
