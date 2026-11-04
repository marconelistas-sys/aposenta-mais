# Conferir o mês

## Status

Implementado em 2026-11-04. Diferenças em relação ao plano:
- "Mostrar valores" e "Importar extrato" dentro da aba usam ganchos próprios (`data-month-check-show-values`, `data-month-check-import`) com a mesma ação. Assim, os scripts de navegador que clicam nos botões do cabeçalho continuam encontrando um botão só.
- Com valores ocultos, as linhas de compensação e o total de "Onde passou do planejado" não aparecem. Junto com os nomes, elas revelariam a direção de cada diferença.
- A frase principal não fica toda colorida: só o valor do desvio fica em vermelho.
- Realizados recorrentes não chegam a existir em dados novos, porque o estado converte todo realizado em eventual. A regra "o último em" continua ignorando recorrentes, para os dados antigos.

## Pedido do dono

"Consultar o agente de UX e product owner e melhorar a tela de conferir mês dentro de orçamento mensal, pois ela está confusa, poluída e pouco útil."

Base: [avaliação de UX](avaliacao-ux-conferir-mes.md) (achados A1 a A13, contagens e proposta de hierarquia) e o plano do [Panorama financeiro](panorama-financeiro.md), que define o Orçamento como tela de lançar e conferir e deixa a análise do ano no Panorama.

Rótulos: [fato] verificado no código; [suposição] decisão sem dado; [validar] decisão tomada pelo PO que o dono pode reverter; [verificar no navegador] depende da renderização real. Não houve teste com usuários.

## Problema

- A aba `/orcamento?aba=resumo` responde só a "estou dentro do planejado?", e responde duas vezes, com arredondamentos diferentes (CHF 7.317 e CHF 7.317,10). [fato: `cash-flow.js:543` com `precise = false`, `month-tracking.js:12` com `precise = true`]
- Não diz **onde** a diferença aconteceu nem **o que falta lançar**. Nenhuma das duas funções recebe dados por categoria. [fato: `cash-flow.js:774`]
- Tem 14 frases explicativas para 7 números, 6 detalhes expansíveis com a aba aberta e 4 nomes diferentes para o mesmo conceito ("Despesas e metas", "Despesas", "Despesas realizadas"; "Saldo do orçamento", "Saldo previsto", "Saldo realizado", "Saldo dos registros"). [contagem na avaliação]
- A 390 px, a frase "CHF 400,00 acima do previsto" fica por volta de 936 px, abaixo da primeira tela. [contagem na avaliação]

Em uma frase: quem fecha o mês não consegue dizer, sem sair da aba, quais categorias causaram o desvio e o que ainda não foi lançado, porque a aba só mostra totais repetidos.

## Decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Hierarquia | Ordem fixa, igual no desktop e no celular: resposta do mês, quadro do mês, "Onde passou do planejado", "Ainda sem realizado", rodapé | Proposta da avaliação. Responde às 4 perguntas na ordem em que a pessoa as faz |
| Matemática | Nenhum cálculo financeiro novo. Fontes: `buildMonthlyBudget` (uma vez por renderização), `budgetExpenseCategories(period, 'expense')`, `budgetExpenseCategories(period, 'income')` e `budgetExpenseOverruns(categorias, 0)`. O resto são filtros, somas em centavos e o maior valor de uma data | Restrição do pedido. As funções já existem e têm testes [fato] |
| Sinal da diferença | Uma convenção em toda a aba: **realizado menos planejado**. A aba não usa `variance.expenses`, que é planejado menos realizado. Despesas: positivo = gastou mais. Receitas e Sobra: negativo = entrou menos ou sobrou menos | `monthly-budget.js:77-81` mistura sinais [fato]. A tabela de Categorias já usa realizado menos planejado [fato: `budget-overview.js:63`] |
| Fechamento da conta | A lista "Onde passou do planejado" fecha ao centavo com a diferença de Despesas do quadro. Para isso tem **dois** termos de compensação: "Abaixo do planejado" (categorias com realizado > 0 e menor que o planejado) e "Ainda sem realizado" (categorias planejadas sem nenhum realizado) | `budgetExpenseCategories` devolve `difference: null` para categoria sem realizado e `budgetExpenseOverruns` a ignora [fato: `budget-overview.js:63`, `budget-expense-overruns.js:37`]. Sem o segundo termo, a soma não bate. Separar os dois termos evita apresentar lançamento que falta como economia (regra de `sprint-acompanhamento-mensal.md`) |
| Arredondamento para fechar | O modelo arredonda cada categoria a centavos e deriva os totais de Despesas e Receitas da aba dessas somas. Diferença tolerada contra `buildMonthlyBudget`: até 1 centavo por categoria | Valores convertidos de outra moeda têm frações de centavo. A conta visível precisa fechar exatamente [suposição: verificar com dados em CHF e BRL] |
| Vocabulário | "Planejado" e "Realizado", iguais ao formulário, aos filtros e a Categorias. **"Sobra"** no lugar de "saldo" nesta aba; quando negativa, **"Falta"**. O resto do app (Panorama, Ano do orçamento) continua com "Saldo" nesta entrega **[validar]** | "Sobra" não sugere saldo da conta, então o aviso "não é o saldo bancário" cai de 3 cópias para 1. Mudar o app inteiro sai do foco desta entrega e mexe em telas recém-entregues |
| Centavos | Todos os valores em dinheiro da aba com centavos (`privateCurrency(valor, oculto, true, moeda)`). Percentuais inteiros | É contabilidade do mês, comparada com extrato. Categorias e Lançamentos já usam centavos [fato: `budget-categories.js:34`, `cash-flow.js:104`]. A regra "sem centavos" vale para projeções de um ano ou mais (`formatProjectedCurrency`, item A1 do backlog), não para esta aba **[validar]** |
| "O último em DD/MM" | Maior data entre os realizados **eventuais** do mês. Recorrentes e anuais não entram, porque guardam a data de início e não a da ocorrência. Sem eventual com data: "Conta N realizados." | [fato] Extrato importado gera realizado eventual com data: `itemFromRow` grava `frequency: 'occasional'`, `startDate` e `endDate` iguais à data da linha, `recordKind: 'actual'` e `imported: true` (`src/domain/statement-import.js:171-182`). `buildMonthlyBudget` expõe essa data como `entry.date` (`monthly-budget.js:62`). Esta pendência da avaliação está resolvida por fato, não precisa de validação |
| Valores ocultos | Mesmo padrão do Panorama: a aba mostra a estrutura e os **nomes** de categorias e lançamentos; todo valor em dinheiro vira `CHF •••••`, sem sinal; percentuais, cores e as palavras "acima" e "abaixo" saem. A frase principal vira "Valores ocultos." com o botão "Mostrar valores" (`data-toggle-values`) **[validar]** | O Panorama, revisto pelo dono em 2026-11-04, mostra o capítulo "Onde o gasto está alto" com nomes visíveis e dinheiro mascarado [fato: `report-text.js:26-40`]. A lista de Lançamentos também mostra nomes com valores mascarados [fato: `cash-flow.js:104`]. A avaliação propunha esconder os nomes; o PO segue a convenção do app. A aba Categorias ainda esconde tudo [fato: `budget-categories.js:29`], inconsistência registrada no backlog |
| Ações com valores ocultos | Os botões por linha ("Lançar realizado", "Adicionar planejado", "Informar data") não aparecem; os links de navegação continuam | Outras ações de valor do app retornam cedo com valores ocultos [fato: `main.js:799, 823`]. [suposição] |
| Limite da lista de excessos | Limite 0: entra todo excesso maior que zero centavo | A lista precisa fechar com o total. O Panorama usa 10% para outro fim (destacar) [fato] |
| "Onde passou do planejado" | Só despesas. Junta categorias acima do planejado e categorias sem planejado, ordenadas pelo excesso, até 3, e uma linha "e mais N categorias" | Receita abaixo do planejado já aparece na linha Receitas do quadro e, se zerada, em "Ainda sem realizado" [suposição] |
| "Ainda sem realizado" | Categorias de receita e de despesa com planejado > 0 e nenhum realizado no mês, mais os eventuais sem data. Até 5 itens, do maior para o menor valor; depois "e mais N itens". Nível de categoria, não de lançamento | O vínculo planejado-realizado por lançamento é ambíguo quando há vários planejados na mesma categoria e só vale para despesas [fato: `planned-expense-links.js:17-20`]. Limite de 5 [suposição] |
| Barras | Sem barras nesta entrega | A avaliação marcou as barras como opcionais. A frase do mês em andamento ("lançou X dos Y planejados") já dá a proporção. Menos elementos, menos risco [suposição] |
| "Lançar realizado" | Novo atalho por linha que abre o formulário existente já preenchido: categoria, descrição = nome da categoria, Realizado, Eventual, moeda da visão, data = hoje no mês em andamento ou dia 1 do mês conferido. Valor **não** é preenchido; o foco vai para o valor. Aceita categoria de receita | Copia o atalho `data-plan-budget-category` (`main.js:888-910`), que hoje só aceita despesa [fato: `main.js:893`]. Preencher o valor com o planejado convidaria a confirmar um número que a pessoa não conferiu [suposição] |
| Cabeçalho e itens abaixo das abas ("fase 2" da avaliação) | **Fora desta entrega.** Entra como próxima entrega no backlog | Ver "Escopo". Mexe nas 4 abas e reverte critérios da H6 do Panorama entregue hoje |
| Código antigo | `renderBudgetMonthSummary` e `renderMonthTracking` saem da aba e ficam no código por um ciclo, sem uso na interface. Apagar após a validação de dezembro | Mesmo padrão do Acumulado do ano. `renderMonthTracking` só é usado por testes [fato: busca no repositório] |

## Escopo

### Nesta entrega

Só o conteúdo do painel da aba "Conferir o mês" (`renderTabbedPanels('orcamento', …)`, chave `resumo`, `cash-flow.js:774`):

1. Modelo puro `buildMonthCheck(state, month, today)` em `src/domain/`, sem DOM.
2. Renderização nova no lugar de `renderBudgetMonthSummary()` + `renderMonthTracking(…)` + frase "Para entender o ano…" + lista de eventuais sem data.
3. Atalho "Lançar realizado" com categoria preenchida, para despesa e receita.
4. Links "›" e "Ver todas as categorias" que abrem Categorias no mês conferido, ordenada por maior diferença.
5. Testes unitários e um script de verificação em navegador com dados sintéticos.

### Depois (backlog, não nesta entrega)

| Item | Por que fica para depois |
|---|---|
| Fase 2: menu "Mais" no cabeçalho, detalhe da previdência na aba Lançamentos, Transferências e Importar só quando acionados, sombra de rolagem na barra de abas | Afeta as 4 abas. Exige um componente novo de menu, acessível por teclado. A H6 do [Panorama](panorama-financeiro.md#h6-orçamento-para-lançar-e-conferir), entregue hoje, exige "3 `<details>` e 4 botões presentes e funcionam como hoje"; mudar isso antes de o dono validar o Panorama embaralha duas avaliações. Se a meta de primeira tela a 390 px falhar nesta entrega, é a evidência para priorizar a fase 2 |
| Seletor de mês mostrando "October 2026" (A13) | Componente compartilhado; bug de idioma separado [verificar no navegador] |
| "Sobra" e "Falta" no app inteiro | Depende da validação do dono |
| Aba Categorias com valores ocultos mostrando nomes, como o Panorama | Consistência; fora do foco |
| Pendência por lançamento (qual conta planejada não apareceu), e não só por categoria | Vínculo ambíguo hoje; exige regra nova |

## Regras de cálculo (sem matemática nova)

Todas sobre `period = buildMonthlyBudget(state, month)`, calculado **uma vez** por renderização (hoje são duas: `cash-flow.js:544` e `month-tracking.js:10`).

| Dado na tela | Regra |
|---|---|
| Categorias de despesa e de receita | `budgetExpenseCategories(period, 'expense')` e `(period, 'income')`. Cada categoria com `planned` e `actual` arredondados a centavos |
| Totais do quadro | Soma das categorias em centavos. Sobra = Receitas − Despesas, na mesma coluna |
| Diferença por linha | Realizado − Planejado, em centavos. Abaixo de meio centavo em módulo: "CHF 0,00", sem sinal |
| Acima do planejado | `budgetExpenseOverruns(despesas, 0)`: `exceeded` + `unplanned`, ordenados por `excess` |
| Abaixo do planejado | Categorias de despesa com realizado > 0 e realizado < planejado. Soma e contagem |
| Ainda sem realizado (categorias) | Planejado > 0 e `entries.actual.length === 0`, receita ou despesa |
| Eventuais sem data | `period.excluded.undated` (planejados e realizados) |
| Fechamento | acima + sem planejado − abaixo − ainda sem realizado = Diferença de Despesas, exato em centavos |
| Contagem | `period.records.actual.count` |
| Último realizado | Maior `entry.date` entre `period.entries.actual` com `frequency === 'occasional'` e data ≤ hoje |
| Realizados com data futura | Realizados eventuais do mês com data > hoje (mês em andamento) ou qualquer realizado em mês futuro (regra atual de `month-tracking.js:19`) |
| Estado temporal | `month` comparado com `today.toISOString().slice(0, 7)`, como hoje (`month-tracking.js:18`) |

## Como saber se deu certo

Sem telemetria: o app é local. Medida = verificação automática no DOM com dados sintéticos + tarefas cronometradas com o dono. Linhas de base da [avaliação](avaliacao-ux-conferir-mes.md#contagens-da-tela-atual-linha-de-base).

| Métrica | Hoje | Meta desta entrega | Instrumento |
|---|---|---|---|
| Exibições de cada total (receitas, despesas e sobra; planejado e realizado) | 2 cada, sobra 3 | 1 no quadro. A frase principal cita no máximo a sobra realizada e a planejada | Script de navegador |
| Frases explicativas visíveis, sem dado | 14 | ≤ 3 | Script de navegador |
| Detalhes expansíveis com a aba aberta | 6 | 4 (1 na aba + 3 compartilhados; a fase 2 leva a 1) | Script de navegador |
| Categorias que explicam a diferença, na aba | 0 | Lista fecha ao centavo com o quadro | Teste unitário + script |
| Topo da frase principal a 390 × 844 | ~936 px | < 844 px [verificar no navegador]. Se falhar, registrar o valor e priorizar a fase 2 | Script de navegador (captura) |
| Altura da aba a 390 px, fixture de outubro | 3.025 px | ≤ 2.000 px [suposição] | Script de navegador |
| T1 "Está dentro do planejado em outubro?" | Não medido | Certo em ≤ 10 s | Dono, cronometrado |
| T2 "Quais categorias causaram a diferença?" | Impossível na aba | Certo em ≤ 10 s, sem sair da aba | Dono |
| T3 "O que estava planejado e não foi lançado?" | Impossível na aba | Certo em ≤ 15 s | Dono |
| T4 "Lance o realizado que falta numa categoria" | ≥ 4 passos | ≤ 2 cliques até o campo Valor | Dono + script |

Linha de base de tempo: aplicar T1 a T4 na tela atual antes da implementação, de preferência junto da pergunta sobre o Acumulado do ano em 2026-11-18 **[validar]**. Depois: no fechamento de novembro (início de dezembro de 2026), com o mesmo roteiro.

Critério de reversão: se no fechamento de novembro o dono ainda abrir Categorias para entender o desvio, ou T2 passar de 10 s, a lista "Onde passou do planejado" é revista antes de apagar o código antigo.

## Histórias de usuário

Persona única: o dono do plano, que fecha o mês depois de importar extratos. Fixture de referência (sintética, da avaliação): outubro de 2026, receitas planejadas e realizadas CHF 9.800,00, despesas planejadas CHF 7.317,10 e realizadas CHF 7.717,10, 12 realizados.

### H1. Resposta do mês e quadro

Como dono do plano, quero ver numa frase e numa tabela se o mês ficou dentro do planejado, para responder sem fazer contas.

- Dado o mês encerrado da fixture, quando abro `/orcamento?aba=resumo`, então o primeiro texto do painel é "Outubro de 2026 · mês encerrado", seguido de "Você gastou CHF 400,00 a mais que o planejado." e "Sobraram CHF 2.082,90 dos CHF 2.482,90 planejados."
- Dado o mesmo mês, quando leio o quadro, então vejo 3 linhas (Receitas, Despesas, Sobra) por 3 colunas (Planejado, Realizado, Diferença), com Despesas `CHF 7.317,10 | CHF 7.717,10 | +CHF 400,00 acima` e Sobra `CHF 2.482,90 | CHF 2.082,90 | −CHF 400,00`. (Os rascunhos da avaliação mostram 2.483,00 e 2.083,10, que não fecham com 9.800,00 − 7.317,10 e 9.800,00 − 7.717,10.)
- Dado qualquer linha do quadro, quando subtraio Planejado de Realizado, então o resultado é a Diferença exibida, ao centavo.
- Dado qualquer valor em dinheiro da aba, quando a aba renderiza, então ele tem duas casas decimais.
- Dada uma diferença de despesas positiva, quando a vejo, então só a célula Diferença e o ícone da frase têm cor de alerta; Planejado e Realizado ficam sem cor; a palavra "acima" acompanha o sinal.
- Dados realizado de despesas menor que o planejado num mês encerrado, quando leio a frase, então vejo "Os gastos lançados estão CHF X abaixo do planejado." e "Se faltou lançar algo, confira a lista ‘Ainda sem realizado’."; a palavra "economia" não aparece.
- Dada diferença total de despesas abaixo de meio centavo, quando leio a frase, então vejo "Os gastos lançados batem com o planejado."
- Dado planejado com receitas menores que despesas, quando leio, então a linha 2 é "O planejado já gasta CHF X a mais do que entra." e a Sobra planejada aparece como "Falta CHF X".
- Dado realizado com receitas menores que despesas, quando leio, então a linha 2 é "Neste mês saiu CHF X a mais do que entrou." e a Sobra realizada aparece como "Falta CHF X".
- Dada receita planejada > 0 e nenhuma receita realizada, quando leio, então a linha 2 é "Nenhuma receita lançada ainda (planejado: CHF X).", a Sobra realizada mostra "Sem receita lançada" e a Diferença da Sobra mostra "—".
- Dada a renderização da aba, quando ela ocorre, então `buildMonthlyBudget` é chamado uma única vez.

### H2. Onde passou do planejado

Como dono do plano, quero ver as categorias que explicam a diferença, para saber onde olhar sem abrir outra aba.

- Dada a fixture, com Lazer +310,00, Mercado +150,00, Presentes +90,00 sem planejado, duas categorias abaixo somando −30,00 e Seguro residencial (120,00) sem realizado, quando leio o bloco, então vejo as 3 categorias em ordem de excesso, a linha "Abaixo do planejado em 2 categorias: −CHF 30,00", a linha "Ainda sem realizado em 1 categoria: −CHF 120,00" e "= +CHF 400,00 no total" (310 + 150 + 90 − 30 − 120 = 400). A fixture do script é montada com estes valores; a da avaliação (−150 abaixo, sem o Seguro) não fechava com o Seguro pendente.
- Dadas quaisquer categorias, quando somo em centavos as linhas visíveis do bloco, então o resultado é igual à Diferença de Despesas do quadro.
- Dadas mais de 3 categorias acima do planejado ou sem planejado, quando leio, então vejo 3 e a linha "e mais N categorias: +CHF X", e a soma continua fechando.
- Dada uma categoria sem planejado, quando a vejo na lista, então ela mostra "sem planejado" e o botão "Adicionar planejado", que abre o formulário de planejado com a categoria e o mês preenchidos (atalho existente).
- Dada uma categoria com planejado > 0, quando a vejo, então mostra o percentual inteiro acima do planejado; sem planejado, não mostra percentual.
- Dados totais iguais com desvios internos (uma +500,00, outra −500,00), quando leio, então a frase é "Os gastos lançados batem com o planejado no total." e o bloco aparece com a categoria acima e a linha de compensação.
- Dado nenhum excesso e nenhuma categoria sem planejado, quando leio, então o bloco diz "Nenhuma categoria acima do planejado."
- Dado o "›" de uma categoria ou o link "Ver todas as categorias", quando clico, então a aba Categorias abre no ano e mês conferidos, ordenada por maior diferença (`budgetCategoriesView.year`, `.month`, `sort = 'difference'`), e a URL fica `?aba=categorias`.

### H3. Ainda sem realizado

Como dono do plano, quero ver o que estava planejado e não foi lançado, e lançar dali, para fechar o mês sem procurar.

- Dada a fixture, com Seguro residencial (despesa, 120,00) e Aluguel recebido (receita, 800,00) planejados e sem realizado, quando leio o bloco, então vejo os dois, do maior para o menor valor, com "receita" marcado na linha da receita e um botão "Lançar realizado" em cada.
- Dado "Lançar realizado" num mês encerrado, quando clico, então o formulário abre com a categoria, descrição = nome da categoria, Realizado, Eventual, moeda da visão e data = dia 1 do mês conferido; o campo Valor está vazio e com o foco. Contando o clique no botão, são ≤ 2 cliques até o campo Valor.
- Dado "Lançar realizado" no mês em andamento, quando clico, então a data preenchida é hoje.
- Dada uma categoria de receita, quando clico "Lançar realizado", então o formulário abre como receita, com a categoria preenchida.
- Dado um eventual sem data, planejado ou realizado, quando leio o bloco, então vejo "Viagem: sem data, fora das contas." e o botão "Informar data", que abre a edição do lançamento (atalho `data-edit-cash-item` existente). Os eventuais sem data aparecem em todos os estados da aba.
- Dados mais de 5 itens, quando leio, então vejo 5 e a linha "e mais N itens: CHF X", seguida de "Ver o planejado do mês" (Lançamentos filtrado em Planejados, atalho existente).
- Dado o mês em andamento, quando leio, então o título do bloco é "Ainda vai entrar ou sair".
- Dado que todo planejado tem realizado e não há eventual sem data, quando leio, então o bloco diz "Tudo o que estava planejado tem realizado."
- Dado o limite de 10.000 lançamentos atingido, quando clico "Lançar realizado", então aparece o aviso existente e o formulário não abre.

### H4. Base dos números e regras

Como dono do plano, quero saber em que lançamentos a conferência se baseia, para confiar no número sem ler avisos genéricos.

- Dada a fixture com eventuais realizados até 28/10, quando leio o rodapé, então vejo "Conta 12 realizados, o último em 28/10." e, uma única vez na aba, "Mostra seus lançamentos, não o saldo da conta."
- Dado um extrato importado no mês, quando leio o rodapé, então a data do último realizado é a maior data das linhas importadas daquele mês.
- Dados só realizados recorrentes ou anuais no mês, quando leio, então vejo "Conta N realizados." sem data.
- Dado o mês em andamento com realizados eventuais de data posterior a hoje, quando leio, então a data do último realizado ignora esses lançamentos e aparece "Há N realizados com data futura. Confira as datas."
- Dado planejado com valores anuais, quando leio o rodapé, então vejo "Inclui valores anuais divididos por 12."
- Dado o rodapé, quando o vejo, então tem os botões "Importar extrato" (abre o detalhe existente de importação) e "Lançar realizado" (formulário de realizado sem categoria), e um único detalhe "Como esta conferência é calculada".
- Dado o detalhe aberto, quando o leio, então cada regra aparece uma vez: anuais em 1/12 por mês; eventuais no mês da data e, sem data, fora; previdência com desconto em folha fora (configuração em "Como a previdência entra no orçamento"); transferências entre contas próprias não são receita nem despesa; outras moedas pelo câmbio da visão; o realizado não muda o planejado nem a projeção.
- Dada a aba, quando a leio, então não aparecem "Os registros podem estar incompletos", "registro(s)" nem "Para entender o ano".

### H5. Estados de tempo e de conteúdo

Como dono do plano, quero que a aba diga a coisa certa em qualquer mês, para não confundir ausência de lançamento com resultado.

- Dado o mês em andamento com planejado e realizado, quando abro a aba, então o cabeçalho diz "· em andamento" e a frase é "Até agora, você lançou CHF X dos CHF Y planejados em despesas."; com categorias acima do planejado, a linha 2 é "N categorias já passaram do planejado."
- Dado um mês futuro, quando abro a aba, então o cabeçalho diz "· ainda não começou", a frase é "Novembro ainda não começou. Planejado: entra CHF X, sai CHF Y, sobra CHF Z.", o quadro mostra só a coluna Planejado, o bloco "Maiores despesas planejadas" lista até 3 categorias e não há botões "Lançar realizado".
- Dado um mês com realizado e sem planejado, quando abro a aba, então a frase é "Outubro ainda não tem planejado.", o quadro mostra só a coluna Realizado, o bloco vira "Maiores gastos lançados" (até 3, cada um com "Adicionar planejado") e a ação principal é "Planejar o mês".
- Dado um mês passado ou atual com planejado e sem realizado, quando abro a aba, então a frase é "Nada lançado como realizado em outubro." e "Importe o extrato ou lance o que já aconteceu.", o quadro mostra só a coluna Planejado, "Onde passou do planejado" não aparece e "Ainda sem realizado" lista o planejado do mês; nenhuma frase sugere economia.
- Dado um mês sem planejado e sem realizado, quando abro a aba, então vejo "Outubro está vazio." e "Planeje o mês ou importe um extrato.", com os botões "Planejar o mês" e "Importar extrato"; o quadro e os blocos não aparecem, exceto eventuais sem data, se houver.
- Dado qualquer estado, quando abro a aba, então a ordem dos blocos é a mesma no desktop e no celular.

### H6. Valores ocultos

Como dono do plano, quero abrir a conferência com os valores ocultos sem expor quantias, para usar a tela perto de outras pessoas.

- Dados os valores ocultos, quando abro a aba, então a frase principal é "Valores ocultos." com o botão "Mostrar valores"; nenhum valor, sinal, percentual ou palavra "acima" ou "abaixo" aparece.
- Dados os valores ocultos, quando leio o quadro, então os 9 valores aparecem como `CHF •••••`, sem cor.
- Dados os valores ocultos, quando leio os blocos, então vejo os títulos e os nomes das categorias e dos lançamentos, com valores mascarados e sem botões por linha; os links "Ver todas as categorias" e "Ver o planejado do mês" continuam. **[validar]**
- Dados os valores ocultos, quando leio o rodapé, então vejo a contagem de realizados e a data do último, que não são valores em dinheiro.
- Dados os valores ocultos, quando clico "Mostrar valores", então continuo na aba Conferir o mês, com os valores.

### H7. Celular, teclado e leitor de tela

Como dono do plano, quero ler a conferência no celular e por teclado, para fechar o mês em qualquer aparelho.

- Dado 390 × 844 px com a fixture, quando abro a aba, então o topo da frase principal fica acima de 844 px [verificar no navegador] e a página não tem rolagem horizontal; em 360 e 320 px também não.
- Dado 390 px, quando leio o quadro, então cada linha mostra primeiro a Diferença e, abaixo, "planejado X · realizado Y".
- Dado um nome de categoria longo e um valor ≥ CHF 1.000.000,00 a 320 px, quando leio, então o nome quebra a linha e o valor não quebra nem encolhe.
- Dado o desktop acima de 1.000 px, quando leio, então os dois blocos de exceção ficam lado a lado; abaixo disso, um embaixo do outro.
- Dado o quadro, quando um leitor de tela o percorre, então ele é uma `<table>` com cabeçalhos de linha e de coluna, e a Diferença é lida com sinal e palavra ("mais 400 francos, acima").
- Dados todos os botões e links da aba, quando navego por Tab, então cada um recebe foco visível, tem área de toque ≥ 44 px no celular e nome acessível com a categoria ("Lançar realizado: Seguro residencial").
- Dados os valores da aba, quando renderizam, então usam dígitos de largura fixa (`tabular-nums`) e alinhamento à direita.

## Texto da aba (pt-BR)

| Situação | Texto |
|---|---|
| Cabeçalho do painel | "Outubro de 2026 · mês encerrado", "· em andamento", "· ainda não começou" |
| Acima do planejado | "Você gastou CHF X a mais que o planejado." |
| Abaixo, mês encerrado | "Os gastos lançados estão CHF X abaixo do planejado." / "Se faltou lançar algo, confira a lista ‘Ainda sem realizado’." |
| Igual | "Os gastos lançados batem com o planejado." (com desvios internos: "… no total.") |
| Sobra | "Sobraram CHF X dos CHF Y planejados." |
| Falta | "Faltaram CHF X para fechar o mês." |
| Mês em andamento | "Até agora, você lançou CHF X dos CHF Y planejados em despesas." / "N categorias já passaram do planejado." |
| Mês futuro | "Novembro ainda não começou. Planejado: entra CHF X, sai CHF Y, sobra CHF Z." |
| Sem planejado | "Outubro ainda não tem planejado." Ação: "Planejar o mês" |
| Sem realizado | "Nada lançado como realizado em outubro." / "Importe o extrato ou lance o que já aconteceu." |
| Vazio | "Outubro está vazio." / "Planeje o mês ou importe um extrato." |
| Déficit planejado | "O planejado já gasta CHF X a mais do que entra." |
| Déficit realizado | "Neste mês saiu CHF X a mais do que entrou." |
| Receita não lançada | "Nenhuma receita lançada ainda (planejado: CHF X)." / célula: "Sem receita lançada" |
| Títulos dos blocos | "Onde passou do planejado", "Ainda sem realizado" ("Ainda vai entrar ou sair" no mês em andamento), "Maiores despesas planejadas", "Maiores gastos lançados" |
| Compensações | "Abaixo do planejado em N categorias: −CHF X", "Ainda sem realizado em N categorias: −CHF X", "= +CHF X no total", "e mais N categorias: +CHF X" |
| Listas vazias | "Nenhuma categoria acima do planejado.", "Tudo o que estava planejado tem realizado." |
| Eventual sem data | "Viagem: sem data, fora das contas." Ação: "Informar data" |
| Rodapé | "Conta N realizados, o último em DD/MM." / "Mostra seus lançamentos, não o saldo da conta." / "Inclui valores anuais divididos por 12." |
| Data futura | "Há N realizados com data futura. Confira as datas." |
| Links e ações | "Ver todas as categorias", "Ver o planejado do mês", "Lançar realizado", "Adicionar planejado", "Importar extrato", "Como esta conferência é calculada" |
| Valores ocultos | "Valores ocultos." + "Mostrar valores" |

Conteúdo informativo: a aba descreve lançamentos. Não sugere cortes, não afirma economia e não recomenda investimento.

## O que sai da aba

| Elemento atual | Destino |
|---|---|
| Cartão "Orçamento previsto de…" com a equação "−" e "=" (`cash-flow.js:555-557`) | Sai. Valores vão para a coluna Planejado |
| "Registrado no mês" e os 3 cartões de realizado (`cash-flow.js:551, 558`) | Sai. Valores vão para a coluna Realizado |
| Pares de barras "Previsto para o mês" e "Registrado como realizado" (`month-tracking.js:25`) | Sai, sem substituto nesta entrega |
| Detalhe "Conferir o saldo dos registros" (`month-tracking.js:32`) | Sai. Vira a linha Sobra |
| Detalhes "O que este saldo representa" e "Como usar esta comparação" | Fundem-se em "Como esta conferência é calculada" |
| Frase "Compare o que você previu…" (`month-tracking.js:8`) | Sai |
| "Os registros podem estar incompletos" (2 cópias) e "N registro(s)" | Viram o rodapé com contagem e data, e a lista "Ainda sem realizado" |
| "Saldo previsto positivo", "Saldo dos registros positivo", "Déficit previsto" e similares | Saem |
| Botões "Conferir realizados" e "Revisar o planejado" | Viram "Ver todas as categorias", "Ver o planejado do mês" e "Lançar realizado" por linha |
| "Para entender o ano, veja onde o gasto está alto no Panorama" (`cash-flow.js:768`) | Sai. O cabeçalho já tem "Ver análise no Panorama" |
| Painel de eventuais sem data (`cash-flow.js:774`) | Entra em "Ainda sem realizado" |

Ficam como estão (compartilhados, fase 2): os 4 botões e 2 links do cabeçalho, a navegação de mês, a barra de abas e os 3 detalhes abaixo das abas.

## Ordem de entrega e corte

Ordem por dependência: modelo (H1, H2, H3, H4 no domínio) → renderização H1 → H2 → H3 → H4 → H5 → H6 → H7 → script de navegador.

RICE (alcance = aberturas da aba por mês pelo dono [suposição]; esforço em horas, estimativa do PO pendente de confirmação do desenvolvimento):

| Item | Alcance | Impacto (1–3) | Confiança | Esforço (h) | RICE | Decisão |
|---|---|---|---|---|---|---|
| H1–H5, H6, H7 (aba nova) | 8 | 3 | 80% | 10 | 1,9 | Esta entrega |
| Atalho "Lançar realizado" (parte da H3) | 8 | 2 | 50% | 1,5 | 5,3 | Esta entrega; 1º a cortar, mantendo "Ver o planejado do mês" |
| Bloco "Maiores despesas planejadas" do mês futuro (parte da H5) | 2 | 1 | 50% | 0,5 | 2,0 | 2º a cortar; o quadro Planejado fica |
| Fase 2 (cabeçalho, detalhes, barra de abas) | 30 | 1 | 50% | 6 | 2,5 | Próxima entrega |

A fase 2 empata com a aba nova no RICE (pontuações adjacentes são empate). O desempate é foco e risco: a aba nova é a única que responde às perguntas 2 e 3, que o dono não consegue responder hoje; a fase 2 mexe nas 4 abas e em critérios recém-entregues.

## Fora de escopo

- Qualquer mudança em `buildMonthlyBudget`, `budgetExpenseCategories`, `budgetExpenseOverruns`, nas regras de inclusão ou no câmbio.
- Cabeçalho, navegação de mês, barra de abas e os 3 detalhes compartilhados (fase 2).
- Abas Categorias, Lançamentos e Ano do orçamento, exceto receber o mês e a ordenação ao abrir Categorias.
- Renomear "saldo" fora desta aba.
- Pendência por lançamento individual, barras, gráficos, edição em linha de valores.
- Panorama, Visão geral e Fluxo de caixa.
- Apagar `renderBudgetMonthSummary` e `renderMonthTracking` (só após a validação de dezembro).

## Riscos

| Risco | Sinal | Mitigação |
|---|---|---|
| A lista não fecha com o quadro por 1 centavo | Teste de fechamento falha com câmbio | Totais da aba derivados da soma das categorias em centavos; teste com itens em BRL convertidos para CHF |
| Lançamento que falta lido como economia | "Abaixo do planejado" inclui categorias sem realizado | Termo separado "Ainda sem realizado em N categorias"; a palavra "economia" não aparece (teste) |
| Data do último realizado errada | Recorrente com data de início antiga vira "o último" | Só eventuais entram (teste com recorrente iniciado em 2024) |
| Nomes visíveis com valores ocultos revelam o desvio | Dono discorda | Segue o Panorama; [validar]; reverter é esconder os blocos no modo oculto |
| Vocabulário diferente entre abas ("Sobra" aqui, "Saldo" no Ano do orçamento e no Panorama) | Dono estranha | [validar]; renomear no app inteiro fica no backlog |
| Meta de primeira tela a 390 px falha por causa do cabeçalho | Topo da frase > 844 px | Registrar a medida; vira a evidência para a fase 2, sem mexer no cabeçalho agora |
| Data do dia 1 em "Lançar realizado" no mês passado fica errada | Lançamentos com dia 1 acumulam | Data visível e editável no formulário; [suposição] revisar no fechamento de novembro |
| Virada do mês em UTC | Perto da meia-noite do último dia, no Brasil, o mês muda 3 h antes | Mesmo comportamento de hoje (`month-tracking.js:18`); fora do escopo |
| Testes e verificações antigas procuram textos que saem | `test:budget-browser` procura `.month-tracking` com "setembro de 2026" [fato: `check-budget-overview-browser.mjs:153`] | Atualizar a verificação para o painel novo; testes de `renderMonthTracking` continuam enquanto o código existir |

## Validação

- **Testes unitários em `tests/`** (`npm run validate`):
  - `tests/month-check.test.js`, sobre `buildMonthCheck`: um caso por linha da tabela de estados (H1 a H5); fechamento "acima + sem planejado − abaixo − sem realizado = Diferença de Despesas" em centavos, inclusive com câmbio; convenção de sinal realizado menos planejado nas 3 linhas; data do último realizado só com eventuais e ignorando datas futuras; import sintético via `inspectStatementText` gerando a data do último realizado; `buildMonthlyBudget` chamado uma vez.
  - `tests/month-check-view.test.js`, sobre a renderização: centavos em todos os valores; ausência das frases removidas; um único detalhe na aba; valores ocultos sem nenhum valor, sinal, percentual, cor ou "acima/abaixo", com nomes presentes; nenhum "economia"; nome acessível dos botões com a categoria.
  - Atalho "Lançar realizado": formulário com Realizado, Eventual, categoria de despesa e de receita, data por estado temporal, valor vazio.
- **Navegador, com dados sintéticos**: novo `scripts/check-month-check-browser.mjs`, no padrão de `scripts/check-report-print-browser.mjs`. Contexto de navegador novo e vazio, estado montado no script (outubro de 2026 da avaliação e uma variação por estado). Nunca usa o banco real do finapp nem o perfil do dono. Verifica:
  - contagens de DOM da tabela "Como saber se deu certo";
  - topo da frase e altura da aba a 390 × 844;
  - sem rolagem horizontal a 1.440, 390, 360 e 320 px;
  - T4 em ≤ 2 cliques até o campo Valor;
  - "›" abrindo Categorias no mês e na ordenação certos;
  - valores ocultos e "Mostrar valores" mantendo a aba.
- Atualizar `scripts/check-budget-overview-browser.mjs` (`npm run test:budget-browser`) para o painel novo.
- Teste de tarefas T1 a T4 com o dono: linha de base antes da implementação e repetição no fechamento de novembro de 2026.

## Pendências com o dono

- [validar] "Sobra" e "Falta" só nesta aba; o resto do app continua com "Saldo".
- [validar] Centavos em todos os valores da aba.
- [validar] Com valores ocultos, nomes de categorias e lançamentos visíveis e valores mascarados, como no Panorama.
- [validar] Aplicar T1 a T4 na tela atual em 2026-11-18, junto da pergunta sobre o Acumulado do ano.
- Resolvido por fato: extratos importados geram realizados eventuais com data (`statement-import.js:177-182`).
