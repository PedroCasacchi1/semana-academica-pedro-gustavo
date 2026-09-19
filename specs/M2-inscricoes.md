# Spec - M2 Inscricoes e lista de espera

## 1. Objetivo

Permitir que participantes se inscrevam em atividades, ocupem vagas ou entrem na lista de espera, cancelem inscricoes e confirmem convocacoes, com processamento deterministico da fila e consultas coerentes para participantes e organizacao.

## 2. Fora de escopo

- Inscricao feita pela organizacao em nome de participante.
- Troca de atividade.
- Alteracao manual da posicao na fila.
- Exclusao de historico de inscricoes.
- Notificacoes por e-mail ou push.
- Pagamento.
- Login e senha.
- Mais de um evento.
- Bloqueio por falta; essa regra depende do M5.
- Grade de atividades; isso pertence ao M1.
- Registro de presenca; isso pertence ao M3.
- Certificados; isso pertence ao M4.

## 3. Modelo

### Inscricao

- `id`: string, gerado pela API com prefixo `ins_` e 8 caracteres hexadecimais minusculos.
- `atividadeId`: string, informado pela rota.
- `participanteId`: string, derivado do participante autenticado.
- `status`: string, calculado pela API; `confirmada`, `em_espera`, `convocada`, `cancelada` ou `expirada`.
- `posicaoNaEspera`: inteiro ou `null`, derivado na consulta; somente `em_espera` recebe numero, sendo 1 a pessoa que sera chamada em seguida. Nao e armazenado.
- `convocadaAte`: instante ISO 8601 ou `null`, calculado quando o status e `convocada`.
- `criadaEm`: instante ISO 8601, calculado com o relogio controlado no momento da inscricao original e preservado nas transicoes.

## 4. Endpoints

- `POST /atividades/:id/inscricoes`: rota de participante, sem corpo; retorna `201 Inscricao`.
- `GET /inscricoes`: rota de consulta para todos; retorna `200 [Inscricao]`; aceita `?atividadeId=`. Participante recebe somente as proprias inscricoes; organizacao recebe todas.
- `GET /inscricoes/:id`: rota de consulta para todos; retorna `200 Inscricao` quando a inscricao e visivel.
- `POST /inscricoes/:id/cancelamento`: rota de participante, sem corpo; retorna `200 Inscricao`.
- `POST /inscricoes/:id/confirmacao`: rota de participante, sem corpo; retorna `200 Inscricao`.

Todas as rotas exigem `X-Usuario`; identificacao, perfil, existencia, corpo e regras do recurso seguem a ordem geral do contrato. Erros retornam `{"erro":"CODIGO","mensagem":"texto livre"}`.

## 5. Regras

- R1. Inscricoes novas podem ser feitas antes do fechamento, definido como 30 minutos antes do inicio do primeiro encontro. No instante exato do fechamento a inscricao ja e recusada com `422 INSCRICOES_ENCERRADAS`. Origem: P-01. Fonte: RN-202 e convencao geral dos requisitos sobre prazos que fecham no proprio instante.
- R2. Se houver vaga livre no instante do pedido, a nova inscricao nasce `confirmada`; se nao houver, nasce `em_espera` no fim da fila, sem erro de lotacao. A fila segue ordem de chegada e `posicaoNaEspera` e calculada na consulta. Origem: P-02. Fonte: RN-205, RN-211 e RN-216.
- R3. Inscricoes `confirmada`, `em_espera` e `convocada` sao ativas. Nova inscricao na mesma atividade com inscricao ativa retorna `409 JA_INSCRITO`. Inscricao `cancelada` ou `expirada` permite nova inscricao, que volta pelo fim da fila e nao herda posicao anterior. Origem: P-03. Fonte: RN-204.
- R4. O cancelamento so pode ocorrer antes do inicio do primeiro encontro. No instante do inicio, retorna `422 ATIVIDADE_JA_INICIADA`. Antes disso, inscricoes ativas podem ser canceladas; inscricao `cancelada` ou `expirada` retorna `422 INSCRICAO_INATIVA`. Se ambos forem aplicaveis, a atividade e verificada primeiro, portanto `ATIVIDADE_JA_INICIADA` prevalece. Origem: P-04 e P-19. Fonte: RN-209, RN-210 e RN-217; a precedencia e decisao do usuario registrada em P-19.
- R5. Cancelar inscricao `confirmada` ou `convocada` libera uma vaga e convoca a primeira pessoa da fila. Cancelar inscricao `em_espera` apenas a marca `cancelada` e a remove da fila; nao libera vaga nem convoca ninguem. Posicoes restantes sao recalculadas na consulta. Cancelar a atividade cancela todas as inscricoes ativas. Origem: P-04 e P-18. Fonte: RN-209, RN-211, RN-216 e RN-217; a ausencia de convocacao e leitura da regra de que convocacao decorre de vaga liberada.
- R6. Cada vaga liberada convoca uma pessoa na ordem da fila. Aumento de vagas convoca, na propria requisicao, uma pessoa por vaga aumentada enquanto houver fila e antes do fechamento; depois do fechamento nao cria convocacoes novas. Essa convocacao e uma leitura direta da regra de que toda vaga liberada convoca.
  Origem: P-02 e P-13. Fonte: RN-111 e RN-211; a promocao por aumento multiplo e leitura direta da regra registrada em P-13.
- R7. Uma convocacao concede ate 2 horas e nunca ultrapassa o fechamento das inscricoes. `convocadaAte` e o menor entre vencimento de 2 horas e fechamento. Confirmacao no instante exato de `convocadaAte` e aceita. Ao vencer, a inscricao vira `expirada`, libera a vaga e a proxima pessoa e convocada com prazo contado do instante do vencimento; a cadeia para no fechamento. Convocar ou expirar nao depende de acesso no instante do evento. Origem: P-05 e P-14. Fonte: RN-211, RN-212 e RN-213.
- R8. Convocacao e cega: a pessoa da frente e convocada mesmo que tenha conflito de horario ou ja esteja no limite de minicursos. Ninguem e pulado nem expirado antecipadamente. Origem: P-12. Fonte: RN-211 e RN-214.
- R9. Confirmacao de convocacao revalida conflito de horario e limite de minicursos. Se uma dessas regras falhar, retorna o respectivo erro e preserva a inscricao `convocada`, mantendo a vaga presa ate o prazo; nova tentativa dentro do prazo e permitida. Se ambas falharem, `409 CONFLITO_DE_HORARIO` prevalece sobre `422 LIMITE_DE_MINICURSOS`. Origem: P-05 e P-15. Fonte: RN-214 e RN-208; a precedencia entre as duas e decisao do usuario registrada em P-15.
- R10. `CONFLITO_DE_HORARIO` so e verificado quando a inscricao ocupa vaga. Comparam-se os encontros da nova atividade com encontros de inscricoes do mesmo participante em status `confirmada` ou `convocada`; `em_espera` nao entra. Intervalos que apenas encostam nao conflitam: fim em `12:00:00` e inicio em `12:00:00` podem coexistir. Origem: P-06. Fonte: RN-206.
- R11. O limite e de 3 minicursos ocupando vaga por participante. Contam inscricoes `confirmada` ou `convocada` de minicursos; palestras, inscricoes `em_espera`, canceladas e expiradas nao contam. A verificacao ocorre na inscricao direta e na confirmacao; uma quarta inscricao pode ser convocada, mas sua confirmacao retorna `422 LIMITE_DE_MINICURSOS` ate que outra vaga seja liberada. Origem: P-07. Fonte: RN-207 e RN-214.
- R12. Na nova inscricao, depois das verificacoes gerais, a ordem e: atividade inexistente (`404`), atividade cancelada (`422 ATIVIDADE_CANCELADA`), inscricoes encerradas (`422 INSCRICOES_ENCERRADAS`), inscricao ativa (`409 JA_INSCRITO`), conflito (`409 CONFLITO_DE_HORARIO`) e limite (`422 LIMITE_DE_MINICURSOS`). Conflito e limite so sao verificados quando a inscricao ocupar vaga. `INSCRICAO_BLOQUEADA` nao faz parte do M2. Origem: P-08 e P-11. Fonte: RN-208, RN-206 e RN-207; a exclusao do bloqueio e decisao do usuario registrada em P-08.
- R13. Ao confirmar uma inscricao `convocada`, o status vira `confirmada`, `criadaEm` preserva o instante original e `posicaoNaEspera` e `convocadaAte` passam a `null`. Origem: P-22. Fonte: contrato-api.md, modelo `Inscricao`.
- R14. Confirmar uma inscricao de atividade cancelada retorna `422 ATIVIDADE_CANCELADA`. Uma convocacao valida nao alcança o inicio da atividade, pois vence no fechamento; depois do vencimento, confirmar retorna `422 CONVOCACAO_EXPIRADA`, e uma inscricao que nunca foi convocada retorna `422 SEM_CONVOCACAO`. Origem: P-05 e P-20. Fonte: RN-212 e RN-215; a precedencia de atividade cancelada e decisao do usuario registrada em P-20.
- R15. A ordem das consultas e decrescente por `criadaEm`, da mais recente para a mais antiga, com desempate pelo `id`; a mesma ordem vale com `atividadeId`. Participante so consulta as proprias inscricoes; detalhe de inscricao alheia retorna `404` sem revelar existencia. Organizacao lista todas, mas nao cancela nem confirma inscricao de outra pessoa. Origem: P-09. Fonte: RN-218 e RN-219; a ordenacao e decisao do usuario.
- R16. A reconciliacao materializa, com base no relogio controlado, vencimentos, expiracoes, convocacoes atrasadas, fechamento e situacao da atividade. Ela ocorre em toda rota que leia ou altere inscricoes ou atividades: rotas M2, leituras de atividade do M1 e registro de presenca do M3. O resultado e idempotente, independe da primeira rota acessada depois de um salto do relogio e nao usa temporizador. Origem: P-16 e P-21. Fonte: RN-213 para a exigencia temporal; a abrangencia e idempotencia sao decisoes do usuario registradas em P-21.
- R17. Toda regra temporal usa o relogio controlado, nunca a hora do sistema. Identificadores, datas ISO 8601, status e campos retornados respeitam o modelo do contrato. Origem: P-01, P-05, P-16, P-21 e P-22. Fonte: contrato-api.md, secoes 1, 3 e modelo `Inscricao`.

## 6. Criterios de aceite

1. (R1, R17) Para atividade cujo primeiro encontro inicia em `2026-10-20T19:00:00-03:00`, com o relogio em `2026-10-20T18:29:59-03:00` `POST /atividades/:id/inscricoes` retorna `201`; em `2026-10-20T18:30:00-03:00` retorna `422 INSCRICOES_ENCERRADAS`.
2. (R2, R17) Com o relogio em `2026-10-20T18:00:00-03:00`, uma atividade com uma vaga livre cria inscricao `confirmada`; outra com a lotacao ocupada cria `em_espera` e, em `GET /inscricoes`, retorna `posicaoNaEspera: 1`.
3. (R3, R17) Com o relogio em `2026-10-20T18:01:00-03:00`, nova tentativa enquanto a inscricao esta `confirmada`, `em_espera` ou `convocada` retorna `409 JA_INSCRITO`; depois de cancelada em `2026-10-20T18:02:00-03:00`, nova inscricao em `2026-10-20T18:03:00-03:00` e aceita e fica depois da fila existente.
4. (R4, R17) Para primeiro encontro em `2026-10-20T19:00:00-03:00`, cancelar inscricao em `2026-10-20T18:59:59-03:00` retorna `200`; em `2026-10-20T19:00:00-03:00` retorna `422 ATIVIDADE_JA_INICIADA`, inclusive se ela ja estiver `cancelada` ou `expirada`.
5. (R5, R6, R17) Com duas inscricoes em espera criadas em `2026-10-20T18:01:00-03:00` e `2026-10-20T18:02:00-03:00`, cancelar a confirmada em `2026-10-20T18:03:00-03:00` convoca a primeira; cancelar a segunda da fila em `2026-10-20T18:04:00-03:00` nao convoca a seguinte e a consulta recalcula a posicao.
6. (R6, R17) Com fechamento em `2026-10-20T18:30:00-03:00`, aumentar em tres vagas uma atividade com tres pessoas em espera no instante `2026-10-20T18:29:00-03:00` cria tres convocacoes na propria resposta; o mesmo aumento em `2026-10-20T18:30:00-03:00` nao cria convocacao nova.
7. (R7, R17) Com fechamento em `2026-10-20T18:30:00-03:00`, uma convocacao criada em `2026-10-20T16:00:00-03:00` recebe `convocadaAte` `2026-10-20T18:00:00-03:00`; confirmacao nesse instante retorna `200`, e em `2026-10-20T18:00:01-03:00` a consulta mostra `expirada` e a proxima pessoa convocada.
8. (R7, R14, R16, R17) Com uma convocacao vencendo em `2026-10-20T18:00:00-03:00`, avancar diretamente o relogio para `2026-10-20T18:05:00-03:00` e fazer uma leitura materializa a expiracao e a proxima convocacao; repetir a mesma leitura em `2026-10-20T18:05:00-03:00` nao cria uma segunda convocacao.
9. (R8, R9, R17) Com o relogio em `2026-10-20T17:00:00-03:00`, a primeira pessoa da fila e convocada mesmo tendo conflito; confirmar em `2026-10-20T17:01:00-03:00` retorna `409 CONFLITO_DE_HORARIO` e preserva `status: convocada`; corrigida a causa em `2026-10-20T17:02:00-03:00`, nova confirmacao dentro do prazo retorna `200`.
10. (R10, R17) Com o relogio em `2026-10-20T17:00:00-03:00`, inscricao para atividade cujo encontro termina em `12:00:00` e outra inicia em `12:00:00` e aceita; se houver sobreposicao em `11:59:59`, retorna `409 CONFLITO_DE_HORARIO`.
11. (R11, R17) Com o relogio em `2026-10-20T17:00:00-03:00`, participante com tres minicursos ocupando vaga pode ser convocado para o quarto, mas sua confirmacao retorna `422 LIMITE_DE_MINICURSOS`; uma palestra e uma inscricao `em_espera` nao alteram esse resultado.
12. (R12, R17) Com o relogio em `2026-10-20T18:30:00-03:00`, atividade inexistente retorna `404`; atividade cancelada retorna `422 ATIVIDADE_CANCELADA`; atividade prevista mas fechada retorna `422 INSCRICOES_ENCERRADAS`; uma inscricao ativa retorna `409 JA_INSCRITO` antes de conflito ou limite.
13. (R13, R17) Convocacao criada em `2026-10-20T16:00:00-03:00` e confirmada em `2026-10-20T17:00:00-03:00` retorna `status: confirmada`, preserva `criadaEm: 2026-10-20T16:00:00-03:00` e retorna `posicaoNaEspera: null` e `convocadaAte: null`.
14. (R14, R17) Com o relogio em `2026-10-20T17:00:00-03:00`, confirmar convocacao de atividade cancelada retorna `422 ATIVIDADE_CANCELADA`; confirmar inscricao `expirada` em `2026-10-20T18:01:00-03:00` retorna `422 CONVOCACAO_EXPIRADA`; confirmar inscricao `em_espera` retorna `422 SEM_CONVOCACAO`.
15. (R15, R17) Criadas inscricoes nos instantes `2026-10-20T17:00:00-03:00` e `2026-10-20T17:01:00-03:00`, `GET /inscricoes` retorna a de `17:01:00` antes da de `17:00:00`, inclusive com `?atividadeId=`; participante alheio recebe `404` no detalhe, enquanto organizacao lista ambas e nao consegue operar por outra pessoa.
16. (R16, R17) Com o relogio em `2026-10-20T17:00:00-03:00`, uma leitura de atividade, uma leitura M2 e um registro M3 feitos como primeira rota apos o salto para `2026-10-20T18:05:00-03:00` produzem o mesmo estado reconciliado de expiracao, fila e situacao da atividade.
17. (R17) Com o relogio controlado em `2026-10-20T17:00:00-03:00`, a inscricao retornada contem `id` no formato `ins_` mais 8 hexadecimais minusculos, datas ISO 8601 e somente `posicaoNaEspera` ou `convocadaAte` aplicavel ao status.

## 7. Como isto sera verificado

Os testes devem verificar a API pela costura HTTP exposta pelo servidor da aplicacao, preferencialmente usando `criarServidor()` se esta for a costura existente do projeto. Essa costura cobre rotas, papeis, status HTTP, corpo JSON, codigos de erro, visibilidade, transicoes, fila e ordenacao observaveis de fora. As regras temporais devem usar `POST /_teste/reset`, `PUT /_teste/relogio` e `GET /_teste/relogio`; nunca devem usar a hora real do sistema. A reconciliacao deve ser exercitada alternando as rotas M2, leituras de atividade do M1 e registro de presenca do M3.

## 8. Fatias de entrega

1. Modelo, identificacao, contrato HTTP e inscricao direta: R1-R3, R10-R12 e R17, cobrindo corpo vazio, atividade inexistente ou cancelada, fechamento, duplicidade, confirmacao imediata, espera, conflito, limite e ordem de recusas.
2. Cancelamento e liberacao de vagas: R4-R6, cobrindo cancelamento ativo, precedencia no inicio, cancelamento de espera, cancelamento da atividade, convocacao por cancelamento e aumento de vagas.
3. Convocacao e confirmacao: R7-R9, R11, R13-R14, cobrindo prazo de 2 horas, truncamento, vencimento, cadeia, convocacao cega, revalidacao, limite, conflito e limpeza dos campos.
4. Reconciliacao da fila: R7, R8, R14 e R16, tratando como fatia propria a materializacao por salto do relogio, cadeia de expiracoes, fechamento, idempotencia e equivalencia entre rotas M1, M2 e M3.
5. Consultas e visibilidade: R15 e R17, cobrindo filtro por atividade, ordenacao deterministica, detalhe alheio, visibilidade da organizacao e forma dos campos retornados.
