# Sprint: comparação visual de receitas e despesas

## Plano e decisão de usabilidade

Pedido: deixar evidente, na composição do ano selecionado no Fluxo de caixa, se as receitas superam as despesas.

O agente de usabilidade recomendou duas barras horizontais na mesma escala, conclusão textual e destaque para sobra ou falta. Priorizamos a comparação anual, depois a distinção entre despesas e metas, e por fim os estados especiais e a leitura em telas pequenas.

## Implementado

- Comparação no início de “Composição de…”, substituindo os três cartões de totais anteriores.
- Receitas e saídas com a mesma origem e escala. Saídas segmentadas em despesas e metas, com valores fora das barras e metas identificadas também por padrão listrado.
- Título informa receitas maiores, despesas maiores ou igualdade no ano selecionado. Quando as metas causam déficit apesar de as despesas estarem cobertas, o título explicita essa situação.
- Valor da sobra ou falta após despesas e metas, antes dos rendimentos. Cor e ícone complementam os textos.
- Ranking dos maiores gastos preservado abaixo, com legenda que distingue sua escala de participação da comparação de totais.
- Período, meses incluídos, moeda e base real ou nominal explícitos. Não anualiza períodos parciais nem reaplica inflação.
- Mesma composição da projeção, sem adicionar novamente previdência, liberações ou rendimentos.
- Mudança de ano usa o mecanismo existente e troca a comparação junto com os lançamentos. Ocultar valores remove a composição.
- Em telas pequenas, cabeçalho e saldo ficam empilhados. Valores mantêm duas casas e não quebram internamente. Ícones do resumo têm dimensões próprias, sem herdar a largura mínima do gráfico principal.

## Validação

Revisão do código pelo agente de usabilidade concluída, incluindo ajuste do título quando as metas causam falta. Seis novos testes cobrem sobra, déficit, metas, proporções acima de 100%, equilíbrio, ausência de dados, anos parciais, inflação, não duplicação de fluxos, ano selecionado e privacidade.

`npm run validate`: 576 testes aprovados e build concluído. O teste de inicialização da aplicação também passou. A inspeção visual em navegador real ficou pendente porque a ferramenta de navegador não está disponível nesta sessão.

Esta comparação descreve o saldo do período. A avaliação patrimonial permanece na seção própria e não é inferida apenas do resultado anual.

## Extensão: patrimônio restante ano a ano

- O gráfico patrimonial agora compara duas barras por ano: financeiro líquido de todas as dívidas, sem bens, e patrimônio bruto projetado, incluindo imóveis e outros bens antes das dívidas.
- Logo abaixo de “Composição de…”, cada saldo aparece em uma barra de preenchimento relativa ao seu próprio máximo projetado até a idade-alvo salva. Valor atual, percentual do máximo, valor máximo e ano do pico ficam visíveis. Por exemplo, 600 mil diante de um máximo de 1 milhão preenchem 60% da barra.
- Trocar o ano altera o preenchimento, mantendo a referência fixa. Saldos negativos conservam o valor em vermelho e deixam a barra vazia. Ausência de máximo positivo não gera percentual inválido.
- Liquidez disponível permanece separada. Financeiro líquido de dívidas pode conter saldos restritos e não corresponde ao patrimônio total líquido de dívidas, que pode incluir bens.
- Bruto projetado = saldo financeiro projetado + bens. Financeiro líquido = saldo financeiro projetado menos dívidas. Déficits diagnósticos do motor permanecem nos saldos, sem truncar valores negativos ou inventar empréstimos.
- As linhas de patrimônio considerado e liquidez permanecem no gráfico anual. O filtro de imóveis altera a avaliação de solvência, sem retirar bens do bruto nem modificar o caixa.
- Os valores são derivados após a conversão de preços. Recortes sem projeção patrimonial não recebem saldos inventados. Modo de privacidade remove barras e valores.

- O máximo usa a mesma base real ou nominal dos valores exibidos e considera fechamentos anuais. Na simulação até 100 anos, anos posteriores à idade-alvo salva não elevam a referência. Valores acima dela mostram o percentual efetivo, com preenchimento limitado a 100%. Se a projeção não alcança a idade-alvo, o texto identifica a referência como o período disponível.

Validação da extensão e do ajuste de referência: oito testes específicos, total de 584 testes aprovados, build concluído e `git diff --check` sem erros. A inspeção visual no navegador permanece pendente.
