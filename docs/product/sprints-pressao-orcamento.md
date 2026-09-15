# Três sprints: legibilidade e pressão dos gastos

## Decisão com o agente de UX

A composição anual sob o gráfico de Fluxo de caixa listava lançamentos na ordem de cadastro, sem participação nas saídas ou comparação visual. O agente de UX priorizou leitura do período, identificação dos maiores gastos e conexão com o efeito futuro. A implementação também leva um resumo à tela Orçamento.

## Sprint 1. Identificar os maiores gastos

- Resumo de receitas, saídas e saldo antes dos rendimentos no início da composição.
- Ranking dos cinco maiores gastos, com barras proporcionais, valor exato, categoria e percentual das saídas.
- Metas e previdência financiada identificadas, sem duplicar contribuições. Previdência externa e liberações ficam fora do ranking de saídas.
- Tabelas completas ordenadas do maior para o menor valor. Nomes visíveis e detalhes de prazo, origem e moeda recolhidos.
- Saldo zero recebe texto de equilíbrio. Receita zero não recebe percentual infinito nem indicação de sustentabilidade.

## Sprint 2. Explicar o peso mensal

- Média mensal calculada pelo número de meses incluídos no período. Um recorte de seis meses divide por seis, independentemente de quantos meses cada lançamento ficou ativo.
- Base real ou nominal explícita. A inflação já aplicada à composição não é aplicada novamente. O valor na moeda original continua no detalhe.
- Resumo dos três maiores gastos do mês na tela Orçamento, usando o planejado familiar pela mesma premissa da série mensal.
- Filtros, busca e realizados da lista de cadastro não alteram o resumo. A diferença entre a lista e o resumo aparece na tela.
- Disposição em uma coluna no celular, valores sem quebra interna, barras acompanhadas de texto e ações com área de toque de 44 pixels.

## Sprint 3. Relacionar a despesa ao futuro

- Botão Simular redução nas despesas elegíveis da composição anual. Disponível no ranking e nos detalhes da lista completa.
- Escolha de percentual e ano inicial. A hipótese usa anos completos e respeita início, término, frequência e moeda do lançamento.
- Elegíveis: despesas planejadas de consumo cadastradas no orçamento. Dívidas, consórcios, metas, previdência e realizados exigem seus próprios fluxos de revisão.
- O cálculo parte da composição anual do plano e reduz somente a parcela do gasto escolhido. O motor de investimentos recalcula rendimentos, impostos de resgate, patrimônio e liquidez, preservando os demais fluxos.
- Comparação entre plano atual e hipótese: saldo do primeiro ano afetado, patrimônio financeiro final, liquidez final, primeiro fechamento anual com insuficiência e gráfico de liquidez.
- Desembolso evitado acumulado e diferença patrimonial aparecem separadamente. O resultado usa poder de compra atual, mesmo quando o gráfico de origem está em valores nominais.
- Nenhuma mudança no plano salvo, nos movimentos ou nos cenários persistidos. Mudança nos parâmetros invalida o resultado anterior. Mudança dos dados do plano exige novo cálculo.

## Validação e limites

`npm run validate` aprovado com 569 testes, incluindo 13 novos testes desta entrega, e build concluído. `git diff --check` sem erros.

A revisão final do agente de UX ajustou os textos sobre saldo zero, insuficiência anual e diferença entre resumo mensal e lista filtrada.

Os testes verificam ranking, participação, meses parciais, inflação, previdência sem dupla contagem, filtros e privacidade. A simulação de redução zero reproduz a base. Outra comparação verifica equivalência com um cenário cuja despesa foi alterada separadamente a partir do ano escolhido. Também há cobertura de retorno não nulo, moeda estrangeira, gastos encerrados e eventos únicos.

O resultado é uma hipótese nas premissas cadastradas. Selecionar o ano atual inclui seus meses já transcorridos. Insuficiência significa patrimônio financeiro líquido de dívidas ou liquidez negativos no fechamento anual, sem comprovar a situação de cada mês. Uma despesa de valor alto não é necessariamente dispensável.

Revisão de UX no código e testes automatizados realizados. A inspeção visual em navegador real permanece pendente. Nenhum servidor foi iniciado e nenhum dado da conta foi alterado ou sincronizado durante a entrega.
