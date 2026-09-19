# Spec - M1 Grade de atividades

## 1. Objetivo

Permitir que a organizacao publique, consulte, altere parcialmente e cancele a grade de atividades da Semana Academica 2026, mantendo horarios, salas, vagas e campos calculados consistentes para participantes e organizacao.

## 2. Fora de escopo

- Criar usuarios ou salas pela API; os dados iniciais sao fixos pelo contrato.
- Remover atividade.
- Desfazer cancelamento de atividade.
- Alterar encontros ou trocar sala depois da criacao da atividade.
- Login e senha.
- Mais de um evento.
- Pagamento.
- E-mail e notificacao push.
- Certificado em PDF.
- Inscricao feita pela organizacao em nome de participante.
- Check-out.
- Importacao de planilha.

## 3. Modelo

### Sala

- `id`: string, informado pelos dados iniciais.
- `nome`: string, informado pelos dados iniciais.
- `capacidade`: numero inteiro, informado pelos dados iniciais.

### Atividade

- `id`: string, gerado pela API.
- `titulo`: string, informado pela organizacao.
- `tipo`: string, informado pela organizacao; valores definidos pelo contrato: `palestra` ou `minicurso`.
- `salaId`: string, informado pela organizacao, referencia uma sala.
- `vagas`: numero inteiro, informado pela organizacao.
- `encontros`: lista de encontros informada pela organizacao; cada encontro recebe `id` gerado pela API e deve ser retornado em ordem de inicio.
- `cargaHorariaMinutos`: numero inteiro calculado pela API; nao e guardado como entrada da organizacao.
- `situacao`: string calculada pela API; valores definidos pelo contrato: `prevista`, `em_andamento`, `encerrada` ou `cancelada`.
- `ocupadas`: numero inteiro calculado pela API a partir das inscricoes.
- `vagasRestantes`: numero inteiro calculado pela API a partir de `vagas - ocupadas`.
- `emEspera`: numero inteiro calculado pela API a partir das inscricoes.

### Encontro

- `id`: string, gerado pela API.
- `inicio`: data-hora ISO 8601 com fuso, informada pela organizacao.
- `fim`: data-hora ISO 8601 com fuso, informada pela organizacao.

## 4. Endpoints

- `GET /salas`: retorna `200 [Sala]`.
- `GET /atividades`: retorna `200 [Atividade]`; aceita filtros `?dia=AAAA-MM-DD` e `?tipo=palestra|minicurso` conforme contrato.
- `GET /atividades/:id`: retorna `200 Atividade`.
- `POST /atividades`: rota de organizacao; recebe `titulo`, `tipo`, `salaId`, `vagas` e `encontros`; retorna `201 Atividade`.
- `PATCH /atividades/:id`: rota de organizacao; recebe qualquer subconjunto de `titulo`, `tipo`, `salaId`, `vagas` e `encontros`; retorna `200 Atividade`.
- `POST /atividades/:id/cancelamento`: rota de organizacao; retorna `200 Atividade`.

## 5. Regras

- R1. `palestra` deve ter exatamente 1 encontro; violacao em `POST /atividades` retorna `422 QUANTIDADE_DE_ENCONTROS`. Origem: P1. Fonte: RN-102.
- R2. `minicurso` deve ter de 2 a 5 encontros; violacao em `POST /atividades` retorna `422 QUANTIDADE_DE_ENCONTROS`. Origem: P1. Fonte: RN-103.
- R3. Um encontro e invalido quando dura menos de 1 hora, dura mais de 4 horas, tem `fim` igual ou anterior a `inicio`, comeca e termina em dias diferentes, fica fora do periodo de 19/10/2026 a 23/10/2026 ou se sobrepoe a outro encontro da mesma atividade; violacao em `POST /atividades` retorna `422 ENCONTRO_INVALIDO`. Origem: P2. Fonte: RN-104, RN-105 e RN-106.
- R4. A ordem dos encontros no corpo de entrada nao e motivo de erro; a resposta deve retornar `encontros` ordenados por `inicio`. Origem: P2. Fonte: RN-104, RN-105 e RN-106; contrato-api.md, linhas 115-116.
- R5. `vagas` deve ser no minimo 1 e no maximo a capacidade da sala escolhida. Origem: P3. Fonte: RN-107.
- R6. Quando `vagas` ultrapassa a capacidade da sala escolhida, `POST /atividades` ou `PATCH /atividades/:id` retorna `422 VAGAS_ACIMA_DA_CAPACIDADE`. Origem: P3. Fonte: RN-107; contrato-api.md, linhas 267-270.
- R7. Existe `CONFLITO_DE_SALA` quando dois encontros de atividades nao canceladas usam a mesma sala e nao ha pelo menos 15 minutos entre o fim de um encontro e o inicio do seguinte; violacao em `POST /atividades` retorna `409 CONFLITO_DE_SALA`. Origem: P4. Fonte: RN-108.
- R8. Atividades canceladas nao contam para conflito de sala. Origem: P4. Fonte: RN-108.
- R9. `GET /atividades` deve retornar atividades ordenadas pelo inicio do primeiro encontro e, em caso de empate, pelo `titulo`. Origem: P5. Fonte: RN-115.
- R10. Atividades canceladas permanecem na listagem de `GET /atividades`. Origem: P5. Fonte: RN-115.
- R11. O filtro `dia` de `GET /atividades` inclui atividades que tenham pelo menos um encontro naquele dia, considerando o horario de Brasilia. Origem: P5. Fonte: RN-116.
- R12. O filtro `dia` de `GET /atividades` pode ser combinado com o filtro `tipo`. Origem: P5. Fonte: RN-116.
- R13. `situacao` e calculada pelo relogio controlado: antes do inicio do primeiro encontro e `prevista`; no instante exato do inicio do primeiro encontro passa a `em_andamento`; permanece `em_andamento` durante intervalos entre encontros; no instante exato do fim do ultimo encontro passa a `encerrada`. Origem: P6. Fonte: RN-114; contrato-api.md, linhas 47-51 e 118-120.
- R14. Se a atividade estiver cancelada, `situacao` deve ser `cancelada` e prevalece sobre a situacao calculada pelo horario. Origem: P6. Fonte: RN-114.
- R15. Depois da criacao, apenas `titulo` e `vagas` podem ser alterados por `PATCH /atividades/:id`. Origem: P7. Fonte: RN-110.
- R16. Depois da criacao, enviar `tipo`, `salaId` ou `encontros` para modificacao em `PATCH /atividades/:id` retorna `422 CAMPO_NAO_EDITAVEL`. Origem: P7. Fonte: RN-110; contrato-api.md, linhas 271-271.
- R17. Atividades `prevista`, `em_andamento` ou `encerrada` seguem a regra geral de edicao: apenas `titulo` e `vagas` podem ser alterados. Origem: P8. Fonte: RN-110, RN-111 e RN-113.
- R18. Atividades canceladas nao podem mais ser alteradas; `PATCH /atividades/:id` retorna `422 ATIVIDADE_CANCELADA`. Origem: P8. Fonte: RN-113; contrato-api.md, linhas 273-274.
- R19. Ao reduzir `vagas`, a nova quantidade nao pode ser menor que o total de inscricoes com status `confirmada` ou `convocada`; inscricoes `em_espera` nao contam para esse limite. Violacao em `PATCH /atividades/:id` retorna `409 VAGAS_ABAIXO_DOS_INSCRITOS`. Origem: P9. Fonte: RN-111; contrato-api.md, linhas 271-272.
- R20. Uma atividade so pode ser cancelada antes de comecar; no instante exato em que o primeiro encontro comeca, `POST /atividades/:id/cancelamento` retorna `422 ATIVIDADE_JA_INICIADA`. Origem: P10. Fonte: RN-112 e RN-113; contrato-api.md, linhas 273-273.
- R21. Cancelar uma atividade ja cancelada retorna `422 ATIVIDADE_CANCELADA`; o cancelamento e definitivo. Origem: P10. Fonte: RN-113; contrato-api.md, linhas 273-274.
- R22. Ao cancelar uma atividade, todas as inscricoes ativas dela sao canceladas; a partir disso, `ocupadas` e `emEspera` deixam de considerar essas inscricoes, e `vagasRestantes` volta a refletir as vagas disponiveis da atividade. Origem: P10. Fonte: RN-112, RN-113 e RN-217.
- R23. `cargaHorariaMinutos` e a soma exata, em minutos, da duracao de todos os encontros; nao ha arredondamento, limite adicional nem soma dos intervalos entre encontros. Origem: P13. Fonte: RN-109.
- R24. Se `cargaHorariaMinutos` for enviado pela organizacao, o valor deve ser ignorado; a resposta deve trazer o valor calculado pela API. Origem: P13. Fonte: RN-109.
- R25. `ocupadas` conta inscricoes com status `confirmada` ou `convocada`; inscricoes `cancelada` ou `expirada` nao contam. Origem: P14. Fonte: RN-111, RN-205 e RN-217.
- R26. `emEspera` conta apenas inscricoes com status `em_espera`. Origem: P14. Fonte: RN-111, RN-205 e RN-217.
- R27. `vagasRestantes` e calculado como `vagas - ocupadas`; inscricoes em espera nao reduzem `vagasRestantes`. Origem: P14. Fonte: RN-111, RN-205 e RN-217.

## 6. Criterios de aceite

1. (R1) `POST /atividades` com `tipo: "palestra"` e 1 encontro valido retorna `201 Atividade`; com 2 encontros retorna `422 QUANTIDADE_DE_ENCONTROS`.
2. (R2) `POST /atividades` com `tipo: "minicurso"` e 2 encontros validos retorna `201 Atividade`; com 1 ou 6 encontros retorna `422 QUANTIDADE_DE_ENCONTROS`.
3. (R3) `POST /atividades` com encontro de 59 minutos, 4 horas e 1 minuto, `fim <= inicio`, dias diferentes, fora de 19 a 23/10/2026 ou sobreposto a outro encontro da mesma atividade retorna `422 ENCONTRO_INVALIDO`.
4. (R4) `POST /atividades` com encontros validos fora de ordem retorna `201 Atividade` com `encontros` ordenados por `inicio`.
5. (R5, R6) `POST /atividades` para `lab-3` com `vagas: 20` retorna `201 Atividade`; com `vagas: 21` retorna `422 VAGAS_ACIMA_DA_CAPACIDADE`.
6. (R5) `POST /atividades` com `vagas: 0` e sala existente e demais campos validos e recusado por vagas invalidas.
7. (R7) Dada uma atividade nao cancelada em `sala-101` ate 10:00, `POST /atividades` para a mesma sala com encontro iniciando 10:14 retorna `409 CONFLITO_DE_SALA`.
8. (R7) Dada uma atividade nao cancelada em `sala-101` ate 10:00, `POST /atividades` para a mesma sala com encontro iniciando 10:15 retorna `201 Atividade`.
9. (R8) Dada uma atividade cancelada em `sala-101` ate 10:00, `POST /atividades` para a mesma sala com encontro iniciando 10:00 retorna `201 Atividade` se as demais regras forem satisfeitas.
10. (R9) Dadas atividades com primeiros encontros em 10:00, 09:00 e 09:00, `GET /atividades` retorna primeiro as de 09:00, ordenadas por `titulo` entre si, e depois a de 10:00.
11. (R10) Dada uma atividade cancelada, `GET /atividades` continua incluindo essa atividade na lista.
12. (R11) Dada uma atividade com encontro em 2026-10-20 no horario de Brasilia, `GET /atividades?dia=2026-10-20` inclui essa atividade.
13. (R12) Dadas atividades de tipos diferentes no mesmo dia, `GET /atividades?dia=2026-10-20&tipo=minicurso` retorna apenas minicursos com pelo menos um encontro nesse dia.
14. (R13) Com o relogio antes do primeiro encontro, `GET /atividades/:id` retorna `situacao: "prevista"`; no instante do primeiro inicio retorna `em_andamento`; durante intervalo entre encontros retorna `em_andamento`; no instante do ultimo fim retorna `encerrada`.
15. (R14) Depois de cancelar uma atividade, `GET /atividades/:id` retorna `situacao: "cancelada"` mesmo que o relogio esteja antes, durante ou depois dos encontros.
16. (R15, R17) `PATCH /atividades/:id` de atividade prevista, em andamento ou encerrada alterando apenas `titulo` retorna `200 Atividade` com novo titulo.
17. (R15, R17) `PATCH /atividades/:id` de atividade prevista, em andamento ou encerrada alterando apenas `vagas` para valor valido retorna `200 Atividade` com novas vagas.
18. (R16, R17) `PATCH /atividades/:id` enviando modificacao de `tipo`, `salaId` ou `encontros` retorna `422 CAMPO_NAO_EDITAVEL`.
19. (R18) `PATCH /atividades/:id` em atividade cancelada retorna `422 ATIVIDADE_CANCELADA`.
20. (R19) Dada atividade com 2 inscricoes `confirmada`, 1 `convocada` e 1 `em_espera`, `PATCH /atividades/:id` para `vagas: 3` retorna `200 Atividade`; para `vagas: 2` retorna `409 VAGAS_ABAIXO_DOS_INSCRITOS`.
21. (R20) `POST /atividades/:id/cancelamento` antes do inicio do primeiro encontro retorna `200 Atividade`; no instante exato do primeiro inicio retorna `422 ATIVIDADE_JA_INICIADA`.
22. (R21) `POST /atividades/:id/cancelamento` em atividade ja cancelada retorna `422 ATIVIDADE_CANCELADA`.
23. (R22) Depois de cancelar uma atividade com inscricoes ativas, `GET /atividades/:id` retorna contadores recalculados sem essas inscricoes ativas.
24. (R23) Atividade com encontros de 120 e 90 minutos retorna `cargaHorariaMinutos: 210`, sem contar intervalo entre eles.
25. (R24) `POST /atividades` que envia `cargaHorariaMinutos: 999` junto dos campos validos retorna `201 Atividade` com `cargaHorariaMinutos` calculado pelos encontros.
26. (R25, R26, R27) Dada atividade com 2 inscricoes `confirmada`, 1 `convocada`, 4 `em_espera`, 1 `cancelada` e 1 `expirada`, `GET /atividades/:id` retorna `ocupadas: 3`, `emEspera: 4` e `vagasRestantes: vagas - 3`.

## 7. Como isto sera verificado

Os testes devem verificar a API pela costura HTTP exposta pelo servidor da aplicacao, preferencialmente usando `criarServidor()` se esta for a costura existente do projeto. Essa costura cobre contrato de rota, status HTTP, corpo JSON, codigos de erro e campos calculados observaveis de fora. Regras dependentes de tempo devem usar o modo de teste e o relogio controlado de `/_teste/relogio`, nunca a hora real do sistema.

## 8. Fatias de entrega

1. Leitura basica e modelo de M1: `GET /salas`, `GET /atividades`, `GET /atividades/:id`, campos de `Atividade`, ordenacao de `encontros`, listagem de atividades, filtros definidos e `cargaHorariaMinutos` calculada. Regras: R4, R9, R10, R11, R12, R23, R24.
2. Criacao de atividade com quantidade de encontros, validade temporal dos encontros e vagas por capacidade. Regras: R1, R2, R3, R5, R6.
3. Conflito de sala na criacao, incluindo intervalo minimo e exclusao de atividades canceladas. Regras: R7, R8.
4. Situacao calculada pelo relogio controlado e prevalencia de cancelamento. Regras: R13, R14.
5. Alteracao de atividade com campos editaveis, campos nao editaveis e bloqueio de atividade cancelada. Regras: R15, R16, R17, R18.
6. Contadores de ocupacao e reducao de vagas conforme inscricoes. Regras: R19, R25, R26, R27.
7. Cancelamento de atividade antes do inicio, recusa apos inicio, recusa de novo cancelamento e cancelamento das inscricoes ativas. Regras: R20, R21, R22.
