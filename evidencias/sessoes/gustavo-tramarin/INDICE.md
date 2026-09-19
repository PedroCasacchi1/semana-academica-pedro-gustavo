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
| | **Total: 1 sessões** | 334 | grilling, to-spec, tdd (4), browser-automation, novo-subagente | auditor | 26 / 70 | 0 | 0 | 0 | — |
