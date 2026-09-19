# Entrevista do módulo M2 — Inscrições e lista de espera

| | |
|---|---|
| Sessão | `ses_f44b6c481ffe8lDP7t2El5OABW` |
| Pasta | trabalhofinal_gustavo/semana-academica-pedro-gustavo |
| Período | 19/09 17:08 → 19/09 18:38 |
| Modelo | openai/gpt-5.6-luna-fast |
| Requisições ao modelo | 21 |
| Tokens de entrada / saída | 58.368 / 14.900 |
| Skills | grilling |
| Subagentes | — |
| Execuções de teste | 0 vermelhas, 0 verdes |
| TDD | 0 ciclo(s) vermelho → verde · 0 teste(s) que já nasceram verdes · 0 vez(es) teste e código juntos |
| Arquivos editados | 0 de teste, 0 de código, 0 de entrevista, 0 de spec, 0 de contexto, 0 de auditoria |
| Alertas | — |

## Linha do tempo

- `19/09 17:08` **prompt** — Use a skill grilling. Vamos entrevistar o módulo M2 — Inscrições e lista de espera. Antes de perguntar qualquer coisa, leia contrato-api.md (a seção M2, as convenções da seção 1, o modo de teste da seção 3 e a tabela de códigos de erro) e também specs/M1-grade.md e specs/M3-presenca.md, porque o M2 fica entre os dois: ele consome as vagas do M1 e alimenta a presença do M3. Regras desta sessão: - …
- `19/09 17:09` carrega a skill **grilling**
- `19/09 17:11` **prompt** — As inscrições fecham 30 minutos antes do início do primeiro encontro. Pela convenção geral dos requisitos, um prazo que "fecha em X" já recusa no próprio instante X: então às 18:30:00, para um encontro às 19:00, a inscrição já é recusada com INSCRICOES_ENCERRADAS. Fonte: RN-202 Agora mude o formato: em vez de uma pergunta por vez, apresente a fronteira inteira de uma vez, numerada, como a skill g…
- `19/09 17:15` **prompt** — 1. Se existe vaga livre no momento do pedido, a inscrição já entra como confirmada. Se não existe, ela entra como em_espera, no fim da fila — e lotação não é erro, é um estado normal. Sempre que uma vaga é liberada, seja por cancelamento, por convocação vencida ou por aumento de vagas, quem está na frente da fila é convocado. A fila segue a ordem de chegada, e a posição é calculada na hora da con…
- `19/09 17:29` **prompt** — 1. A ordem é: atividade inexistente (404) → atividade cancelada → inscrições encerradas → já existe inscrição ativa → conflito de horário → limite de minicursos. O bloqueio que apareceria entre "encerradas" e "já inscrito" é do M5 e não se aplica ao nosso grupo. As duas últimas verificações, conflito e limite, só rodam quando a inscrição vai realmente ocupar vaga: quem entra direto para a lista d…
- `19/09 18:09` **prompt** — 1. Cancelar uma inscrição em_espera apenas a tira da fila e a marca como cancelada. Nenhuma convocação é disparada, porque quem está em espera não ocupa vaga e portanto não libera nada ao sair. As posições dos que continuam na fila não são armazenadas: elas são calculadas na consulta a partir da ordem de chegada, então se reacomodam sozinhas. Fonte: RN-205, RN-211 e RN-216. A ausência de convocaç…
- `19/09 18:38` **prompt** — Confirmo o resumo. Encerre a rodada e registre no topo do arquivo "Status: Rodadas 1 e 2 encerradas e confirmadas. Todas as perguntas respondidas."
