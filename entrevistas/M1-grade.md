# Entrevista M1 - Grade de atividades

## Escopo da sessao

- Modulo: M1 - Grade de atividades.
- Fonte fixa lida: `contrato-api.md`.
- Nao implementar codigo nesta sessao.
- Nao escrever spec nesta sessao.
- Quando a resposta for "consultar requisitos", registrar a pergunta como PENDENTE.
- Recomendacoes feitas pelo agente em conversa nao sao respostas do usuario e nao sao decisoes.
- A entrevista deve seguir uma pergunta por vez.
- Regras respondidas diretamente pelo `contrato-api.md` devem ser registradas com fonte, sem perguntar ao usuario.

## Fatos do contrato-api.md

- Rotas M1:
  - `GET /salas` para todos, sucesso `200 [Sala]`.
  - `GET /atividades` para todos, sucesso `200 [Atividade]`, filtros `?dia=AAAA-MM-DD` e `?tipo=palestra|minicurso`.
  - `GET /atividades/:id` para todos, sucesso `200 Atividade`.
  - `POST /atividades` para organizacao, sucesso `201 Atividade`.
  - `PATCH /atividades/:id` para organizacao, sucesso `200 Atividade`.
  - `POST /atividades/:id/cancelamento` para organizacao, sucesso `200 Atividade`.
- Permissoes resolvidas pelo contrato: somente usuarios com papel `organizacao` podem criar, alterar e cancelar atividades. Fonte: `contrato-api.md`, linhas 85-92.
- Campos de entrada de atividade: `titulo`, `tipo`, `salaId`, `vagas`, `encontros`.
- `PATCH /atividades/:id` recebe qualquer subconjunto desses campos.
- `Atividade` responde `id`, `titulo`, `tipo`, `salaId`, `vagas`, `encontros`, `cargaHorariaMinutos`, `situacao`, `ocupadas`, `vagasRestantes`, `emEspera`.
- `situacao` calculada: `prevista`, `em_andamento`, `encerrada`, `cancelada`.
- `cargaHorariaMinutos`, `ocupadas`, `vagasRestantes` e `emEspera` sao calculados.
- `encontros` devem sair em ordem de inicio.
- Salas iniciais: `auditorio` capacidade 200, `sala-101` capacidade 40, `sala-102` capacidade 40, `lab-3` capacidade 20.
- Evento: Semana Academica 2026, de 19/10/2026 a 23/10/2026, horario de Brasilia.
- Codigos M1 no contrato: `QUANTIDADE_DE_ENCONTROS`, `ENCONTRO_INVALIDO`, `VAGAS_ACIMA_DA_CAPACIDADE`, `CONFLITO_DE_SALA`, `CAMPO_NAO_EDITAVEL`, `VAGAS_ABAIXO_DOS_INSCRITOS`, `ATIVIDADE_JA_INICIADA`, `ATIVIDADE_CANCELADA`.
- Ordem geral de verificacoes: identificacao, perfil, existencia, corpo, regras do recurso. A ordem entre regras do recurso e regra de negocio.

## Entrevista

Status: Rodada 1 encerrada e confirmada.

### P1 - Quantidade de encontros

- Pergunta: Quantos encontros uma atividade pode ter? Existe minimo, maximo, e isso muda por `tipo` (`palestra` vs `minicurso`)?
- Resposta: Palestra deve ter exatamente 1 encontro. Minicurso deve ter de 2 a 5 encontros.
- Fonte: RN-102 e RN-103.
- Status: RESPONDIDA.

### P2 - Encontro invalido

- Pergunta: O que torna um encontro invalido para `ENCONTRO_INVALIDO`? Considere pelo menos: `fim <= inicio`, encontro fora da semana do evento, duracao minima ou maxima, atravessar meia-noite, sobrepor outro encontro da mesma atividade, e receber encontros fora de ordem no corpo.
- Resposta: Um encontro e invalido quando dura menos de 1 hora ou mais de 4 horas; quando comeca e termina em dias diferentes; quando fica fora do periodo do evento, de 19 a 23/10/2026; ou quando se sobrepoe a outro encontro da mesma atividade. Se o fim for igual ou anterior ao inicio, tambem e invalido por nao formar uma duracao valida. A ordem em que os encontros sao enviados nao e indicada como motivo de erro; eles devem ser retornados ordenados pelo inicio.
- Fonte: RN-104, RN-105 e RN-106.
- Status: RESPONDIDA.

### P3 - Vagas

- Pergunta: Quais valores de `vagas` sao validos? Pode ser zero? Precisa ser inteiro positivo? Quando exatamente retorna `VAGAS_ACIMA_DA_CAPACIDADE`?
- Resposta: As vagas devem ser no minimo 1 e no maximo a capacidade da sala. Portanto, zero nao e valido. Se o valor ultrapassar a capacidade da sala escolhida, deve retornar `VAGAS_ACIMA_DA_CAPACIDADE`.
- Fonte: RN-107.
- Status: RESPONDIDA.

### P4 - Conflito de sala

- Pergunta: Quando existe `CONFLITO_DE_SALA`? O conflito e apenas por sobreposicao de horarios na mesma sala, ou existe intervalo minimo/tolerancia entre atividades?
- Resposta: Existe conflito quando dois encontros usam a mesma sala e nao existe pelo menos 15 minutos entre o fim de um encontro e o inicio do seguinte. Encontros de atividades canceladas nao contam para esse conflito. Assim, se um encontro termina as 10:00, outro na mesma sala so pode comecar as 10:15 ou depois.
- Fonte: RN-108.
- Status: RESPONDIDA.

### P5 - Listagem e filtros

- Resolvido pelo contrato: `GET /atividades` retorna `200 [Atividade]` e aceita filtros `?dia=AAAA-MM-DD` e `?tipo=palestra|minicurso`. Fonte: `contrato-api.md`, linhas 87-89.
- Pergunta: Qual deve ser a ordenacao de `GET /atividades`? Atividades canceladas aparecem na listagem? O filtro `dia` inclui a atividade quando qualquer encontro cai naquele dia? Se `dia` ou `tipo` forem invalidos, retorna lista vazia ou `422 DADOS_INVALIDOS`?
- Resposta: A listagem deve ser ordenada pelo inicio do primeiro encontro e, em caso de empate, pelo titulo. Atividades canceladas continuam aparecendo. O filtro por dia deve trazer atividades que tenham pelo menos um encontro naquele dia, considerando o horario de Brasilia, e pode ser combinado com o filtro por tipo. O documento de requisitos nao define o comportamento para valores invalidos de dia ou tipo; essa parte deve permanecer como duvida ou ser resolvida apenas se o `contrato-api.md` definir explicitamente.
- Fonte: RN-115 e RN-116.
- Status: PENDENTE.

### P6 - Situacao calculada

- Resolvido pelo contrato: `situacao` e calculada e pode ser `prevista`, `em_andamento`, `encerrada` ou `cancelada`. Fonte: `contrato-api.md`, linhas 118-120.
- Pergunta: Como calcular `situacao` usando o relogio controlado? Em qual instante vira `em_andamento` e `encerrada`, especialmente para atividades com multiplos encontros e intervalos entre eles?
- Resposta: A situacao e calculada pelo relogio. Antes do inicio do primeiro encontro, a atividade fica como `prevista`. No instante exato em que comeca o primeiro encontro, passa para `em_andamento` e permanece assim durante toda a atividade, inclusive nos intervalos entre encontros. No instante exato do fim do ultimo encontro, passa para `encerrada`. Se a atividade estiver cancelada, `cancelada` prevalece sobre qualquer situacao calculada pelo horario.
- Fonte: RN-114.
- Status: RESPONDIDA.

### P7 - Campos editaveis

- Resolvido pelo contrato: `PATCH /atividades/:id` recebe qualquer subconjunto dos campos de entrada `titulo`, `tipo`, `salaId`, `vagas`, `encontros`. Fonte: `contrato-api.md`, linhas 95-107.
- Pergunta: Em `PATCH /atividades/:id`, quais desses campos podem ser alterados e quais devem gerar `CAMPO_NAO_EDITAVEL`?
- Resposta: Depois de criada, a atividade so permite alterar o titulo e a quantidade de vagas. Os campos `tipo`, `salaId` e `encontros` nao podem ser alterados e devem gerar `CAMPO_NAO_EDITAVEL` se forem enviados para modificacao.
- Fonte: RN-110.
- Status: RESPONDIDA.

### P8 - Alteracao por situacao da atividade

- Resolvido pelo contrato: `ATIVIDADE_CANCELADA` aparece em alterar atividade; `ATIVIDADE_JA_INICIADA` nao aparece em alterar atividade na tabela de codigos. Fonte: `contrato-api.md`, linhas 272-274.
- Pergunta: Quais alteracoes sao permitidas ou proibidas conforme a atividade esteja `prevista`, `em_andamento`, `encerrada` ou `cancelada`? Para os casos proibidos em `PATCH`, qual codigo do contrato deve ser usado?
- Resposta: Atividades previstas, em andamento ou encerradas continuam sujeitas a regra geral de edicao: somente titulo e vagas podem ser alterados. `tipo`, `salaId` e `encontros` nao podem ser alterados e geram `CAMPO_NAO_EDITAVEL`. Atividades canceladas nao podem mais ser alteradas e devem retornar `ATIVIDADE_CANCELADA`. A reducao de vagas tambem continua limitada pela quantidade de inscricoes que ocupam vaga.
- Fonte: RN-110, RN-111 e RN-113.
- Status: RESPONDIDA.

### P9 - Vagas abaixo dos inscritos

- Resolvido pelo contrato: `VAGAS_ABAIXO_DOS_INSCRITOS` aparece em alterar atividade. Fonte: `contrato-api.md`, linhas 271-272.
- Pergunta: Para `VAGAS_ABAIXO_DOS_INSCRITOS`, quais inscricoes contam como inscritos? So confirmadas? Convocadas contam? Inscricoes em espera contam?
- Resposta: Contam como inscricoes que ocupam vaga as que estao com status `confirmada` ou `convocada`. Inscricoes em espera nao contam para esse limite. Portanto, as vagas nao podem ser reduzidas para um valor menor que a quantidade de confirmadas + convocadas.
- Fonte: RN-111.
- Status: RESPONDIDA.

### P10 - Cancelamento de atividade

- Resolvido pelo contrato: `POST /atividades/:id/cancelamento` e rota de organizacao, retorna `200 Atividade`; `ATIVIDADE_JA_INICIADA` aparece em cancelar atividade; `ATIVIDADE_CANCELADA` aparece em cancelar atividade. Fonte: `contrato-api.md`, linhas 90-92 e 273-274.
- Pergunta: Quando uma atividade pode ser cancelada? O que acontece ao cancelar uma atividade ja cancelada? Como `ocupadas`, `vagasRestantes` e `emEspera` devem aparecer depois do cancelamento?
- Resposta: A atividade so pode ser cancelada antes de comecar. No instante em que o primeiro encontro comeca, o cancelamento ja deve ser recusado com `ATIVIDADE_JA_INICIADA`. Se a atividade ja estiver cancelada, um novo cancelamento deve retornar `ATIVIDADE_CANCELADA`, porque o cancelamento e definitivo. Ao cancelar a atividade, todas as inscricoes ativas dela sao canceladas. Com isso, `ocupadas` e `emEspera` deixam de considerar essas inscricoes ativas, e `vagasRestantes` passa a refletir novamente a quantidade de vagas disponiveis da atividade.
- Fonte: RN-112, RN-113 e RN-217.
- Status: RESPONDIDA.

### P11 - Ordem entre regras do recurso

- Resolvido pelo contrato: a ordem geral e identificacao, perfil, existencia, corpo, regras do recurso; quando mais de uma regra do recurso recusa a mesma operacao, a ordem entre elas e regra de negocio. Fonte: `contrato-api.md`, linhas 15-17.
- Pergunta: Em `POST /atividades`, `PATCH /atividades/:id` e `POST /atividades/:id/cancelamento`, qual e a ordem de precedencia entre as regras do recurso quando mais de uma falha ao mesmo tempo?
- Resposta: O documento de requisitos nao define uma ordem especifica de precedencia entre as regras de negocio do M1 quando mais de uma falha ao mesmo tempo. Ele define as regras RN-101 a RN-116, mas nao traz uma regra equivalente a RN-208 do M2 para ordenar esses erros. Portanto, esta pergunta deve permanecer como pendencia de esclarecimento, sem inventar uma ordem.
- Status: PENDENTE.

### P12 - Fora do escopo de M1

- Resolvido pelo contrato: nao ha rota para criar usuario ou sala; nao ha rota de remocao de atividade; nao ha rota para desfazer cancelamento. Fonte: `contrato-api.md`, linhas 55-57 e 83-92.
- Pergunta: Alem do que ja nao existe no contrato, ha algo que M1 deve declarar explicitamente como fora de escopo?
- Resposta: Alem do que ja nao existe no contrato, o documento declara como fora de escopo: login e senha, mais de um evento, pagamento, e-mail e notificacao push, certificado em PDF, alteracao de encontros e troca de sala, inscricao feita pela organizacao em nome de alguem, check-out e importacao de planilha. Para o M1, os pontos mais diretamente relacionados sao que nao ha alteracao de encontros nem troca de sala depois da criacao. Se necessario, os demais podem ficar registrados como fora de escopo geral do sistema.
- Fonte: Secao 7 - Fora de escopo do documento de requisitos.
- Status: RESPONDIDA.

### P13 - Carga horaria calculada

- Resolvido pelo contrato: `cargaHorariaMinutos` e campo calculado de `Atividade`. Fonte: `contrato-api.md`, linhas 115-122.
- Pergunta: Como calcular `cargaHorariaMinutos`? Deve ser a soma exata dos minutos de todos os encontros? Ha arredondamento, limite, ou tratamento especial para intervalos entre encontros?
- Resposta: `cargaHorariaMinutos` deve ser calculada pela soma exata da duracao, em minutos, de todos os encontros da atividade. Nao ha arredondamento, limite adicional nem soma dos intervalos entre encontros. A organizacao nao informa esse valor; se ele for enviado, deve ser ignorado.
- Fonte: RN-109.
- Status: RESPONDIDA.

### P14 - Contadores de ocupacao

- Resolvido pelo contrato: `ocupadas`, `vagasRestantes` e `emEspera` sao campos calculados de `Atividade`. Fonte: `contrato-api.md`, linhas 119-122.
- Pergunta: Quais inscricoes entram em `ocupadas`, quais entram em `emEspera`, e como calcular `vagasRestantes` em todos os status possiveis de inscricao?
- Resposta: `ocupadas` deve contar as inscricoes com status `confirmada` ou `convocada`, pois sao as que ocupam vaga. `emEspera` deve contar apenas as inscricoes com status `em_espera`. Inscricoes canceladas ou expiradas nao entram nesses contadores. `vagasRestantes` e calculado como `vagas - ocupadas`. Assim, inscricoes em espera nao reduzem `vagasRestantes`. Se a atividade for cancelada, as inscricoes ativas tambem sao canceladas e deixam de contar nesses valores.
- Fonte: RN-111, RN-205 e RN-217.
- Status: RESPONDIDA.

### P15 - Sala inexistente em atividade

- Resolvido pelo contrato: existencia e verificada antes do corpo e antes das regras do recurso; `NAO_ENCONTRADO` e o codigo para recurso inexistente. Fonte: `contrato-api.md`, linhas 15-17 e 263-265.
- Pergunta: Em `POST /atividades` e `PATCH /atividades/:id`, se `salaId` aponta para uma sala inexistente, deve retornar `NAO_ENCONTRADO` ou `DADOS_INVALIDOS`?
- Resposta: O documento de requisitos nao define qual codigo deve ser usado quando `salaId` referencia uma sala inexistente. Nao ha RN-xxx especifica para esse caso. Se o `contrato-api.md` nao definir explicitamente esse comportamento, a pergunta deve permanecer como pendencia de esclarecimento.
- Status: PENDENTE.

### P16 - Valores invalidos dos campos

- Resolvido pelo contrato: corpo que nao e JSON, campo obrigatorio ausente ou de tipo errado retorna `422 DADOS_INVALIDOS`; `tipo` no contrato e `palestra` ou `minicurso`. Fonte: `contrato-api.md`, linhas 15, 95-104 e 108-123.
- Pergunta: Quais valores semanticamente invalidos tambem retornam `DADOS_INVALIDOS` em `POST` e `PATCH`? Por exemplo: `titulo` vazio, `tipo` fora de `palestra|minicurso`, `encontros` vazio, campos extras, strings com espacos, datas ISO sem fuso, ou `PATCH` com corpo vazio.
- Resposta: O documento de requisitos nao acrescenta uma regra especifica para esses valores semanticamente invalidos. O que ja estiver definido pelo `contrato-api.md` deve ser seguido, como corpo invalido, campo obrigatorio ausente, tipo incorreto e valores fora dos formatos/enumeracoes definidos pelo contrato. Casos nao definidos explicitamente no contrato, como titulo vazio, campos extras, strings so com espacos, datas sem fuso ou `PATCH` vazio, devem permanecer como pendencia de esclarecimento e nao devem ser inventados. Para encontros, violacoes de quantidade ou das regras de horario devem usar os codigos especificos do M1, como `QUANTIDADE_DE_ENCONTROS` ou `ENCONTRO_INVALIDO`, e nao `DADOS_INVALIDOS`.
- Status: PENDENTE.

## Resumo da Rodada 1

1. O contrato fixa as rotas de M1: listar salas, listar atividades, obter atividade, criar atividade, alterar atividade e cancelar atividade.
2. O contrato fixa que criar, alterar e cancelar atividades sao acoes exclusivas de usuarios com papel `organizacao`.
3. O contrato fixa os campos de entrada de atividade: `titulo`, `tipo`, `salaId`, `vagas` e `encontros`.
4. O contrato fixa que `PATCH /atividades/:id` recebe qualquer subconjunto dos campos de entrada, mas nao define quais campos sao editaveis; P7 fica PENDENTE.
5. O contrato fixa os campos de saida de `Atividade`, incluindo campos calculados e encontros em ordem de inicio.
6. O contrato fixa os valores possiveis de `situacao`, mas nao define a regra temporal de calculo; P6 fica PENDENTE.
7. O contrato fixa os filtros `dia` e `tipo` em `GET /atividades`, mas nao define ordenacao, inclusao de canceladas nem comportamento para filtros invalidos; P5 fica PENDENTE.
8. O contrato fixa a ordem geral de validacao: identificacao, perfil, existencia, corpo e regras do recurso; a precedencia entre regras do recurso nao esta definida; P11 fica PENDENTE.
9. As regras de quantidade de encontros, encontro invalido, vagas, conflito de sala, alteracao por situacao, vagas abaixo dos inscritos, cancelamento, carga horaria, contadores, sala inexistente em entrada e valores semanticamente invalidos dependem de requisitos externos ao contrato; P1, P2, P3, P4, P8, P9, P10, P13, P14, P15 e P16 ficam PENDENTES.
10. O contrato tambem resolve que nao ha rota para criar usuario ou sala, remover atividade ou desfazer cancelamento; qualquer outro limite de escopo de M1 fica PENDENTE em P12.

## Confirmacao

- Usuario confirmou o encerramento da Rodada 1.

## Resumo da Rodada 2

1. P1 foi respondida: palestra deve ter exatamente 1 encontro; minicurso deve ter de 2 a 5 encontros. Fonte: RN-102 e RN-103.
2. P2 foi respondida: encontro invalido inclui duracao menor que 1 hora ou maior que 4 horas, inicio e fim em dias diferentes, encontro fora de 19 a 23/10/2026, sobreposicao com outro encontro da mesma atividade, ou fim igual/anterior ao inicio; a ordem de envio nao e motivo de erro e os encontros devem ser retornados ordenados pelo inicio. Fonte: RN-104, RN-105 e RN-106.
3. P3 foi respondida: `vagas` deve ser no minimo 1 e no maximo a capacidade da sala; acima da capacidade retorna `VAGAS_ACIMA_DA_CAPACIDADE`. Fonte: RN-107.
4. P4 foi respondida: existe `CONFLITO_DE_SALA` quando encontros na mesma sala nao respeitam intervalo minimo de 15 minutos; atividades canceladas nao contam para o conflito. Fonte: RN-108.
5. P5 foi parcialmente respondida: listagem ordena pelo inicio do primeiro encontro e depois por titulo; atividades canceladas aparecem; filtro por dia inclui atividades com pelo menos um encontro no dia em horario de Brasilia e pode combinar com tipo. Fonte: RN-115 e RN-116. O comportamento para valores invalidos de `dia` ou `tipo` continua pendente.
6. P6 foi respondida: `situacao` e calculada pelo relogio; antes do primeiro encontro e `prevista`, no inicio do primeiro encontro vira `em_andamento`, permanece assim inclusive nos intervalos, no fim do ultimo encontro vira `encerrada`, e `cancelada` prevalece sobre o calculo temporal. Fonte: RN-114.
7. P7 foi respondida: depois da criacao, apenas `titulo` e `vagas` podem ser alterados; `tipo`, `salaId` e `encontros` geram `CAMPO_NAO_EDITAVEL` se enviados para modificacao. Fonte: RN-110.
8. P8 foi respondida: atividades previstas, em andamento ou encerradas seguem a regra geral de edicao; atividades canceladas nao podem ser alteradas e retornam `ATIVIDADE_CANCELADA`; reducao de vagas continua limitada pelas inscricoes que ocupam vaga. Fonte: RN-110, RN-111 e RN-113.
9. P9 foi respondida: para `VAGAS_ABAIXO_DOS_INSCRITOS`, contam inscricoes `confirmada` ou `convocada`; `em_espera` nao conta. Fonte: RN-111.
10. P10 foi respondida: atividade so pode ser cancelada antes de comecar; no inicio do primeiro encontro ja retorna `ATIVIDADE_JA_INICIADA`; novo cancelamento retorna `ATIVIDADE_CANCELADA`; ao cancelar, inscricoes ativas sao canceladas e deixam de contar nos contadores. Fonte: RN-112, RN-113 e RN-217.
11. P12 foi respondida: alem do contrato, ficam fora de escopo login e senha, mais de um evento, pagamento, e-mail e notificacao push, certificado em PDF, alteracao de encontros e troca de sala, inscricao pela organizacao em nome de alguem, check-out e importacao de planilha; para M1, destacam-se alteracao de encontros e troca de sala depois da criacao. Fonte: Secao 7 - Fora de escopo do documento de requisitos.
12. P13 foi respondida: `cargaHorariaMinutos` e a soma exata, em minutos, da duracao de todos os encontros; nao ha arredondamento, limite adicional nem soma de intervalos; valor enviado pela organizacao deve ser ignorado. Fonte: RN-109.
13. P14 foi respondida: `ocupadas` conta `confirmada` e `convocada`; `emEspera` conta `em_espera`; canceladas ou expiradas nao entram; `vagasRestantes` e `vagas - ocupadas`; cancelamento da atividade cancela inscricoes ativas e elas deixam de contar. Fonte: RN-111, RN-205 e RN-217.
14. Continuam PENDENTES: P5 quanto ao comportamento para valores invalidos de `dia` ou `tipo`; P11 quanto a ordem de precedencia entre regras de negocio do M1 quando mais de uma falha ao mesmo tempo; P15 quanto ao codigo para `salaId` inexistente em `POST /atividades` e `PATCH /atividades/:id`; P16 quanto a valores semanticamente invalidos nao definidos explicitamente no contrato, como titulo vazio, campos extras, strings so com espacos, datas sem fuso ou `PATCH` vazio.
15. Nenhuma decisao foi inventada para as pendencias: onde o documento de requisitos ou o `contrato-api.md` nao definiram comportamento, a pergunta permaneceu pendente.

## Confirmacao da Rodada 2

- Rodada 2 encerrada conforme solicitado pelo usuario.
