# Orçamento: acumulado do ano

## Decisão

A aba Categorias compara o planejado com o realizado de um mês. Faltava a leitura anual: quanto da cota de cada categoria já foi usado e se o ritmo até o mês está acima do planejado.

A nova aba Acumulado do ano (`/orcamento?aba=acumulado`) fica em segundo lugar, depois de Resumo do mês. Ela segue o mês do navegador acima das abas. O quadro O que mais pesa, no resumo, tem o atalho Ver acumulado do ano por categoria. As regras de cálculo seguem [Comparação do orçamento acumulado com a cota anual](comparacao-orcamento-acumulado-cota-anual.md).

## Cálculo

- Realizado até o mês: registros de janeiro até o mês selecionado. Registros posteriores ficam fora.
- Planejado até o mês: planejamento dos mesmos meses, conforme a vigência dos lançamentos.
- Cota anual: planejamento de janeiro a dezembro. Em receitas, a interface usa Previsão anual.
- Saldo da cota anual: cota anual menos realizado até o mês. Valor negativo aparece como Excesso sobre a cota anual.
- Cota utilizada: realizado até o mês dividido pela cota anual.
- Saldo: receitas menos despesas, realizadas e planejadas até o mês.

Valores anuais usam o rateio mensal existente, dividido por 12. Eventuais ficam no mês informado. Não há projeção dos meses restantes. As comparações usam centavos.

## Leitura por categoria

Cada categoria mostra uma barra na escala da própria cota anual. A barra cheia é o realizado. A marca escura é o planejado até o mês. O fim da trilha é a cota anual. Acima da cota, a trilha termina em 85% da largura e o excesso aparece hachurado até 100%. Quando o excesso não cabe, a ponta mostra o sinal ›. Os três valores e uma frase de leitura sempre aparecem em texto.

Situações das despesas: Cota anual ultrapassada, Cota anual esgotada, Acima do ritmo, Gasto antecipado (nada planejado até o mês, mas cota positiva), Sem registros e Dentro do planejado. Receitas: Abaixo do previsto, Sem registros, Dentro do previsto, Acima do previsto e Previsão anual atingida. Cada situação usa texto e ícone, não apenas cor.

A ordem padrão, Precisam de atenção primeiro, segue essa sequência e depois a diferença em relação ao ritmo. Também é possível ordenar por maior cota anual, maior realizado ou nome.

Ao abrir uma categoria, a lista de planejados inclui os meses seguintes que compõem a cota, marcados como Previsto após o mês selecionado. Cada lançamento abre a edição existente.

## Estados

- Valores ocultos: somente o título e a orientação para exibir os valores.
- Sem planejamento no ano: mensagem e botão Adicionar lançamento.
- Sem realizado: barras somente com a marca do planejado e aviso.
- Cobertura: meses com e sem registros. Ausência de registros não confirma ausência de gastos.
- Mês futuro: aviso de que o realizado mostra apenas o que já foi registrado.
- Dezembro: aviso de que o planejado até o mês é igual à cota anual.
- Categorias com realizado e sem cota ficam em Sem planejamento no ano. Em despesas, há a ação Adicionar planejado.
- Categorias sem planejado, realizado e cota não aparecem.
- Outras moedas: os valores usam a moeda do aplicativo e as taxas de câmbio atuais.

## Validação

Testes de domínio e de interface em `tests/budget-year-to-date.test.js`. Verificação em navegador com servidor e banco temporários: `npm run test:budget-ytd-browser`.
