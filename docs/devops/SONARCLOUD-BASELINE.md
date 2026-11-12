# SonarCloud — auditoria e gate da main

O projeto INKO usa SonarQube Cloud no projeto `DevAngeloOliveira_Inko`. Os PRs e a main possuem cálculos diferentes: os PRs avaliam as condições de código novo; a main pode ter Security Rating C mesmo com todos os PRs recentes aprovados.

## Problema confirmado (09/11/2026)

O último check `SonarCloud Code Analysis` da main retornou GitHub conclusion `neutral`. O dashboard da main não exibiu um Quality Gate calculado, enquanto cinco arquivos apresentaram Security Rating C (visão geral). O `INKO CI` não executava validação explícita desse estado.

## Fonte de verdade para problemas

O workflow `INKO SonarCloud Baseline Audit` consulta a API pública do SonarCloud e apresenta um relatório de Quality Gate, métricas e issues abertas com impacto SECURITY. Não modifica nem aceita issues, não reduz o Quality Gate e não substitui o scanner do SonarCloud.

Em PRs, a auditoria é diagnóstica e não usa secrets. Configure o check nativo `SonarCloud Code Analysis` como obrigatório nas regras de integração da main. Em execuções na main (push, agendamento ou manual), o job associa o gate ao SHA do workflow e espera até dez minutos. O job falha se:

- A API não estiver acessível e não for possível conferir o resultado.
- A análise mais recente divergir do SHA esperado ou mudar durante a auditoria.
- O Quality Gate não estiver calculado como `OK`.
- O Security Rating geral for diferente de A.
- A coleta de issues estiver incompleta.

Se o projeto SonarCloud não aceitar consultas anônimas, configure um token de análise/leitura com acesso ao projeto como `SONAR_TOKEN` em GitHub **Actions secrets**. Esse segredo nunca é exposto aos jobs de PR. Não copie o token para arquivos ou logs.

## Configuração necessária no SonarCloud

No SonarCloud, entre no projeto INKO → **Administration → New Code** e confira a definição de novo código. Para desenvolvimento contínuo, uma janela de 30 dias é uma opção. Depois de definir, execute uma nova análise da main: faça merge de alterações via PR ou use o mecanismo de análise automática já configurado. Uma única análise inicial ou ausência de definição pode produzir `Not computed`.

Não reinicialize a data de referência apenas para esconder problemas antigos. As métricas de **Overall Code** continuarão relevantes e o job de auditoria exige Security Rating A.

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
```

O script utiliza apenas a biblioteca padrão do Python e, quando `SONAR_TOKEN` está presente, acessa o projeto por Basic Auth com token sem registrar o segredo. A saída JSON é adequada para anexar ao backlog de correções. A versão `--strict` retorna código diferente de zero enquanto o gate ou a segurança geral ainda estiverem pendentes.

**Importante:** não confundir o `neutral` do check de SonarCloud com `success` nem com falha de compilação. O processo continua sendo governado pelas condições configuradas no projeto SonarCloud.
