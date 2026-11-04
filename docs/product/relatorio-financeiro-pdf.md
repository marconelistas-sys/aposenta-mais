# Relatório financeiro em PDF

## Pedido do usuário

Relatório completo em PDF que avalie a situação financeira com as práticas de análise financeira profissional: onde o gasto está alto e pede readequação do orçamento, como o patrimônio evolui no tempo em várias dimensões, como os investimentos evoluem, e os demais aspectos essenciais do planejamento.

## Análise dos agentes

### Planejamento financeiro

- Modelos de referência: revisão anual de planejador CFP (diagnóstico → recomendação → plano de ação), relatório de private banking suíço (balanço multimoeda, alocação por dimensão, ponte patrimonial), índices de finanças pessoais (semáforo objetivo) e análise de variância de FP&A (materialidade dupla).
- O app já calcula quase tudo de orçamento, carteira, liquidez, dívidas, câmbio, viabilidade e confiança (mapa de dados abaixo).
- Lacuna crítica: não há histórico de saldos de investimentos nem de patrimônio. Cada investimento guarda só `amount`/`nativeAmount` + `balanceAsOf`. Sem série, não há TWR, TIR, rendimento realizado nem efeito cambial realizado. Começar a gravar fotos mensais já no MVP, porque cada mês sem foto é histórico perdido.

### Usabilidade e visualização

- Todos os gráficos atuais são SVG/HTML inline gerados por funções puras, sem canvas. Reaproveitáveis em impressão.
- Não há nenhuma regra `@media print`/`@page` nem `window.print`.
- A paleta atual de classes falha no validador de daltonismo (`--chart-gold` × `--chart-equity` ΔE 1,2 em deuteranopia; perigo × aviso ΔE 5,4). No relatório, rótulo direto, ícone, sinal e textura são obrigatórios.
- Sem velocímetros nem nota agregada (coerente com [dashboard-instrumentos-visuais.md](dashboard-instrumentos-visuais.md)). Indicadores em grade com estado textual.

## Decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Geração do PDF | Rota `/relatorio` com página HTML de relatório e botão "Salvar como PDF" (`window.print()`), CSS `@page` A4 | Dados não saem do navegador; reaproveita SVGs; zero dependência. Playwright só em teste |
| Ponto de entrada | Item "Relatório financeiro" no grupo Planejar do menu. Substituído pelo Panorama financeiro (`/panorama`, em abas): ver [panorama-financeiro.md](panorama-financeiro.md) | Relatório é leitura do plano inteiro |
| Valores ocultos | Botão de PDF bloqueado até revelar os valores; o panorama na tela aparece mascarado (2026-11-04, ver `panorama-financeiro.md`) | Nunca imprimir máscaras em silêncio |
| Histórico de patrimônio | `plan.wealthHistory`: uma foto por mês, no padrão de `goalsHistory` (troca a foto do mês, sanitiza, limite de 120 meses) | Base para a evolução real a partir de agora |
| Evolução realizada | Com menos de 2 fotos, a seção mostra a composição de hoje e a projeção, com aviso. Com 2 ou mais, linha do patrimônio por mês e variação entre a primeira e a última foto | Não estimar o passado |
| TWR/TIR, ponte realizada, benchmarks realizados | Fase 2 | Dependem do histórico |
| Paleta de categorias | Escopo do relatório, ordem fixa, cor segue a entidade, máx. 5 + "Outros", sempre com rótulo direto | Paleta atual falha no daltonismo |
| Impressão | `print-color-adjust: exact`; nada dentro de `<details>`; cada capítulo em página nova; figuras com `break-inside: avoid` | Fundos e barras HTML sumiriam |

## Estrutura do relatório (ordem de leitura, meta de até 10 páginas)

Parâmetros: mês de referência (`cashFlow.referenceMonth`), acumulado do ano (jan → mês), últimos 12 meses; moeda do estado; câmbio com data.

0. **Capa e parâmetros.** Período, moeda, data do câmbio, cobertura de registros, qualidade dos dados (`planChecks`).
1. **Sumário executivo (1 página).** Grade de 8 indicadores (valor, estado com ícone e rótulo, referência, uma frase), 3 principais achados e 3 ações com impacto quantificado, ordenadas pelo impacto na confiança ou no patrimônio final.
2. **Fluxo de caixa e poupança.** Taxa de poupança, despesas fixas sobre receita, saldo acumulado do ano.
3. **Onde o gasto está alto.** Variância por categoria, cota anual, sem orçamento, tendência, peso na renda, categorias que pedem ação com corte sugerido e efeito.
4. **Balanço patrimonial hoje.** Ativos por grupo, dívidas, patrimônio líquido, alavancagem.
5. **Patrimônio por dimensão e evolução.** Classe, liquidez, moeda do saldo, moeda de exposição, região, financeiro × imobilizado × previdência × consórcio. Evolução realizada (se houver fotos) e ponte projetada do próximo ano.
6. **Carteira.** Concentração, custo, retorno assumido, alocação atual × alvo com banda, aporte sugerido.
7. **Liquidez e reserva.** Meses de reserva, liquidez não informada, menor liquidez projetada.
8. **Dívidas e compromissos.** Serviço da dívida, juros restantes, quitação.
9. **Câmbio.** Ativos por moeda × despesas por moeda; choque de ±20%.
10. **Aposentadoria e objetivos.** Confiança, faixas P10–P90, primeiro ano de falta, taxa de retirada, alavancas.
11. **Lista de verificação.** Seguros, sucessão, impostos CH/BR, declaração de bens no exterior (sem dados no app; só perguntas).
12. **Plano de ação, premissas, cobertura dos dados, glossário e avisos.**

Capítulos sem dados somem ou mostram estado vazio explícito.

## Indicadores e limites

Limites são convenções de mercado, não regras regulatórias. Estados: ok, atenção, risco; sem dado = indisponível.

| Indicador | Fórmula | Ok | Atenção | Risco |
|---|---|---|---|---|
| Taxa de poupança | (receitas − despesas de consumo) / receitas; aportes em previdência e investimentos contam como poupança | ≥ 20% | 10–20% | < 10% |
| Despesas fixas / receita | grupos `essential` + `debt` / receita | ≤ 50% | 50–60% | > 60% |
| Execução do orçamento (acumulado) | realizado / planejado até o mês, despesas | ≤ 100% | 100–110% | > 110% |
| Reserva de emergência | saldo disponível / despesa mensal | ≥ 6 meses | 3–6 | < 3 |
| Serviço da dívida / receita | parcelas / receita mensal | ≤ 36% | 36–43% | > 43% |
| Alavancagem | dívidas / ativos brutos | < 30% | 30–50% | > 50% |
| Concentração | classe ≥ 60% atenção, ≥ 80% risco; um investimento ≥ 40% atenção (`diagnosticThresholds`) | | | |
| Custo da carteira | custo médio ponderado | < 0,5% | 0,5–1% | ≥ 1% (atenção) |
| Confiança da aposentadoria | `analyzeGoals` | 75–90% | > 90% folga | < 75% |
| Taxa de retirada | retirada anual / patrimônio na aposentadoria | ≤ 3,5% | 3,5–5% | > 5% |
| Descasamento cambial | diferença entre % de ativos e % de despesas por moeda | ≤ 20 p.p. | > 20 p.p. | |

## Onde o gasto está alto: metodologia

1. Variância acumulada no ano por categoria (`buildBudgetYearToDate`), com os status existentes.
2. Materialidade dupla: desvio ≥ 10% **e** ≥ 1% da receita mensal. Abaixo disso, a categoria não vai para a lista de ação.
3. Cota anual: uso da cota contra meses decorridos.
4. Sem orçamento: realizado sem planejado (`unplanned`); detalhar "Outras despesas" (`otherExpenseAnalysis`).
5. Tendência: média de 3 meses × média de 12 meses (`buildBudgetMonths`); alta se a de 3 passar a de 12 em mais de 15%.
6. Peso na renda por grupo (`essential` = necessidades, `variable` = desejos, previdência e aportes = poupança), com 50/30/20 só como referência. Na Suíça, moradia e seguro-saúde costumam passar de 50%.
7. Priorização: excesso anualizado × impacto no patrimônio final (`simulateExpenseReduction`). Só `essential` e `variable` são alvo de corte.
8. Readequação: corte que leva a confiança a 80% (`analyzeGoals().levers.spending`), distribuído pelas categorias priorizadas, começando pelos desejos com excesso. Texto: "Reduzir Restaurantes em CHF X/mês (−Y%) eleva o patrimônio aos 90 anos em Z." Se a confiança passar de 90%, informar a folga em vez de pedir corte.

## Mapa de dados

| Métrica | Situação | Fonte |
|---|---|---|
| Variância acumulada, cota, sem orçamento, cobertura | Já calcula | `budget-year-to-date.js` `buildBudgetYearToDate` |
| Excessos | Já calcula | `budget-expense-overruns.js` |
| Série mensal planejado × realizado | Derivável | `monthly-budget.js` `buildBudgetMonths` |
| Distribuição e "Outras" | Já calcula | `budget-expense-distribution.js`, `other-expense-analysis.js` |
| Pressão projetada | Já calcula | `budget-pressure.js` |
| Impacto de cortar uma despesa | Já calcula | `expense-impact.js` `simulateExpenseReduction` |
| Alavancas, confiança, reservas | Já calcula | `goals-planning.js` `analyzeGoals` |
| Histórico de confiança | 36 meses | `plan.goalsHistory`, `goalsTrend` |
| Balanço, liquidez, moeda | Já calcula | `wealth-composition.js` |
| Concentração, custo, retorno assumido | Já calcula | `portfolio-diagnostics.js` |
| Alocação × alvo | Já calcula | `target-allocation.js` |
| Choque cambial | Já calcula | `currency-scenario.js` |
| Dívidas | Já calcula | `debt-analysis.js` |
| Projeção anual e Monte Carlo | Já calcula | `finapp-viability.js`, `finapp-risk.js` |
| Patrimônio mês a mês | **Falta**: criar `plan.wealthHistory` | novo |
| TWR, TIR, efeito cambial realizado, benchmarks realizados | **Falta** (fase 2) | depende do histórico |
| Seguros, sucessão, imposto suíço | **Falta** | só lista de verificação |

## Sistema visual

- A4, margens 16 mm laterais, 14 mm topo, 18 mm base; grade de 12 colunas. Rodapé com data-base e número de página.
- Tipografia em pt: capítulo 18, título-conclusão 12,5, texto 9,5, notas 7,5 (mínimo 7), KPI 20–24. Números tabulares.
- Estados: favorável (verde, ▲/✓, sólido), desfavorável (vermelho, ▼/✕, hachura), alerta (âmbar, !, pontilhado), neutro (cinza, ●, contorno). Zero sem sinal e neutro; negativo com "−" (U+2212). Vermelho só para desvio material.
- No máximo 2 gráficos principais por página, mais uma tabela curta. Tabelas completas no anexo.

| Pergunta | Gráfico |
|---|---|
| Sumário | Grade de indicadores com estado + 3 achados → 3 ações |
| Variação do orçamento | Barras divergentes a partir de zero, ordenadas pelo desvio em moeda |
| Consumo da cota | Bullet (realizado, planejado até o mês, cota anual) |
| Planejado → realizado | Waterfall |
| Patrimônio por dimensão | Barras 100% empilhadas, uma por dimensão (small multiples) |
| Evolução realizada | Linha do patrimônio por mês (com ≥ 2 fotos) |
| Ponte projetada | Waterfall: inicial + saldo do orçamento + rendimento + previdência = final |
| Alocação × alvo | Pontos com faixa de ±5 p.p. |
| Aposentadoria | Mediana com faixas P10–P90 e P25–P75, marco da idade-alvo |
| Reserva | Bullet de meses contra a meta |

## Regras de texto

- Título-conclusão gerado pelo modelo a partir dos limites ("Moradia e lazer explicam 80% do excesso"). Sem dado, título descritivo.
- Abaixo de cada gráfico: *Como ler*, *Fonte*, *Premissa*.
- Sem centavos em totais, médias e projeções. Moeda e base (nominal ou real) sempre explícitas. K/mi só em eixos.
- Tom neutro: "acima do plano em CHF 480/mês (+12%)". Todo alerta traz uma ação.
- Avisos: educativo, não é recomendação de investimento, fiscal ou jurídica; projeções dependem de premissas; retorno passado não garante futuro; cobertura de registros; câmbio usado.
- Antes de gerar: "O arquivo contém seus dados financeiros e não é enviado a nenhum servidor."

## Escopo do MVP

- Rota `/relatorio`, modelo puro `buildFinancialReport(state, { today })` testado com `node --test`, renderização e CSS de impressão.
- Capítulos 0–4, 5 (composição de hoje + evolução se houver fotos + ponte projetada), 6–10, 11 (lista de verificação), 12.
- Gravação de `plan.wealthHistory`.
- Teste de impressão com Playwright (dados de exemplo, perfil temporário): número de páginas ≤ 12, sem estouro horizontal.

## Fase 2

TWR/TIR e ponte realizada (aportes + rendimento + câmbio), benchmarks realizados informados à mão, preenchimento manual do histórico (saldos de 31/12), titularidade de ativos, seguros e sucessão, impostos suíços e pilar 3a, comparação entre relatórios.
