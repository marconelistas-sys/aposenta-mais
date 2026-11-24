# Sua carteira de verdade e quantas vezes o custo mensal você precisa ter

## Status

Especificado em 2026-11-16. **Implementado em 2026-11-16** (domínio em `portfolio-reality.js` e `retirement-multiple.js`; tela e PDF em `report-view.js` e `report.css`), sem commit, aguardando revisão do dono.

Decisões de interface tomadas na implementação [validar]:
- PDF com 14 páginas no fixture: o capítulo 6 abre página; os capítulos 11, 12, 13 e 14 continuam na folha anterior.
- Custo anual em % mantém duas casas abaixo de 1% (0,35%), como no capítulo Carteira, e não uma casa (D14): com uma casa, 0,04% viraria "0%" e pareceria custo zero.
- "Diferença" (realizado − esperado) em pontos percentuais.
- Um medidor no capítulo 6 mostra a carteira de hoje como parcela do capital da Liberdade e do Legado, sem rendimento e aportes até a aposentadoria.

Rótulos: [fato] verificado no código ou nos documentos; [calculado] conta do PO, reproduzível; [suposição] decisão sem dado; [validar] decisão do PO que o dono pode reverter; [verificar no navegador] depende da renderização. Não houve teste com usuários.

Conteúdo informativo. Os capítulos descrevem a carteira e fazem contas com premissas declaradas. Não recomendam produto, alocação, taxa de retirada nem data de aposentadoria.

## Pedido do dono

"Crie um relatório que responda: (1) quanto a sua carteira rende de verdade acima do IPCA; (2) quanto ela custa em taxas e comissões escondidas; (3) quantas vezes ela cabe no seu custo de vida. Crie também um relatório que responda quantas vezes o meu custo mensal eu preciso ter de capital acumulado quando eu me aposentar, nos cenários Regra do 1%, Liberdade e Legado, com juro real líquido de 4% ao ano e aportes por 10 anos em reais de hoje. Faça as adaptações necessárias para um planejamento correto."

Referência: slide de um vídeo, "100 vezes? Não. Entre 229 e 306". Regra do 1%: R$ 3 mi, 100x, acaba aos 60. Liberdade: R$ 6,86 mi, 229x, aporte de R$ 16,5 mil/mês. Legado: R$ 9,19 mi, 306x, aporte de R$ 32,4 mil/mês. Custo de R$ 30 mil/mês, capital de R$ 3 mi, 40 anos de idade, aposentadoria aos 50, horizonte até os 85.

## O que já existe [fato]

- `portfolioMetrics`: `total`, `weightedFee` e `weightedRealReturn`. Este último mistura o rendimento calculado pelos saldos com a taxa informada, porque `resolveInvestmentRealReturn` dá precedência ao calculado.
- `resolveGrossInvestmentRealReturn` + `applyAnnualFee` dão a premissa informada já líquida de custo. `calculatedReturn(balanceHistory)` dá o rendimento nominal pelos saldos (Dietz modificado, janela de 90 a 730 dias), já líquido de custo e de come-cotas, porque usa o saldo.
- O app não guarda série de inflação realizada. O snapshot `/api/economic-indicators` traz `cpi.yoy` e `cpi.lastMonth`: IPCA de 12 meses para o Brasil e IPC de 12 meses para a Suíça. Ele fica só em memória, em `economicIndicatorsState`, e não no plano.
- `annualFee` vazio é salvo como 0 (`main.js:2588`), e o armazenamento descarta valores abaixo de 0,01% (`state-storage.js:140`). Por isso "sem custo informado" e "custo zero" não se distinguem.
- `feeImpact` (capítulo Carteira): patrimônio no fim do horizonte com e sem custos, com duas rodadas de `finappViability`.
- `finappViability` gera linhas anuais reais com `costs`, `income`, `goals` e `withdrawalTax`. O indicador `withdrawalRate` já usa o primeiro ano civil completo de aposentadoria.
- Capítulos numerados por `chapterOrder` (índice + 2). Três textos fixos citam "capítulo 12" e "Capítulo 1" (`report-view.js:105, 117, 520`). O teste de impressão espera 12 capítulos e até 12 páginas.

## Decisões

| # | Tema | Decisão | Motivo |
|---|---|---|---|
| D1 | Lugar | Dois capítulos novos no modelo do relatório. `portfolioReality` ("Sua carteira de verdade") fica na aba Carteira, antes de `portfolio`. `retirementMultiple` ("Quantas vezes o custo mensal você precisa ter") fica na aba Aposentadoria, antes de `retirement`. Nenhuma aba nova | Ficam onde a pessoa já procura o assunto. A resposta curta vem antes do detalhe. Continuam 7 abas |
| D2 | Numeração | A ordem vira 1 Sumário, 2 a 5 iguais, 6 Sua carteira de verdade, 7 Carteira, 8 Liquidez, 9 Dívidas, 10 Câmbio, 11 Quantas vezes o custo, 12 Aposentadoria, 13 Verificação, 14 Premissas. Os três textos com número fixo passam a pegar o número pela chave (`appendix`, `summary`) | Inserir no lugar certo é mais claro que pendurar capítulos depois do apêndice. Com número calculado, nenhum texto quebra |
| D3 | PDF | Os dois capítulos entram no PDF. A meta passa a ser até 14 páginas e 14 capítulos (`check-report-print-browser.mjs`) [verificar no navegador] | O PDF é o relatório inteiro, por decisão anterior |
| D4 | Premissas na tela | Só leitura. A taxa de 4% real líquida é fixa (`reportThresholds.retirementMultiple.realRate = 0.04`). A sensibilidade a 3%, 5% e à taxa do plano aparece em tabela. Custo, idades e aporte vêm do plano. Links "Ajustar em" e "Simular em" | O Panorama não edita (fora de escopo de `panorama-financeiro.md`). A tabela de sensibilidade responde ao "e se" sem campo novo |
| D5 | Rótulo da inflação | "acima da inflação", com o índice em cada linha: IPCA (BRL), IPC suíço (CHF) ou "inflação do plano" (EUR, USD). O título diz "acima do IPCA" só se a carteira inteira estiver em BRL | Um saldo em CHF descontado pelo IPCA daria um real falso, cerca de 3,6 p.p. abaixo [calculado: IPCA 4,58% contra IPC 0,99% no fixture] |
| D6 | Imposto | O rendimento esperado e o realizado são antes do IR. O realizado já desconta o come-cotas, porque vem do saldo. Os 4% do relatório B são líquidos de taxas e de imposto. Quando o plano tem regime de imposto nos resgates, uma nota avisa que a projeção oficial desconta imposto à parte | O app trata o imposto só no resgate [fato]. O vídeo fala em juro real líquido |
| D7 | Custo a cobrir | **Lacuna** = custo de vida na aposentadoria menos renda garantida (benefícios, cônjuge, rendas do Orçamento), ano a ano. O capital é calculado sobre a lacuna. O múltiplo exibido divide o capital pelo **custo total** mensal | Responde à pergunta literal ("vezes o custo mensal") e mostra quanto a renda garantida reduz a meta. Sem renda garantida, os dois coincidem e o slide é reproduzido |
| D8 | Fonte do custo e da renda | 1º: linhas de `finappViability` a partir do primeiro ano civil completo de aposentadoria (mesma regra do indicador `withdrawalRate`), lacuna = max(0, `costs` − `income`) / 12. 2º, sem projeção: `targetMonthlyIncome` − (`expectedMonthlyBenefit` + benefício do cônjuge, se houver), constante. 3º: custo de vida de hoje (D10), sem renda garantida. A base usada aparece na tela | O motor oficial já trata período-ponte, cônjuge e renda com valor fixo (`indexacao-beneficios.md`). Os dois fallbacks evitam capítulo vazio |
| D9 | Capital atual (K0) | Carteira financeira = soma de `plan.investments` na moeda do plano (`metrics.total`), com previdência que forma capital e sem imóveis. Nada é descontado para reserva | Mesma base do capítulo Carteira e da projeção oficial. Benefício "somente mensal" já não forma saldo [fato: `previdencia-capital-ou-beneficio.md`] [validar] |
| D10 | Custo de vida hoje | Consumo mensal médio de `flowBasis`: (necessidades + desejos + dívidas + outras) / meses, sem o grupo Previdência e sem aportes. Base realizada se houver meses realizados; senão, planejada | É o custo de viver, não o de poupar. Mesma base da taxa de poupança [fato] |
| D11 | Objetivos e reserva | `goals` (objetivos pontuais) e a reserva de emergência ficam fora do capital de renda. Uma nota leva a Objetivos e confiança e ao capítulo Liquidez | Misturar consumo recorrente com metas pontuais distorce o múltiplo |
| D12 | Aporte | Real e constante (cresce com a inflação em valores nominais), no fim do mês, até a aposentadoria. O aporte atual é `plan.monthlyContribution` | Convenção de `rate-conventions.md` [fato]. Mesmo campo que "Aporte necessário" de Meu plano [validar] |
| D13 | Horizonte da Liberdade | Da idade de aposentadoria (ou da idade atual, se já aposentado) até `targetAge` (padrão 90), não 85 fixo | O horizonte é premissa do plano |
| D14 | Arredondamento | Dinheiro sem centavos em todos os valores dos dois capítulos (`formatProjectedCurrency`). Múltiplos sem casas ("229x"). Percentuais com 1 casa. Meses inteiros. Anos com 1 casa. Idades inteiras | Projeções de longo prazo sem centavos (regra A1) |
| D15 | Valores ocultos | Dinheiro mascarado. Múltiplos, percentuais, meses e idades visíveis | Sem o custo, eles não revelam valores [suposição] |

## Relatório A: Sua carteira de verdade

### A1. Quanto rende acima da inflação

Para cada investimento j, com peso w_j = saldo na moeda do plano e ano = ano corrente:

- **Esperado (premissa)**: E_j = `annualRealReturns` do ano, se houver; senão `applyAnnualFee(resolveGrossInvestmentRealReturn(j, plan, ano), fee_j)`. Real e líquido de custo, antes do IR.
- **Realizado (pelos saldos)**: com `calculatedReturn(j.balanceHistory).status === 'ok'`, em qualquer `returnMode`: R_j = (1 + nominal_j) / (1 + π12_moeda) − 1. π12 = `cpi.yoy` do snapshot para BRL e CHF. Para EUR e USD, ou sem snapshot, π = `investmentInflation(j, plan, ano)`, com o rótulo "inflação estimada". O snapshot chega ao modelo como opção, como `goals` e `risk`.
- Carteira: E = Σ w_j E_j / Σ w_j. R = Σ_cob w_j R_j / Σ_cob w_j, só nos investimentos com histórico. E_cob = a premissa no mesmo subconjunto. Cobertura = Σ_cob w / Σ w.
- Título: "Nos investimentos com histórico (X% da carteira), a carteira rendeu R acima da inflação. A premissa para eles é E_cob." Sem histórico: "Sem histórico de saldos. A premissa é E acima da inflação. Informe saldos com pelo menos 90 dias de intervalo." Link para a Carteira.
- Tabela por investimento: nome, moeda e índice, esperado, realizado, janela ("de 2025-11 a 2026-10"), diferença. Janela fora de 10 a 14 meses: nota "anualizado; inflação dos últimos 12 meses como aproximação".

### A2. Quanto custa em taxas e comissões

- Custo do ano em dinheiro: Σ saldo_j × fee_j. Em %: `metrics.weightedFee`, com o indicador `portfolioCost` (ok abaixo de 0,5%).
- Perda de patrimônio: diferença com e sem custos na linha do ano da aposentadoria e no fim do horizonte (`feeImpact`), nas mesmas duas rodadas que já existem.
- Maiores custos: até 5 investimentos, ordenados pelo custo em dinheiro.
- Sem custo cadastrado (`fee_j = 0`): parcela da carteira, em dois grupos. Classes `fund` e `pension`: "provavelmente falta o custo anual". Classes `equity`, `cash` e `other`: "sem custo cadastrado; pode ser zero".
- Sinal de custo não cadastrado: para `returnType` `cdi` ou `nominal` com realizado, Δ = `applyAnnualFee(nominal contratado, fee)` − nominal realizado. Com Δ ≥ 1 p.p., a linha mostra "rendeu Δ abaixo do contratado: pode ser custo não cadastrado, come-cotas, imposto ou aporte não registrado". Ações e fundos não recebem o sinal, porque a oscilação de mercado não é custo.
- Texto fixo "O que o app não vê": taxa de performance; taxa de carregamento de PGBL/VGBL; spread embutido na taxa de títulos bancários; corretagem e custódia; spread de câmbio e IOF em remessas; taxa de custódia e imposto de selo na Suíça. Come-cotas e IR são impostos e não entram no custo. O texto não traz percentuais de mercado.

### A3. Quantas vezes cabe no custo de vida

- M_total = K0 / C_hoje (D9, D10), em meses e em anos. M_disponível = liquidez `available` / C_hoje.
- Frase: "A carteira equivale a 86 meses (7,1 anos) do seu custo de vida de hoje. A parte disponível, a 14 meses." Mais a linha: "Quanto seria preciso na aposentadoria: capítulo 11." O número vem de D2.
- Sem custo de vida (C_hoje ≤ 0) ou sem carteira: o estado vazio explica o que cadastrar.

## Relatório B: Quantas vezes o custo mensal você precisa ter

### Fórmulas

Taxa real anual r; i = (1 + r)^(1/12) − 1; v = 1 / (1 + i). Saques no início do mês, aportes no fim.

- ä_N = (1 − v^N) / i × (1 + i); se i = 0, ä_N = N. s_n = ((1 + i)^n − 1) / i; se i = 0, s_n = n.
- g_m = lacuna mensal no mês m da aposentadoria (D8). Meses antes do primeiro ano civil completo usam o g desse ano. Depois do horizonte, vale o g do último ano. C = custo total mensal do primeiro ano.
- **Regra do 1%**: K = 100 × g_0. É a regra de bolso "a renda é 1% ao mês do capital".
- **Liberdade** (o capital zera em `targetAge`): K = Σ_{m=0}^{N−1} g_m v^m, com N = (targetAge − idade no início) × 12. Com g constante: K = g × ä_N.
- **Legado** (o capital real nunca diminui): K = K_Lib + v^N × g_N × (1 + i) / i. Exige i > 0. Com g constante: K = g × (1 + i) / i.
- Múltiplo = K / C. Retirada equivalente ao ano = 12 × g_0 / K.
- Aporte necessário: A* = max(0, (K − K0 × (1 + i)^n) / s_n), com n = `retirementMonths(plan, hoje)`.
- **Seu plano atual**: K_proj = K0 × (1 + i)^n + A × s_n, com A = aporte atual.
- Duração D(K): saldo B = K. A cada mês m, B −= g_m. Se B < 0, o dinheiro acaba no mês m. Senão, B ×= (1 + i). Idade em que acaba = idade no início + ⌊m / 12⌋. Até 100 anos de simulação; depois disso, "não acaba".

### Adaptações em relação ao vídeo

| Vídeo | Aqui | Por quê |
|---|---|---|
| Custo total de R$ 30 mil | Lacuna = custo − renda garantida, ano a ano; múltiplo sobre o custo total | Benefício, cônjuge e renda fixa do 2º pilar reduzem o capital necessário. O período-ponte entra pela projeção |
| Até os 85 | Até `targetAge` | Premissa do plano |
| 10 anos de aportes | Meses até `retirementAge` | Prazo real do dono |
| 4% real líquido | 4% fixo, mais sensibilidade a 3%, 5% e à taxa do plano | A conta é muito sensível à taxa: Legado vai de 246x a 406x [calculado] |
| "300x = regra dos 4%" | Nota: 306x é a perpetuidade com 4% real certo todos os anos. A "regra dos 4%" americana é a retirada inicial que resistiu a cerca de 30 anos do histórico dos EUA. Não é perpetuidade e não usa juro fixo | O slide mistura os dois conceitos |
| Sem risco | Nota: a Liberdade retira 5,2% ao ano, faixa de risco do indicador `withdrawalRate` (acima de 5%). O Legado retira 3,9% (atenção). Com volatilidade e sequência de retornos, o resultado varia. Link para Objetivos e confiança | O cálculo é determinístico. A confiança vem do Monte Carlo |
| Capital e custo em R$ | Moeda do plano (CHF para o dono). 4% acima da inflação dessa moeda | Moeda do plano [fato] |

### Saída

Premissas exibidas: custo de vida na aposentadoria, renda garantida, lacuna, base usada (D8), capital atual, aporte atual, meses até a aposentadoria, horizonte, taxa de 4% e a mensal equivalente (0,327%).

| Linha | Capital | Vezes o custo | Retirada ao ano | Aporte necessário | Situação |
|---|---|---|---|---|---|
| Regra do 1% | K | x | % | A* | "Já tem" / "Faltam X" / "O aporte atual cobre"; "o dinheiro acaba aos N" |
| Liberdade | | | | | idem; "dura até `targetAge`" |
| Legado | | | | | idem; "não acaba" |
| Seu plano atual | K_proj | x | % | aporte atual | "o dinheiro acaba aos N" ou "não acaba". Mais a linha da projeção oficial: primeiro ano de insuficiência de `base.firstFailure`, ou "sem insuficiência até `targetAge`" |

Sensibilidade: múltiplo e aporte da Liberdade e do Legado com r = 3%, 4%, 5% e a taxa do plano (`plan.annualRealReturn`, "líquida de custos, antes de imposto").

### Casos de borda

| Caso | Comportamento |
|---|---|
| Sem custo (C ≤ 0 nas três fontes) | Capítulo vazio: "Cadastre o orçamento ou a renda desejada em Meu plano" |
| Lacuna zero | Capitais 0, múltiplo 0x, aporte 0. "A renda garantida cobre o custo. O capital fica para objetivos e imprevistos" |
| Sem `currentAge` ou `retirementAge` | Regra do 1% e Legado com capital, múltiplo e retirada. Liberdade, aportes, plano atual e duração: "Informe as idades em Meu plano" |
| `retirementAge ≥ targetAge` | Liberdade indisponível, com motivo |
| Já aposentado (n = 0) | Aporte "não se aplica". Situação = K0 contra K. Duração a partir da idade atual |
| K0 × (1 + i)^n ≥ K | Aporte 0. "O capital atual já chega lá, sem novos aportes" |
| r ≤ 0 (só na linha da taxa do plano) | Legado: "Sem capital finito com retorno real zero ou negativo". Liberdade com a fórmula para i ≤ 0 |
| Carteira vazia | K0 = 0. Tudo funciona |

## Métricas de sucesso

Sem telemetria. A medição é feita com testes e numa sessão com o dono.

| Métrica | Hoje | Meta | Medição |
|---|---|---|---|
| O dono responde às 4 perguntas do pedido olhando o Panorama | Não responde (A1 realizado, A3 e B não existem) | Cada uma em até 1 min, sem ajuda | Sessão observada na primeira revisão |
| Caso ouro do slide | — | H6 passa | Teste unitário |
| Contramétrica: capítulos existentes | — | Valores do modelo idênticos, exceto a numeração | Teste de snapshot |
| Contramétrica: PDF | 11 páginas | Até 14, sem estouro | `test:report-browser` |

Critério de simplificação: se depois de um ciclo o dono não usar a sensibilidade, ela sai [validar].

## Priorização RICE

Escala de `indexacao-beneficios.md`. Alcance de 1 a 10, impacto de 0,25 a 3, esforço em sessões de agente [suposição, a confirmar pelo desenvolvimento].

| História | R | I | C | E | RICE | Ordem |
|---|---|---|---|---|---|---|
| H1 Capítulos, numeração e PDF | — | — | — | 0,5 | — | Pré-requisito |
| H3 A3 Vezes o custo de vida | 6 | 1 | 80% | 0,25 | 19,2 | 1ª |
| H4 A2 Custo em taxas | 6 | 2 | 80% | 1 | 9,6 | 2ª |
| H5 B Múltiplo da aposentadoria | 6 | 3 | 80% | 2 | 7,2 | 3ª, núcleo do pedido |
| H7 B Sensibilidade e plano atual | 4 | 1 | 80% | 0,75 | 4,3 | 4ª |
| H2 A1 Rendimento real | 6 | 2 | 50% | 1,5 | 4,0 | 5ª. Confiança de 50%: o snapshot precisa chegar ao worker |

Ordem de corte, se faltar tempo: o realizado de H2 (o esperado fica), depois H7.

## Histórias

### H1. Capítulos novos sem quebrar a numeração
Como dono do plano, quero os dois relatórios no Panorama e no PDF, para ler e guardar tudo junto.
1. Dado o relatório, quando abro a aba Carteira, então vejo os capítulos 6 "Sua carteira de verdade" e 7 "Carteira", nesta ordem.
2. Dada a aba Aposentadoria, quando ela abre, então vejo os capítulos 11 "Quantas vezes o custo mensal você precisa ter" e 12 "Aposentadoria e objetivos".
3. Dados os textos que citam o apêndice, quando são exibidos, então dizem "capítulo 14". Nenhum número de capítulo está fixo no código.
4. Dado o botão de PDF a partir de qualquer aba, quando imprimo, então saem 14 capítulos em até 14 páginas A4 [verificar no navegador].
5. Dados os valores ocultos, quando abro as duas abas, então o dinheiro aparece mascarado, e múltiplos, percentuais, meses e idades continuam visíveis.

### H2. Rendimento acima da inflação, esperado e realizado
Como dono do plano, quero ver quanto a carteira rendeu e quanto deve render acima da inflação de cada moeda, para saber se a premissa é realista.
1. Dado um investimento em CHF com nominal calculado de 3,0%, IPC de 12 meses de 0,99% e custo de 0,5%, quando o capítulo é gerado, então o realizado é 1,03 / 1,0099 − 1 = 1,99%, exibido "2,0%", com o índice "IPC suíço" e sem desconto extra de custo.
2. Dado um investimento em BRL com `returnType` `cdi` sem histórico, quando o capítulo é gerado, então ele entra só no esperado, e a cobertura exclui o saldo dele.
3. Dado o snapshot indisponível, quando o capítulo é gerado, então o realizado usa a inflação esperada da moeda, com o rótulo "inflação estimada".
4. Dado uma carteira toda em BRL, quando o título é exibido, então diz "acima do IPCA". Com algum saldo em CHF, diz "acima da inflação".
5. Dado nenhum investimento com histórico válido, quando o capítulo é gerado, então só o esperado aparece, com a frase sobre os 90 dias e o link para a Carteira.

### H3. Quantas vezes a carteira cabe no custo de vida
Como dono do plano, quero saber por quantos meses a carteira paga o meu custo de vida, para entender o tamanho dela.
1. Dado carteira de 600.000, disponível de 100.000 e consumo médio realizado de 7.000/mês, quando o capítulo é gerado, então mostra 86 meses (7,1 anos) e 14 meses disponíveis.
2. Dado o grupo Previdência no orçamento, quando o consumo é calculado, então ele não entra.
3. Dado nenhum mês realizado, quando o capítulo é gerado, então usa o orçamento planejado e diz "pelo orçamento planejado".

### H4. Custo em taxas e o que não é medido
Como dono do plano, quero ver quanto pago em custos por ano e o que o app não consegue medir, para conferir os produtos.
1. Dado fundo de 200.000 com 1,5% e ETF de 300.000 com 0,2%, quando o capítulo é gerado, então mostra 3.600 por ano, 0,7% ponderado, e o fundo como maior custo.
2. Dado um fundo e uma previdência com custo 0, quando o capítulo é gerado, então eles aparecem em "provavelmente falta o custo anual", com a parcela da carteira, e um link para a Carteira.
3. Dado um investimento `cdi` com contrato de 100% do CDI, custo 0 e realizado 1,2 p.p. abaixo do contratado, quando o capítulo é gerado, então aparece o sinal de possível custo não cadastrado. Para ações, o sinal não aparece.
4. Dado custo ponderado acima de zero e projeção disponível, quando o capítulo é gerado, então mostra a perda de patrimônio no ano da aposentadoria e no fim do horizonte. Esta última é igual ao `feeImpact` atual.
5. Dado qualquer carteira, quando o capítulo é gerado, então o bloco "O que o app não vê" aparece sem percentuais de mercado.

### H5. Múltiplo do custo nos três cenários
Como dono do plano, quero saber quantas vezes o meu custo mensal preciso ter ao me aposentar, já descontada a renda garantida, para ter uma meta de capital.
1. Dado o plano do dono, quando o capítulo é gerado, então custo, renda garantida e lacuna vêm do primeiro ano civil completo da Viabilidade, com a base indicada. Uma planilha que desconta as lacunas anuais exportadas da Viabilidade a 4% chega ao mesmo capital da Liberdade, com diferença de até 1 unidade da moeda [validar com o dono].
2. Dada uma projeção indisponível e `targetMonthlyIncome` 9.000 com benefício de 3.200, quando o capítulo é gerado, então a lacuna é 5.800, o múltiplo é sobre 9.000 e a base diz "renda desejada de Meu plano".
3. Dado cada caso de borda da tabela, quando o capítulo é gerado, então aparece o comportamento descrito.
4. Dado o capítulo, quando ele é exibido, então traz a nota sobre a regra dos 4%, a nota de risco com o link para Objetivos e as notas de reserva e objetivos fora do capital.

### H6. Caso ouro: reprodução do slide [calculado à mão, 5 algarismos]
Dado custo 30.000, lacuna 30.000 constante, r = 4%, K0 = 3.000.000, idade 40, aposentadoria 50, horizonte 85 e aporte atual 0, quando a função do domínio calcula, então:
1. i = 0,0032737 (± 1e-7), K0 × (1 + i)^120 = 4.440.733 e s_120 = 146,696.
2. Regra do 1%: K = 3.000.000, 100x, retirada de 12,0%, aporte 0 ("o capital atual já chega lá"). São 120 saques completos e o 121º é parcial: o dinheiro acaba aos 60.
3. Liberdade: K = 6.863.972 (± 50), 229x, retirada de 5,2%, aporte de 16.519/mês (± 2).
4. Legado: K = 9.193.840 (± 50), 306x, retirada de 3,9%, aporte de 32.401/mês (± 2).
5. O alvo não é arredondado antes do aporte. Com o alvo de 6.860.000 do slide, o aporte seria 16.492, que também é "16,5 mil".
6. Plano atual: K_proj = 4.440.733, 148x, retirada de 8,1%. São 201 saques completos (ä_n = 148,02, n ≈ 201,8): o dinheiro acaba aos 66.

Caso adaptado, com renda garantida de 10.000 desde os 50 (lacuna de 20.000): Regra do 1% com 2.000.000 e 67x, acabando aos 60. Liberdade com 4.575.981 e 153x, aporte de 922. Legado com 6.129.227 e 204x, aporte de 11.510.

Caso período-ponte, com renda de 10.000 só a partir dos 65 (180 meses de lacuna de 30.000, depois 20.000): Liberdade com 5.938.917 (± 50), 198x, retirada de 6,1%. Legado com 7.492.160 (± 50) e 250x.

### H7. Sensibilidade e plano atual
Como dono do plano, quero ver como a meta muda com a taxa, para não tratar 4% como certeza.
1. Dado lacuna constante de 30.000 e horizonte de 35 anos, quando a sensibilidade é gerada, então a Liberdade dá 262x, 229x e 202x, e o Legado 406x, 306x e 246x, para 3%, 4% e 5% [calculado].
2. Dado `annualRealReturn` = 0, quando a linha da taxa do plano é gerada, então a Liberdade dá 420x e o Legado mostra "sem capital finito".
3. Dado o plano com projeção oficial, quando a linha "Seu plano atual" é exibida, então o primeiro ano de insuficiência da Viabilidade aparece ao lado da idade calculada aqui, com a explicação de que a Viabilidade usa a taxa e o orçamento do plano.

## Fora de escopo

- Editar premissas no Panorama, gráficos interativos ou novos indicadores no Sumário.
- Série histórica de inflação para a janela exata do rendimento. TWR ou TIR da carteira.
- Distinguir "custo zero" de "custo não informado" com um campo novo (backlog).
- Imposto por país sobre o capital necessário, longevidade probabilística e regras dinâmicas de retirada (B6 e B8 de `indexacao-beneficios.md`).
- Mudar "Aporte necessário" de Meu plano (`projectRetirement`) ou o motor oficial.
- Atualizar a tabela de capítulos de `panorama-financeiro.md` antes da entrega. Ela muda junto com o código.

## Riscos

| Risco | Sinal | Mitigação |
|---|---|---|
| Três números de "aporte necessário" (Meu plano, este capítulo e as alavancas de Objetivos) | O dono pergunta qual vale | Cada um diz a premissa. Este capítulo diz "4% fixo, cenários de bolso" |
| Ler o realizado de ações como custo | Sinal de custo em renda variável | O sinal vale só para `cdi` e `nominal` |
| Contar duas vezes o 2º pilar (saldo na Carteira e renda no Orçamento) | Lacuna baixa e K0 alto | Pergunta 1. Mesmo risco já existe no motor oficial [fato] |
| O snapshot não chega ao worker | Realizado sempre "estimado" | Fallback rotulado. Teste H2.3 |
| PDF passa de 14 páginas | Teste de impressão | Tabelas compactas. Sensibilidade só com 4 linhas |

## Perguntas abertas para o dono

1. O saldo da caixa de pensão (BVK) está na Carteira e a renda dela também está no Orçamento? Se estiver nos dois, o capital atual e a renda garantida contam o mesmo dinheiro. Responsável: dono, antes de H5.
2. O capital atual deve incluir a previdência inteira (D9) ou só o que é resgatável antes da aposentadoria? [validar]
3. O aporte atual deve ser o "Aporte mensal" de Meu plano (D12) ou a poupança média do orçamento? [validar]
4. Os 4% devem continuar fixos, como no vídeo, ou a linha principal deve usar a taxa do plano, com 4% só na sensibilidade? [validar]
5. A renda garantida deve incluir todas as receitas ativas na aposentadoria, inclusive aluguel, ou só benefícios ("Aposentadoria e benefício")? [validar]
6. Os capítulos novos ficam antes do detalhe, com renumeração para 14 (D1 e D2), ou o dono prefere manter os números atuais e pôr os dois capítulos como seções dentro dos capítulos 6 e 10? [validar]
