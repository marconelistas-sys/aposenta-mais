# Gráficos anuais de patrimônio e fluxos

## Avaliação e plano

O agente de UX avaliou os componentes e revisou a implementação final. Identificou quatro fontes de confusão: barras e linhas patrimoniais sobrepostas, variação financeira chamada de resultado final, valores flutuantes sobre o desenho e seleção anual distante do primeiro gráfico.

A solução mantém dois gráficos e permite escolher quais perguntas cada um responde.

## Comportamento implementado

### Patrimônio ao fim de cada ano

- Visão essencial: patrimônio considerado após dívidas e filtro de imóveis, junto da liquidez disponível.
- Visão comparativa: acrescenta financeiro líquido de dívidas, sem bens, e patrimônio bruto com imóveis.
- Todas as séries usam linhas. Não há barras sugerindo parcelas somáveis.
- A descrição informa que as séries compartilham valores e não devem ser somadas.
- O resumo patrimonial do Dashboard usa os mesmos traçados e a mesma leitura por ano.

### Fluxos anuais

- Visão Orçamento: receitas, despesas e metas, saldo antes dos rendimentos.
- Visão Resultado: saldo do orçamento, rendimentos, créditos previdenciários e variação do patrimônio financeiro no ano.
- A fórmula de cada visão aparece antes do gráfico.
- Saldo abaixo de zero indica déficit no orçamento. Variação abaixo de zero indica redução dos ativos financeiros.
- Os títulos distinguem saldo acumulado de total durante o ano. O resumo também chama a variação financeira pelo mesmo nome.

### Leitura e navegação

- Seletor de ano acima do par, sincronizado com os cursores e a composição existente.
- Moeda e base explícitas: poder de compra do ano-base ou valores nominais de cada ano.
- Alterações de visão, inflação de apresentação ou filtro de imóveis preservam o ano disponível selecionado.
- Legendas antes do desenho. Ocultar uma série mantém a escala da visão escolhida.
- Leituras numéricas fora do desenho, disponíveis desde a primeira renderização.
- Prévia do ponteiro identificada. Ao sair ou pressionar Escape, a leitura volta ao ano selecionado.
- Tabelas expansíveis com valores exatos de todos os anos da visão escolhida, inclusive séries ocultadas na legenda.
- Celular mantém leitura textual, seleção anual e rolagem horizontal do desenho.

## Verificação

`npm run validate`: 632 testes passaram, sintaxe e build concluídos.

As novas verificações cobrem visões essenciais e comparativas, negativos, dados ausentes, tabelas, equivalência monetária, privacidade, seleção comum, prévia e Escape. A revisão encontrou e corrigiu um caso em que anos sem composição detalhada voltavam indevidamente ao primeiro ano.

Validação no Chrome headless com dados fictícios, componentes e CSS reais. A seleção comum atualizou os dois gráficos no DOM. As capturas usam desktop e contêiner estreito de 350 pixels. A verificação isolada não substitui teste da aplicação autenticada ou estudo com usuários.

As rotinas financeiras e a persistência dos valores não foram alteradas. As novas preferências são de visualização e permanecem em memória.
