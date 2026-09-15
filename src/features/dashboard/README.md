# Dashboard: interpretação do plano

## Instrumentos visuais

O Dashboard apresenta quatro instrumentos antes da trajetória principal: cobertura anual, orçamento vigente, menor liquidez projetada e patrimônio considerado na data-alvo. O especialista em UX revisou a proposta e a implementação. [Decisões, fórmulas e limites](../../../docs/product/dashboard-instrumentos-visuais.md).

Os instrumentos futuros reutilizam o resultado da avaliação anual. O orçamento usa a data atual e explicita o rateio dos valores anuais. Não há score agregado nem probabilidade derivada da contagem de anos. Marcos e textos detalhados ficam recolhidos. O filtro de imóveis permanece visível e afeta somente a avaliação patrimonial.

O resumo de sustentabilidade usa o resultado de `finappViability`. Não calcula uma segunda projeção e não altera dados financeiros.

## Leitura visual

- O status mantém prioridade para a primeira insuficiência, mesmo quando há pendências.
- O gráfico ocupa a largura disponível, seguido dos marcos Hoje, Aposentadoria e Data-alvo.
- Hoje mostra os saldos cadastrados usados na abertura do ano-base. Não representa conciliação automática de contas bancárias.
- Aposentadoria mostra a abertura do ano correspondente. A interface informa que esse valor não é o saldo do mês exato da aposentadoria.
- Data-alvo mostra o fechamento final, incluindo patrimônio financeiro, liquidez e total líquido de dívidas.
- A interpretação diferencia déficit do orçamento coberto na projeção, falta de liquidez e insuficiência financeira líquida de dívidas.
- Até três próximos passos são escolhidos conforme insuficiência, horizonte e pendências. Cada passo aponta para a tela correspondente.

## Indicadores e privacidade

O medidor de meta de renda permanece em detalhes, identificado como indicador complementar. Ele compara patrimônio projetado e meta de renda, enquanto a sustentabilidade familiar considera o orçamento e a liquidez até a data-alvo.

Com valores ocultos, os marcos, as ações inferidas e o SVG do medidor não são renderizados. Ocultar apenas o percentual deixava a proporção do arco revelar o progresso.

## Validação

`tests/dashboard-interpretation.test.js` cobre os marcos anuais, déficit coberto, primeira insuficiência com patrimônio positivo, limite de ações, aposentadoria fora do horizonte e privacidade do indicador.

Validação da entrega: 33 testes passaram nas suites `dashboard-interpretation`, `cash-flow-solvency-ui`, `plan-checks-ui`, `ui-privacy` e `premium-ui`.

O layout usa listas semânticas, títulos, links de navegação e colunas que se ajustam à largura disponível. A validação desta entrega usa renderização HTML e testes automatizados, sem inspeção visual em navegador.
