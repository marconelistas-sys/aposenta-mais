# Despesas por categoria

## Status

Implementado em 2026-11-04 (`src/features/cash-flow/budget-categories.js`, `src/styles/budget-categories.css`). Medidas com a fixture `tests/fixtures/budget-categories-state.js` (`npm run test:budget-categories-browser`):

- Altura da aba: 693 px a 1.440 (antes 5.277) e 1.094 px a 390 (antes 7.640).
- Primeira categoria a 802 px no celular (meta ≤ 1.000).
- 3 paradas de Tab até a primeira categoria (antes 57).
- 2 controles de exibição (antes 6).
- 1 gatilho por categoria.

Diferenças em relação ao plano:
- O "›" de Conferir o mês também passa o mês global para o mês conferido, quando são diferentes.
- No celular, as células "Sem planejado" e "Nada lançado" aparecem sem o rótulo "planejado"/"realizado" na frente, para não repetir a palavra.
- Os renderizadores antigos (`budget-expense-pies.js`, `budget-category-bars.js`, `budget-expense-overruns.js`) ficam sem uso na interface, com seus testes, até a revisão de dezembro.

## Pedido do dono

"Agora vá até a tela de despesas por categoria e implemente melhorias que melhorem a utilidade desta tela, as it is kind of too convoluted. Ask the UX agent and product owner. Implement, test, merge."

Base: a [avaliação de UX](avaliacao-ux-categorias.md) (achados C1 a C15, contagens e proposta de hierarquia), o plano de [Conferir o mês](conferir-mes.md), entregue hoje, e o plano do [Panorama financeiro](panorama-financeiro.md), que deixa a análise do ano no Panorama e prevê a volta do Acumulado do ano "como período em Categorias" (`panorama-financeiro.md:128`).

Rótulos: [fato] verificado no código; [suposição] decisão sem dado; [validar] decisão tomada pelo PO que o dono pode reverter; [verificar no navegador] depende da renderização real. Não houve teste com usuários.

## Problema

- A tabela, único lugar da aba onde se abre e edita um lançamento, começa a cerca de 3.850 px no desktop e a 6.140 px no celular, depois de 57 paradas de Tab. [contagem na avaliação, C1]
- Antes dela há dois gráficos de barras, o bloco "Gastos acima do planejado" e duas pizzas. Eles repetem a tabela: 43 dos 79 valores em dinheiro da aba ficam acima dela, e o realizado de uma categoria aparece até 4 vezes em texto e 3 vezes em gráfico. [contagem, C2]
- "Gastos acima do planejado" responde à mesma pergunta de "Onde passou do planejado" (Conferir o mês) com outra regra (limite de 10%) e dá outro número: CHF 500,00 contra +CHF 400,00. [fato: `budget-expense-overruns.js:5, 12`; `month-check.js:96-108`, C3]
- Vermelho quer dizer "categoria grande" nas barras e "acima do planejado" na tabela. [fato: `budget-category-bars.js:14`, C4]
- Seis controles mudam só a exibição; o mês tem dois controles (o global e os seletores Ano e Período da aba). [fato, C5 e C6]
- Com valores ocultos, a aba esconde até os nomes, e o "›" de Conferir o mês leva a um painel sem "Mostrar valores". [fato: `budget-categories.js:29`, C9]
- A 390 px, Realizado e Diferença ficam fora da tela, atrás de rolagem lateral. [fato: `budget-overview.css:13-14`, C10]

Em uma frase: quem abre Categorias para ver ou corrigir os lançamentos de uma categoria precisa atravessar quatro blocos de análise que repetem a tabela e que, desde hoje, Conferir o mês e o Panorama fazem melhor.

## Decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Papel da aba | **A lista é a tela.** Categorias vira o livro das categorias: todas as categorias do período, lado a lado, com planejado, realizado e diferença, e um clique para ver e editar os lançamentos. A leitura do mês fica em Conferir o mês; a do ano, no Panorama (aba Fluxo e gastos) | Avaliação, seção "Para que a pessoa abre esta aba". Não há outra tela que mostre todas as categorias com os lançamentos |
| Gráficos e bloco de excessos | **Saem da aba**: os dois gráficos de barras "Gasto mensal por categoria", as duas pizzas "Para onde vai o dinheiro", o controle "Detalhamento das categorias", o bloco "Gastos acima do planejado" com "Excesso mínimo", "Período analisado", "Comparar o realizado acumulado com" e "Consumo da cota anual". "Para onde vai o dinheiro" passa a ser a ordenação "Maior realizado", com a barra de cada linha **[validar]** | C1, C2, C3, C5, C7, C12. Prefere-se remover e consolidar a acrescentar. Critério de reversão em "Como saber se deu certo" |
| Código antigo | `budget-expense-pies.js`, `budget-category-bars.js` e `budget-expense-overruns.js` (renderizadores) ficam no repositório sem uso na interface por um ciclo, com os testes atuais. Saem já a ligação `bindBudgetExpensePies` e `budgetCategoryPieData` (`main.js:173-183`). Apagar depois da revisão de dezembro | Mesmo padrão do Acumulado do ano e de `renderMonthTracking`. As funções de domínio (`budgetExpenseOverruns`, `budgetExpenseAccumulated`, `budgetAnnualQuota`, `budgetExpenseComparison`) são usadas por Conferir o mês e pelo Panorama e ficam [fato] |
| Matemática | Nenhum cálculo financeiro novo. Fontes: `buildBudgetYear(state, ano)` uma vez por renderização; `budgetExpenseCategories(model.months[m])` (mês), `budgetExpenseAccumulated(model, mês).categories` (janeiro até o mês), `budgetExpenseCategories(model.annual)` (ano), `budgetAnnualQuota` (uso no ano em andamento) e `otherExpenseAnalysis` (Outras despesas). O resto é filtro, ordenação, soma em centavos, a escala de barra que já existe (`budget-categories.js:35`) e formatação | Restrição do pedido [fato: as funções existem e têm testes] |
| Período | O mês vem do seletor global "Mês do orçamento" (`state.cashFlow.referenceMonth`). A aba perde os seletores Ano e Período e ganha **um** seletor "Período" com 3 opções: "Outubro", "Janeiro a outubro", "Ano de 2026". Em janeiro, só "Janeiro" e "Ano de 2026" | C6. O mês global já é o que o "›" de Conferir o mês abre [fato: `month-check.js:156`] |
| Forma do seletor de período | `<select data-budget-category-control="period">`, igual ao "Ordenar por", e não botões em pílula como no rascunho da avaliação | Mesmo tratador de `change` que já existe (`bindBudgetCategoriesInteractions`), teclado nativo, nenhum componente novo [suposição] |
| "Janeiro a outubro" | É o caminho de volta do Acumulado do ano previsto no Panorama, com nome concreto em vez de "Acumulado até o mês". A pergunta de 2026-11-18 passa a ser "o período Janeiro a outubro cobre o que você usava no Acumulado do ano?" **[validar]** | `panorama-financeiro.md:128`. Mostra o planejado e o realizado só dos meses de janeiro até o mês. A comparação com o planejado do ano inteiro fica em "Ano de 2026" e no Panorama |
| Ano em andamento | Em "Ano de 2026" com o ano corrente, a coluna Diferença vira **"Usado"**: "Usado: 64%" = realizado até agora sobre o planejado do ano, por `budgetAnnualQuota(...).usedPercent`, arredondado ao inteiro. Acima de 100%, em cor de alerta. Ano encerrado continua com Diferença **[validar]** | C7: no ano em andamento, a diferença anual mostra um "abaixo do planejado" grande que não é economia. A regra do app proíbe ler lançamento que falta como economia (`sprint-acompanhamento-mensal.md`) |
| Valores ocultos | Mesmo padrão do Panorama e de Conferir o mês: **nomes visíveis** de categorias e lançamentos; todo valor em dinheiro vira `CHF •••••`; sem sinal, percentual, cor, barra nem palavras "acima" e "abaixo"; sem botões por linha; ordem forçada para "Nome (A a Z)" com o seletor desativado, porque a ordem por valor revelaria a classificação. Uma linha "Valores ocultos." com o botão "Mostrar valores" **[validar]** | C9. Convenção do app decidida pelo dono no Panorama em 2026-11-04 [fato: `report-text.js:26-40`] e seguida hoje em Conferir o mês. Resolve o beco sem saída do "›" com valores ocultos |
| "Mostrar valores" | Gancho próprio `data-budget-categories-show-values`, com a mesma ação de `data-toggle-values`, e volta o foco ao título da aba | Mesmo motivo de Conferir o mês: os scripts que clicam no botão do cabeçalho continuam achando um só [fato: `conferir-mes.md`, Status] |
| Linha de categoria | Cada categoria é um `<details class="budget-category-details" data-budget-category-details="id">`. O `<summary>` traz nome, Planejado, Realizado, Diferença (percentual inteiro abaixo) e uma barra. Abrir mostra os lançamentos na largura toda. Abrir uma categoria não fecha as outras | Mantém o contrato usado pelo "›" e pela volta depois de editar (`main.js:955-958, 2531`). C8 e C10 |
| Barra da linha | Uma barra por linha: realizado dentro do planejado, trecho acima do planejado em cor de alerta, marca no planejado, planejado sem realizado em tom claro. Escala comum: o maior planejado ou realizado do período. Sem barra com valores ocultos | Substitui as 2 barrinhas por linha e os 2 gráficos de barras. Cor só no excesso (C4). 1º item a cortar se o prazo apertar |
| Lançamentos dentro da categoria | "Realizado (N)" primeiro, depois "Planejado (N)", cada lista do maior para o menor valor. No período de um mês, o lançamento eventual mostra o dia ("12/10"), e não "outubro de 2026"; nos períodos de vários meses, o mês, como hoje. As notas atuais ficam (vínculo automático, mais de um planejado, proporção do anual, convertido de outra moeda) | C15. Quem chega pelo "›" procura o realizado [suposição: maior para o menor] |
| `entryDetails` | A assinatura e a saída padrão não mudam. A nova linha usa uma opção nova ou um renderizador próprio | `budget-year-to-date.js:93` e `tests/budget-year-to-date.test.js:172` dependem da saída atual [fato] |
| Outras despesas | A análise fica, sem pizzas e sem percentuais: dentro da linha aberta de "Outras despesas", um bloco "Sugestões pela descrição" com os grupos de `otherExpenseAnalysis` (nome do grupo, valor, lançamentos editáveis). Não aparece com valores ocultos | É ferramenta de correção, não de leitura (avaliação, "O que funciona"). Tarefa T4 |
| Sinal e formatos | Realizado menos planejado, como em Conferir o mês. Sinal negativo com U+2212. Percentual inteiro, só quando há planejado. Diferença abaixo de meio centavo: "CHF 0,00", sem sinal e sem percentual. Centavos em todos os valores | C14. Mesmos formatadores de `month-check.js:8-19` |
| Linha de total | "Total de despesas" com Planejado, Realizado e Diferença (ou "Usado" no ano em andamento). Quando há categoria planejada sem realizado, uma linha abaixo: "Inclui CHF X planejados sem realizado em N categorias." | Sem essa linha, a soma das diferenças visíveis não bate com a diferença total, porque a categoria sem realizado mostra "—" mas entra no total planejado [fato: `budget-overview.js:63`]. Mesmo problema que Conferir o mês resolveu com o termo "Ainda sem realizado" |
| Ordenação | "Ordenar por" fica, com `data-budget-category-control="sort"` e os mesmos valores: "Maior diferença" (`difference`, padrão), "Maior realizado" (`actual`), "Maior planejado" (`planned`), "Nome (A a Z)" (`category`). Em "Maior diferença", categorias sem realizado vão para o fim, desempatadas pelo planejado | Só renomeia (C14). O valor `sort` é foco de reserva em `main.js:2534` [fato] |
| "Adicionar planejado" | Continua só nas categorias sem planejado, agora dentro da linha aberta, com `data-plan-budget-category` e `data-plan-budget-month` como hoje | Atalho existente (`main.js:895-918`). Botão dentro de `<summary>` é ruim para teclado e leitor de tela |
| "Lançar realizado" por categoria | **Fora desta entrega** | Exige mudar o destino da volta (hoje volta para Conferir o mês, `main.js:2568-2574`). Conferir o mês já oferece o atalho para o que falta lançar |
| Receitas na aba | **Fase 2** **[validar]** | Exige "Adicionar planejado" para receita (`main.js:900` aceita só despesa) e um segundo total |
| Entrada por Lançamentos | O link "Ver para onde vai o dinheiro" (`cash-flow.js:757`) vira "Ver gastos por categoria", mantém o gancho `data-show-budget-expense-pies` e abre esta aba no mês, ordenada por "Maior realizado", com o foco no título da aba | O destino antigo (`#budget-expense-pies-title`) deixa de existir. Manter o gancho evita mexer nos outros pontos que o procuram |

## Escopo

### Nesta entrega

Só o conteúdo do painel da aba Categorias (`renderBudgetCategories`, chave `categorias`) e os pontos de entrada:

1. `budgetCategoriesView` passa a `{ period: 'month' | 'to-date' | 'year', sort }`. `resetBudgetCategories` volta para `{ period: 'month', sort: 'difference' }`.
2. Renderização nova: cabeçalho da aba, lista de categorias em `<details>`, linha de total, rodapé com um único detalhe.
3. Valores ocultos com nomes visíveis.
4. "Sugestões pela descrição" dentro de Outras despesas.
5. Ajustes em `main.js`: mudança de mês (`main.js:767-769`), link de Lançamentos (`main.js:867-877`), "›" de Conferir o mês (`main.js:948-963`), remoção da ligação das pizzas (`main.js:173-183`), "Mostrar valores" da aba.
6. Testes unitários e verificação em navegador com dados sintéticos.

### Depois (backlog, não nesta entrega)

| Item | Por que fica para depois |
|---|---|
| Receitas na aba | [validar]; exige mudar o atalho de planejar e um segundo total |
| "Lançar realizado" dentro da categoria | Muda o destino da volta do formulário; Conferir o mês já cobre o que falta lançar |
| Filtros "Acima do planejado", "Nada lançado", "Sem planejado" com contagem | Só para listas longas; sem dado de que o dono tenha mais de 15 categorias [suposição] |
| "Ver todos os N" em categoria com mais de 10 lançamentos | Idem |
| Cabeçalho da lista fixo ao rolar | Idem |
| Apagar os renderizadores antigos e os testes deles | Depois da revisão de dezembro |
| Ordenação "Maior uso" no ano em andamento | Hoje "Maior diferença" ordena pela diferença contra o planejado do ano, que pode diferir da ordem do percentual usado [suposição] |

## Regras de cálculo (sem matemática nova)

`model = buildBudgetYear(state, ano do mês global)`, uma vez por renderização. `m` = mês do seletor global.

| Período | Linhas | Totais |
|---|---|---|
| Mês | `budgetExpenseCategories(model.months[m − 1]).categories` | Soma das linhas em centavos |
| Janeiro até o mês | `budgetExpenseAccumulated(model, m).categories`, **sem** as linhas que não têm nenhum lançamento de janeiro até o mês (`entries.planned` e `entries.actual` vazios). Essas linhas chegam sem `difference`, `differencePercent` e `unplanned` [fato: `budget-expense-overruns.js:12`] e pertencem só ao resto do ano | Soma das linhas em centavos. Deve ser igual a `budgetExpenseCategories` sobre os lançamentos de janeiro até o mês, com tolerância de 1 centavo por categoria |
| Ano | `budgetExpenseCategories(model.annual).categories` | Soma das linhas em centavos |
| Ano em andamento | As linhas do Ano. "Usado" = `budgetAnnualQuota(linhas com annualPlanned = planned)`, `Math.round(usedPercent)`. No total, a mesma função sobre a linha de total | Idem |

| Dado | Regra |
|---|---|
| Diferença por linha | `difference` da linha (realizado − planejado). `null` quando a categoria não tem realizado: mostra "—" |
| Percentual | `Math.round(differencePercent × 100)`, só quando `planned > 0` e há realizado |
| Sem planejado | `unplanned === true`: etiqueta "sem planejado", Diferença = realizado, sem percentual |
| Planejado sem realizado no total | Soma do `planned` das linhas com `difference === null`, e a contagem delas |
| Meses com realizado | `actualMonths` da função usada no período |
| Escala da barra | Maior `planned` ou `actual` entre as linhas do período (regra atual, `budget-categories.js:35`) |
| Estado temporal | Mês ou ano comparado com `today` (injetável nos testes), como `month-tracking.js:18` |
| Outras despesas | `otherExpenseAnalysis(linhas do período, { existingItems, customCategories })` |

## Como saber se deu certo

Sem telemetria: o app é local. Medida = verificação automática no DOM com dados sintéticos + tarefas cronometradas com o dono. Linhas de base da [avaliação](avaliacao-ux-categorias.md#contagens-da-tela-atual-linha-de-base), com a fixture de outubro de 2026 (12 categorias de despesa, planejado CHF 7.317,10, realizado CHF 7.717,10).

| Métrica | Hoje | Meta desta entrega | Instrumento |
|---|---|---|---|
| Altura da aba a 1.440 px | 5.277 px | ≤ 2.000 px [suposição] | Script de navegador |
| Altura da aba a 390 px | 7.640 px | ≤ 3.000 px [suposição] | Script de navegador |
| Topo da primeira categoria a 1.440 × 900 | ~3.960 px | < 900 px | Script (`getBoundingClientRect`) |
| Topo da primeira categoria a 390 × 844 | ~6.200 px | ≤ 1.000 px [verificar no navegador] | Script |
| Rolagem lateral a 390, 360 e 320 px | Sim | Não, na página e na lista | Script (`scrollWidth ≤ clientWidth + 1`) |
| Valores em dinheiro na aba, todas as linhas recolhidas | 79 | 36 (3 por categoria) + 3 do total | Script |
| Controles de exibição | 6 | 2 (Período e Ordenar por) | Script |
| Gatilhos que abrem uma categoria | 61 | 12 (1 por categoria) | Script |
| Paradas de Tab do título da aba até a primeira categoria | 57 | ≤ 5 | Script com Tab |
| Frases explicativas visíveis, sem dado | 22 | ≤ 2 | Script |
| Cores para "Realizado" | 4 | 1, mais a cor de alerta só no excesso | Revisão de código |
| T1 do "›" de Lazer, abrir o lançamento que mais pesou | Não medido | ≤ 2 cliques e ≤ 20 s | Dono + script (cliques) |
| T2 planejado e realizado de Mercado de janeiro a outubro | Não medido; hoje depende do limite de excesso | ≤ 15 s | Dono |
| T3 maior despesa de outubro | Não medido | ≤ 5 s | Dono |
| T4 mover um lançamento de Outras despesas | Não medido | ≤ 4 cliques até salvar | Dono + script |
| T5 realizado e diferença de Restaurantes a 390 px | Exige rolagem lateral | Sem rolagem, ≤ 5 s | Dono |

Linha de base de tempo: aplicar T1 a T5 na tela atual antes do merge, se possível; senão, registrar como "não medido" e medir só depois. Repetição: no fechamento de novembro (início de dezembro de 2026), junto com a revisão de Conferir o mês **[validar]**.

Critério de reversão: se no fechamento de novembro o dono procurar "Para onde vai o dinheiro" e a ordenação "Maior realizado" com a barra não bastar, volta um único gráfico de barras horizontais (realizado com a marca do planejado), recolhido no fim da aba, antes de apagar o código antigo.

## Histórias de usuário

Persona única: o dono do plano, que confere e corrige lançamentos depois de importar extratos.

Fixture de referência dos critérios (sintética, menor que a da avaliação e montada para fechar): outubro de 2026, CHF, mês encerrado (`today` = 2026-11-04).

| Categoria | Planejado | Realizado | Diferença |
|---|---|---|---|
| Restaurantes e delivery | 450,00 | 820,00 | +370,00 (+82%) |
| Compras | (nenhum) | 240,00 | +240,00, sem planejado |
| Lazer | 300,00 | 430,00 (Cinema 60,00 em 04/10, Show 250,00 em 12/10, Parque 120,00 em 20/10, cadastrados nesta ordem) | +130,00 (+43%) |
| Transporte | 380,00 | 360,00 | −20,00 (−5%) |
| Viagens | 400,00 | (nenhum) | — |
| **Total** | **1.530,00** | **1.850,00** | **+320,00 (+21%)** |

Conferência: 370 + 240 + 130 − 20 = 720; 720 − 400 (Viagens sem realizado) = 320.

### H1. Lista de categorias do mês

Como dono do plano, quero ver todas as categorias do mês numa lista com planejado, realizado e diferença, para saber onde olhar sem atravessar gráficos.

- Dada a fixture, quando abro `/orcamento?aba=categorias`, então o painel começa com o título "Despesas por categoria", a linha "Outubro de 2026 · CHF", os seletores "Período" e "Ordenar por", e logo depois a lista; não há gráfico, pizza, controle deslizante nem bloco "Gastos acima do planejado" (`[data-budget-expense-pies]`, `[data-budget-overruns]`, `input[type=range]` ausentes).
- Dada a fixture, quando leio a lista em "Maior diferença", então as linhas vêm na ordem Restaurantes e delivery, Compras, Lazer, Transporte, Viagens.
- Dada a linha de Restaurantes, quando a leio, então vejo `CHF 450,00 | CHF 820,00 | +CHF 370,00` e, abaixo da diferença, "+82%".
- Dada a linha de Transporte, quando a leio, então a diferença é "−CHF 20,00" com U+2212 e o percentual "−5%", ambos sem cor de alerta.
- Dada a linha de Compras, quando a leio, então vejo a etiqueta "sem planejado" junto ao nome, Planejado "Sem planejado", Diferença "+CHF 240,00" e nenhum percentual.
- Dada a linha de Viagens, quando a leio, então Realizado é "Nada lançado" e Diferença é "—", lido por leitor de tela como "sem comparação".
- Dada a linha de total, quando a leio, então vejo "Total de despesas", `CHF 1.530,00 | CHF 1.850,00 | +CHF 320,00`, "+21%" e a linha "Inclui CHF 400,00 planejados sem realizado em 1 categoria."
- Dado qualquer período e qualquer dado, quando somo em centavos o planejado e o realizado das linhas, então os resultados são iguais aos da linha de total.
- Dada uma diferença positiva, quando a vejo, então só o texto da diferença, o percentual e o trecho acima do planejado da barra têm cor de alerta; Planejado e Realizado ficam sem cor.
- Dada qualquer linha recolhida, quando conto os valores em dinheiro, então são no máximo 3 (planejado, realizado, diferença) e cada um aparece uma vez na aba.
- Dada a barra de Lazer, quando a vejo, então ela mostra 300 de 430 dentro do planejado, 130 acima em cor de alerta e a marca no ponto do planejado; a barra de Viagens mostra só o planejado em tom claro; a escala é a mesma em todas as linhas.
- Dado "Ordenar por", quando escolho "Maior realizado", então a ordem é Restaurantes, Lazer, Transporte, Compras, Viagens; "Maior planejado": Restaurantes, Viagens, Transporte, Lazer, Compras; "Nome (A a Z)": Compras, Lazer, Restaurantes, Transporte, Viagens.
- Dada a mudança de ordenação, quando ela ocorre, então o foco continua no seletor e as categorias que estavam abertas continuam abertas [suposição].
- Dada a aba, quando a leio, então não aparecem os textos "Ver lançamentos", "Maior excesso", "Sem registros", "Sem realizado", "Não calculado", "Sem planejamento", "podem estar incompletos" nem "Variação".

### H2. Abrir uma categoria e editar

Como dono do plano, quero abrir uma categoria e ver primeiro o que gastei, do maior para o menor, para achar e corrigir o lançamento que pesou.

- Dada a linha de Lazer, quando clico nela ou pressiono Enter com o foco no resumo, então ela abre em largura total com "Realizado (3)" antes de "Planejado (1)", e os realizados na ordem Show CHF 250,00, Parque CHF 120,00, Cinema CHF 60,00.
- Dado o período de um mês, quando vejo um lançamento eventual com data, então ele mostra o dia ("12/10") e não "outubro de 2026"; nos períodos de vários meses, mostra o mês.
- Dado um lançamento com vínculo automático, mais de um planejado compatível, proporção do anual ou outra moeda, quando o vejo, então a nota atual aparece como hoje (`tests/planned-expense-links.test.js` continua passando).
- Dado um lançamento do Orçamento, de meta anual ou de calendário, quando clico nele, então abre a edição como hoje (`data-edit-budget-category`, `data-category-item-id`, `data-category-entry-month`; `tests/budget-category-edit.test.js` continua passando).
- Dada uma edição salva, quando a tela volta, então a categoria do lançamento está aberta, inclusive os `<details>` que a contêm, e o foco está no lançamento (`main.js:703-713, 2527-2534`).
- Dada Lazer aberta, quando abro Restaurantes, então Lazer continua aberta.
- Dada Compras (sem planejado) aberta, quando a vejo, então há o botão "Adicionar planejado", com nome acessível "Adicionar planejado: Compras", que abre o formulário de planejado com a categoria e o mês preenchidos (`data-plan-budget-category="shopping" data-plan-budget-month="2026-10"`).
- Dada uma categoria com planejado, quando a abro, então não há "Adicionar planejado" nem "Lançar realizado".
- Dado o "›" de Lazer em Conferir o mês (outubro de 2026), quando clico, então a aba Categorias abre com o mês global em 2026-10, Período "Outubro", ordenação "Maior diferença", a linha `[data-budget-category-details="leisure"]` aberta e o foco no resumo dela. Contando esse clique, abrir a edição do Show leva 2 cliques (T1).
- Dado "Ver todas as categorias" em Conferir o mês, quando clico, então a aba abre no mesmo mês, Período "Outubro", "Maior diferença", com o foco no título da aba.
- Dado "Ver gastos por categoria" em Lançamentos, quando clico, então a aba abre no mês global, Período "Outubro", ordenação "Maior realizado", com o foco no título da aba (`#budget-categories-title`).

### H3. Janeiro até o mês

Como dono do plano, quero comparar planejado e realizado de janeiro até o mês, para responder quanto gastei com uma categoria no ano até aqui.

- Dado o mês global 2026-10, quando abro "Período", então vejo as opções "Outubro", "Janeiro a outubro" e "Ano de 2026", nesta ordem.
- Dado o mês global 2026-01, quando abro "Período", então vejo só "Janeiro" e "Ano de 2026".
- Dado "Janeiro a outubro", quando leio, então a linha do período é "Janeiro a outubro de 2026 · CHF" e cada linha mostra o planejado e o realizado somados de janeiro a outubro.
- Dada uma categoria planejada só em dezembro (Viagem dezembro, CHF 1.000,00), quando escolho "Janeiro a outubro", então ela não aparece; em "Ano de 2026", aparece.
- Dado "Janeiro a outubro" com realizados em 7 meses, quando leio o rodapé, então vejo "Realizados lançados em 7 de 10 meses."
- Dada Saúde com planejado de CHF 870,00 por mês e realizados de janeiro a setembro, quando escolho "Janeiro a setembro", então vejo Planejado CHF 7.830,00 e o realizado somado, e abrir a linha mostra os realizados de cada mês com o mês ao lado.
- Dados os totais de "Janeiro a outubro", quando os comparo com `budgetExpenseCategories` sobre os lançamentos de janeiro a outubro, então são iguais, com tolerância de 1 centavo por categoria.
- Dado "Janeiro a outubro", quando mudo o mês global para novembro, então o período continua "Janeiro a novembro"; quando mudo para janeiro, o período volta para "Janeiro".
- Dado um período diferente de "Outubro", quando troco de sessão, então a aba volta para "Outubro" e "Maior diferença" (`resetBudgetCategories`).

### H4. Ano inteiro

Como dono do plano, quero ver o ano inteiro por categoria, sem confundir o planejado que ainda não chegou com economia.

- Dado "Ano de 2025" (ano encerrado), quando leio, então cada linha mostra Planejado, Realizado e Diferença do ano, e o rodapé diz "Realizados lançados em N de 12 meses."
- Dado "Ano de 2026" com `today` em 2026-11-04, quando leio, então a linha do período diz "Ano de 2026 · CHF · em andamento", a coluna Diferença se chama "Usado", e cada linha com planejado mostra "Usado: N%" no lugar da diferença.
- Dada Saúde com planejado de CHF 870,00 por mês (CHF 10.440,00 no ano) e CHF 11.000,00 realizados, quando leio "Ano de 2026", então vejo "Usado: 105%" em cor de alerta; Viagem com CHF 1.000,00 planejados e CHF 300,00 realizados mostra "Usado: 30%" sem cor; o total mostra "Usado: 99%".
- Dada uma categoria sem planejado no ano em andamento, quando a leio, então vejo "sem planejado" e a diferença igual ao realizado, como no mês.
- Dado "Ano de 2026" em andamento, quando leio o rodapé, então vejo "2026 ainda não terminou. Usado é o realizado até agora sobre o planejado do ano." e o link "Ver o ritmo do ano no Panorama" (`<a href="/panorama?aba=gastos" data-route>`, mesmo padrão de "Ver análise no Panorama").
- Dado o ano em andamento, quando leio a aba, então não aparece nenhuma diferença negativa anual nem a palavra "economia".
- Dado "Ano de 2027" com `today` em 2026, quando leio, então as linhas mostram só o planejado, Realizado "Nada lançado", e o rodapé "2027 ainda não começou. Mostrando só o planejado."

### H5. Estados de conteúdo e de tempo

Como dono do plano, quero que a lista diga a coisa certa em qualquer mês, para não confundir ausência de lançamento com resultado.

- Dado o mês em andamento (mês global = mês de `today`), quando abro a aba, então a linha do período termina em "· em andamento".
- Dado um mês futuro, quando abro a aba, então as linhas mostram o planejado, "Nada lançado" e "—", a barra só em tom claro, e o rodapé diz "Novembro ainda não começou. Mostrando só o planejado."
- Dado um mês passado com planejado e sem nenhum realizado de despesa, quando abro a aba, então todas as linhas mostram "Nada lançado" e "—", a ordem "Maior diferença" segue o planejado, e o rodapé diz "Nada lançado como realizado em outubro."; nenhuma frase sugere economia.
- Dado um mês com realizado e sem planejado, quando abro a aba, então todas as linhas mostram "sem planejado", diferença igual ao realizado, nenhum percentual, e "Adicionar planejado" dentro de cada linha.
- Dado um período sem planejado e sem realizado, quando abro a aba, então não há lista, e vejo "Outubro não tem despesas planejadas nem realizadas." e "Planeje o mês ou importe um extrato.", com o botão "Planejar o mês" (`data-new-cash-item data-new-cash-item-kind="planned"`, o mesmo de Conferir o mês). Em "Janeiro a outubro": "Janeiro a outubro de 2026 não tem…"; em "Ano de 2026": "2026 não tem…".
- Dado um nome de categoria longo e um valor ≥ CHF 1.000.000,00, quando leio a 320 px, então o nome quebra a linha e o valor não quebra nem encolhe.
- Dadas 20 categorias, quando abro a aba, então todas aparecem recolhidas, sem filtro nem paginação (fase 2).

### H6. Valores ocultos

Como dono do plano, quero abrir Categorias com os valores ocultos sem expor quantias e sem cair num beco sem saída.

- Dados os valores ocultos, quando abro a aba, então vejo "Valores ocultos." e o botão "Mostrar valores", e a lista continua com os nomes das 5 categorias em ordem alfabética.
- Dados os valores ocultos, quando leio as linhas e o total, então todo valor em dinheiro é `CHF •••••`; não há sinal, percentual, cor de alerta, barra, "acima", "abaixo" nem a linha "Inclui … planejados sem realizado".
- Dados os valores ocultos, quando olho "Ordenar por", então ele mostra "Nome (A a Z)" e está desativado; quando mostro os valores de novo, a ordenação anterior volta.
- Dados os valores ocultos, quando abro uma categoria, então vejo as descrições dos lançamentos como texto, com valores mascarados, sem botão de edição, sem "Adicionar planejado" e sem "Sugestões pela descrição".
- Dados os valores ocultos e o "›" de Lazer em Conferir o mês, quando clico, então a aba Categorias abre com Lazer aberta, nomes visíveis e o botão "Mostrar valores".
- Dados os valores ocultos, quando clico "Mostrar valores" na aba, então continuo em Categorias, com os valores, e o foco vai para o título da aba.
- Dada a aba com valores ocultos, quando procuro a frase "Exiba os valores para consultar as despesas por categoria", então ela não existe. **[validar]**

### H7. Outras despesas

Como dono do plano, quero ver os lançamentos de Outras despesas agrupados pela descrição, para reclassificá-los rápido.

- Dada Outras despesas com realizados "SBB CFF FFS" (CHF 100,00), "Netflix" (CHF 50,00), "Anuidade cartão" (CHF 25,00) e dois fornecedores, quando abro a linha, então vejo os lançamentos e, abaixo, "Sugestões pela descrição" com a frase "Agrupado pela descrição. A categoria só muda quando você edita o lançamento." e os grupos de `otherExpenseAnalysis`, como "Transporte (sugestão)" e "Tarifas e anuidade", cada um com o valor e os lançamentos.
- Dado "Sugestões pela descrição", quando o leio, então não há pizza, percentual nem legenda colorida.
- Dado o grupo "Transporte (sugestão)", quando o abro e clico em "SBB CFF FFS", troco a categoria para Transporte e salvo, então são 4 cliques ou menos desde a linha recolhida de Outras despesas (T4), a categoria do lançamento muda e os totais são recalculados.
- Dado que só abrir as sugestões não muda nada, quando as abro, então todos os lançamentos continuam com `categoryId = 'other-expense'`.
- Dado um período sem Outras despesas, quando abro a aba, então não há "Sugestões pela descrição".

### H8. Celular, teclado e leitor de tela

Como dono do plano, quero usar Categorias no celular e por teclado, para corrigir lançamentos em qualquer aparelho.

- Dado 390 × 844 px com a fixture, quando abro a aba, então o topo da primeira categoria fica a 1.000 px ou menos [verificar no navegador] e não há rolagem horizontal na página nem na lista; a 360 e 320 px também não.
- Dado menos de 640 px de largura [suposição], quando leio uma linha, então vejo o nome, depois a diferença com o percentual, depois "planejado CHF 450,00 · realizado CHF 820,00" numa linha menor, depois a barra.
- Dado o título da aba focado, quando pressiono Tab, então as paradas são Período, Ordenar por e a primeira categoria (≤ 5 paradas).
- Dado o resumo de uma categoria, quando um leitor de tela o lê, então ouço o nome e cada valor com seu rótulo ("Planejado: CHF 450,00", "Realizado: CHF 820,00", "Diferença: mais CHF 370,00, acima do planejado, 82%"), e o cabeçalho visual das colunas não é lido duas vezes.
- Dados todos os botões, resumos e seletores da aba, quando navego por Tab, então cada um tem foco visível e, no celular, área de toque de 44 px ou mais.
- Dados os valores da lista, quando renderizam, então usam `tabular-nums` e alinhamento à direita no desktop.
- Dada a linha do período, quando a leio, então "Outubro de 2026" vem capitalizado no texto, sem `text-transform` que produza "Outubro De 2026".

## Texto da aba (pt-BR)

Vocabulário igual ao de Conferir o mês. Centavos em todos os valores. Percentual inteiro.

| Situação | Texto |
|---|---|
| Título | "Despesas por categoria" |
| Linha do período | "Outubro de 2026 · CHF", "Janeiro a outubro de 2026 · CHF", "Ano de 2026 · CHF"; sufixo "· em andamento" no mês ou ano corrente |
| Seletor "Período" | "Outubro", "Janeiro a outubro", "Ano de 2026" (em janeiro: "Janeiro", "Ano de 2026") |
| Seletor "Ordenar por" | "Maior diferença", "Maior realizado", "Maior planejado", "Nome (A a Z)" |
| Cabeçalho das colunas | "Categoria", "Planejado", "Realizado", "Diferença" ("Usado" no ano em andamento) |
| Sem planejado | Etiqueta "sem planejado"; célula "Sem planejado" |
| Sem realizado | "Nada lançado"; diferença "—" (leitor de tela: "sem comparação") |
| Uso do ano | "Usado: 64%" |
| Linha aberta | "Realizado (3)", "Planejado (1)", ação "Adicionar planejado" |
| Outras despesas | "Sugestões pela descrição" / "Agrupado pela descrição. A categoria só muda quando você edita o lançamento." |
| Total | "Total de despesas" / "Inclui CHF X planejados sem realizado em N categorias." |
| Rodapé | "Diferença = realizado menos planejado." / "Realizados lançados em N de M meses." / detalhe "Como os valores são calculados" |
| Ano em andamento | "2026 ainda não terminou. Usado é o realizado até agora sobre o planejado do ano." / link "Ver o ritmo do ano no Panorama" |
| Futuro | "Novembro ainda não começou. Mostrando só o planejado." / "2027 ainda não começou. Mostrando só o planejado." |
| Sem realizado no mês | "Nada lançado como realizado em outubro." |
| Vazio | "Outubro não tem despesas planejadas nem realizadas." / "Planeje o mês ou importe um extrato." / botão "Planejar o mês" |
| Valores ocultos | "Valores ocultos." / botão "Mostrar valores" |
| Link em Lançamentos | "Ver gastos por categoria" |

Conteúdo do detalhe "Como os valores são calculados", cada regra uma vez: a diferença é o realizado menos o planejado; valores anuais entram como 1/12 por mês; eventuais entram no mês da data; metas anuais, calendário e consórcios entram como despesa planejada; aplicações, resgates e transferências próprias ficam fora, exceto tarifas identificadas; outras moedas usam o câmbio da visão; "Janeiro a outubro" compara só esses meses; "Ano de 2026" usa o planejado do ano inteiro.

Conteúdo informativo: a aba descreve lançamentos. Não sugere cortes, não afirma economia e não recomenda investimento.

## O que sai, o que muda e o que precisa continuar funcionando

### Sai da aba

| Elemento atual | Destino |
|---|---|
| "Para onde vai o dinheiro": 2 pizzas, legendas, "Detalhamento das categorias", "Como calculamos os gráficos" (`budget-expense-pies.js:51-63`) | Sai. Vira a ordenação "Maior realizado" com a barra da linha |
| 2 gráficos "Gasto mensal por categoria" (`budget-category-bars.js`) | Sai |
| "Gastos acima do planejado", "Excesso mínimo", "Sem planejamento", "Período analisado", "Comparar o realizado acumulado com", "Consumo da cota anual" (`budget-expense-overruns.js`) | Sai. Mês: Conferir o mês + "Maior diferença". Janeiro até o mês: período novo. Ano: "Ano de 2026" com "Usado" + Panorama |
| Seletores "Ano" e "Período" de 13 opções | Viram um seletor "Período" de 3 opções; o mês vem do seletor global |
| Coluna "Variação" | Percentual inteiro abaixo da Diferença |
| 2 barrinhas por linha | 1 barra por linha |
| Lançamentos dentro da primeira coluna da tabela | Linha aberta em largura total |
| "Ver lançamentos" sob cada nome | Sai |
| Frase de abertura, frase de método longa, "Como as despesas são calculadas" | "Diferença = realizado menos planejado." e um único detalhe |
| 4 avisos "podem estar incompletos" | "Realizados lançados em N de M meses." nos períodos de vários meses |
| Painel "Valores ocultos" que esconde a aba | Nomes visíveis com valores mascarados e "Mostrar valores" |

### Precisa continuar funcionando

| Dependência | Onde | Regra |
|---|---|---|
| `<details class="budget-category-details" data-budget-category-details="id">` com `<summary>` | "›" de Conferir o mês (`main.js:955-961`), volta depois de editar (`main.js:2531`), `scripts/check-month-check-browser.mjs:107` | Cada linha é esse `<details>`. Ids de grupos de Outras despesas continuam com o prefixo `other-analysis:` |
| `data-edit-budget-category`, `data-category-item-id`, `data-category-entry-month` | `main.js:705, 1573-1591, 2527` | Em cada lançamento com valores visíveis |
| `data-plan-budget-category`, `data-plan-budget-month` | `main.js:895-918`, `tests/budget-categories.test.js:32` | Na linha aberta das categorias sem planejado, com a mesma ordem de atributos |
| `data-budget-category-control="sort"` | Foco de reserva em `main.js:2534` | No seletor de ordenação |
| `data-budget-categories` no contêiner | `bindBudgetCategoriesInteractions`, scripts | Mantido |
| `data-show-budget-expense-pies` | Link de Lançamentos, `main.js:867-877` | Gancho mantido; destino: título da aba, `sort = 'actual'`, `period = 'month'` |
| `data-open-month-category` | Conferir o mês, `main.js:948-963` | Passa a definir `period = 'month'`, `sort = 'difference'`; o mês já é o global |
| `budgetCategoriesView`, `resetBudgetCategories` | `main.js:768-769, 868-869, 952`, `budget-entries-view.js:9`, testes | Forma nova `{ period, sort }` |
| `entryDetails` | `budget-year-to-date.js:93`, `tests/budget-year-to-date.test.js:172-176` | Assinatura e saída padrão inalteradas |
| Rota `/orcamento?aba=categorias` | Panorama (`report-view.js:479`) | Sem mudança |
| Domínio (`budgetExpenseOverruns`, `budgetExpenseAccumulated`, `budgetAnnualQuota`, `budgetExpenseComparison`, `otherExpenseAnalysis`) | Conferir o mês, Panorama | Sem mudança |

## Ordem de entrega e corte

Ordem por dependência: estado da aba (`{ period, sort }`) e pontos de entrada em `main.js` → H1 → H2 → H5 → H6 → H3 → H4 → H7 → H8 → testes e scripts.

RICE (alcance = aberturas da aba por mês pelo dono [suposição]; impacto 1 a 3; esforço em horas, estimativa do PO pendente de confirmação do desenvolvimento):

| Item | Alcance | Impacto | Confiança | Esforço (h) | RICE | Decisão |
|---|---|---|---|---|---|---|
| Lista nova e remoções (H1, H2, H5, H8) | 8 | 3 | 80% | 6 | 3,2 | Esta entrega |
| Valores ocultos com nomes (H6) | 3 | 2 | 80% | 1 | 4,8 | Esta entrega |
| Sugestões de Outras despesas como lista (H7) | 3 | 2 | 80% | 1 | 4,8 | Esta entrega; sem ela a ferramenta some com as pizzas |
| Janeiro até o mês (H3) | 4 | 2 | 80% | 1,5 | 4,3 | Esta entrega |
| Barra por linha (parte da H1) | 8 | 1 | 50% | 1 | 4,0 | Esta entrega; **1º a cortar** (a ordenação "Maior realizado" fica) |
| "Usado" no ano em andamento (parte da H4) | 2 | 2 | 50% | 1 | 2,0 | Esta entrega; **2º a cortar**: fica a Diferença com o rodapé "2026 ainda não terminou…" |
| "Lançar realizado" na linha | 3 | 1 | 50% | 1,5 | 1,0 | Depois |
| Receitas | 2 | 1 | 50% | 3 | 0,3 | Fase 2 [validar] |
| Filtros, "Ver todos", cabeçalho fixo | 2 | 1 | 20% | 3 | 0,1 | Depois |

As pontuações de 4,0 a 4,8 são empate. A lista nova tem RICE menor que os itens pequenos, mas é a condição para todos eles: eles só existem dentro dela.

## Fora de escopo

- Qualquer mudança em `buildBudgetYear`, `budgetExpenseCategories`, `budgetExpenseAccumulated`, `budgetAnnualQuota`, `otherExpenseAnalysis`, nas regras de inclusão ou no câmbio.
- Receitas na aba, "Lançar realizado" por categoria, filtros, paginação de lançamentos, cabeçalho fixo.
- Abas Conferir o mês, Lançamentos e Ano do orçamento, exceto os pontos de entrada listados.
- Panorama, inclusive a análise de cota anual e ritmo do ano.
- Seletor de mês em inglês ("October 2026"), cabeçalho e menu "Mais" do Orçamento (fase 2 de Conferir o mês).
- Apagar os renderizadores antigos (só após a revisão de dezembro).

## Riscos

| Risco | Sinal | Mitigação |
|---|---|---|
| A soma das diferenças visíveis não bate com o total | Categoria planejada sem realizado mostra "—" mas entra no total planejado | Linha "Inclui CHF X planejados sem realizado em N categorias." (H1); teste com a fixture (720 − 400 = 320) |
| Total diverge por frações de centavo com câmbio | Teste de soma falha com BRL convertido | Totais derivados da soma das linhas em centavos; tolerância de 1 centavo por categoria contra `budgetExpenseCategories` |
| Linhas sem lançamento no "Janeiro a outubro" | Categoria planejada só em dezembro aparece com "Sem planejado" e "Nada lançado" | Filtrar linhas sem `entries` no período (regra de cálculo); teste com Viagem dezembro |
| O dono sente falta dos gráficos | Procura "Para onde vai o dinheiro" no fechamento de novembro | [validar]; critério de reversão com um gráfico único recolhido; código antigo fica um ciclo |
| Nomes visíveis com valores ocultos expõem demais | Dono discorda | Segue Panorama e Conferir o mês; [validar]; reverter é esconder a lista no modo oculto |
| Perda da semântica de tabela para leitor de tela | Valores lidos sem rótulo | Rótulo oculto em cada valor; teste do nome lido; [verificar no navegador] com VoiceOver |
| Volta da edição não mostra o lançamento | O lançamento está num grupo de "Sugestões" dentro de Outras despesas, e só o `<details>` mais próximo é aberto (`main.js:2531`) | Abrir todos os `<details>` ancestrais do lançamento (H2); teste no script |
| "Maior diferença" no ano em andamento ordena diferente do percentual "Usado" | Categoria grande com 80% usado acima de uma pequena com 120% | [suposição] aceitável nesta entrega; "Maior uso" no backlog |
| Scripts antigos procuram controles que saem | `test:budget-browser` e `test:month-check-browser` falham em `[data-budget-category-control="month"]`, pizzas e excessos | Reescrever os trechos listados em "Validação" no mesmo PR |
| Virada do mês em UTC | Mês em andamento muda 3 h antes no Brasil | Mesmo comportamento de hoje (`month-tracking.js:18`); fora do escopo |

## Validação

- **Testes unitários em `tests/`** (`npm run validate`). Reescrever `tests/budget-categories.test.js`:
  - teste 2 (linha 48): `budgetCategoriesView.month = 'all'` vira `period = 'year'`; o texto esperado vira "Realizados lançados em 1 de 12 meses.";
  - teste 3 (linhas 57-62): "Sem planejamento", "Sem realizado", "Não calculado" e "Nenhuma despesa planejada ou realizada" viram "sem planejado", "—", "Nada lançado" e "Agosto não tem despesas planejadas nem realizadas.";
  - teste 4 (linhas 65-72): a privacidade inverte; com valores ocultos, os nomes aparecem, e não aparecem valores, sinais, percentuais, barras, classe de alerta, `data-edit-budget-category` nem `data-plan-budget-category`; o escape de descrições continua;
  - teste 5 (linhas 74-86): "Maior excesso" vira "Maior diferença"; a ordem é lida da lista de `<details>`, não de `<tbody>`; o estado depois de `resetBudgetEntriesView` é `{ period: 'month', sort: 'difference' }`.
  - Casos novos: um por estado (mês encerrado, em andamento, futuro, sem realizado, sem planejado, vazio, janeiro até o mês, janeiro sem a opção, ano encerrado, ano em andamento com "Usado", ano futuro, valores ocultos, Outras despesas); soma das linhas igual ao total em centavos, inclusive com câmbio; linha "Inclui … sem realizado"; as 4 ordenações da fixture; lançamentos do maior para o menor com o dia no modo mês; ausência das frases removidas; `buildBudgetYear` chamado uma vez por renderização.
  - Devem continuar passando sem mudança: `tests/budget-category-edit.test.js`, `tests/planned-expense-links.test.js`, `tests/budget-year-to-date.test.js`, `tests/budget-expense-overruns.test.js`, `tests/budget-expense-distribution.test.js`, `tests/other-expense-analysis.test.js` (os três últimos testam código que fica sem uso por um ciclo).
- **Navegador, só com dados sintéticos.** Contexto de navegador novo e vazio, servidor e banco próprios, estado montado no script, como já fazem os scripts atuais. Nunca o banco real do finapp nem o perfil do dono.
  - Novo `scripts/check-budget-categories-browser.mjs` (sugestão de comando: `npm run test:categories-browser`), no padrão de `scripts/check-month-check-browser.mjs`, com a fixture de outubro de 2026 da avaliação e a da seção "Histórias". Verifica as métricas de "Como saber se deu certo" (altura a 1.440 e 390 px, topo da primeira categoria, rolagem lateral a 1.440, 390, 360 e 320 px, valores em dinheiro, controles, gatilhos, paradas de Tab, frases), T1 em 2 cliques, T4 em ≤ 4 cliques, o "›" com e sem valores ocultos, "Mostrar valores" mantendo a aba e capturas para revisão.
  - Reescrever em `scripts/check-budget-overview-browser.mjs`: linha 151 e 165-177 (seletores `month` e `year` viram a checagem do mês global e de `period`, que persiste ao trocar o mês); 225-309 (pizzas, "Excesso mínimo", fatias, fixture isolada de pizzas e controle de detalhamento saem; fica a linha de Mercado com 300,00, 430,00 e +130,00 lida do `<details>`); 387-396 (`tbody`/`tfoot` e seletores de ano e mês viram a lista, o total e `period = 'year'`); 601-606 (o link passa a se chamar "Ver gastos por categoria", o foco vai para `budget-categories-title` e a ordenação fica `actual`); 708-757 (o bloco de acumulado vira o período "Janeiro a setembro", com Saúde em 7.830,00 e a edição de "Consulta 1"); 770-800 (Outras despesas por "Sugestões pela descrição", sem fatias, com a mesma edição de SBB para Transporte e a mesma checagem de privacidade); 814-830 (cota anual vira "Ano de 2026" com "Usado: 105%" e "Usado: 30%", com `today` controlado).
  - Atualizar `scripts/check-month-check-browser.mjs:104-105`: em vez dos seletores `month` e `year`, conferir `#budget-reference-month` = 2026-10 e `[data-budget-category-control="period"]` = `month`.
- Teste de tarefas T1 a T5 com o dono: linha de base na tela atual, se houver tempo antes do merge, e repetição no fechamento de novembro de 2026.

## Pendências com o dono

- [validar] Remover da aba os 2 gráficos de barras, as 2 pizzas e o bloco "Gastos acima do planejado"; a leitura fica em Conferir o mês e no Panorama. Reversão: um gráfico único recolhido.
- [validar] Com valores ocultos, nomes de categorias e lançamentos visíveis, valores mascarados e ordem alfabética, como no Panorama e em Conferir o mês.
- [validar] "Janeiro a outubro" como o caminho de volta do Acumulado do ano. Na conversa de 2026-11-18, perguntar se esse período cobre o que o dono usava.
- [validar] No ano em andamento, "Usado: N%" no lugar da Diferença.
- [validar] Receitas nesta aba só na fase 2.
- [suposição] Seletor de período como `<select>`, lançamentos do maior para o menor, metas de altura e posição; confirmar com as capturas da implementação.
