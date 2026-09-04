# Convenções de taxas

O motor não deve aceitar taxas sem natureza e periodicidade explícitas.

## Convenções atuais

- `annualRealReturn` representa uma taxa real efetiva anual.
- `annualWithdrawalRate` representa a fração anual do patrimônio convertida em renda.
- A conversão da taxa anual para mensal usa equivalência composta.
- Aportes ocorrem no fim de cada mês.
- Contribuições previdenciárias recorrentes ocorrem no fim de cada mês ativo entre as datas inicial e final.
- O mesmo valor entra como saída no orçamento e como aporte programado no patrimônio.
- O aporte livre e a contribuição previdenciária são parcelas distintas para evitar dupla contagem.
- Valores de aposentadoria são calculados na moeda base do cenário e no poder de compra de hoje.
- Valores do orçamento são convertidos pela fotografia cambial do BCE antes da consolidação.
- As taxas do BCE têm EUR como base. Taxas cruzadas usam `valor / taxa_origem × taxa_destino`.
- Arredondamento monetário ocorre somente na apresentação.

Uma taxa anual não deve ser dividida por 12 sem identificação explícita como taxa nominal anual com capitalização mensal.
