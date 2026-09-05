# Sprint: gráficos anuais e horizonte até a idade-alvo

## Prioridades e execução

1. P0: distinguir idade de aposentadoria de idade-alvo do planejamento. Persistir idade-alvo e referência temporal, importar target_age e impedir truncamento silencioso no risco.
2. P1: adaptar a organização visual do finapp. Fluxos em barras com saldo em linha, patrimônio separado de Monte Carlo, cores consistentes, grade, eixo monetário, linha zero e legendas.
3. P1: conferir somas, saldos negativos, percentis, meses parciais, ocultação e atualização isolada do horizonte de planos já importados.

Implementado localmente, com 317 testes e build aprovados. A integração Git inclui as entregas locais anteriores que servem de dependência para os gráficos, a migração e o motor financeiro. Não inclui arquivos financeiros privados gerados em /private/tmp.

## Referência examinada

`../finapp/frontend/src/pages/DashboardPage.tsx`: seções de evolução patrimonial, fluxos anuais e simulação de cenários. Foram aproveitadas a organização, as cores e as duas faixas de percentis. Não foram adicionadas dependências React/Recharts ao Aposenta+.

O Aposenta+ mantém sua convenção de saldo após todas as saídas, inclusive contribuições previdenciárias. O finapp exibe contribuições fora do FCX. Essa diferença está explícita na legenda para não alterar cálculos financeiros ao adaptar a aparência.

## Horizonte

Idade-alvo é um campo independente da aposentadoria, configurável em Plano, Fluxo de caixa e Risco. O mês de referência associa a idade atual a um ano. A projeção inclui dezembro do ano em que a idade-alvo é atingida, seguindo a organização anual do finapp. Não se presume uma data de nascimento.

O fluxo inicia no mês consultado do orçamento. O risco inicia no mês atual. Ambos encerram no mesmo dezembro quando usam idade-alvo. A referência persistida impede que o ano final avance automaticamente a cada ano.

Sem idade-alvo, o orçamento informa que mostra apenas 12 meses. O risco informa que usa a quantidade manual de meses. Não se copia a idade de aposentadoria como horizonte final.

O fluxo admite até 1.200 meses. Monte Carlo mantém limite de 720 meses e rejeita horizontes maiores com explicação, sem cortar o período silenciosamente. O modo manual continua disponível.

## Convenções dos gráficos

- Fluxos anuais somam somente os meses calculados. Anos parciais informam quantos meses estão incluídos e não são anualizados artificialmente.
- Barras: entradas, saídas sem previdência e previdência separada. Linha: saldo após todas as saídas.
- Patrimônio: posições do último mês disponível em cada ano, com financeiro total, disponível, restrito, posição vinculada e patrimônio líquido.
- Monte Carlo: P10/P90 e P25/P75, mediana e cenário base, no fechamento anual. Percentis não são somados ou promediados.
- Indicadores de insuficiência continuam verificando todos os meses, mesmo quando o gráfico mostra fechamentos anuais.
- Valores ocultos removem o SVG. Tabelas conservam valores mascarados. Regiões horizontais podem receber foco pelo teclado em telas estreitas.

## Planos importados anteriormente

O gerador produz `horizonte-finapp.json`, restrito ao modo Atualizar somente a idade-alvo do horizonte no Perfil. Preserva lançamentos, investimentos, contas, cenários e aposentadoria. Rejeita uso no modo Substituir para impedir que um arquivo sem registros apague o plano. Exige idade atual compatível com o arquivo e mantém versão de recuperação.

Importações antigas não continham target_age. Abrir a versão nova da aplicação não permite recuperá-lo automaticamente da sessão já importada. É necessário configurar o campo no Plano ou aplicar o arquivo de horizonte. Não é necessário repetir a importação financeira.

## Validação e limites

Testes cobrem dezembro final, horizonte estável, aposentadoria independente, anos inválidos, meses parciais, previdência sem duplicação, percentis ordenados, estoques de fechamento, conversão de arquivo sem alteração de registros, SVG sem NaN e ocultação.

Inspeção visual no navegador e teste autenticado da importação não foram executados nesta sessão. A adaptação visual foi verificada pelo código e pelos testes de renderização. Não houve alteração em dados da conta ou no banco hospedado.
