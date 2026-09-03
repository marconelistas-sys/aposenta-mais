# Convenções de taxas

O motor não deve aceitar taxas sem natureza e periodicidade explícitas.

## Convenções atuais

- `annualRealReturn` representa uma taxa real efetiva anual.
- `annualWithdrawalRate` representa a fração anual do patrimônio convertida em renda.
- A conversão da taxa anual para mensal usa equivalência composta.
- Aportes ocorrem no fim de cada mês.
- Valores são calculados em reais de hoje.
- Arredondamento monetário ocorre somente na apresentação.

Uma taxa anual não deve ser dividida por 12 sem identificação explícita como taxa nominal anual com capitalização mensal.

