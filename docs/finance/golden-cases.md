# Casos financeiros de referência

Os casos abaixo definem comportamentos básicos do motor. A tolerância monetária é de R$ 0,01.

## Saldo sem movimentação

- Saldo inicial: R$ 100.000,00.
- Taxa: 0%.
- Aporte: R$ 0,00.
- Resultado sem passagem de tempo: R$ 100.000,00.

## Aportes sem rendimento

- Saldo inicial: R$ 0,00.
- Aporte postecipado: R$ 1.000,00.
- Taxa: 0%.
- Prazo: 12 meses.
- Resultado: R$ 12.000,00.

## Conversão de taxa anual

- Retorno real efetivo anual: 12%.
- Taxa mensal equivalente: `(1 + 0,12)^(1/12) - 1`.
- A composição das 12 taxas mensais deve retornar exatamente 12% ao ano, dentro da tolerância numérica.

## Renda coberta pelo benefício

- Renda desejada: R$ 3.000,00.
- Benefício esperado: R$ 3.500,00.
- Patrimônio-alvo adicional: R$ 0,00.
- Aporte adicional necessário: R$ 0,00.

