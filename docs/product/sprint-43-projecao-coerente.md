# Sprint 43: projeção coerente e legível

Planejamento do product-manager, 21 de outubro de 2026. A Sprint 42 está entregue (`tests/sprint-42-moeda.test.js` existe e o backlog registra a entrega). Depois dela entraram o vínculo BVK e contribuição, a opção capital ou benefício mensal e a unificação de Orçamento e Projeção patrimonial. Linha de base medida hoje: 961 testes aprovados com `npm test`.

## Objetivo

Os números de longo prazo seguem as mesmas premissas de moeda em todas as telas e aparecem sem falsa precisão.

## Por que este recorte

Fatos verificados no código:

- `finappViability` monta `investmentModel.plan` só com investimentos, patrimônio, retorno padrão e inflação (`src/domain/finapp-viability.js`, linha 151). A tendência cambial fica de fora. Reprodução executada: fundo com 4% real e exposição em USD, tendência USD de 5% ao ano. A Carteira usa 9,2% real. A viabilidade e o risco anual continuam com 4% e chegam ao mesmo patrimônio final com e sem tendência. A Sprint 37 prometia efeito em "projeção, viabilidade e risco".
- `resolveGrossInvestmentRealReturn` deflaciona todo retorno nominal pela inflação do plano (`src/domain/investment-returns.js`). Reprodução executada: retorno nominal de 2% em CHF, plano em BRL com 4,5% de inflação, resulta em −2,4% real.
- Painel de indicadores, gráficos anuais, composição do patrimônio projetado, viabilidade e riscos formatam com centavos (`privateCurrency(..., true, ...)`). Exemplo citado na Sprint 41: R$ 11.576.523,33.
- O cartão "Cobertura até a data-alvo" desenha uma faixa por ano (`horizonStrip` em `src/features/dashboard/cockpit.js`). Com 30 ou mais anos no mesmo estado, a faixa não informa nada além do texto.

Itens da lista "Próximo sprint (43)" da Sprint 42 já resolvidos ou parcialmente resolvidos:

- Fim dos aportes da BVK: resolvido pelo vínculo de destino ([diagnóstico](diagnostico-vinculo-bvk-contribuicao.md)).
- Segundo pilar capital ou renda: parcialmente resolvido ([capital ou benefício mensal](previdencia-capital-ou-beneficio.md)). Falta a taxa de conversão.
- Liquidez por ano de liberação: o Patrimônio já mostra "Quando vira dinheiro" (Sprint 39). Precisa de validação com o usuário se o pedido era outro.

## Priorização RICE

Escala usada. Alcance de 1 a 10, proporção das sessões em que o efeito aparece. Impacto 0,25 a 3. Confiança em percentual. Esforço em sessões de agente.

| ID | História | Agente | R | I | C | E | RICE |
|----|----------|--------|---|---|---|---|------|
| H1 | Viabilidade e risco anual aplicam a tendência cambial | software-developer | 3 | 2 | 100% | 0,5 | 12,0 |
| H4 | Cobertura até a data-alvo em barra única | frontend-developer | 9 | 0,5 | 80% | 0,5 | 7,2 |
| H5 | Distribuição com uma única classe em texto | frontend-developer | 4 | 0,5 | 100% | 0,25 | 8,0 |
| H3 | Projeções sem centavos | frontend-developer | 9 | 1 | 80% | 1,5 | 4,8 |
| H2 | Inflação por moeda para retorno nominal | software-developer | 3 | 2 | 80% | 1,5 | 3,2 |

Ordem de execução por agente: software-developer faz H1 e depois H2. frontend-developer faz H3, H4 e H5. H3 vem primeiro no frontend apesar do RICE menor, porque altera os mesmos arquivos de H4 e define o formato usado no cartão.

## Histórias

### H1. Viabilidade e risco anual aplicam a tendência cambial

Agente: software-developer.

Como pessoa com investimentos expostos a moeda estrangeira, quero que a viabilidade e o risco anual usem a tendência cambial que salvei na Carteira, para ver o mesmo retorno em todas as telas.

RICE 12,0. Defeito confirmado por reprodução, correção de uma linha no modelo, efeito direto no resultado principal.

Critérios de aceite:

1. Dado um investimento com exposição a USD e tendência USD de 5% ao ano salva, quando a viabilidade é calculada, então o retorno do investimento em cada ano é igual ao de `resolveInvestmentRealReturn(investimento, state.plan, ano)`.
2. Dado o mesmo plano, quando a tendência é removida, então o patrimônio final da viabilidade volta ao valor sem tendência.
3. Dado um investimento com retorno informado por ano, quando há tendência salva, então o ano informado não recebe a tendência (regra da Sprint 37 mantida).
4. Dado o risco anual (`src/domain/finapp-risk.js`), quando ele reutiliza o `investmentModel` da viabilidade, então também aplica a tendência sem mudança própria.
5. Dado um plano sem tendência, quando a viabilidade é calculada, então nenhum valor muda em relação à linha de base.

Arquivos esperados: `src/domain/finapp-viability.js` (repassar `currencyTrends` e, após H2, `inflationByCurrency` em `investmentModel.plan`).

Testes: novo `tests/sprint-43-premissas-moeda.test.js` com os casos 1 a 5. A suíte existente deve passar sem ajuste.

### H2. Inflação por moeda para retorno nominal

Agente: software-developer.

Como pessoa com previdência ou investimento em CHF, quero informar a inflação de cada moeda estrangeira, para que um retorno nominal em CHF não seja descontado pela inflação brasileira.

RICE 3,2. Corrige um retorno real distorcido em vários pontos percentuais. Confiança 80% porque os investimentos importados do FinApp usam retorno real e não sabemos quantos cadastros usam retorno nominal em moeda estrangeira.

Critérios de aceite:

1. Dado o painel "Câmbio na projeção" da Carteira, quando ele é exibido, então aparece um campo "Inflação anual esperada" para cada moeda diferente da moeda do plano, vazio por padrão, com faixa de −20% a 20%.
2. Dado um investimento com moeda do saldo CHF, retorno nominal de 2% e inflação CHF de 1% salva, quando a projeção é calculada, então o retorno real usado é (1,02 / 1,01) − 1, antes de custo e tendência.
3. Dado o mesmo investimento sem inflação CHF informada, quando a projeção é calculada, então vale a inflação do plano, como hoje, e o diagnóstico da Carteira mostra um aviso informativo com link para o campo.
4. Dado um investimento sem moeda própria, ou com moeda igual à do plano, quando a projeção é calculada, então nada muda.
5. Dado retorno do tipo real, padrão, IPCA ou CDI, quando a projeção é calculada, então nada muda.
6. Dado que a pessoa troca a moeda do plano para CHF, quando a projeção é calculada, então a inflação do plano vale para CHF e o valor salvo para CHF fica guardado, sem uso.
7. Dado o cartão do investimento, quando o retorno é nominal em moeda estrangeira, então o texto informa qual inflação foi usada, por exemplo "2% nominal em CHF, com inflação CHF de 1%, resulta em 1% real".
8. Dado exportação, importação, sincronização e cenário salvo, quando o plano é recarregado, então as inflações por moeda são preservadas e valores fora da faixa são descartados.
9. Dado o modo de privacidade, quando a Carteira é exibida, então nenhum valor monetário novo aparece. Percentuais seguem a regra atual da tela.

Arquivos esperados:

- `src/domain/investment-returns.js`: `sanitizeInflationByCurrency` e uso em `resolveGrossInvestmentRealReturn` para o tipo nominal.
- `src/app/state-storage.js`: uma linha em `sanitizePlan`. **Arquivo com alterações do usuário não commitadas.** A mudança fica em `sanitizePlan`, longe do trecho alterado em `sanitizeCashFlowItem`.
- `src/app/state.js`: setter ao lado de `setCurrencyTrends`.
- `src/main.js`: ler os campos `inflation:<moeda>` no handler existente de `[data-currency-trends-form]`. **Arquivo com alterações do usuário não commitadas.** O trecho do usuário está no handler de `change` (linha 1525). O handler de `submit` fica perto da linha 2110.
- `src/features/investments/investments.js`: campos no `currencyTrendsPanel` e texto de `sourceDetail`. Só marcação, reaproveitando `.currency-trends__fields`. Sem CSS. Fica com o software-developer neste sprint para manter os arquivos dos agentes separados.
- `src/domain/portfolio-diagnostics.js`: aviso informativo do critério 3.
- `src/domain/finapp-viability.js`: repasse já previsto em H1.

Testes: em `tests/sprint-43-premissas-moeda.test.js`, casos de domínio (2 a 6), sanitização e ida e volta por exportação (8), texto do cartão (7) e aviso do diagnóstico (3). Conferir `tests/currency-trends.test.js` sem alterá-lo.

### H3. Projeções sem centavos

Agente: frontend-developer.

Como pessoa que acompanha a aposentadoria, quero ver projeções em valores inteiros, para ler décadas de patrimônio sem centavos que sugerem uma precisão inexistente.

RICE 4,8. Alcance alto, porque o painel de indicadores abre a Visão geral. Esforço médio pela quantidade de testes que verificam ",00".

Critérios de aceite:

1. Dado o painel de indicadores da Visão geral, quando os valores aparecem, então os quatro cartões mostram moeda sem casas decimais, por exemplo R$ 11.576.523.
2. Dado gráfico anual, leitura por ano, tabela "Consultar valores de todos os anos", composição do patrimônio projetado, conciliação da projeção, viabilidade, risco anual e risco mensal, quando há valores monetários, então aparecem sem casas decimais.
3. Dado um valor projetado entre −0,5 e 0,5, quando é exibido, então aparece "R$ 0", sem sinal negativo.
4. Dado lançamentos, extratos, contas, Calendário, transferências, Orçamento do mês e saldos atuais da Carteira, quando são exibidos, então continuam com duas casas decimais.
5. Dado a conciliação da projeção, quando os valores são exibidos inteiros, então um texto curto informa que os valores estão arredondados e que a soma pode diferir em uma unidade.
6. Dado o modo de privacidade, quando a tela é exibida, então nada muda em relação ao comportamento atual.
7. Dado qualquer cálculo, quando a exibição muda, então nenhum valor calculado, salvo ou exportado é arredondado.

Arquivos esperados:

- `src/shared/formatters.js`: função única para valor projetado, sem casas decimais e com `signDisplay: 'negative'`.
- Troca do `money` local em `src/features/dashboard/cockpit.js`, `src/shared/planning-chart.js`, `src/shared/remaining-wealth.js`, `src/shared/financial-reconciliation.js`, `src/shared/release-sources.js`, `src/shared/cash-flow-result.js`, `src/shared/income-cost-bars.js`, `src/shared/property-solvency.js`, `src/features/plan/viability.js`, `src/features/plan/annual-risk.js`, `src/features/plan/risk.js`, `src/features/dashboard/planning-overview.js` e `src/features/dashboard/plan-interpretation.js`.
- Fora da troca: `src/shared/cash-flow-detail.js` (total do lançamento na moeda original), `src/features/plan/annual-planning.js` (valor cadastrado), `src/shared/asset-allocation.js` (saldo atual), `src/features/simulations/simulations.js` (premissas de cenário).

Testes: novo `tests/sprint-43-projecao-inteira.test.js` com o formatador (inteiro, zero sem sinal, negativo, privacidade) e um caso por grupo de tela. Ajustar as expectativas ",00" já existentes, sem remover asserções: `tests/dashboard-cockpit.test.js`, `tests/remaining-wealth.test.js`, `tests/planning-chart-ux.test.js`, `tests/annual-chart-clarity.test.js`, `tests/financial-reconciliation.test.js`, `tests/property-solvency.test.js`, `tests/cash-flow-solvency-ui.test.js`, `tests/dashboard-interpretation.test.js`. Confirmar `tests/finapp-risk.test.js` e outros pela suíte completa.

### H4. Cobertura até a data-alvo em barra única

Agente: frontend-developer.

Como pessoa que abre a Visão geral, quero ver o horizonte em uma barra com o primeiro ano de insuficiência marcado, para entender o resultado sem contar dezenas de faixas iguais.

RICE 7,2. Alcance alto, impacto baixo, esforço pequeno. Proposta já avaliada na Sprint 41.

Critérios de aceite:

1. Dado um horizonte sem insuficiência, quando o cartão aparece, então mostra uma barra contínua na cor do estado, com ano inicial e ano final.
2. Dado um horizonte com insuficiência, quando o cartão aparece, então a barra muda de cor a partir do primeiro ano com insuficiência e esse ano aparece como rótulo junto ao marcador.
3. Dado premissas a revisar, quando o cartão aparece, então a barra usa a cor de atenção, como hoje.
4. Dado qualquer estado, quando o cartão aparece, então o texto e o selo continuam a transmitir o resultado sem depender da cor. O SVG segue `aria-hidden`.
5. Dado a largura de 320 px, quando o cartão aparece, então rótulos não se sobrepõem.
6. Dado "Como ler", quando aberto, então o texto descreve a barra, não "cada faixa representa um ano".

Arquivos esperados: `src/features/dashboard/cockpit.js` (`horizonStrip` e nota), `src/styles/responsive.css` só se a altura do SVG precisar mudar.

Testes: em `tests/dashboard-cockpit.test.js`, trocar contagens de faixas por verificação de um segmento sem insuficiência e de dois segmentos com marcador e ano. Inspeção em navegador a 1366 px e 390 px.

### H5. Distribuição com uma única classe em texto

Agente: frontend-developer.

Como pessoa com um único tipo de investimento, quero ler "100% em Renda fixa" em vez de um anel de uma cor, para entender a distribuição de imediato.

RICE 8,0. Esforço mínimo. Item pendente da Sprint 41. Feito por último porque não bloqueia nada.

Critérios de aceite:

1. Dado um único segmento com valor positivo, quando a distribuição é renderizada, então aparece um texto com rótulo, valor e "100%", sem SVG.
2. Dado dois ou mais segmentos, quando a distribuição é renderizada, então a rosca atual continua igual.
3. Dado nenhum segmento ou modo oculto, quando a distribuição é renderizada, então as mensagens atuais continuam.
4. Dado Patrimônio e "Para onde vai o orçamento", quando há um único segmento, então os dois usam o novo texto.

Arquivos esperados: `src/shared/category-donut.js`, `src/styles/responsive.css` para o bloco de texto.

Testes: em `tests/category-donut.test.js`, substituir o teste "a single segment fills the whole circle without a gap" pelo novo comportamento. Manter o teste da cor neutra de "other" com dois segmentos.

## Separação de arquivos

| Agente | Arquivos |
|--------|----------|
| software-developer | `src/domain/finapp-viability.js`, `src/domain/investment-returns.js`, `src/domain/portfolio-diagnostics.js`, `src/app/state.js`, `src/app/state-storage.js`, `src/main.js`, `src/features/investments/investments.js`, `tests/sprint-43-premissas-moeda.test.js` |
| frontend-developer | `src/shared/formatters.js`, os 13 arquivos de H3, `src/shared/category-donut.js`, `src/styles/responsive.css`, `tests/sprint-43-projecao-inteira.test.js` e os testes de tela listados em H3, H4 e H5 |

Nenhum arquivo aparece nas duas listas. `formatters.js` é importado por arquivos do software-developer, mas só o frontend o altera e apenas acrescenta uma função.

Arquivos com alterações do usuário não commitadas: `src/app/state-storage.js` e `src/main.js` entram em H2. Nenhum outro arquivo da lista do usuário é tocado. Os agentes não fazem commit. Ao commitar, separar as mudanças do usuário das mudanças da sprint.

## Decisões

1. **Centavos.** Duas casas decimais ficam onde o valor corresponde a um registro: lançamentos, extratos, contas, pagamentos, transferências, Orçamento do mês e saldos atuais. Projeções de um ano ou mais, gráficos de horizonte, painel de indicadores, viabilidade e riscos usam valores inteiros. A regra anterior de duas casas vale só para o primeiro grupo. A mudança é só de exibição. Cálculo, armazenamento e exportação continuam sem arredondamento novo.
2. **Painel de indicadores inteiro.** O cartão "Receitas e despesas" também fica inteiro, para o painel não misturar precisões. O Orçamento continua com centavos. Uma diferença de até uma unidade entre os dois é aceita.
3. **Zero sem sinal.** Valor projetado que arredonda para zero aparece como "R$ 0".
4. **Inflação por moeda.** Retorno nominal em moeda estrangeira é deflacionado pela inflação dessa moeda: real = (1 + nominal) / (1 + inflação da moeda) − 1. A premissa implícita é a paridade de poder de compra. Desvios dessa paridade continuam na tendência cambial real, que já existe. A moeda usada é a moeda do saldo (`investment.currency`), não a moeda de exposição.
5. **Sem valor padrão de inflação estrangeira.** O app não sugere taxa de inflação para CHF, EUR ou USD. Sem valor informado, mantém a inflação do plano e avisa. Isso evita apresentar premissa econômica como fato.
6. **Inflação por moeda não depende da moeda do plano.** Diferente da tendência cambial, ela não é apagada ao trocar a moeda do plano. A entrada da moeda do plano fica guardada e sem uso.
7. **Divisão de arquivos.** `investments.js` fica com o software-developer neste sprint, só com marcação, para que as duas frentes trabalhem em paralelo.

## Validação

Cada agente roda `npm run check && npm test && npm run build`. Se `check:grants` falhar por falta de `.env`, rodar `npm test && npm run build` e registrar o motivo. Meta: 961 testes da linha de base mais os novos, todos aprovados. Frontend inspeciona em navegador Visão geral, Projeção patrimonial, Viabilidade, Riscos e Patrimônio a 1366 px e 390 px, com valores visíveis e ocultos.

## Precisa de validação com o usuário

- Se a BVK está cadastrada com retorno nominal ou real. Define o efeito prático de H2 no plano do usuário.
- Se "Liquidez por ano de liberação" já está atendida pelo "Quando vira dinheiro" do Patrimônio.
- Se valores inteiros no cartão de orçamento do painel incomodam quem confere o mês.

## Fora do escopo

- Descasamento entre a moeda das despesas e a dos ativos, com choque combinado.
- Taxa de conversão do segundo pilar.
- Tendência cambial em receitas e despesas em moeda estrangeira (pendência da Sprint 37).
- Valores inteiros no Orçamento, na Carteira e em cenários.
- Demonstração com investimentos de exemplo. Mexe em `defaultPlan`, que também serve de base para contas novas.
- Visão geral mais curta e Premium em Conteúdos.
- Modo escuro, Câmbio com gráficos e CHF como padrão, Riscos com resultado na primeira tela, cores dos gráficos em um módulo.

## Resultado da sprint

Revisão do product-manager em 21 de outubro de 2026, feita no diff e nos testes, sem inspeção em navegador. `npm test` executado na revisão: 989 de 989 aprovados (961 da linha de base mais 28). Os relatórios dos agentes informam `npm run validate` e build aprovados. As alterações do usuário não commitadas (`baseline-fin2-2026-10-21.patch`) foram comparadas e ficaram de fora da revisão. Os trechos da sprint em `src/app/state-storage.js` e `src/main.js` estão separados dos trechos do usuário.

### Status por história

| História | Status | Observação |
|----------|--------|------------|
| H1 | Aceita | Todos os critérios atendidos. |
| H2 | Aceita com acompanhamento | Critérios atendidos. Risco de base divergente na importação vira item de backlog (A2). |
| H3 | Aceita com acompanhamento | Painéis de ano das projeções ainda misturam precisões (A1). |
| H4 | Aceita, falta inspeção | Critério de 320 px depende de navegador. |
| H5 | Aceita | Critério 4 atendido pelo componente compartilhado, sem teste de tela próprio. |

### Critérios de aceite

| Critério | Veredito | Evidência |
|----------|----------|-----------|
| H1.1 | Atendido | `finapp-viability.js` repassa `currencyTrends` e `inflationByCurrency` em `investmentModel.plan`. Teste "H1.1 viabilidade usa o mesmo retorno anual da Carteira". |
| H1.2 | Atendido | Teste "H1.2 sem a tendência, o patrimônio final volta ao valor sem tendência". |
| H1.3 | Atendido | Teste "H1.3 retorno informado por ano não recebe a tendência". |
| H1.4 | Atendido | `finapp-risk.js` usa `base.investmentModel` sem mudança. Teste "H1.4 risco anual reaproveita o modelo". |
| H1.5 | Atendido | Teste "H1.5 plano sem tendência mantém os valores da linha de base". |
| H2.1 | Atendido | `investments.js:currencyTrendsPanel`, campos `inflation:<moeda>` só para moedas estrangeiras, faixa −20 a 20, vazios. Teste "H2.1 painel de câmbio". |
| H2.2 | Atendido | `investment-returns.js:resolveGrossInvestmentRealReturn` com `balanceCurrencyInflation`. Teste "H2.2 retorno nominal em CHF usa a inflação de CHF". |
| H2.3 | Atendido | `portfolio-diagnostics.js`, aviso `foreign-inflation` nível info com link para `inflation:CHF`. Testes "H2.3" de domínio e de tela. |
| H2.4 | Atendido | Teste "H2.4 investimento sem moeda própria ou na moeda do plano não muda". |
| H2.5 | Atendido | Teste "H2.5 retornos real, padrão, IPCA e CDI não mudam". |
| H2.6 | Atendido | `state.js:setCurrency` mantém as taxas e troca `base`. Teste "H2.6 trocar a moeda do plano para CHF". |
| H2.7 | Atendido | `investments.js:sourceDetail`. Teste "H2.7 cartão informa a inflação usada". |
| H2.8 | Atendido | `state-storage.js:sanitizePlan` e `sanitizeInflationByCurrency`. Testes "H2.8" de sanitização, exportação, cenário e assinatura de sincronização. |
| H2.9 | Atendido | Teste "H2.9 modo de privacidade não mostra valor monetário novo". |
| H3.1 | Atendido | `cockpit.js` usa `privateProjectedCurrency` nos quatro cartões. Teste "dashboard indicator panel shows the four cards". |
| H3.2 | Parcial | Os 13 arquivos da lista usam o novo formatador. Os painéis de ano abertos pelos gráficos (`cash-flow-detail.js`, com `budget-comparison.js` e `budget-pressure.js`) continuam com centavos na Visão geral, na Projeção patrimonial e na Viabilidade. A exclusão de `cash-flow-detail.js` veio do planejamento. Ver A1. |
| H3.3 | Atendido | `formatters.js:formatProjectedCurrency`, valor abaixo de 0,5 em módulo vira zero, `signDisplay: 'negative'`. Teste "projected currency shows whole units". |
| H3.4 | Atendido | `formatCurrency` e `privateCurrency` sem mudança. Arquivos de registros não alterados. Teste "records keep two decimals". |
| H3.5 | Atendido com desvio aceito | `financial-reconciliation.js`, nota `data-rounding-note` com "até duas unidades". |
| H3.6 | Atendido | `privateProjectedCurrency` oculto gera a mesma máscara. Teste "privacy keeps the same masked output". |
| H3.7 | Atendido | Nenhuma mudança de domínio para H3. Teste "projection reconciliation ... leaves the rows untouched". |
| H4.1 | Atendido | `cockpit.js:horizonStrip`, um segmento de 216 unidades. Teste "coverage horizon is one continuous bar". |
| H4.2 | Atendido | Segmento de insuficiência a partir do primeiro ano e marcador com o ano. Teste "coverage horizon changes colour at the first failed year". |
| H4.3 | Atendido | Cor de atenção com premissas a revisar. Teste "keeps the caution colour". |
| H4.4 | Atendido | SVG com `aria-hidden`, ano e selo em texto fora do SVG. Teste "changes colour at the first failed year". |
| H4.5 | Parcial | Marcador e anos ficam em linhas diferentes do SVG e os extremos são ancorados. Falta confirmar em navegador a 320 px. |
| H4.6 | Atendido | Texto "A barra vai de ... e muda de cor a partir de ...". Testes de H4. |
| H5.1 | Atendido | `category-donut.js`, bloco `data-category-single` sem SVG. Teste "a single positive segment is shown as text". |
| H5.2 | Atendido | Teste "the other bucket always uses the muted color" com dois segmentos. |
| H5.3 | Atendido | Retornos de oculto e vazio antes do novo bloco. Teste "non-finite, negative or all-zero segments never draw a circle". |
| H5.4 | Atendido | Patrimônio (`wealth.js`) e "Para onde vai o orçamento" (`budget-pressure.js`) chamam o mesmo `categoryDonut`. Sem teste de tela próprio. |

Asserções ",00": nos 11 arquivos de teste alterados pela sprint, cada asserção removida tem uma substituta com o valor inteiro e `(?![,\d])`. Três `doesNotMatch` de privacidade ficaram mais amplos (`5.000`, `200`). Em `tests/category-donut.test.js`, o teste do anel de uma cor foi substituído e o teste de "other" passou a usar dois segmentos, como previsto em H5. Nenhuma asserção foi apagada sem substituta. `tests/bb-statement.test.js` e `tests/credit-card-payments.test.js` têm só alterações do usuário.

### Desvios

| Desvio | Decisão |
|--------|---------|
| Nota da conciliação diz "até duas unidades", não "uma unidade". | Aceito. A linha soma quatro parcelas arredondadas. O erro pode passar de uma unidade. O texto novo é o correto. |
| `src/app/review-navigation.js` alterado fora da lista do software-developer. | Aceito. Necessário para o link do aviso focar o campo `inflation:<moeda>`. Mudança de uma linha. |
| Botão "Salvar tendência" renomeado para "Salvar premissas de câmbio". | Aceito. O formulário salva tendência e inflação. |
| Barra de cobertura fica na cor de insuficiência do primeiro ano com falha até o fim, mesmo se um ano posterior se recuperar. | Aceito. Segue o critério H4.2. A contagem "X de Y fechamentos sem insuficiência" continua no "Como ler". |
| Cor do marcador da barra fixa em `#0f172a`. | Aceito por ora. Entra no item de modo escuro já previsto, sem item novo. |
| Tabela do risco mensal passa a valores inteiros. | Aceito. Está no critério H3.2. |

### Decisões tomadas na revisão

1. **Precisão nos painéis de ano (a).** Corrigir como história pequena, primeira da próxima sprint (A1). Um painel de ano com valores inteiros e com centavos contradiz o objetivo da sprint. Hoje o efeito aparece em três telas, não só na Viabilidade.
2. **Nota "até duas unidades" (b).** Aceita como entregue.
3. **Base da inflação por moeda na importação (c).** Risco aceito para esta entrega e registrado no backlog com prioridade baixa (A2). Exportação, importação, sincronização e cenários levam moeda e plano juntos, então a base só diverge com arquivo editado à mão ou estado antigo inconsistente. O mesmo risco já existe para `currencyTrends`. Quando ocorre, a taxa entra no cálculo e não aparece no formulário, porque o painel só mostra valores com `base` igual à moeda do plano.

### Acompanhamentos

- **A1. Painéis de ano das projeções sem centavos.** Agente: frontend-developer. RICE 5,4 (R 6, I 0,5, C 90%, E 0,5). Escopo: `src/shared/cash-flow-detail.js`, `src/shared/budget-comparison.js` e `src/shared/budget-pressure.js` recebem o formatador por parâmetro. Critérios: (1) dado um painel de ano de projeção anual na Visão geral, na Projeção patrimonial ou na Viabilidade, quando aberto, então totais de grupo, valores por lançamento, comparação com o orçamento, pressão dos gastos e a linha "Resultado do retorno" aparecem sem casas decimais; (2) dado o recorte do orçamento mensal e o Orçamento do mês, quando exibidos, então continuam com duas casas; (3) dado o modo de privacidade, nada muda; (4) asserções ",00" ajustadas, sem remoção.
- **A2. Base das premissas de câmbio alinhada na carga.** Agente: software-developer. RICE 3,2 (R 1, I 1, C 80%, E 0,25). Escopo: `sanitizeStoredState` em `src/app/state-storage.js`. Critérios: (1) dado `inflationByCurrency.base` diferente da moeda do estado, quando o estado é carregado ou importado, então `base` passa a ser a moeda do estado e as taxas ficam, porque valem por moeda; (2) dado `currencyTrends.base` diferente da moeda do estado, quando carregado, então a tendência é descartada, como em `setCurrency`; (3) teste de ida e volta com base divergente. Arquivo com alterações do usuário não commitadas: mexer só no trecho do plano.

### Precisa de validação manual do usuário

Inspeção em navegador a 1366 px e 390 px, com valores visíveis e ocultos:

- Visão geral: barra de cobertura sem insuficiência, com insuficiência no meio, no primeiro e no último ano, e com premissas a revisar. Conferir também a 320 px que o ano do marcador não encosta nos anos das pontas.
- Visão geral, Projeção patrimonial, Viabilidade, risco anual e risco mensal: valores inteiros, "R$ 0" sem sinal, nota de arredondamento na conciliação.
- Patrimônio com uma única classe e "Para onde vai o orçamento" com uma única categoria: texto "100% em ..." legível e sem quebra ruim a 390 px.
- Carteira, "Câmbio na projeção": campos de inflação, botão "Salvar premissas de câmbio", mensagem de faixa inválida, aviso do diagnóstico e o link que foca o campo da moeda.
- Painéis de ano das projeções ainda com centavos até A1. Não é defeito novo.
