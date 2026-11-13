# SonarCloud — auditoria e gate da main

O projeto INKO usa SonarQube Cloud no projeto `DevAngeloOliveira_Inko`. Os PRs e a main possuem cálculos diferentes: os PRs avaliam as condições de código novo; a main pode ter Security Rating C mesmo com todos os PRs recentes aprovados.

## Problema confirmado (09/11/2026)

O último check `SonarCloud Code Analysis` da main retornou GitHub conclusion `neutral`. O dashboard da main não exibiu um Quality Gate calculado, enquanto cinco arquivos apresentaram Security Rating C (visão geral). O `INKO CI` não executava validação explícita desse estado.

## Fonte de verdade para problemas

O workflow `INKO SonarCloud Baseline Audit` consulta a API pública do SonarCloud e apresenta Quality Gate, métricas e issues abertas em `securityIssues`, `reliabilityIssues` e `maintainabilityIssues`. O inventário deduplica por chave e registra regra, arquivo, intervalo, status, mensagem, severidade e impactos. Uma issue com mais de um impacto aparece nas categorias correspondentes. Tipos legados `BUG` e `VULNERABILITY` também entram no inventário.

Em PRs, a auditoria é diagnóstica e usa a API pública. O relatório confere o commit analisado com o head do PR antes e depois de consultar métricas e issues. Configure o check nativo `SonarCloud Code Analysis` como obrigatório nas regras de integração da main. Antes da integração, confirme que o check do app `sonarqubecloud` tem `head_sha` igual ao head atual e conclusão `success`, e que o SonarCloud mostra Quality Gate `OK`, New Security A e New Reliability A para essa revisão.

Em execuções na main (push, agendamento ou manual), o job associa o gate ao SHA do workflow e espera até dez minutos. O job falha se:

- A API não estiver acessível e não for possível conferir o resultado.
- A análise mais recente divergir do SHA esperado ou mudar durante a auditoria.
- O Quality Gate ou alguma condição retornada for diferente de `OK`, ou as condições de Security e Reliability do código novo não comprovarem valor A com limite A.
- Security Rating ou Reliability Rating geral for diferente de A.
- A coleta de issues estiver incompleta ou a resposta do inventário for inválida.

Se o projeto SonarCloud não aceitar consultas anônimas, configure um token de análise/leitura com acesso ao projeto como `SONAR_TOKEN` em GitHub **Actions secrets**. Esse segredo nunca é exposto aos jobs de PR. Não copie o token para arquivos ou logs.

## Configuração necessária no SonarCloud

No SonarCloud, entre no projeto INKO → **Administration → New Code** e confira a definição de novo código. Para desenvolvimento contínuo, uma janela de 30 dias é uma opção. Depois de definir, execute uma nova análise da main: faça merge de alterações via PR ou use o mecanismo de análise automática já configurado. Uma única análise inicial ou ausência de definição pode produzir `Not computed`.

Preserve a referência de New Code. O job exige Security Rating A e Reliability Rating A no **Overall Code**.

## Inventário de referência do SDD-001.1 (13/11/2026)

A consulta pública da main confirmou a revisão `8feaef90b6c348c5a387d8f30c9199039a864cd0`, análise `baecbfdb-2267-4705-8f95-78fa7b4951ec`, Quality Gate `ERROR` e ratings C/C. O inventário retornou 52 issues abertas distintas, com 2 de Security, 13 de Reliability e 44 de Maintainability. As categorias podem se sobrepor. A mesma análise foi observada antes e depois da consulta. As regras de código novo de Security e Reliability retornaram 3 para o limite 1. A confirmação de encerramento requer nova análise da revisão integrada. [Auditoria da baseline](https://github.com/DevAngeloOliveira/Inko/actions/runs/43396617220)

| Regra | Arquivo e linha na baseline | Chaves |
| --- | --- | --- |
| `pythonsecurity:S8703` | `scripts/ops/measure-gateway.py:64,65` | `AaHUHE-dIPqd_ggUi3z4`, `AaHUHE-dIPqd_ggUi3z5` |
| `pythonbugs:S2259` | `apps/gateway/inko_gateway/resilience.py:53` | `AaHUHE9tIPqd_ggUi3zx` |
| `typescript:S6772` | `apps/web/app/acervo/novo/page.tsx:164`, `apps/web/app/login/page.tsx:114` | `AaHUFuG0rm7QXUVH8lDb`, `AaHUFuGVrm7QXUVH8lDX` |
| `typescript:S6852` | `apps/web/app/devolucoes/page.tsx:181`, `apps/web/app/emprestimos/page.tsx:109,130,175` | `AaHUFuGgrm7QXUVH8lDZ`, `AaHUFuGLrm7QXUVH8lDU`, `AaHUFuGLrm7QXUVH8lDV`, `AaHUFuGLrm7QXUVH8lDW` |
| `typescript:S6847`, `typescript:S1082` | `apps/web/components/app-shell.tsx:170` | `AaHUFuH1rm7QXUVH8lDl`, `AaHUFuH1rm7QXUVH8lDm` |
| `shell:S7688` | `scripts/ops/verify-backup.sh:5,9`, `scripts/ops/backup-postgres.sh:13`, `scripts/ops/deploy-staging.sh:5` | `AaHCriUNAmKj134XCH_q`, `AaHCriUNAmKj134XCH_r`, `AaHCnXs3OvL8uTblGV2O`, `AaHCnXsbOvL8uTblGV2N` |

## Segurança — arquivos conhecidos

A auditoria do painel encontrou Security C em:
- `.github/workflows/ci.yaml`
- `.github/workflows/release-manifest.yaml`
- `apps/web/Dockerfile`
- `apps/gateway/Dockerfile`
- `apps/gateway/pyproject.toml`

Uma interpolação de variável GitHub Actions na shell do workflow CI foi corrigida em `fix(ci)`. Para os demais arquivos, utilize **rule ID, linha e mensagem** do SonarCloud antes de alterar versões de bibliotecas ou imagens; substituir versões arbitrariamente não garante resolver vulnerabilidades.

## Auditoria manual

```bash
python scripts/ci/sonar-main-audit.py
python scripts/ci/sonar-main-audit.py --strict --expected-sha <SHA-integrado-na-main>
python scripts/ci/sonar-main-audit.py --pull-request <numero> --expected-sha <SHA-do-head>
```

O script usa a biblioteca padrão do Python. Se `SONAR_TOKEN` estiver presente em uma execução autorizada, usa autenticação HTTP sem registrar o segredo. A saída JSON contém o inventário completo. O modo `--strict` retorna código diferente de zero enquanto a revisão, o gate, os dois ratings ou a integridade do inventário estiverem pendentes.

**Importante:** não confundir o `neutral` do check de SonarCloud com `success` nem com falha de compilação. O processo continua sendo governado pelas condições configuradas no projeto SonarCloud.
