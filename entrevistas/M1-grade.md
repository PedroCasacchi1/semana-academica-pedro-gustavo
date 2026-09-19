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
- Resposta: consultar requisitos.
- Status: PENDENTE.

### P2 - Encontro invalido

- Pergunta: O que torna um encontro invalido para `ENCONTRO_INVALIDO`? Considere pelo menos: `fim <= inicio`, encontro fora da semana do evento, duracao minima ou maxima, atravessar meia-noite, sobrepor outro encontro da mesma atividade, e receber encontros fora de ordem no corpo.
- Resposta: consultar requisitos.
- Status: PENDENTE.

### P3 - Vagas

- Pergunta: Quais valores de `vagas` sao validos? Pode ser zero? Precisa ser inteiro positivo? Quando exatamente retorna `VAGAS_ACIMA_DA_CAPACIDADE`?
- Resposta: consultar requisitos.
- Status: PENDENTE.

### P4 - Conflito de sala

- Pergunta: Quando existe `CONFLITO_DE_SALA`? O conflito e apenas por sobreposicao de horarios na mesma sala, ou existe intervalo minimo/tolerancia entre atividades?
- Resposta: consultar requisitos.
- Status: PENDENTE.

### P5 - Listagem e filtros

- Resolvido pelo contrato: `GET /atividades` retorna `200 [Atividade]` e aceita filtros `?dia=AAAA-MM-DD` e `?tipo=palestra|minicurso`. Fonte: `contrato-api.md`, linhas 87-89.
- Pergunta: Qual deve ser a ordenacao de `GET /atividades`? Atividades canceladas aparecem na listagem? O filtro `dia` inclui a atividade quando qualquer encontro cai naquele dia? Se `dia` ou `tipo` forem invalidos, retorna lista vazia ou `422 DADOS_INVALIDOS`?
- Resposta: consultar requisitos.
- Status: PENDENTE.

### P6 - Situacao calculada

- Resolvido pelo contrato: `situacao` e calculada e pode ser `prevista`, `em_andamento`, `encerrada` ou `cancelada`. Fonte: `contrato-api.md`, linhas 118-120.
- Pergunta: Como calcular `situacao` usando o relogio controlado? Em qual instante vira `em_andamento` e `encerrada`, especialmente para atividades com multiplos encontros e intervalos entre eles?
- Resposta: consultar requisitos.
- Status: PENDENTE.

### P7 - Campos editaveis

- Resolvido pelo contrato: `PATCH /atividades/:id` recebe qualquer subconjunto dos campos de entrada `titulo`, `tipo`, `salaId`, `vagas`, `encontros`. Fonte: `contrato-api.md`, linhas 95-107.
- Pergunta: Em `PATCH /atividades/:id`, quais desses campos podem ser alterados e quais devem gerar `CAMPO_NAO_EDITAVEL`?
- Resposta: consultar requisitos.
- Status: PENDENTE.

### P8 - Alteracao por situacao da atividade

- Resolvido pelo contrato: `ATIVIDADE_CANCELADA` aparece em alterar atividade; `ATIVIDADE_JA_INICIADA` nao aparece em alterar atividade na tabela de codigos. Fonte: `contrato-api.md`, linhas 272-274.
- Pergunta: Quais alteracoes sao permitidas ou proibidas conforme a atividade esteja `prevista`, `em_andamento`, `encerrada` ou `cancelada`? Para os casos proibidos em `PATCH`, qual codigo do contrato deve ser usado?
- Resposta: consultar requisitos.
- Status: PENDENTE.

### P9 - Vagas abaixo dos inscritos

- Resolvido pelo contrato: `VAGAS_ABAIXO_DOS_INSCRITOS` aparece em alterar atividade. Fonte: `contrato-api.md`, linhas 271-272.
- Pergunta: Para `VAGAS_ABAIXO_DOS_INSCRITOS`, quais inscricoes contam como inscritos? So confirmadas? Convocadas contam? Inscricoes em espera contam?
- Resposta: consultar requisitos.
- Status: PENDENTE.

### P10 - Cancelamento de atividade

- Resolvido pelo contrato: `POST /atividades/:id/cancelamento` e rota de organizacao, retorna `200 Atividade`; `ATIVIDADE_JA_INICIADA` aparece em cancelar atividade; `ATIVIDADE_CANCELADA` aparece em cancelar atividade. Fonte: `contrato-api.md`, linhas 90-92 e 273-274.
- Pergunta: Quando uma atividade pode ser cancelada? O que acontece ao cancelar uma atividade ja cancelada? Como `ocupadas`, `vagasRestantes` e `emEspera` devem aparecer depois do cancelamento?
- Resposta: consultar requisitos.
- Status: PENDENTE.

### P11 - Ordem entre regras do recurso

- Resolvido pelo contrato: a ordem geral e identificacao, perfil, existencia, corpo, regras do recurso; quando mais de uma regra do recurso recusa a mesma operacao, a ordem entre elas e regra de negocio. Fonte: `contrato-api.md`, linhas 15-17.
- Pergunta: Em `POST /atividades`, `PATCH /atividades/:id` e `POST /atividades/:id/cancelamento`, qual e a ordem de precedencia entre as regras do recurso quando mais de uma falha ao mesmo tempo?
- Resposta: consultar requisitos.
- Status: PENDENTE.

### P12 - Fora do escopo de M1

- Resolvido pelo contrato: nao ha rota para criar usuario ou sala; nao ha rota de remocao de atividade; nao ha rota para desfazer cancelamento. Fonte: `contrato-api.md`, linhas 55-57 e 83-92.
- Pergunta: Alem do que ja nao existe no contrato, ha algo que M1 deve declarar explicitamente como fora de escopo?
- Resposta: consultar requisitos.
- Status: PENDENTE.

### P13 - Carga horaria calculada

- Resolvido pelo contrato: `cargaHorariaMinutos` e campo calculado de `Atividade`. Fonte: `contrato-api.md`, linhas 115-122.
- Pergunta: Como calcular `cargaHorariaMinutos`? Deve ser a soma exata dos minutos de todos os encontros? Ha arredondamento, limite, ou tratamento especial para intervalos entre encontros?
- Resposta: consultar requisitos.
- Status: PENDENTE.

### P14 - Contadores de ocupacao

- Resolvido pelo contrato: `ocupadas`, `vagasRestantes` e `emEspera` sao campos calculados de `Atividade`. Fonte: `contrato-api.md`, linhas 119-122.
- Pergunta: Quais inscricoes entram em `ocupadas`, quais entram em `emEspera`, e como calcular `vagasRestantes` em todos os status possiveis de inscricao?
- Resposta: consultar requisitos.
- Status: PENDENTE.

### P15 - Sala inexistente em atividade

- Resolvido pelo contrato: existencia e verificada antes do corpo e antes das regras do recurso; `NAO_ENCONTRADO` e o codigo para recurso inexistente. Fonte: `contrato-api.md`, linhas 15-17 e 263-265.
- Pergunta: Em `POST /atividades` e `PATCH /atividades/:id`, se `salaId` aponta para uma sala inexistente, deve retornar `NAO_ENCONTRADO` ou `DADOS_INVALIDOS`?
- Resposta: consultar requisitos.
- Status: PENDENTE.

### P16 - Valores invalidos dos campos

- Resolvido pelo contrato: corpo que nao e JSON, campo obrigatorio ausente ou de tipo errado retorna `422 DADOS_INVALIDOS`; `tipo` no contrato e `palestra` ou `minicurso`. Fonte: `contrato-api.md`, linhas 15, 95-104 e 108-123.
- Pergunta: Quais valores semanticamente invalidos tambem retornam `DADOS_INVALIDOS` em `POST` e `PATCH`? Por exemplo: `titulo` vazio, `tipo` fora de `palestra|minicurso`, `encontros` vazio, campos extras, strings com espacos, datas ISO sem fuso, ou `PATCH` com corpo vazio.
- Resposta: consultar requisitos.
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
