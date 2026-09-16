# Diagnóstico da carteira

Regras educativas em `src/domain/portfolio-diagnostics.js`. Não são recomendação de investimento. Os limites ficam em `diagnosticThresholds`.

| Regra | Nível | Condição |
|---|---|---|
| Concentração por classe | Atenção / Risco | Maior classe com 60% / 80% ou mais |
| Um investimento pesa muito | Atenção | Maior investimento com 40% ou mais, carteira com mais de um item |
| Limite do FGC | Informação | Moeda BRL, renda fixa acima de R$ 250 mil em um item |
| Liquidez não informada | Atenção | 50% ou mais sem liquidez declarada |
| Reserva | Risco / Atenção / Adequado | Disponível cobre menos de 3 / menos de 6 / 6 ou mais meses de despesas |
| Custo anual | Atenção | Custo médio ponderado de 1% ao ano ou mais |
| Coerência de retorno | Atenção | Menos de 20% em ações, retorno assumido acima de 5% real, 10 anos ou mais até a aposentadoria |
| Risco de sequência | Atenção | Até 5 anos da aposentadoria e mais de 50% em ações |
| Marcação a mercado | Informação | IPCA + taxa sem liquidez restrita |
| Previdência sem data | Informação | Previdência sem data do primeiro aporte |
| Retorno assumido | Atenção / Risco | Retorno real médio sem IPCA + de 6% / 8% ou mais |
| Taxa de retirada | Risco | Acima de 5% ao ano |
| Retirada longa | Atenção | Mais de 30 anos após a aposentadoria e taxa acima de 3,5% |

## Custo anual

Retorno líquido = (1 + retorno real) × (1 − custo) − 1. Vale para a taxa habitual e para retornos nominais e de CDI. Retornos informados por ano são considerados líquidos.

## IR progressivo em 2026

Base mensal = resgate bruto mensal − R$ 607,20. Tabela: isento até R$ 2.428,80. 7,5% até R$ 2.826,65 (dedução R$ 182,16). 15% até R$ 3.751,05 (R$ 394,16). 22,5% até R$ 4.664,68 (R$ 675,49). 27,5% acima (R$ 908,73).

Redutor da Lei 15.270/2025 sobre o valor bruto: até R$ 5.000, até R$ 312,89. De R$ 5.000,01 a R$ 7.350, R$ 978,62 − 0,133145 × valor. Acima, zero. O imposto nunca fica negativo.
