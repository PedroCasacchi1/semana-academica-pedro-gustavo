# Sessões — Gustavo Tramarin

Cada execução de teste é lida pelo que mudou desde a anterior:

- **Ciclo** — vermelho logo depois de mexer só em teste, e depois verde logo depois de mexer só em código. É o TDD.
- **Nasceu verde** — verde logo depois de mexer só em teste. Ou o comportamento já existia, ou o teste não testa o que diz.
- **Juntos** — teste e código mudaram antes da mesma execução. Não houve vermelho para ver.

**Alertas:** *colou* = prompt com 10 palavras seguidas ou mais iguais às do documento de requisitos (só aparece quando o resumo é gerado com `--requisitos`); *leu* = o agente acessou um arquivo de requisitos; *anexou* = o documento foi anexado à conversa.

Requisições são chamadas ao modelo: cada passo do agente é uma. Skills contam tanto a ferramenta `skill` quanto o comando `/nome`.

| Início | Sessão | Requisições | Skills | Subagentes | Vermelhas / verdes | Ciclos | Nasceu verde | Juntos | Alertas |
|---|---|---|---|---|---|---|---|---|---|
| 19/09 14:32 | [OpenCode Debugging Skill](ses_f454587d7ffeSOfeGHUVHeeL32.md) | 334 | grilling, to-spec, tdd (4), browser-automation, novo-subagente | auditor | 26 / 70 | 0 | 0 | 0 | — |
| 19/09 17:08 | [Entrevista do módulo M2 — Inscrições e lista de espera](ses_f44b6c481ffe8lDP7t2El5OABW.md) | 21 | grilling | — | 0 / 0 | 0 | 0 | 0 | — |
| 19/09 18:39 | [Especificação M2 — Inscrições com critérios e fatias](ses_f44644653ffeoZHnAuQHtwBZ4h.md) | 10 | to-spec | — | 0 / 0 | 0 | 0 | 0 | — |
| 19/09 18:42 | [Implementação TDD de M2-inscrições e integração M3](ses_f4460cdf3ffe3DrosIcjuC9FvO.md) | 41 | tdd | — | 8 / 9 | 0 | 0 | 0 | — |
| 19/09 18:51 | [Migração de rotas e cobertura temporal das specs M1–M3](ses_f4458c472ffeoAk21Zh4AWHo7T.md) | 33 | tdd | general (3) | 3 / 5 | 0 | 0 | 0 | — |
| 19/09 19:10 | [Auditoria do módulo M2 conforme especificação](ses_f4447cb39ffeO95rMw5YPF2ZyN.md) | 50 | tdd | auditor | 5 / 12 | 0 | 0 | 0 | — |
| 19/09 19:22 | [Implementação das entregas M2 e atualização documental](ses_f443c8d4affecgzOMBC7havsr9.md) | 32 | tdd | — | 3 / 4 | 0 | 0 | 0 | — |
| | **Total: 7 sessões** | 521 | grilling (2), to-spec (2), tdd (8), browser-automation, novo-subagente | auditor (2), general (3) | 45 / 100 | 0 | 0 | 0 | — |
