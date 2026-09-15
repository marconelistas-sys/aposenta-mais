# Mostrador de liquidez da carteira

## Contexto

A avaliação anterior de mostradores financeiros (`avaliacao-ux-mostradores.md`) identificou a distribuição de liquidez da carteira como oportunidade posterior, fora daquela entrega. Esta sprint implementa exatamente essa oportunidade: um mostrador radial segmentado (dial/HUD) na tela Carteira, mostrando a proporção disponível para resgate, restrita ou com prazo e não informada.

## Avaliação de UX

O agente de UX revisou o código do novo componente contra os princípios já estabelecidos nas entregas anteriores (círculo só com denominador definido, valor em texto antes do gráfico, equivalente textual completo, sem faixas de segurança inventadas, privacidade suprime toda geometria derivada, estados explícitos para dados ausentes ou inválidos).

Apontou um problema real: a cor escolhida para "não informada" reaproveitava o tom de alerta já usado no mostrador de orçamento para excesso de gastos — e como a carteira sem investimentos cadastrados cai automaticamente 100% em "não informada", o primeiro contato de um usuário novo mostraria um anel inteiro na cor de alerta, mesmo sem nenhum problema. Corrigido para uma cor neutra do sistema de tokens, sem reaproveitar semântica de alerta.

Confirmou que os demais princípios já estavam atendidos: os valores em `<dl>` continuam antes do mostrador na mesma função, a legenda de texto é sempre visível (não depende de hover), a privacidade interrompe o cálculo antes de qualquer geometria, e os casos de total zero, valores negativos ou não finitos e categoria única (100% em um segmento) já eram tratados sem gerar arco inválido.

## Implementação

- `src/shared/liquidity-gauge.js`: novo componente `liquidityGauge`, um donut de três segmentos (disponível, restrita, não informada) sobre o total da carteira, com leitura digital central do percentual disponível e legenda textual sempre visível com o percentual de cada categoria.
- `src/features/investments/liquidity.js`: o mostrador é inserido logo após a lista `<dl>` de valores monetários já existente, reutilizando o mesmo `summarizeLiquidity`. Nenhum cálculo financeiro foi alterado.
- CSS em `src/styles/responsive.css`, seguindo o padrão visual já usado pelo mostrador de orçamento (`.budget-gauge`).
- Privacidade: `hidden` interrompe o componente antes de qualquer proporção ou geometria, retornando apenas texto.

## Verificação

`npm run validate`: 656 testes aprovados e build concluído (antes desta entrega: 649). Testes novos em `tests/liquidity-gauge.test.js` cobrem proporções, categoria única, total zero, valores inválidos, privacidade e o rótulo acessível completo. Testes de integração em `tests/investments.test.js` cobrem a carteira com liquidez declarada mista, a privacidade na tela real e o estado padrão de uma carteira nova (100% não informada).

Inspeção visual em navegador não foi realizada nesta sessão, pois a ferramenta de navegador não estava disponível no ambiente. A revisão de UX foi feita no código-fonte do componente, da integração e dos testes.
