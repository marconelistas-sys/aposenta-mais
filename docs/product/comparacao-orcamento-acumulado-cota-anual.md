# Comparação do orçamento acumulado com a cota anual

## Decisão

A revisão com o agente de planejamento financeiro recomendou preservar o planejado até o mês como referência padrão do acompanhamento acumulado. A comparação com a cota anual inteira fica disponível como segunda base.

O acompanhamento do ritmo detecta problemas antes de toda a cota anual ser consumida. O consumo da cota anual informa quanto do orçamento do ano já foi utilizado e quanto ainda resta. As duas informações aparecem juntas no acumulado.

## Cálculo

- Realizado até o mês: soma dos registros de janeiro até o mês selecionado.
- Planejado até o mês: soma do planejamento nos mesmos meses.
- Cota anual: soma do planejamento de janeiro a dezembro.
- Saldo da cota anual: cota anual menos realizado até o mês.
- Excesso percentual: diferença entre realizado e a base escolhida, dividida pela base.

Exemplo em setembro: Saúde com 870 mensais tem 7.830 previstos até setembro e uma cota anual de 10.440. Gastos acumulados de 9.000 superam o ritmo previsto em 14,9%, mas deixam 1.440 da cota anual. Gastos de 11.000 ultrapassam a cota anual em 560. Este segundo aviso aparece mesmo se o filtro de excesso estiver em 10%, pois a ultrapassagem anual é de aproximadamente 5,4%.

## Regras

O planejado segue a vigência dos registros, incluindo mudanças de valor durante o ano. Lançamentos anuais usam o rateio mensal existente, sem aplicar um segundo rateio. Lançamentos eventuais permanecem no mês informado.

Um gasto antecipado pode ficar sem planejamento no período e ainda ter planejamento anual. A interface distingue as duas situações. No modo anual, a lista de lançamentos planejados inclui os meses futuros que compõem a cota.

Realizados posteriores ao mês selecionado ficam fora das duas comparações. Ausência de registros não comprova ausência de despesas. A interface informa a cobertura dos meses. Não há extrapolação automática dos gastos para os meses restantes.

Categorias com cota positiva mostram percentual utilizado, saldo restante e os estados dentro da cota, esgotada ou ultrapassada. A ultrapassagem usa valores em centavos e não depende do filtro de excesso. Em dezembro, ambas as bases são equivalentes.

## Referências da consulta

O CFPB recomenda comparar os gastos com o orçamento periodicamente e considerar despesas menos frequentes. A implementação das duas bases é uma decisão de produto baseada na consulta ao agente.

- [CFPB: Consumer tips on managing spending](https://files.consumerfinance.gov/f/documents/201702_cfpb_Consumer-Tips-on-Managing-Spending.pdf)
- [CFPB: Assess your spending](https://www.consumerfinance.gov/owning-a-home/prepare/assess-your-spending/)
