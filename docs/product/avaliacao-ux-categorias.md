# Avaliação de UX: aba "Categorias" do Orçamento

## Pedido e escopo

O dono descreveu a aba `/orcamento?aba=categorias` (título "Despesas por categoria") como "meio convoluta" e pediu para melhorar a utilidade dela. Esta avaliação revisa a aba, propõe uma tela nova e não altera código.

Evidências: capturas a 1.440 e 390 pixels e o texto visível da aba, com dados fictícios (outubro de 2026: 12 categorias de despesa, planejado CHF 7.317,10, realizado CHF 7.717,10). Código lido: `renderBudgetCategories` (`src/features/cash-flow/budget-categories.js`), `renderBudgetExpensePies` e `renderOtherExpenseAnalysis` (`src/shared/budget-expense-pies.js`), `renderBudgetCategoryBars` (`src/shared/budget-category-bars.js`), `renderBudgetExpenseOverruns` (`src/shared/budget-expense-overruns.js`), `entryDetails` (`src/shared/budget-category-entries.js`), as funções de domínio em `src/domain/budget-overview.js`, `budget-expense-overruns.js`, `budget-expense-distribution.js` e `other-expense-analysis.js`, os tratadores em `src/main.js`, os estilos em `src/styles/budget-overview.css` e a aba irmã "Conferir o mês" (`month-check.js`, plano `docs/product/conferir-mes.md`).

Rótulos: [fato] verificado no código ou na captura; [contagem] medido na captura ou no texto; [suposição] decisão sem dado; [validar] pede confirmação do dono; [verificar no navegador] depende da renderização real. Não houve teste com usuários. As contagens servem de linha de base, não são resultado medido com pessoas.

## O que mudou ao redor desta aba

Até hoje, Categorias era o único lugar do Orçamento que dizia onde o gasto passou do planejado. Isso mudou:

- **Conferir o mês** responde, para um mês, se a pessoa está dentro do planejado, onde passou (até 3 categorias, mais linhas de compensação que fecham ao centavo) e o que ainda falta lançar. Cada categoria tem um "›" que abre Categorias naquele mês, ordenada por "Maior excesso", com a categoria já aberta [fato: `month-check.js:79`, `main.js:948-961`].
- **Panorama, aba Fluxo e gastos** (`/panorama?aba=gastos`) faz a análise do ano: desvio por categoria no acumulado, uso da cota anual, gastos sem orçamento, tendência de 3 e 12 meses e prioridade de corte [fato: `report-view.js:160-215`].

Os dois blocos de análise desta aba ("Para onde vai o dinheiro" e "Gastos acima do planejado") ficaram, portanto, repetindo telas que agora fazem melhor esse papel.

## Para que a pessoa abre esta aba

Sobra para Categorias um trabalho que nenhuma outra tela faz: **ser o livro das categorias**. Quem abre esta aba quer:

1. **Ver todas as categorias do período, lado a lado.** Planejado, realizado e diferença de cada uma, não só as exceções. É o destino de "Ver todas as categorias" e do "›" de Conferir o mês.
2. **Abrir uma categoria e ver os lançamentos.** Saber qual lançamento fez Lazer passar do planejado, ou o que compõe Mercado.
3. **Corrigir.** Editar um lançamento, mudar a categoria dele, planejar uma categoria sem planejado, lançar um realizado que falta, reclassificar o que está em "Outras despesas".
4. **Trocar o período.** O mês (padrão), o acumulado de janeiro até o mês ou o ano inteiro.
5. **Ordenar.** Pela diferença (onde olhar) ou pelo realizado (para onde vai o dinheiro).

Tarefas e critério de sucesso:

| # | Tarefa | Sucesso |
|---|---|---|
| T1 | A partir do "›" de Lazer em Conferir o mês, achar o lançamento que mais pesou e abrir para editar | ≤ 2 cliques e ≤ 20 s |
| T2 | "Quanto você planejou e gastou com Mercado de janeiro a outubro?" | Resposta certa em ≤ 15 s |
| T3 | "Qual é a maior despesa de outubro?" | Resposta certa em ≤ 5 s |
| T4 | Mover um lançamento de "Outras despesas" para a categoria certa | ≤ 4 cliques até salvar |
| T5 | A 390 px, ler o realizado e a diferença de Restaurantes | Sem rolagem lateral |

## Contagens da tela atual (linha de base)

| Medida | Valor | Fonte |
|---|---|---|
| Altura da página a 1.440 px | 5.277 px | [contagem] captura a 1.440 px |
| Início da tabela, o único lugar que abre lançamentos, a 1.440 px | Cerca de 3.850 px, 73% da página. A primeira categoria fica perto de 3.960 px | [contagem] captura a 1.440 px |
| Altura da página a 390 px | 7.640 px, cerca de 9 telas de 844 px | [contagem] captura a 390 px |
| Início da tabela a 390 px | Cerca de 6.140 px, depois de 7 telas | [contagem] captura a 390 px |
| Valores em dinheiro na aba | 79 para 27 valores distintos. 43 ficam acima da tabela e repetem o que a tabela mostra | [contagem] texto visível |
| Vezes em que o mesmo valor aparece | Restaurantes realizado (CHF 820,00): 4 vezes em texto, mais 3 marcas gráficas (barra, fatia e barrinha da tabela). Moradia (CHF 2.650,00): 6 vezes | [contagem] texto visível |
| Vezes em que o nome de uma categoria aparece | Restaurantes e delivery: 6 | [contagem] texto visível |
| Controles que mudam a exibição | 6: 3 seletores no cabeçalho (Ano, Período, Ordenar), 1 seletor "Período analisado" e 2 controles deslizantes | [fato] `budget-categories.js:28`, `budget-expense-overruns.js:17, 29`, `budget-expense-pies.js:57` |
| Gatilhos que abrem uma categoria | 61 para 12 categorias, cerca de 5 por categoria: 22 barras, 12 fatias, 12 itens de legenda, 3 links de excesso e 12 linhas da tabela | [contagem] código e texto |
| Paradas de Tab antes da primeira linha da tabela | 57 | [contagem] a partir do código. [verificar no navegador] |
| Frases explicativas visíveis, sem dado | 22 | [contagem] texto visível |
| Avisos de que os realizados podem estar incompletos | 4 | [contagem] texto visível |
| Detalhes "Como…" dentro da aba | 3: "Como calculamos os gráficos", "Como as despesas são calculadas" e "Sem planejamento" | [fato] `budget-expense-pies.js:63`, `budget-categories.js:39`, `budget-expense-overruns.js:28` |
| Codificações de cor para "Realizado" | 4: vermelho, laranja ou azul por tamanho nas barras; marrom nos cartões de excesso; cor por categoria nas pizzas; azul da marca na tabela | [fato] `budget-category-bars.js:14`, `budget-expense-pies.js:11-18`, `budget-overview.css:31` |

O texto citado entre aspas nas tabelas reproduz a tela atual.

## Achados heurísticos

Severidade de 0 a 4 (Nielsen): 4 impede a tarefa, 3 problema grave, 2 problema moderado, 1 cosmético ou de baixo impacto.

| # | Sev. | Heurística | Achado e consequência | Evidência |
|---|---|---|---|---|
| C1 | 3 | 7 Eficiência e 1 Visibilidade | A tabela, único lugar onde se abre e edita um lançamento, começa a 3.850 px no desktop e a 6.140 px no celular. Antes dela há 57 paradas de Tab. Quem chega pela aba (e não pelo "›") precisa rolar por dois gráficos de barras, um bloco de excessos e duas pizzas para chegar ao que veio fazer. | [contagem] capturas. [fato] ordem em `budget-categories.js:39`: gráficos, depois tabela |
| C2 | 3 | 8 Minimalismo e 4 Consistência | Os mesmos valores por categoria aparecem em até 4 lugares em texto (barras do realizado e do planejado, cartões de excesso, legendas das pizzas e tabela) e em até 3 marcas gráficas. 43 dos 79 valores em dinheiro ficam acima da tabela e repetem a tabela. A pessoa compara blocos para ver se dizem coisas diferentes, e não dizem. | [contagem] texto visível. [fato] `budget-category-bars.js:7-16`, `budget-expense-pies.js:59-62`, `budget-expense-overruns.js:23-26` |
| C3 | 3 | 4 Consistência | "Gastos acima do planejado" responde à mesma pergunta de "Onde passou do planejado" (Conferir o mês) com outra regra e outro número. Com o limite padrão de 10%, esconde Mercado (+CHF 40,00) e Saúde (+CHF 40,00) e soma "Excesso nas categorias exibidas: CHF 500,00". Conferir o mês fecha ao centavo em +CHF 400,00. Duas abas vizinhas dão dois números para "quanto passei". | [fato] `budget-expense-overruns.js:5, 12, 28`; `month-check.js:96-108`. Texto visível |
| C4 | 3 | 4 Consistência e 2 Linguagem do usuário | Vermelho quer dizer coisas opostas na mesma tela. Nas barras, vermelho marca categoria **grande** (a partir de 20% da maior); na tabela e em Conferir o mês, vermelho marca **acima do planejado**. Moradia, exatamente no planejado, é a barra mais vermelha; Lazer, 43% acima, é laranja. | [fato] `budget-category-bars.js:14`, `budget-overview.css:32`. Captura a 1.440 px |
| C5 | 2 | 8 Minimalismo e 7 Eficiência | Dois controles deslizantes mudam só a exibição: "Excesso mínimo" (0 a 100%) e "Detalhamento das categorias" (quantas fatias individuais). No acumulado, entram mais dois seletores ("Período analisado" e "Comparar o realizado acumulado com"). Cada um é uma decisão que a pessoa não veio tomar. | [fato] `budget-expense-overruns.js:17, 19, 29`; `budget-expense-pies.js:57` |
| C6 | 2 | 4 Consistência | O mês tem dois controles. O seletor global "Mês do orçamento" fica acima das abas; os seletores "Ano" e "Período" da aba mudam o mesmo mês global e mostram o aviso "Mês de comparação atualizado.". O Ano lista anos sem relação com o uso (2024 a 2028 e 2051). | [fato] `budget-categories.js:52-56`, `main.js:765-776, 2709`, `budget-overview.js:7-16` |
| C7 | 2 | 1 Visibilidade e 2 Linguagem | Em "Ano completo", as barras mostram média mensal ("total anual dividido por 12") e a tabela e as pizzas mostram o total do ano. A mesma categoria aparece com dois valores na mesma tela. No ano em andamento, a diferença anual compara o planejado do ano inteiro com o realizado até hoje, e a tabela mostra um "abaixo do planejado" grande que não é economia. | [fato] `budget-category-bars.js:5, 18`; `budget-categories.js:31, 39` |
| C8 | 2 | 3 Controle e liberdade | Clicar numa barra, fatia, legenda ou link de excesso rola a página de 2.000 a 3.000 px até a tabela e **fecha todas as outras categorias abertas**. Não há caminho de volta além de rolar. | [fato] `budget-expense-pies.js:105-107` |
| C9 | 2 | 4 Consistência e 3 Controle | Com valores ocultos, a aba esconde tudo, inclusive os nomes. Conferir o mês e o Panorama mostram os nomes com valores mascarados. O "›" de Conferir o mês continua visível com valores ocultos e leva a um painel "Valores ocultos" sem botão "Mostrar valores". É um beco sem saída. | [fato] `budget-categories.js:29`, `month-check.js:79, 100`, `report-view.js:550`. Conferir o mês tem o botão (`main.js:1263-1271`) |
| C10 | 2 | 4 Consistência (celular) | A 390 px, a tabela precisa de pelo menos 690 px (190 px na primeira coluna e 125 px em cada uma das outras quatro). Só Categoria e Planejado aparecem; Realizado e Diferença exigem rolagem lateral dentro da tabela. Os lançamentos de uma categoria aberta ficam espremidos na primeira coluna. | [fato] `budget-overview.css:13-14`. [contagem] captura a 390 px. [verificar no navegador] categoria aberta |
| C11 | 2 | 8 Minimalismo | Há 22 frases explicativas sem dado e 4 avisos de que os realizados podem estar incompletos. Três detalhes explicam regras parecidas com textos diferentes. | [contagem] texto visível |
| C12 | 2 | 8 Minimalismo (gráfico) | As duas pizzas comparam participação por ângulo, o que é difícil de ler entre duas pizzas. "Demais categorias" vira a segunda maior fatia (26%) e esconde 7 categorias; para vê-las, é preciso arrastar o controle de detalhamento. | [fato] `budget-expense-distribution.js:7-9`, `budget-expense-pies.js:54`. Captura a 1.440 px |
| C13 | 1 | 4 Consistência | O mesmo fato recebe três rótulos na mesma linha: em Viagens, "Sem registros", "Sem realizado" e "Não calculado"; em Compras, "Sem registros", "Sem planejamento" e "Não calculado". | [fato] `budget-categories.js:36-37` |
| C14 | 1 | 4 Consistência | Formatos diferentes da aba irmã: percentual com decimal ("+82,2%") contra inteiro em Conferir o mês ("+82%"); sinal negativo com hífen ("-CHF 20,00") contra U+2212; "Outubro De 2026" (capitalização por CSS); "Maior excesso" para uma ordenação que também ordena diferenças negativas; "Ver lançamentos" repetido 12 vezes e "Ver e editar lançamentos" nos cartões. | [fato] `budget-categories.js:10, 37`, `budget-overview.css:9`, `month-check.js:8, 19` |
| C15 | 1 | 7 Eficiência | Dentro de uma categoria, os lançamentos vêm na ordem do cadastro, não do maior para o menor. No modo mês, cada lançamento repete "outubro de 2026". Não há "Lançar realizado" na categoria, e "Adicionar planejado" só aparece quando a categoria não tem nenhum planejado. | [fato] `budget-category-entries.js:15`, `budget-categories.js:36` |

O que funciona e deve ficar:

- Ordem padrão por maior diferença (`budget-categories.js:7`), que deixa no alto o que merece atenção.
- O "›" de Conferir o mês abre a categoria certa, no mês certo, já aberta (`main.js:948-961`).
- Depois de editar um lançamento, a tela volta para ele, com a categoria aberta e o foco no lançamento (`main.js:703-713, 2522-2537`).
- O atalho "Adicionar planejado" na categoria sem planejado (`main.js:895-918`).
- As notas por lançamento: vinculado automaticamente ao planejado, mais de um planejado compatível, proporção mensal do valor anual, convertido de outra moeda (`budget-category-entries.js:15`).
- A análise de "Outras despesas", que agrupa pela descrição e sugere categoria (`other-expense-analysis.js`). É uma ferramenta de correção, não de leitura, e pertence a esta aba.
- Dígitos de largura fixa na tabela (`budget-overview.css:12`).

## O que os dados já oferecem

| Pergunta | Fonte existente | Cálculo novo? |
|---|---|---|
| Planejado, realizado, diferença e lançamentos por categoria, no mês ou no ano | `budgetExpenseCategories(period)` sobre `buildBudgetYear(state, ano)` | Não [fato] |
| O mesmo, de janeiro até o mês | `budgetExpenseAccumulated(modelo, mês).categories`. As linhas que só têm planejado depois do mês chegam sem `difference`; tratar como "sem realizado" | Não [fato]. [verificar no código] campo ausente |
| Meses com realizado no período | `actualMonths` das duas funções acima | Não [fato] |
| Quanto do planejado do ano já foi usado | `budgetAnnualQuota(categorias).usedPercent` | Não [fato] |
| Tamanho relativo de cada categoria (barra da linha) | Valor dividido pelo maior planejado ou realizado do período, como a tabela já faz | Não [fato] `budget-categories.js:35` |
| Grupos sugeridos dentro de "Outras despesas" | `otherExpenseAnalysis(categorias, …)` | Não [fato] |
| Receitas por categoria | `budgetExpenseCategories(period, 'income')` | Não [fato] |
| Lançar realizado já com a categoria | `data-record-budget-category` (`main.js:920-946`). Hoje, ao salvar, volta para Conferir o mês (`main.js:2568-2574`) | Só o destino da volta |
| Planejar uma categoria | `data-plan-budget-category` (`main.js:895-918`). Aceita só despesa (`main.js:899`) | Não |

Toda a proposta funciona com a matemática existente, mais ordenação e filtros.

## Proposta de hierarquia

Princípio: **a tabela é a tela**. Uma linha por categoria, com os números e uma barra; um clique abre os lançamentos na largura toda; cada valor aparece uma vez. A análise fica em Conferir o mês (um mês) e no Panorama (o ano).

Ordem fixa, igual no desktop e no celular:

1. **Cabeçalho da aba**: título, período e moeda em uma linha; o seletor de período (Mês, Janeiro até o mês, Ano) e "Ordenar por".
2. **Lista de categorias**: Categoria, Planejado, Realizado, Diferença e uma barra que mostra o realizado contra o planejado.
3. **Linha de total**.
4. **Rodapé**: uma linha sobre a base dos números e um único detalhe "Como os valores são calculados".

O mês vem do seletor global "Mês do orçamento", como em Conferir o mês. A aba não tem mais seletor de ano nem lista de meses.

### Desktop (1.440 px). Nomes de lançamentos ilustrativos

```
 [←] [ outubro de 2026  ▾ ] [→]
  Conferir o mês  ┌ Categorias ┐  Lançamentos   Ano do orçamento
 ╞════════════════╧════════════╧════════════════════════════════════════════════════╡
 │ Despesas por categoria                                         Ordenar por       │
 │ Outubro de 2026 · CHF                                      [ Maior diferença ▾ ] │
 │ [● Outubro ] [ Janeiro a outubro ] [ Ano de 2026 ]                               │
 │                                                                                  │
 │ Categoria                    Planejado     Realizado      Diferença              │
 │ › Restaurantes e delivery   CHF 450,00    CHF 820,00    +CHF 370,00  ████│▒▒▒▒▒▒ │
 │                                                               +82%               │
 │ › Compras  sem planejado    Sem planejado CHF 240,00    +CHF 240,00  ███         │
 │ ⌄ Lazer                     CHF 300,00    CHF 430,00    +CHF 130,00  ███│▒       │
 │                                                               +43%               │
 │   ┌ Realizado (3) ──────────────────────┐ ┌ Planejado (1) ──────────────────────┐│
 │   │ Show              12/10  CHF 250,00 │ │ Lazer do mês     mensal  CHF 300,00 ││
 │   │ Parque            20/10  CHF 120,00 │ └─────────────────────────────────────┘│
 │   │ Cinema            04/10   CHF 60,00 │  [Lançar realizado] [Adicionar planej.]│
 │   └─────────────────────────────────────┘                                        │
 │ › Mercado e alimentação     CHF 900,00    CHF 940,00     +CHF 40,00  ████████│▒  │
 │ › Saúde                     CHF 520,00    CHF 560,00     +CHF 40,00  █████│▒     │
 │ › Assinaturas e serviços     CHF 90,00     CHF 90,00       CHF 0,00  █│          │
 │ ...                                                                              │
 │ › Transporte                CHF 380,00    CHF 360,00     −CHF 20,00  ████░│      │
 │ › Viagens                   CHF 400,00    Nada lançado        —      ░░░░│       │
 │ ──────────────────────────────────────────────────────────────────────────────── │
 │   Total de despesas       CHF 7.317,10  CHF 7.717,10    +CHF 400,00              │
 │                                                                                  │
 │ Diferença = realizado menos planejado.          › Como os valores são calculados │
 └──────────────────────────────────────────────────────────────────────────────────┘
```

Legenda da barra: `█` realizado dentro do planejado; `▒` parte do realizado acima do planejado; `░` planejado ainda sem realizado; `│` marca o planejado. A escala é a mesma em todas as linhas (o maior planejado ou realizado do período), como hoje (`budget-categories.js:35`).

Regras de layout:

- Uma linha recolhida tem cerca de 56 px. Sem "Ver lançamentos" embaixo do nome: o "›" e o cursor indicam que a linha abre.
- A linha aberta usa a largura toda. Realizado à esquerda, porque é o que a pessoa procura quando chega pelo "›". Lançamentos do maior para o menor valor.
- No modo mês, cada lançamento mostra o dia (eventuais) ou a frequência ("mensal", "anual ÷ 12"). Nos períodos de vários meses, mostra o mês.
- Cor só no que passou do planejado: o texto da diferença positiva e o trecho `▒` da barra. Nunca no valor inteiro e nunca pelo tamanho (corrige C4).
- Percentual inteiro abaixo da diferença, só quando há planejado. Sinal com U+2212 (corrige C14).
- Abrir uma categoria não fecha as outras (corrige C8).
- Cabeçalho da lista fixo no alto ao rolar, quando houver mais de 12 categorias [suposição].

### Celular (390 px)

```
 [Conferir o mês] [Categorias] [Lança›
 Despesas por categoria
 Outubro de 2026 · CHF
 [● Outubro][Jan. a out.][2026]
 Ordenar por [ Maior diferença ▾ ]
 ┌───────────────────────────────────┐
 │ › Restaurantes e delivery         │
 │   +CHF 370,00              +82%   │
 │   planejado 450,00 · real 820,00  │
 │   ██████████│▒▒▒▒▒▒▒▒▒            │
 ├───────────────────────────────────┤
 │ › Compras          sem planejado  │
 │   +CHF 240,00                     │
 │   realizado 240,00                │
 ├───────────────────────────────────┤
 │ ⌄ Lazer                           │
 │   +CHF 130,00              +43%   │
 │   planejado 300,00 · real 430,00  │
 │   Realizado (3)                   │
 │   Show        12/10   CHF 250,00  │
 │   Parque      20/10   CHF 120,00  │
 │   Cinema      04/10    CHF 60,00  │
 │   Planejado (1)                   │
 │   Lazer do mês mensal CHF 300,00  │
 │   [Lançar realizado]              │
 ├───────────────────────────────────┤
 │ › Viagens                         │
 │   Nada lançado                    │
 │   planejado 400,00                │
 ├───────────────────────────────────┤
 │ Total de despesas  +CHF 400,00    │
 │   planejado 7.317,10 · real 7.717,10
 └───────────────────────────────────┘
 › Como os valores são calculados
```

No celular, a diferença vem primeiro em cada linha, como em Conferir o mês, e o planejado e o realizado ficam numa linha menor abaixo. Nenhuma rolagem lateral (corrige C10). Meta: o título da aba e a primeira categoria cabem na primeira tela de 844 px. [verificar no navegador]

## O que sai, o que se funde e o que muda de lugar

| Elemento atual | Destino | Motivo |
|---|---|---|
| Bloco "Para onde vai o dinheiro" (`budget-expense-pies.js:63`) | Sai. A pergunta vira a ordenação "Maior realizado" com a barra de cada linha | C1, C2 |
| Dois gráficos de barras "Gasto mensal por categoria" (`budget-category-bars.js`) | Saem. A barra da linha mostra tamanho e excesso numa só marca | C2, C4, C7 |
| "Gastos acima do planejado", controle "Excesso mínimo" e "Sem planejamento" (`budget-expense-overruns.js`) | Saem. No mês: "Onde passou do planejado" em Conferir o mês e a ordenação "Maior diferença" aqui. No acumulado: período "Janeiro a outubro" e a mesma ordenação. Limiar de relevância: "desvio material" no Panorama | C3, C5 |
| "Consumo da cota anual" (dentro do bloco de excessos, `budget-expense-overruns.js:22`) | Sai. Período "Ano de 2026" mostra o uso por categoria; a análise com o ritmo do ano fica no Panorama | C5, C7 |
| Controle "Detalhamento das categorias" e as duas pizzas | Saem | C5, C12 |
| "Analisar Outras despesas" (`budget-expense-pies.js:37-49`) | Fica, dentro da linha aberta de "Outras despesas", como "Sugestões pela descrição": grupos com valor e lançamentos editáveis, sem pizzas | Ferramenta de correção (T4) |
| Seletores "Ano" e "Período" do cabeçalho da aba | Viram um seletor de 3 opções. O mês vem do seletor global | C6 |
| "Ordenar por" | Fica. Opções renomeadas (ver Texto) | — |
| Coluna "Variação" | Funde-se com Diferença, em percentual inteiro abaixo do valor | C14 |
| Duas barrinhas por linha (planejado e realizado, `budget-categories.js:36`) | Viram uma barra por linha | C2 |
| Lançamentos dentro da primeira coluna | Linha aberta em largura total, Realizado primeiro, do maior para o menor | C10, C15 |
| "Ver lançamentos" sob cada nome | Sai. O "›" e o nome acessível ("Lazer: ver lançamentos") bastam | C14 |
| Frase de método da tabela, "Como as despesas são calculadas" e "Como calculamos os gráficos" | Fundem-se em "Como os valores são calculados", com cada regra uma vez | C11 |
| Avisos "podem estar incompletos" (4) | Saem. Nos períodos de vários meses, uma linha factual: "Realizados lançados em 7 de 10 meses." | C11 |
| Painel "Valores ocultos" que esconde a aba inteira | Nomes visíveis, valores mascarados, botão "Mostrar valores" | C9 |
| Link "Ver para onde vai o dinheiro" em Lançamentos (`cash-flow.js:757`) | Vira "Ver gastos por categoria": abre esta aba no mês, ordenada por "Maior realizado" | Destino removido |

### O que outras telas usam e precisa continuar funcionando

| Dependência | Onde | O que fazer |
|---|---|---|
| `<details data-budget-category-details="id">` com `<summary>`, classe `budget-category-details` | `main.js:955-958` (o "›" de Conferir o mês), `main.js:2531` | Manter na nova linha. A linha passa a ser um `<details>` com grade, não uma célula de tabela |
| Botões `data-edit-budget-category`, `data-category-item-id`, `data-category-entry-month` | `main.js:705, 1573-1591, 2527, 2577` (editar e voltar ao lançamento) | Manter em cada lançamento |
| `data-plan-budget-category` e `data-plan-budget-month` | `main.js:895-918`; teste `budget-categories.test.js:32` | Manter |
| `data-budget-category-control="sort"` | Foco de reserva em `main.js:2534` | Manter no seletor de ordenação |
| `budgetCategoriesView` e `resetBudgetCategories` | `main.js:768-769, 868-869, 952`; testes | Trocar `year`/`month` por `period: 'month' \| 'to-date' \| 'year'`, mantendo `sort`. O mês vem de `state.cashFlow.referenceMonth`, que já é o mês aberto pelo "›" [fato: `month-check.js:156`] |
| Link `data-show-budget-expense-pies` em Lançamentos | `main.js:867-877` foca `#budget-expense-pies-title`; o script `check-budget-overview-browser.mjs:601-605` confere esse foco | Novo destino: título da aba, com `sort = 'actual'`. Atualizar o script |
| `bindBudgetExpensePies` e `budgetCategoryPieData` | `main.js:173-182` | Sair junto com as pizzas |
| Funções de domínio `budgetExpenseOverruns`, `budgetExpenseAccumulated`, `budgetAnnualQuota`, `budgetExpenseComparison` | `src/domain/month-check.js`, `financial-report.js`, `budget-year-to-date.js` | Ficam. Só os renderizadores saem |
| `entryDetails` | `budget-year-to-date.js:93` (Ano do orçamento) | Manter a assinatura atual. A nova linha pode usar uma opção nova de layout |
| Panorama | Não importa nenhum destes renderizadores (`report-view.js:6-10`); só leva para `/orcamento?aba=categorias` (`report-view.js:479`) | Manter a rota |
| Testes | `budget-categories.test.js:65-72` exige que nenhum nome apareça com valores ocultos; `budget-expense-distribution.test.js`, `budget-expense-overruns.test.js:149-150`, `other-expense-analysis.test.js:57-66`, `check-budget-overview-browser.mjs:145-300` | Reescrever para a nova regra de privacidade e remover os casos das pizzas, barras e excessos |

## Texto (pt-BR, linguagem simples)

Vocabulário igual ao de Conferir o mês: **Planejado**, **Realizado**, **Diferença** (realizado menos planejado), "sem planejado", "Nada lançado". Centavos em todos os valores. Percentual inteiro.

| Atual | Proposto |
|---|---|
| "Compare o planejado com o realizado. Abra uma categoria e selecione um lançamento para editar suas informações." | Sai. O "›" e o cursor já indicam a ação. Na primeira visita sem nenhuma categoria aberta, uma linha: "Abra uma categoria para ver e editar os lançamentos." [suposição] |
| "Outubro De 2026 · CHF" | "Outubro de 2026 · CHF" |
| Seletor "Período": "Ano completo", "janeiro" … "dezembro" | "Outubro", "Janeiro a outubro", "Ano de 2026". Em janeiro, só "Janeiro" e "Ano de 2026" |
| "Ordenar por": "Maior excesso", "Maior planejado", "Maior realizado", "Categoria" | "Maior diferença", "Maior realizado", "Maior planejado", "Nome (A a Z)" |
| Diferença "+CHF 370,00" e Variação "+82,2%" | "+CHF 370,00", e abaixo "+82%" |
| "-CHF 20,00" e "-5,3%" | "−CHF 20,00" e "−5%" |
| "Sem registros" (planejado) | "Sem planejado" |
| "Sem registros" (realizado) | "Nada lançado" |
| "Sem realizado" e "Não calculado" | "—" (leitor de tela: "sem comparação") |
| "Sem planejamento" (abaixo da diferença) | Etiqueta "sem planejado" ao lado do nome, como em Conferir o mês |
| "Ver lançamentos" e "Ver e editar lançamentos" | Saem. Nome acessível do resumo: "Lazer: ver lançamentos" |
| Títulos "Planejado" e "Realizado" dentro da categoria | "Realizado (3)" e "Planejado (1)" |
| (não existe) | Ações da categoria: "Lançar realizado" e "Adicionar planejado" |
| "Analisar Outras despesas" | Dentro de Outras despesas: "Sugestões pela descrição". Linha: "Agrupado pela descrição. A categoria só muda quando você edita o lançamento." |
| "Diferença = realizado menos planejado. Valores positivos indicam…" mais 2 detalhes | "Diferença = realizado menos planejado." e o detalhe "Como os valores são calculados" |
| "Há despesas realizadas em N de 12 meses. A comparação anual inclui todo o planejado…" | "Realizados lançados em N de 10 meses." |
| "Valores ocultos. Exiba os valores para consultar as despesas por categoria." | "Valores ocultos." e o botão "Mostrar valores". A lista continua, com nomes |
| "Nenhuma despesa planejada ou realizada neste período." | "Outubro não tem despesas planejadas nem realizadas." Linha 2: "Planeje o mês ou importe um extrato." |
| Link em Lançamentos: "Ver para onde vai o dinheiro" | "Ver gastos por categoria" |

Conteúdo do detalhe único (cada regra uma vez): a diferença é o realizado menos o planejado; valores anuais entram como 1/12 por mês; eventuais entram no mês da data; metas anuais, calendário e consórcios entram como despesa planejada; aplicações, resgates e transferências próprias ficam fora, exceto tarifas identificadas; outras moedas usam o câmbio da visão; "Janeiro a outubro" compara o planejado e o realizado só desses meses; "Ano de 2026" mostra o planejado do ano inteiro.

## Estados

Cálculo local e síncrono: não há carregamento nem erro de rede. Mês inválido já gera aviso pela navegação de mês (`main.js:765`). Os estados que importam são de conteúdo, de período e de privacidade.

| Estado | Condição | Linha de cada categoria | Linha de total e rodapé | Ações |
|---|---|---|---|---|
| Mês com planejado e realizado | Padrão | Completa, com barra | Total completo | Abrir, editar, Lançar realizado, Adicionar planejado |
| Mês em andamento | Mês = atual | Completa. A barra mostra o que já foi lançado | Ao lado do título: "· em andamento" | Iguais |
| Mês futuro | Mês > atual | Só Planejado e a parte `░` da barra | "Novembro ainda não começou. Mostrando só o planejado." | Sem "Lançar realizado" |
| Sem realizado no mês | Nenhum realizado de despesa | Realizado "Nada lançado", Diferença "—" | "Nada lançado como realizado em outubro." Ordem "Maior diferença" desempata pelo planejado | Lançar realizado por categoria |
| Sem planejado no mês | Nenhum planejado de despesa | Planejado "Sem planejado", Diferença = realizado, sem percentual | Total sem percentual | "Adicionar planejado" em cada linha |
| Período vazio | Sem planejado e sem realizado | Sem lista | "Outubro não tem despesas planejadas nem realizadas." | Planejar o mês, Importar extrato (as mesmas de Conferir o mês) |
| Categoria planejada sem realizado | `planned > 0` e nenhum realizado | "Nada lançado", "—", barra só `░` | — | Lançar realizado |
| Gasto sem planejado | `unplanned` | Etiqueta "sem planejado", Diferença = realizado, sem percentual | — | Adicionar planejado |
| Janeiro até o mês | `period = 'to-date'` | Planejado e realizado de janeiro até o mês | "Realizados lançados em N de M meses." | Iguais. Lançamentos mostram o mês |
| Ano encerrado | `period = 'year'`, ano < atual | Como no mês, com totais do ano | "Realizados lançados em N de 12 meses." | Iguais |
| Ano em andamento | `period = 'year'`, ano = atual | Planejado do ano, realizado até agora e, no lugar da Diferença, "Usado: 64%" (`budgetAnnualQuota`). Barra: realizado contra o planejado do ano | "2026 ainda não terminou. A comparação com o planejado do ano inteiro fica no Panorama." com link | Iguais. [validar] |
| Valores ocultos | `state.valuesHidden` | Nomes visíveis; valores `CHF •••••`; sem barra, sem sinal, sem cor, sem percentual. Lançamentos com descrição e valor mascarado, como texto (o clique de edição já é ignorado com valores ocultos, `main.js:1575`) | "Valores ocultos." e "Mostrar valores", que reaproveita o tratador de Conferir o mês (`main.js:1263`) | Sem ações por linha. Ordem forçada para "Nome (A a Z)", com o seletor desativado, porque a ordem por valor revelaria a classificação [validar] |
| Muitas categorias | Mais de 12 linhas | Iguais, recolhidas | Cabeçalho da lista fixo ao rolar [suposição] | Fase 2: filtros "Acima do planejado", "Nada lançado", "Sem planejado", com contagem |
| Muitos lançamentos numa categoria | Mais de 10 realizados | Os 10 maiores e "Ver todos os 37" na própria linha | — | — [suposição] |
| Outras despesas com lançamentos | `otherExpenseAnalysis` com grupos | A linha aberta mostra também "Sugestões pela descrição" | — | Editar lançamento para trocar a categoria |
| Lançamento de meta, calendário ou consórcio | Origem fora do Orçamento | Nota "Editar em Calendário" (ou Metas, Consórcios), porque o clique leva para outra tela (`main.js:1577-1583`) | — | — |
| Depois de salvar uma edição | Formulário salvo | A categoria continua aberta e o foco volta ao lançamento (comportamento atual) | Aviso "Lançamento atualizado. Os totais foram recalculados." | — |
| Conteúdo extremo | Nome longo, valor ≥ CHF 1.000.000 a 390 px | O nome quebra a linha; o valor nunca quebra nem encolhe | — | — |
| Receitas | Fase 2 [validar] | Mesmo desenho, grupo "Receitas" abaixo das despesas, com `budgetExpenseCategories(period, 'income')`. "Adicionar planejado" precisa aceitar receita (`main.js:899`) | Total próprio | Lançar realizado já aceita receita |

## Implementação sugerida

1. Reescrever `renderBudgetCategories(state)` sobre `buildBudgetYear`, `budgetExpenseCategories` (mês e ano), `budgetExpenseAccumulated` (janeiro até o mês), `budgetAnnualQuota` (ano em andamento) e `otherExpenseAnalysis`. Sem cálculo financeiro novo: só ordenação, a escala da barra que já existe e formatação.
2. Trocar `budgetCategoriesView` por `{ period, sort }`. O mês sai de `state.cashFlow.referenceMonth`. Ajustar `main.js:768-769` (mudança de mês), `main.js:867-877` (link de Lançamentos, agora com `sort = 'actual'`) e `main.js:948-961` (o "›", agora com `period = 'month'` e `sort = 'difference'`).
3. Cada categoria vira um `<details data-budget-category-details>` com o resumo em grade (desktop) ou em pilha (celular). Cabeçalho visual das colunas e rótulos ocultos para leitor de tela em cada valor ("Planejado: CHF 300,00"). [verificar no navegador] com leitor de tela.
4. Linha aberta: lançamentos com `data-edit-budget-category`, do maior para o menor; botões "Lançar realizado" (`data-record-budget-category`) e "Adicionar planejado" (`data-plan-budget-category`). O "Lançar realizado" vindo daqui precisa voltar para esta aba, como já faz o caminho de "Adicionar planejado" (`main.js:2575-2582`), e não para Conferir o mês.
5. Valores ocultos: renderizar a lista com `privateCurrency(valor, true, …)`, sem barras, sem ações, ordem alfabética.
6. Remover as chamadas a `renderBudgetExpensePies` (`budget-categories.js:39`) e `bindBudgetExpensePies` (`main.js:173-182`). Manter `budget-expense-pies.js`, `budget-category-bars.js` e `budget-expense-overruns.js` sem uso por um ciclo, como foi feito com o Acumulado do ano, e apagar depois da revisão com o dono.
7. Testes: um por linha da tabela de estados; a privacidade nova (nomes visíveis, nenhum valor, nenhuma barra, nenhuma cor, ordem alfabética); o total da lista igual a `totals` de `budgetExpenseCategories` em centavos; o "›" de Conferir o mês abrindo a categoria; ausência de rolagem lateral a 320, 375 e 390 px no script de navegador.
8. Fase 2, separada: receitas, filtros com contagem para listas longas e "Ver todos" em categorias com muitos lançamentos.

Relação com uma decisão em aberto: o plano do Panorama prevê que, se o dono sentir falta do Acumulado do ano, ele volte "como período em Categorias" (`docs/product/panorama-financeiro.md:128`, conversa marcada para 2026-11-18). O período "Janeiro a outubro" desta proposta é exatamente esse caminho.

## Como medir

Não há telemetria: o app é local e não envia dados. A medição combina contagens automáticas no DOM, como em `scripts/check-budget-overview-browser.mjs`, com um teste de tarefas feito pelo dono.

| Métrica | Linha de base | Meta | Instrumento |
|---|---|---|---|
| Altura da página a 1.440 px | 5.277 px [contagem] | ≤ 2.000 px com os dados fictícios atuais [suposição] | Captura em Chrome sem interface (headless) |
| Altura da página a 390 px | 7.640 px [contagem] | ≤ 3.000 px [suposição] | Captura em Chrome sem interface (headless) |
| Posição da primeira categoria a 1.440 px | Cerca de 3.960 px [contagem] | Na primeira tela (≤ 900 px) | Script de DOM (`getBoundingClientRect`) |
| Posição da primeira categoria a 390 px | Cerca de 6.200 px [contagem] | ≤ 1.000 px [suposição] | Script de DOM |
| Rolagem lateral a 390 px | Sim: Realizado e Diferença fora da tela [fato] | Não | Script de DOM (`scrollWidth ≤ clientWidth`) |
| Valores em dinheiro na aba | 79 para 27 distintos [contagem] | Cada valor por categoria uma vez: 36 com os dados fictícios | Script de DOM |
| Representações do realizado de uma categoria | 4 em texto e 3 gráficas [contagem] | 1 em texto e 1 barra | Script de DOM |
| Controles de exibição | 6 [contagem] | 2 (período e ordenação) | Script de DOM |
| Gatilhos para abrir uma categoria | 61 para 12 categorias [contagem] | 1 por categoria | Script de DOM |
| Paradas de Tab antes da primeira categoria, a partir do título da aba | 57 [contagem: código] | ≤ 5 | Script de navegador com Tab |
| Frases explicativas visíveis, sem dado | 22 [contagem] | ≤ 2 | Script de DOM |
| Cores usadas para "Realizado" | 4 [fato] | 1, mais o vermelho só no excesso | Revisão de código |
| T1 achar e abrir o lançamento que mais pesou em Lazer, vindo do "›" | Não medido. 2 cliques hoje, com os lançamentos espremidos na primeira coluna | ≤ 2 cliques e ≤ 20 s | Teste com o dono, cronometrado |
| T2 planejado e gasto de Mercado de janeiro a outubro | Não medido. Hoje exige "Período analisado: Acumulado…" no bloco de excessos, e só aparece se Mercado passou do limite | ≤ 15 s | Teste com o dono |
| T3 maior despesa de outubro | Não medido | ≤ 5 s | Teste com o dono |
| T4 reclassificar um lançamento de Outras despesas | Não medido | ≤ 4 cliques até salvar | Teste com o dono |
| T5 ler realizado e diferença de Restaurantes a 390 px | Exige rolagem lateral [fato] | Sem rolagem lateral, ≤ 5 s | Teste com o dono no celular |
| Percepção | "Meio convoluta" (relato do dono) | O dono usa Categorias no fechamento de novembro só para abrir e corrigir lançamentos, sem procurar os gráficos | Conversa depois do fechamento |

Responsável: dono do produto. Revisão: no fechamento de novembro de 2026 (início de dezembro), junto com a revisão de Conferir o mês. [validar] As tarefas T1 a T5 devem ser aplicadas também na tela atual antes da implementação, para registrar a linha de base de tempo.

Critério de reversão: se no fechamento de novembro o dono procurar "Para onde vai o dinheiro" e a ordenação "Maior realizado" não bastar, um gráfico único de barras horizontais (realizado, com a marca do planejado) volta como detalhe recolhido no fim da aba, antes de apagar o código antigo.

## Pendências com o dono

- [validar] Remover da aba os dois gráficos de barras, as duas pizzas e o bloco "Gastos acima do planejado", deixando a leitura para Conferir o mês e o Panorama.
- [validar] Com valores ocultos, mostrar nomes de categorias e de lançamentos com valores mascarados, em ordem alfabética, como o Panorama. Hoje a aba esconde tudo.
- [validar] O período "Janeiro a outubro" como o caminho de volta do Acumulado do ano (conversa de 2026-11-18).
- [validar] No ano em andamento, trocar a Diferença por "Usado: N%" do planejado do ano.
- [validar] Receitas nesta aba (fase 2) ou só em Lançamentos e Conferir o mês.
- [suposição] Lançamentos do maior para o menor valor dentro da categoria.
- [suposição] Metas de altura e posição; confirmar com a captura depois da implementação.
