# Indicadores de mercado: inflação e juros nas projeções

Status: backend e domínio entregues no branch `feat/indicadores-inflacao` (2026-11-10). A interface fica para a etapa seguinte.

## Objetivo

As projeções usavam uma inflação fixa por moeda, digitada pela pessoa, e um CDI fixo por investimento. Agora o app busca a inflação e os juros publicados pelos bancos centrais do Brasil e da Suíça e monta uma trajetória por ano. A regra segue a prática usual de planejamento: expectativas de mercado no curto prazo e uma âncora no longo prazo. O último dado mensal nunca é estendido por 30 anos.

## Fontes

Todas são públicas, sem chave. O servidor só acrescenta parâmetros derivados do relógio (`fromDate`). Nenhum dado da pessoa sai do servidor.

| País | Indicador | Fonte | Uso |
|---|---|---|---|
| BR | IPCA mensal, % | BCB SGS série 433 | Informativo (`cpi.monthly`) |
| BR | IPCA 12 meses, % | BCB SGS série 13522 | Informativo (`cpi.yoy`) |
| BR | CDI anualizado, % a.a. (diário) | BCB SGS série 4389 | CDI do ano corrente |
| BR | Meta Selic, % a.a. | BCB SGS série 432 | Informativo (`policyRate`) |
| BR | Focus, mediana anual do IPCA | BCB Olinda `ExpectativasMercadoAnuais`, `Indicador eq 'IPCA'`, `baseCalculo eq 0` | Inflação por ano |
| BR | Focus, mediana da Selic de fim de ano | Mesma API, `Indicador eq 'Selic'` | CDI por ano |
| CH | IPC: variação anual (`VVP`) e índice (`LD2010100`) | SNB data portal, cubo `plkopr` (CSV) | Inflação do ano corrente e do seguinte |
| CH | Taxa básica do SNB (`LZ`) e SARON | SNB data portal, cubo `snbgwdzid` (CSV) | Informativo |

URLs:

- SGS: `https://api.bcb.gov.br/dados/serie/bcdata.sgs.{N}/dados/ultimos/{k}?formato=json`. A ordem das linhas não é garantida (a 4389 vem da mais nova para a mais antiga), por isso os pontos são ordenados por data. A série 432 é publicada até a próxima reunião do Copom, com datas futuras: vale o último ponto até hoje.
- Focus: `https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$top=40&$format=json&$orderby=Data%20desc&$filter=Indicador%20eq%20'IPCA'%20and%20baseCalculo%20eq%200&$select=Indicador,Data,DataReferencia,Mediana`. A URL precisa de `%20` e das aspas literais, senão o servidor responde 400 "URI malformed". Só as linhas da `Data` mais recente são usadas.
- SNB: `https://data.snb.ch/api/cube/plkopr/data/csv/en?fromDate=AAAA-MM` (14 meses atrás) e `https://data.snb.ch/api/cube/snbgwdzid/data/csv/en?fromDate=AAAA-MM-DD` (45 dias atrás). O CSV tem BOM, CRLF, separador `;` e algumas linhas de cabeçalho antes de `"Date";"D0";"Value"`. Valores vazios são ignorados. Sem `fromDate`, o cubo diário tem cerca de 1 MB.

Todas as taxas são guardadas em **decimal** (4,58% = 0,0458). A conversão de % para decimal arredonda em 10 casas decimais só para tirar o ruído binário (0,82 / 100). Isso não é arredondamento de exibição.

## Regras da trajetória

Notação: π(moeda, ano) é a inflação do ano. `baseYear` é o ano corrente (UTC) no momento da aplicação.

### Inflação do Brasil (BRL)

- Anos do Focus, como estão: π(BRL, Y) = mediana do Focus para Y, para os anos a partir do ano corrente.
- longRun = mediana do último ano do Focus.
- Referência: a meta contínua do CMN é **3,0%** (constante `brazilInflationTarget`). O mercado está acima dela: em 06/11/2026 a mediana para 2030 é 3,935%. O app usa a mediana do mercado, não a meta, porque ela é a melhor estimativa pública do que vai acontecer. A meta fica registrada para comparação.

### CDI (BRL)

- Ano corrente: o CDI atual (SGS 4389).
- Anos seguintes: CDI médio de Y ≈ (Selic de fim de Y−1 + Selic de fim de Y) / 2 − 0,10 p.p. A média dos dois fins de ano aproxima a Selic média do ano. O CDI costuma ficar 0,10 p.p. abaixo da meta Selic (constante `cdiSelicSpread`).
- longRun = Selic de fim do último ano do Focus − 0,10 p.p.

### Inflação da Suíça (CHF)

- Ano corrente: a variação anual mais recente do IPC.
- Ano seguinte: média entre essa variação e o longRun.
- Depois: longRun = **0,75%** (constante exportada `swissLongRunInflation`). Hipótese documentada: meio da faixa histórica e do intervalo de estabilidade de preços do SNB, de 0% a 2%. Não é previsão.

### EUR e USD

Sem dados de mercado. Seguem as regras atuais: a inflação salva da moeda (`inflationByCurrency`), ou a inflação do plano.

### Exemplo com os números de 06/11/2026 (base 2026)

| Ano | IPCA (Focus) | Selic fim de ano | CDI usado | Inflação CH |
|---|---|---|---|---|
| 2026 | 5,2195% | 13,75% | 13,65% (atual) | 0,99% |
| 2027 | 4,9005% | 12,50% | (13,75 + 12,50) / 2 − 0,10 = 13,025% | (0,99 + 0,75) / 2 = 0,87% |
| 2028 | 4,00% | 11,00% | 11,65% | 0,75% |
| 2029 | 4,00% | 10,25% | 10,525% | 0,75% |
| 2030 | 3,935% | 10,00% | 10,025% | 0,75% |
| depois | 3,935% | | 9,90% | 0,75% |

## Uso nas projeções

`inflationFor(plan, moeda, ano)` e `cdiFor(plan, ano, reserva)` devolvem a taxa do ano pela trajetória e, depois do último ano, o longRun. Sem ano, o longRun. Sem `marketAssumptions` ou com `inflationSource: 'manual'`, valem as regras de antes (`annualInflation`, `inflationByCurrency`, `indexAnnualRate`).

Retorno real dos investimentos (`resolveInvestmentRealReturn(investment, plan, year)`):

- `cdi`: nominal(Y) = returnValue × CDI(Y); real = (1 + nominal) / (1 + π(moeda do saldo, Y)) − 1.
- `nominal`: real = (1 + returnValue) / (1 + π(moeda do saldo, Y)) − 1.
- `real`, `ipca`, `default` e os retornos anuais informados (`annualRealReturns`): inalterados. Custo anual e tendência cambial: inalterados.
- Exemplo: CDB a 76,5% do CDI em 2027 rende (1 + 0,765 × 0,13025) / 1,049005 − 1 = 4,83% real ao ano antes do custo anual.

**Correção de comportamento.** Antes, o CDI deflacionava pela inflação do plano mesmo com o saldo em outra moeda. Agora usa a inflação da moeda do saldo, com a do plano como reserva, igual ao retorno nominal. Isso vale também sem dados de mercado: muda o resultado de investimentos CDI com moeda diferente da do plano e taxa salva em `inflationByCurrency`. Nos demais casos o resultado é idêntico.

`resolveInvestmentNominalReturn` é coerente: CDI do ano com a taxa, nominal contratado com a taxa, e os tipos reais convertidos pela inflação da moeda do plano no ano.

Todos os motores passam o ano: projeção anual (`annual-investment-projection`, `finapp-viability`), `retirement.js` (acumulação mês a mês), pós-aposentadoria, objetivos (via projeção anual) e risco. No Monte Carlo (`risk-plan.js`), com dados de mercado, cada ano simulado recebe a taxa daquele ano em `annualRealReturns`. As chamadas sem ano que restam (validação e o resumo da Carteira) usam o longRun.

### Renda fixa nominal e visão nominal

Renda com reajuste "Valor fixo" (`fixedIncomeIndexation`) passa a usar o índice acumulado da trajetória da moeda do lançamento:

índice(Y) = Π (1 + π(moeda, k)) para k de baseYear + 1 até Y; valor real = valor do contrato / índice(Y).

O ano-base nunca entra (fator 1), a mesma convenção de `(1 + π)^(Y − baseYear)`. A visão nominal (`annualRowsInPriceBasis`) aceita a mesma trajetória (`inflationPath`, obtida com `priceBasisInflation(plan, moeda)`) e multiplica pelo mesmo índice. Assim, uma renda fixa na moeda do plano aparece na visão nominal exatamente com o valor do contrato.

## Aplicação no plano

`applyMarketAssumptions(plan, snapshot, hoje, { currency })` devolve um novo plano, só quando `plan.inflationSource !== 'manual'` (padrão: mercado):

- grava `plan.marketAssumptions = { asOf, fetchedAt, baseYear, stale, byCurrency: { BRL: { inflation: { years, longRun }, cdi: { years, longRun }, asOf, stale }, CHF: { inflation, asOf, stale } }, source: 'market' }`;
- `plan.annualInflation` = longRun da moeda do plano (se BRL ou CHF);
- `plan.inflationByCurrency.rates[outra moeda]` = longRun dela;
- não toca nos campos contratuais dos investimentos (`returnType`, `returnValue`, `annualFee`, `indexAnnualRate`);
- é idempotente.

No modo manual, as premissas de mercado já salvas ficam guardadas e são ignoradas pelos cálculos.

## Servidor

`GET /api/economic-indicators` (`src/server/economic-indicators.mjs`, registrado em `scripts/dev-server.mjs`):

- tempo limite de 6 s por fonte; cache de 12 h por país;
- falha parcial por país: um país indisponível não derruba o outro;
- falha de um país: mantém o último dado obtido, marcado `stale`, ou o snapshot embutido (06/11/2026), marcado `stale` e com a data; tenta de novo depois de 10 minutos;
- resposta sanitizada por lista de permissão (`sanitizeEconomicIndicators`): `{ fetchedAt, countries: { BR: { currency, asOf, fetchedAt, cpi: { lastMonth, monthly, yoy }, policyRate, cdi, expectations: { asOf, inflation, policyRateYearEnd }, source, sourceUrl, stale }, CH: { currency, asOf, fetchedAt, cpi, policyRate, saron, source, sourceUrl, stale } } }`;
- `fetchedAt` de topo é a busca mais antiga entre os países, e é nulo enquanto algum país usa o snapshot embutido.

## Cliente

`src/app/economic-indicators-state.js`:

- `loadEconomicIndicators(fetchImpl)`: busca, sanitiza e aplica pelo `setMarketAssumptions` do estado. Falhas são ignoradas. Devolve `true` só quando o plano mudou;
- `shouldRefresh(plan, agora)`: `true` sem `marketAssumptions` ou com `fetchedAt` (ou `asOf`, se `fetchedAt` for nulo) com mais de 24 h; `false` no modo manual;
- `economicIndicatorsState.snapshot`: último snapshot recebido na sessão, para telas que mostram fonte, data e "desatualizado".

`src/main.js` chama `loadEconomicIndicators` depois de abrir o plano, sem bloquear a renderização, só quando `shouldRefresh`. A atualização não conta como edição: não muda `lastUpdatedAt` nem `isDemo` e não tira foto do patrimônio. Só a Visão geral é redesenhada, para não apagar formulários em edição.

## Persistência

`plan.marketAssumptions` e `plan.inflationSource` (`'market' | 'manual'`) são sanitizados em `state-storage.js` (anos de 2000 a 2199, taxas de −0,2 a 1, até 30 anos por trajetória) e passam por exportação, importação, cenários e sincronização. Ausentes, o comportamento é o de antes e o plano salvo não ganha campos. `stateVersion` não mudou.

## Limitações conhecidas

- O Focus vai até 4 anos à frente; depois disso tudo é longRun. Choques de inflação não são modelados.
- O CDI médio do ano é uma aproximação pela média de dois fins de ano.
- A inflação suíça de longo prazo (0,75%) é hipótese, não expectativa de mercado.
- Um país em `stale` com dado já obtido continua no plano até a próxima atualização bem-sucedida.
- Ao trocar a moeda do plano para EUR ou USD, `annualInflation` guarda o longRun da moeda anterior até a próxima aplicação.
- Carregar um cenário antigo traz as premissas daquele dia; a próxima atualização (24 h) as substitui.
- `post-retirement.js` calcula `nominalAssets` com a inflação constante do plano. O campo não é usado em nenhuma tela.
