# Composição do patrimônio no ano selecionado

No bloco “Patrimônio em xxxx comparado ao máximo”, passe o mouse sobre o nome, valor ou barra para abrir a composição. Também é possível usar Tab ou tocar no nome. O clique fixa o painel para leitura. Escape, o botão de fechar ou um clique fora o fecham.

- Financeiro líquido de dívidas: saldos financeiros menos todas as dívidas, sem bens ou imóveis.
- Patrimônio bruto: saldos financeiros mais imóveis e outros bens, antes das dívidas. Imóveis excluídos da avaliação de solvência continuam neste total.
- Cada grupo lista todos os itens pelo nome e saldo projetado: investimentos, previdências iniciais e contribuições acumuladas, caixa do planejamento, imóveis, outros bens, consórcios e dívidas. Os itens aparecem do maior para o menor valor, com subtotal do grupo.
- O grupo restrito identifica prazo de liberação, ausência de prazo e liquidez não informada. Após a liberação, o item passa ao grupo disponível, com o ano indicado. Um déficit de caixa conserva o sinal negativo.

Os valores vêm do fechamento projetado do ano selecionado, com a mesma moeda e base real ou nominal do gráfico. A projeção fornece uma cópia dos saldos individuais após rendimentos, contribuições, retiradas e liberações. Os valores do cadastro não são reapresentados como saldos futuros. Nenhum cálculo da projeção ou dado salvo foi alterado. Recortes sem posições individuais conservam o resumo agregado e identificam a ausência do detalhamento.

A composição acompanha a troca de ano sem recarregar a página. O modo de privacidade remove seu conteúdo. O painel adapta a largura em telas pequenas, preserva valores monetários em uma linha e permite rolar a lista inteira. Parágrafos explicativos foram substituídos por etiquetas curtas e linhas de composição.

Validação: `npm run validate` aprovado com 622 testes e build concluído. Cinco testes adicionais cobrem posições individuais, classificação e liberação, câmbio e inflação, valores negativos, nomes escapados e privacidade. A regressão também concilia as posições em cenários com previdência externa ou financiada e diferentes custos. Os testes anteriores de mouse, teclado, toque e fechamento permanecem. `git diff --check` sem erros. Inspeção visual pendente, pois a ferramenta de navegador não estava disponível nesta sessão.
