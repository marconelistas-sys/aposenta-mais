# Avaliação de UX: aba "Conferir o mês" do Orçamento

## Pedido e escopo

O dono descreveu a aba `/orcamento?aba=resumo` como "confusa, poluída e pouco útil". Esta avaliação revisa a aba, propõe uma tela nova e não altera código.

Evidências: capturas a 1.440 e 390 pixels e o texto visível da aba, com dados fictícios (outubro de 2026: 12 realizados, receitas CHF 9.800, despesas planejadas CHF 7.317,10 e realizadas CHF 7.717,10). Código lido: `renderBudgetEntries` e `renderBudgetMonthSummary` (`src/features/cash-flow/cash-flow.js`), `renderMonthTracking` (`month-tracking.js`), `buildMonthlyBudget` (`src/domain/monthly-budget.js`), `budgetExpenseCategories` (`src/domain/budget-overview.js`), `budgetExpenseOverruns` (`src/domain/budget-expense-overruns.js`), `linkActualExpensesToPlans` (`src/domain/planned-expense-links.js`) e a aba Categorias (`budget-categories.js`).

Rótulos: [fato] verificado no código ou na captura; [contagem] medido na captura ou no texto; [suposição] decisão sem dado; [validar] pede confirmação do dono; [verificar no navegador] depende da renderização real. Não houve teste com usuários. As contagens servem de linha de base, não são resultado medido com pessoas.

## Para que a pessoa abre esta aba

Quem abre "Conferir o mês" acabou de importar um extrato, está fechando o mês ou quer saber como o mês vai. Em 10 segundos, precisa responder, nesta ordem:

1. **Estou dentro do planejado?** Uma frase com um número: gastei X a mais ou a menos e sobrou Y.
2. **Onde passei do planejado?** As duas ou três categorias que explicam a diferença, com o valor de cada uma.
3. **O que ainda falta lançar?** O que estava planejado e não tem realizado no mês, como receita que não entrou, conta que não apareceu ou eventual sem data.
4. **Posso confiar nos números?** Quantos realizados existem e até que data vão. Isso substitui o aviso genérico "podem estar incompletos".

Depois disso, a pessoa quer **agir**: lançar o que falta, importar o extrato, ajustar o planejado de uma categoria ou abrir a categoria para ver os lançamentos.

Hoje a aba responde só à pergunta 1, e a resposta aparece duas vezes. Não responde às perguntas 2 e 3. A pergunta 4 recebe um aviso, sem dado. [fato: `cash-flow.js:774` monta a aba só com totais; nenhuma das duas funções recebe dados por categoria]

## Contagens da tela atual (linha de base)

| Medida | Valor | Fonte |
|---|---|---|
| Valores em dinheiro na aba | 11 visíveis para 7 fatos distintos. Mais 3 no detalhe "Conferir o saldo dos registros" | [contagem] texto visível e `month-tracking.js:32` |
| Fatos repetidos | Receitas, despesas e saldo, planejados e realizados, aparecem 2 vezes cada. O saldo aparece 3 vezes | [contagem] |
| Frases explicativas visíveis, sem dado | 14 | [contagem] texto visível |
| Repetições literais | "Os registros podem estar incompletos" e "12 registro(s)" aparecem 2 vezes cada. "Não é o saldo bancário" aparece 1 vez visível e 2 vezes dentro de detalhes | [contagem] `cash-flow.js:554, 558, 559` e `month-tracking.js:14, 19` |
| Detalhes expansíveis com a aba aberta | 6: 3 dentro da aba e 3 abaixo das abas | [contagem] `cash-flow.js:559`, `month-tracking.js:14, 32`, `cash-flow.js:792-794` |
| Controles antes do primeiro número | 13: 2 links, 4 botões, 3 controles de mês e 4 abas | [contagem] captura a 1.440 px |
| Altura da página a 390 px | 3.025 px, cerca de 3,6 telas de 844 px | [contagem] captura a 390 px |
| Posição da frase "CHF 400,00 acima do previsto" a 390 px | Por volta de 936 px, abaixo da primeira tela | [contagem] captura a 390 px |
| Categorias que explicam a diferença | 0 | [fato] |

O texto citado entre aspas nas tabelas reproduz a tela atual. A cópia proposta usa "planejado" e "realizado".

## Achados heurísticos

Severidade de 0 a 4 (Nielsen): 4 impede a tarefa, 3 problema grave, 2 problema moderado, 1 cosmético ou de baixo impacto.

| # | Sev. | Heurística | Achado e consequência | Evidência |
|---|---|---|---|---|
| A1 | 3 | 6 Reconhecimento em vez de memória | A tela mostra "CHF 400,00 acima do previsto" sem dizer de onde veio. Para descobrir, a pessoa precisa decorar o número, abrir Categorias e comparar a tabela. Quando categorias se compensam (uma +500, outra −100), o total esconde o desvio. | [fato] `cash-flow.js:774` e `month-tracking.js:20-31` trabalham só com totais. Os dados por categoria existem em `budgetExpenseCategories` (`budget-overview.js:47-68`), sem uso nesta aba |
| A2 | 3 | 1 Visibilidade do estado | A tela não mostra o que falta lançar. Em vez de listar o planejado sem realizado, avisa que "os registros podem estar incompletos". O aviso aparece mesmo quando nada falta e não diz o que falta quando falta. | [fato] `month-tracking.js:19` e `cash-flow.js:554`. Planejado sem realizado é um filtro simples sobre `budgetExpenseCategories` (`entries.actual.length === 0 && planned > 0`) |
| A3 | 3 | 4 Consistência e 8 Minimalismo | Os mesmos 6 fatos aparecem duas vezes, nos cartões da esquerda e nas barras da direita, com arredondamentos diferentes (CHF 7.317 e CHF 7.317,10). O saldo aparece uma terceira vez em um detalhe. A pessoa compara cartões para ver se dizem coisas diferentes, e não dizem. | [fato] `cash-flow.js:543` (`precise = false`), `month-tracking.js:12` (`precise = true`), `month-tracking.js:32`. Captura a 1.440 px |
| A4 | 2 | 4 Consistência | O mesmo conceito tem nomes diferentes: "Despesas e metas", "Despesas" e "Despesas realizadas". "Saldo do orçamento" e "Saldo previsto". "Saldo realizado" e "Saldo dos registros". "Previsto" e "Registrado como realizado". Nas abas Categorias e Lançamentos e no formulário, os nomes são "Planejado" e "Realizado". | [fato] `cash-flow.js:551, 557`, `month-tracking.js:30, 32`, `budget-categories.js:37`, `cash-flow.js:780` |
| A5 | 2 | 8 Minimalismo e 2 Linguagem do usuário | 14 frases explicativas competem com 7 números. Boa parte é defensiva ("não é o saldo bancário") porque a palavra "saldo" sugere o saldo da conta. O problema é o nome, e o remédio atual é repetir o aviso. | [contagem] texto visível; `cash-flow.js:558`, `month-tracking.js:14` |
| A6 | 2 | 8 Minimalismo | Há 6 detalhes expansíveis. Dois explicam as mesmas regras com textos diferentes: anuais divididos por 12, eventuais sem data, previdência e saldo bancário. "Conferir o saldo dos registros" esconde a terceira cópia do saldo. | [fato] `cash-flow.js:559` e `month-tracking.js:14, 32` |
| A7 | 2 | 8 Minimalismo e 7 Eficiência | O cabeçalho tem 4 botões e 2 links acima do seletor de mês. "Importar extrato" e "Transferências" só abrem os detalhes do fim da página, então há duas entradas para a mesma ferramenta. "Para entender o ano…" repete o link "Ver análise no Panorama" do cabeçalho. | [fato] `cash-flow.js:768-770` e `main.js:942-953` |
| A8 | 2 | 1 Visibilidade e 4 Consistência | A 390 px, a resposta principal fica abaixo da primeira tela e a página mede cerca de 3,6 telas. A ordem também muda: no desktop o planejado vem primeiro, no celular o acompanhamento vem primeiro. | [fato] `cash-month-summary.css:52` (`order: -1`). [contagem] captura a 390 px |
| A9 | 2 | 8 Minimalismo | O lugar de maior destaque (alto à esquerda, título maior) vai para o planejado, que a pessoa mesma digitou. A comparação, que é o motivo da aba, fica em segundo plano. Os sinais "−" e "=" ocupam três linhas para uma subtração que a pessoa não precisa fazer. | [fato] `cash-flow.js:555-557`. Captura a 1.440 px |
| A10 | 1 | 8 Minimalismo | "Saldo previsto positivo" e "Saldo dos registros positivo" repetem o sinal de um número que já aparece em verde. | [fato] `cash-flow.js:552-553` |
| A11 | 1 | 4 Consistência | A barra do realizado fica toda vermelha, embora o excesso seja só CHF 400 de CHF 7.717. A cor marca o valor inteiro, não o desvio. Também não há limite: 0,5% acima recebe o mesmo vermelho que 50%. | [fato] `month-tracking.js:30` (`data-over`). Captura a 1.440 px |
| A12 | 1 | 7 Eficiência | Os botões "Conferir realizados" e "Revisar o planejado" levam para Lançamentos. Lançar o que falta numa categoria exige sair da aba, abrir o formulário e escolher a categoria de novo. | [fato] `month-tracking.js:13` e `main.js:787-795` |
| A13 | 1 | 4 Consistência | A 390 px, a barra de abas corta "Lançam…" e esconde "Ano do orçamento", sem sinal de rolagem. O seletor de mês mostra "October 2026" numa tela em português. Os dois são componentes compartilhados. | [verificar no navegador] captura a 390 px e 1.440 px |

Notas para quem for implementar (não são problemas da tela):

- `variance.expenses` usa planejado menos realizado, sinal contrário ao de receitas e saldo (`monthly-budget.js:77-81`) e ao da tabela de Categorias (realizado menos planejado). A tela nova deve usar uma única convenção: **realizado menos planejado**.
- A aba calcula `buildMonthlyBudget` duas vezes por renderização (`cash-flow.js:544` e `month-tracking.js:10`). A tela nova deve calcular uma vez e passar o resultado adiante.

## O que os dados já oferecem

| Pergunta | Fonte existente | Cálculo novo? |
|---|---|---|
| Totais planejados e realizados de receitas, despesas e saldo | `buildMonthlyBudget(state).planned / .actual` | Não [fato] |
| Despesas por categoria no mês: planejado, realizado, diferença, sem planejamento e lançamentos | `budgetExpenseCategories(period)` | Não [fato] |
| Receitas por categoria no mês | `budgetExpenseCategories(period, 'income')`. A função aceita o tipo | Não [fato] |
| Categorias acima do planejado, em ordem de excesso | `budgetExpenseOverruns(categories, 0)`. Com limite 0, entra todo excesso maior que zero centavos | Não. Usar limite 0 para a lista fechar com o total [suposição] |
| Categorias abaixo do planejado, que compensam | Filtro `difference < 0` sobre as mesmas categorias | Só um filtro |
| Planejado sem realizado no mês, por categoria | Filtro `planned > 0 && entries.actual.length === 0` | Só um filtro |
| Planejado sem realizado, por lançamento | `plannedExpenseLink.id` nos realizados contra os `id` planejados. O vínculo é ambíguo quando há vários planejados na mesma categoria (`planned-expense-links.js:17-20`) e só vale para despesas | Diferença de conjuntos. Deixar para depois [suposição] |
| Eventuais sem data, fora dos totais | `budgetEntriesResult().excluded.undated`, já listado na aba | Não [fato] |
| Quantidade de realizados | `records.actual.count` | Não [fato] |
| Data do último realizado | Maior `entry.date` entre realizados **eventuais** do mês. Recorrentes guardam a data de início, não a da ocorrência | Uma redução simples. [validar] se os extratos importados geram eventuais com data |
| Mês passado, em andamento ou futuro | Lógica de `month-tracking.js:18-19` | Não [fato] |
| Lançar realizado já com a categoria preenchida | O atalho `data-plan-budget-category` (`main.js:888-910`) faz o mesmo para planejado | Novo atalho com `recordKind: 'actual'`. Liberar também categorias de receita |

Toda a proposta funciona com matemática existente, mais filtros e uma redução de data.

## Proposta de hierarquia

Princípio: **mostrar só as exceções**. A aba responde às quatro perguntas e manda para Categorias quem quiser a tabela completa. Cada fato aparece uma vez, com um único arredondamento.

Ordem fixa, igual no desktop e no celular:

1. **Resposta do mês**: uma frase com o desvio das despesas e uma linha sobre a sobra.
2. **Quadro do mês**: 3 linhas (Receitas, Despesas, Sobra) por 3 colunas (Planejado, Realizado, Diferença).
3. **Onde passou do planejado**: até 3 categorias, mais uma linha de fechamento para que a soma bata com a diferença total.
4. **Ainda sem realizado**: planejado sem realizado no mês, receitas e despesas, mais os eventuais sem data, cada um com sua ação.
5. **Rodapé**: uma linha sobre a base dos números, as duas ações de preenchimento e um único detalhe "Como esta conferência é calculada".

### Desktop (1.440 px). Nomes de categorias ilustrativos

```
 Orçamento mensal                                    [+ Adicionar lançamento] [Mais ▾]
 Planeje e confira o mês.                            Ver análise no Panorama →
 [←] [ outubro de 2026  ▾ ] [→]
 ┌ Conferir o mês ┐  Categorias   Lançamentos   Ano do orçamento
 ╞════════════════╧══════════════════════════════════════════════════════════════════╡
 │ OUTUBRO DE 2026 · MÊS ENCERRADO                                                  │
 │ Você gastou CHF 400,00 a mais que o planejado.                                   │
 │ Sobraram CHF 2.083,10 dos CHF 2.483,00 planejados.                               │
 │                                                                                  │
 │                    Planejado         Realizado         Diferença                 │
 │  Receitas       CHF 9.800,00      CHF 9.800,00          CHF 0,00                 │
 │  Despesas       CHF 7.317,10      CHF 7.717,10       +CHF 400,00  acima          │
 │  Sobra          CHF 2.483,00      CHF 2.083,10       −CHF 400,00                 │
 └──────────────────────────────────────────────────────────────────────────────────┘
 ┌ Onde passou do planejado ──────────────┐ ┌ Ainda sem realizado ───────────────────┐
 │ Lazer          +CHF 310,00   +62%   ›  │ │ Seguro residencial  CHF 120,00         │
 │ Mercado        +CHF 150,00   +12%   ›  │ │                       [Lançar realizado]│
 │ Presentes      +CHF  90,00             │ │ Aluguel recebido    CHF 800,00 receita │
 │   sem planejado  [Adicionar planejado] │ │                       [Lançar realizado]│
 │ Abaixo do planejado em 2 categorias:   │ │ Viagem (eventual sem data)             │
 │   −CHF 150,00                          │ │                       [Informar data]  │
 │ = +CHF 400,00 no total                 │ │                                        │
 │ Ver todas as categorias →              │ │ Ver o planejado do mês →               │
 └────────────────────────────────────────┘ └────────────────────────────────────────┘
 Conta 12 realizados, o último em 28/10. Mostra seus lançamentos, não o saldo da conta.
 [Importar extrato]  [Lançar realizado]               › Como esta conferência é calculada
```

Regras de layout:

- A resposta e o quadro ficam num só painel, em largura total. Os dois blocos de exceção ficam lado a lado acima de 1.000 px e um embaixo do outro abaixo disso.
- Valores alinhados à direita, com dígitos de largura fixa (`font-variant-numeric: tabular-nums`). Diferença com sinal e palavra ("acima", "abaixo"), sem depender só da cor.
- Cor só na diferença e no ícone da frase principal, nunca no valor inteiro (corrige A11). Vermelho para despesa acima do planejado e sobra abaixo do planejado.
- Barras opcionais: uma barra fina por linha do quadro, com o realizado como fração do planejado, útil no mês em andamento. Nada de pares de barras.
- `›` abre a categoria na aba Categorias, já no mês da conferência e ordenada por "Maior excesso", que já é o padrão (`budget-categories.js:7`).

### Celular (390 px)

```
 Orçamento mensal
 [+ Adicionar lançamento]  [Mais ▾]
 [←] [ outubro de 2026 ▾ ] [→]
 [Conferir o mês] [Categorias] [Lança›      ← rolagem com sombra na borda
 ┌───────────────────────────────────┐
 │ OUTUBRO DE 2026 · ENCERRADO       │
 │ Você gastou CHF 400,00 a mais     │
 │ que o planejado.                  │
 │ Sobraram CHF 2.083,10 dos         │
 │ CHF 2.483,00 planejados.          │
 │ ───────────────────────────────── │
 │ Despesas            +CHF 400,00 ▲ │
 │  planejado 7.317,10 · real 7.717,10│
 │ Receitas               CHF 0,00   │
 │  planejado 9.800,00 · real 9.800,00│
 │ Sobra               −CHF 400,00   │
 │  planejado 2.483,00 · real 2.083,10│
 └───────────────────────────────────┘
 ┌ Onde passou do planejado ─────────┐
 │ Lazer           +CHF 310,00     › │
 │ Mercado         +CHF 150,00     › │
 │ Presentes        +CHF 90,00       │
 │  sem planejado [Adicionar planej.]│
 │ Abaixo em 2 categorias −CHF 150,00│
 │ Ver todas as categorias →         │
 └───────────────────────────────────┘
 ┌ Ainda sem realizado ──────────────┐
 │ Seguro residencial   CHF 120,00   │
 │                [Lançar realizado] │
 │ Aluguel recebido     CHF 800,00   │
 │                [Lançar realizado] │
 └───────────────────────────────────┘
 12 realizados, o último em 28/10.
 Seus lançamentos, não o saldo da conta.
 [Importar extrato]
 › Como esta conferência é calculada
```

No celular, a diferença vem primeiro em cada linha, porque é a resposta, e o planejado e o realizado ficam numa linha menor abaixo. Meta: a frase principal e a linha de Despesas cabem na primeira tela (844 px) com o cabeçalho reduzido. [verificar no navegador]

## O que sai, o que se funde e o que muda de lugar

| Elemento atual | Destino | Motivo |
|---|---|---|
| Cartão "Orçamento previsto de…" com equação "−" e "=" (`cash-flow.js:555-557`) | Sai. Os valores vão para a coluna Planejado do quadro | A3, A9 |
| "Registrado no mês" (`cash-flow.js:558`) | Sai. Os valores vão para a coluna Realizado | A3 |
| Pares de barras "Previsto para o mês" e "Registrado como realizado" (`month-tracking.js:25`) | Viram uma barra fina opcional por linha do quadro | A3, A11 |
| Detalhe "Conferir o saldo dos registros" (`month-tracking.js:32`) | Sai. O saldo vira a linha Sobra | A3, A6 |
| Detalhes "O que este saldo representa" e "Como usar esta comparação" | Fundem-se em "Como esta conferência é calculada", com cada regra uma vez | A6 |
| Frase de propósito "Compare o que você previu…" (`month-tracking.js:8`) | Sai. A estrutura da tela já cumpre esse papel | A5 |
| "Os registros podem estar incompletos" (2 vezes) | Vira "Conta N realizados, o último em DD/MM" e a lista "Ainda sem realizado" | A2, A5 |
| "Saldo previsto positivo" e "Saldo dos registros positivo" | Saem | A10 |
| Botões "Conferir realizados" e "Revisar o planejado" | Viram os links "Ver todas as categorias" e "Ver o planejado do mês", mais "Lançar realizado" por linha | A12 |
| "Para entender o ano, veja onde o gasto está alto no Panorama" (`cash-flow.js:768`) | Sai. O cabeçalho já tem o link | A7 |
| Lista de eventuais sem data (`cash-flow.js:774`) | Entra em "Ainda sem realizado", com "Informar data" | Mesma pergunta: o que falta |

Cabeçalho e itens abaixo das abas, compartilhados por todas as abas. Fica como **fase 2**, porque afeta as outras abas:

| Elemento | Destino |
|---|---|
| 4 botões do cabeçalho | "Adicionar lançamento" continua como ação principal. "Importar extrato", "Transferências" e "Nova categoria de despesa" vão para um menu "Mais". Na aba Conferir o mês, "Importar extrato" também aparece no rodapé, onde a necessidade surge |
| Link "Ver impacto no patrimônio" | Vai para a aba Ano do orçamento, onde a pergunta sobre o patrimônio faz sentido |
| Frase "O mês selecionado acompanha as visões do orçamento." | Sai. O mês aparece no título de cada aba |
| Detalhe "Como a previdência entra no orçamento" (`cash-flow.js:792`) | Vai para a aba Lançamentos, porque é uma configuração do que entra nos totais. "Como esta conferência é calculada" aponta para lá |
| Detalhes "Transferências" e "Importar e exportar" (`cash-flow.js:793-794`) | Abrem só pelos botões ou pela rota `?aba=`. Deixam de aparecer fechados sob todas as abas |
| Barra de abas a 390 px | Sombra ou degradê na borda indicando rolagem (A13) |

## Texto (pt-BR, linguagem simples)

Decisão de vocabulário: **Planejado** e **Realizado**, as mesmas palavras do formulário, dos filtros e da tabela de Categorias. **Sobra** no lugar de "saldo" nesta aba: diz o resultado sem sugerir saldo da conta, e assim o aviso repetido deixa de ser necessário. [validar] O Panorama usa "saldo do orçamento". Confirmar com o dono se "Sobra" pode valer só aqui ou se deve mudar no app inteiro.

Arredondamento: centavos em todos os valores da aba, iguais aos de Categorias e Lançamentos e aos do extrato que a pessoa confere. [validar]

| Atual | Proposto |
|---|---|
| "Orçamento previsto de outubro de 2026" | Sai. O cabeçalho do painel diz "Outubro de 2026 · mês encerrado", "em andamento" ou "ainda não começou" |
| "Registrado CHF 400,00 acima do previsto." | "Você gastou CHF 400,00 a mais que o planejado." |
| "O valor registrado coincide com o previsto." | "Os gastos lançados batem com o planejado." |
| Realizado abaixo do planejado, mês encerrado | "Os gastos lançados estão CHF X abaixo do planejado." Linha 2: "Se faltou lançar algo, confira a lista ‘Ainda sem realizado’." Não afirmar economia (regra de `sprint-acompanhamento-mensal.md`) |
| Mês em andamento | "Até agora, você lançou CHF X dos CHF Y planejados em despesas." Linha 2: "N categorias já passaram do planejado." (só quando houver) |
| "Saldo do orçamento", "Saldo realizado" e "Saldo dos registros" | "Sobra", linha do quadro. Negativa: "Falta" ("Faltaram CHF X para fechar o mês") |
| "Despesas e metas" | "Despesas". O detalhe explica uma vez que as metas anuais entram como despesa planejada |
| "12 registro(s). Os registros podem estar incompletos." | "Conta 12 realizados, o último em 28/10." Sem data: "Conta 12 realizados." |
| "O saldo realizado representa os lançamentos registrados, não o saldo bancário." | "Mostra seus lançamentos, não o saldo da conta." (uma vez, no rodapé) |
| "Nenhum realizado registrado para este mês" e "Isso não significa que você não gastou…" | "Nada lançado como realizado em outubro." Linha 2: "Importe o extrato ou lance o que já aconteceu." |
| "Ainda falta cadastrar o planejado para comparar com seus registros." | "Outubro ainda não tem planejado." Ação: "Planejar o mês" |
| "Há lançamentos eventuais sem data, fora dos totais." | Item em "Ainda sem realizado": "Viagem: sem data, fora das contas." Ação: "Informar data" |
| "Conferir realizados" e "Revisar o planejado" | "Ver todas as categorias" e "Ver o planejado do mês" |
| "Como usar esta comparação" e "O que este saldo representa" | "Como esta conferência é calculada" |

Conteúdo do detalhe único (cada regra uma vez): valores anuais entram como 1/12 por mês; eventuais entram no mês da data, e sem data ficam fora; previdência descontada em folha fica fora (configuração em Lançamentos); transferências entre contas próprias não são receita nem despesa; valores em outras moedas usam o câmbio da visão; o realizado não muda o planejado nem a projeção.

## Estados

Cálculo local e síncrono: não há carregamento nem erro de rede. Mês inválido já gera aviso pela navegação de mês (`main.js:780-784`). Os estados que importam são de conteúdo e de tempo.

| Estado | Condição | Resposta do mês | Quadro | Exceções | Ação principal |
|---|---|---|---|---|---|
| Mês encerrado com dados | Mês < atual, planejado e realizado | Desvio das despesas e sobra | Completo | As duas listas. Lista vazia: "Nenhuma categoria acima do planejado." ou "Tudo o que estava planejado tem realizado." | Lançar realizado ou importar extrato, se houver pendência |
| Mês em andamento | Mês = atual | "Até agora, você lançou X dos Y planejados." | Completo, com barra fina | "Onde passou" vale desde já. "Ainda sem realizado" com o título "Ainda vai entrar ou sair" | Importar extrato |
| Mês futuro | Mês > atual | "Novembro ainda não começou. Planejado: entra X, sai Y, sobra Z." | Só a coluna Planejado | "Maiores despesas planejadas", até 3. Realizados com data futura: "Há N realizados com data futura. Confira as datas." (regra atual) | Ver o planejado do mês |
| Sem planejado | `records.planned.count === 0` | "Outubro ainda não tem planejado." Mostra só o realizado | Só a coluna Realizado | "Onde passou" vira "Maiores gastos lançados", com "Adicionar planejado" | Planejar o mês |
| Sem realizado | `records.actual.count === 0`, mês passado ou atual | "Nada lançado como realizado em outubro." | Só a coluna Planejado | "Ainda sem realizado" mostra todo o planejado, que funciona como lista de conferência | Importar extrato |
| Sem planejado e sem realizado | Os dois zerados | "Outubro está vazio." Linha 2: "Planeje o mês ou importe um extrato." | Oculto | Oculto | Duas ações, Planejar o mês e Importar extrato |
| Valores ocultos | `state.valuesHidden` | "Valores ocultos." Sem desvio, sem cor e sem categoria | Valores mascarados (`CHF •••••`), sem sinal, sem barras | Ocultas, porque nomes de categoria acima do planejado revelam informação derivada | Mostrar valores |
| Planejado com déficit | `planned.balance < 0` | Linha 2: "O planejado já gasta CHF X a mais do que entra." | Sobra negativa como "Falta" | Normais | Ver o planejado do mês |
| Realizado com déficit | `actual.balance < 0` | Linha 2: "Neste mês saiu CHF X a mais do que entrou." | "Falta" | Normais | Normais |
| Receita planejada sem realizado | Receita planejada > 0 e nenhuma receita realizada | Linha 2: "Nenhuma receita lançada ainda (planejado: CHF X)." Sem calcular sobra realizada | Sobra realizada: "Sem receita lançada" | Receitas aparecem em "Ainda sem realizado" | Lançar realizado |
| Totais iguais com desvios internos | Diferença total ≈ 0 e alguma categoria ≠ 0 | "Os gastos lançados batem com o planejado no total." | Completo | "Onde passou" aparece mesmo assim, com a linha de compensação | Nenhuma |
| Gasto sem planejado | `unplanned` | Normal | Normal | Item com "sem planejado" e "Adicionar planejado" (atalho existente) | Adicionar planejado |
| Planejado com valores anuais | `records.planned.annual > 0` | Normal | Normal | Normais | Rodapé: "Inclui valores anuais divididos por 12." |
| Muitas exceções | Mais de 3 categorias em uma lista | Normal | Normal | 3 itens e a linha "e mais N categorias: +CHF X", para a soma fechar | Ver todas as categorias |
| Conteúdo extremo | Nome de categoria longo, valor ≥ CHF 1.000.000 a 390 px | — | Quebra de linha no nome, nunca no valor. Valor não encolhe | Igual | — |

## Implementação sugerida

1. Novo modelo puro `buildMonthCheck(state, month, today)` em `src/domain/`, sobre `buildMonthlyBudget`, `budgetExpenseCategories` (despesa e receita) e `budgetExpenseOverruns(…, 0)`. Retorna: estado temporal, totais, diferenças com a convenção realizado menos planejado, acima (top 3 e resto), abaixo (soma e contagem), sem realizado, sem data, contagem e último realizado. Testável sem DOM.
2. Novo `renderMonthCheck(state)` no lugar de `renderBudgetMonthSummary` e `renderMonthTracking(…)` na aba `resumo`. `renderMonthTracking` não tem outro uso na interface (só testes); manter por um ciclo, como foi feito com o Acumulado do ano.
3. Novo atalho "Lançar realizado" (`data-record-budget-category`), copiado de `data-plan-budget-category` (`main.js:888-910`), com `recordKind: 'actual'`, eventual e data = hoje no mês em andamento ou o dia 1 do mês da conferência. Aceitar categorias de receita.
4. `›` e "Ver todas as categorias" definem `budgetCategoriesView.month` com o mês da conferência e `sort = 'difference'`, e então navegam para `?aba=categorias`.
5. Testes: um por linha da tabela de estados, a soma "acima + abaixo = diferença total" em centavos, a privacidade (nenhum nome de categoria e nenhuma cor quando oculto) e o arredondamento único.
6. Fase 2, separada: cabeçalho com o menu "Mais", detalhes compartilhados fora das abas e indicação de rolagem na barra de abas.

## Como medir

Não há telemetria: o app é local e não envia dados. A medição combina contagens automáticas no DOM, como em `scripts/check-report-print-browser.mjs`, com um teste de tarefas feito pelo dono.

| Métrica | Linha de base | Meta | Instrumento |
|---|---|---|---|
| Cada fato monetário aparece uma vez na aba | 7 fatos em 11 exibições, mais 3 no detalhe [contagem] | 1 exibição por fato | Script de DOM com dados fictícios |
| Frases explicativas visíveis, sem dado | 14 [contagem] | ≤ 3 | Script de DOM |
| Detalhes expansíveis com a aba aberta | 6 [contagem] | 1 (fase 1: 4; fase 2: 1) | Script de DOM |
| Frase principal na primeira tela a 390 × 844 | Não. Fica por volta de 936 px [contagem] | Sim | Captura em Chrome sem interface (headless) |
| Altura da aba a 390 px | 3.025 px [contagem] | ≤ 2.000 px com os dados fictícios atuais [suposição] | Captura em Chrome sem interface (headless) |
| Tarefa T1: "Você está dentro do planejado em outubro?" | Não medido | Resposta certa em ≤ 10 s | Teste com o dono, cronometrado |
| Tarefa T2: "Quais categorias causaram a diferença?" | Impossível nesta aba. Exige ir para Categorias [fato] | Resposta certa em ≤ 10 s, sem sair da aba | Teste com o dono |
| Tarefa T3: "O que estava planejado e ainda não foi lançado?" | Impossível na tela atual [fato] | Resposta certa em ≤ 15 s | Teste com o dono |
| Tarefa T4: "Lance o realizado que falta numa categoria" | Não medido. São pelo menos 4 passos: Lançamentos, Adicionar, categoria e tipo [contagem] | ≤ 2 cliques até o campo de valor | Teste com o dono |
| Percepção | "Confusa, poluída e pouco útil" (relato do dono) | O dono usa a aba no fechamento de novembro sem abrir Categorias para entender o desvio | Conversa depois do fechamento |

Responsável: dono do produto. Revisão: no fechamento de novembro de 2026 (início de dezembro), com o mesmo roteiro de tarefas aplicado antes e depois da mudança. [validar] As tarefas T1 a T4 devem ser aplicadas também na tela atual antes da implementação, para registrar a linha de base de tempo.

## Pendências com o dono

- [validar] "Sobra" e "Falta" no lugar de "saldo" só nesta aba ou no app inteiro.
- [validar] Centavos em todos os valores desta aba.
- [validar] Os extratos importados geram realizados eventuais com data? Disso depende "o último em DD/MM".
- [validar] Quando valores estão ocultos, esconder também os nomes das categorias acima do planejado (proposta) ou mostrá-los sem valor.
- [suposição] Limite 0 na lista "Onde passou do planejado". O Panorama usa 10%, e aqui a lista precisa fechar com o total.
