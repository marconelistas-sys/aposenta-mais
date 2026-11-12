# Rendimento calculado pelos saldos

Implementado em 2026-11-12. Cada investimento passa a usar, por padrão, o rendimento calculado pela variação entre saldos informados. O rendimento informado pela pessoa é a referência quando não há base para calcular e vale sozinho na opção "Informado por mim".

## Regras

- **Padrão:** `returnMode` ausente ou `calculated`. A opção `manual` desliga o cálculo. O rendimento manual (`returnType`, `returnValue`) continua salvo nos dois casos.
- **Saldos que contam:** só os informados de fato, pela pessoa (formulário) ou lidos de extrato de saldo. Um saldo derivado de aplicações e resgates vinculados não conta, porque não traz rendimento. Fica em `balanceHistory` (data, saldo na moeda do saldo, fluxo do período), com até 36 pontos.
- **Fluxo do período:** aplicações e resgates vinculados ao investimento. Sem eles, o aporte mensal informado e as contribuições de previdência vinculadas entram como estimativa, e o cartão avisa.
- **Cálculo:** Dietz modificado por período, encadeado e anualizado (`src/domain/calculated-return.js`). O resultado é nominal, na moeda do saldo, e já líquido do custo do produto. A projeção desconta a inflação dessa moeda.
- **Quando não vale:** menos de dois saldos, janela menor que 90 dias ou taxa fora de -50% a 100% ao ano (provável aporte não registrado). Nesses casos usa o rendimento manual e o cartão explica o motivo.
- **Precedência:** retorno por ano informado, depois calculado, depois manual.
- **Fora do escopo:** o retorno padrão do plano (derivado da carteira) continua usando as taxas informadas, não as calculadas.

## Pendências [validar]

- Investimentos antigos passam a ser "calculados" sem mudar nada até terem 90 dias entre dois saldos. Os que têm taxa própria digitada voltam a ela enquanto não houver cálculo.
- Janela mínima de 90 dias e faixa plausível são hipóteses.
- Contribuições de previdência vinculadas entram pelo valor mensal cadastrado, sem considerar início e fim.
