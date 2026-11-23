# Visão dos bens em Patrimônio

Novembro de 2026. Desenho combinado entre o especialista de planejamento financeiro e o agente de UI, implementado na seção "Imóveis, veículos e outros bens" de /patrimonio.

## O problema
Os bens eram uma lista de texto no rodapé de Patrimônio: nome, valor inicial, anos e taxa. Não mostravam o valor de hoje, a desvalorização, o valor na aposentadoria nem quanto do patrimônio está em bens que não pagam contas.

## O que a seção mostra
Todos os valores estão em valores de hoje, na moeda do plano. O cálculo está em `src/domain/non-financial-assets.js`.

- **Bens hoje e a parte do patrimônio que eles representam.** O patrimônio líquido sem bens é o que paga a aposentadoria.
- **Para cada R$ 1 disponível, quanto está em bens.** O tom é neutro. Só aparece um aviso quando os bens passam de metade do patrimônio.
- **Bens na aposentadoria.** É a soma dos valores no ano da aposentadoria. Um bem que sai antes mostra "Sai em {ano}".
- **Desvalorização dos veículos no ano.** É `valor(ano) − valor(ano+1)`, contada apenas enquanto o bem é mantido. É uma estimativa contábil: não é despesa nem saída de dinheiro.
- **Um card por bem, agrupado por tipo.** Mostra o valor hoje, na aposentadoria, a desvalorização no ano, o período no patrimônio e um gráfico pequeno do valor ao longo dos anos. O gráfico marca "hoje" com um círculo e "aposentadoria" com um losango, e todos os cards usam a mesma escala de anos. O card também traz selos de tipo, situação (ativo, previsto ou encerrado), origem do valor (soma de pagamentos vinculados) e solvência, no caso de imóvel.
- **Bens previstos e encerrados continuam visíveis**, com valor zero e a situação.
- **Pontos para revisar:**
  - veículo sem depreciação;
  - veículo por mais de 15 anos;
  - premissa fora do usual para imóvel;
  - imóvel que sai antes do fim do plano;
  - bem sem tipo;
  - imóvel cujo valor é a soma de pagamentos, que pode incluir ITBI e cartório;
  - bem em outra moeda.

## O que não fazer
- Não pôr bens em "disponível", nas liberações, no múltiplo da aposentadoria nem na capacidade de retirada.
- Não inventar venda, aluguel ou valor de mercado. Usar "valor estimado", nunca "preço".
- Não somar a desvalorização às despesas planejadas do carro, porque não há vínculo entre elas. Usar "desvalorização estimada", não "perda".

## Backlog
1. `assetId` opcional em despesas planejadas e metas. Permitiria mostrar o custo anual de cada bem e saber quando a troca renova o bem.
2. `debtId` opcional no bem, para mostrar o valor do imóvel menos o financiamento.
3. Valor de mercado opcional, com data (FIPE, avaliação), ao lado do valor de compra.
4. Linha de imobilizado no histórico do patrimônio.
5. Carro como sequência de trocas, em vez de um carro só depreciando até o fim.
6. Simulação "e se eu vendesse", com custos e impostos, marcada como hipótese.
7. Regras suíças para imóvel: Eigenmietwert e retiradas da previdência para a casa (WEF).
