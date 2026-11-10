import test from 'node:test'
import assert from 'node:assert/strict'
import { createExportableState } from '../src/app/state-storage.js'
import { setCurrency, setInflationSource, setMarketAssumptions, state } from '../src/app/state.js'
import { economicIndicatorsState, loadEconomicIndicators, reapplyMarketAssumptions } from '../src/app/economic-indicators-state.js'
import { bundledEconomicIndicators } from '../src/shared/economic-indicators.js'
import { marketInflationPath, trajectoryRate } from '../src/domain/market-assumptions.js'
import { resolveGrossInvestmentRealReturn } from '../src/domain/investment-returns.js'
import { projectRetirementWithSchedules } from '../src/domain/retirement.js'
import { retirementContributionSchedules } from '../src/domain/cash-flow.js'
import { renderPlan } from '../src/features/plan/plan.js'
import { marketIndicatorsView, marketRefreshMessage } from '../src/features/plan/market-indicators.js'
import { planWithReturns, renderInvestments } from '../src/features/investments/investments.js'
import { renderCashFlowTimeline, timelineView } from '../src/features/cash-flow/timeline.js'
import { cashFlowChartView, renderCashFlowLineChart } from '../src/shared/cash-flow-line-chart.js'
import { renderDashboard } from '../src/features/dashboard/dashboard.js'
import { formatMarketRate, inflationRateLabel } from '../src/shared/market-indicators.js'

// Synthetic data only. Snapshots are the embedded one (stale) and a fresh copy of it.
// No test touches the network: loadEconomicIndicators receives a fake fetch.
const today = new Date()
const year = today.getUTCFullYear()
const stale = structuredClone(bundledEconomicIndicators)
const fresh = structuredClone(bundledEconomicIndicators)
fresh.fetchedAt = today.toISOString()
for (const country of Object.values(fresh.countries)) Object.assign(country, { stale: false, fetchedAt: today.toISOString() })

const textOf = markup => markup.replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ')
const panelOf = html => html.match(/<section class="panel market-indicators"[\s\S]*?<\/section>/)[0]
const assumptionsForm = html => html.match(/<form class="panel investment-assumptions"[\s\S]*?<\/form>/)[0]
const trendsForm = html => html.match(/<form class="panel currency-trends"[\s\S]*?<\/form>/)[0]

function plan(currency, extra = {}) {
  return createExportableState({
    isDemo: false,
    currency,
    plan: {
      currentAge: 45, retirementAge: 65, targetAge: 90, horizonReferenceMonth: `${year}-01`, retirementMonth: `${year + 20}-01`,
      annualRealReturn: 0.03, annualInflation: 0.045,
      investments: [
        { id: 'cdb', name: 'CDB', assetClass: 'fixed-income', amount: 100000, monthlyContribution: 500, currency: 'BRL', liquidity: 'available', returnType: 'cdi', returnValue: 0.765, indexAnnualRate: 0.12 },
        { id: 'pre', name: 'Prefixado', assetClass: 'fixed-income', amount: 50000, monthlyContribution: 0, currency: 'BRL', liquidity: 'available', returnType: 'nominal', returnValue: 0.12 }
      ],
      finappMethod: { openingConfirmed: true, pensionConfirmed: true },
      ...extra
    },
    cashFlow: { referenceMonth: `${year}-01`, retirementMonth: `${year + 20}-01`, items: [] }
  })
}

function withState(next, run, { snapshot = null } = {}) {
  const before = structuredClone(state)
  const session = { ...economicIndicatorsState }
  const view = { ...marketIndicatorsView }
  try {
    Object.assign(state, next, { valuesHidden: false, dataDeleted: false })
    economicIndicatorsState.snapshot = snapshot
    economicIndicatorsState.loadedAt = snapshot ? today.toISOString() : null
    return run()
  } finally {
    for (const key of Object.keys(state)) delete state[key]
    Object.assign(state, before)
    Object.assign(economicIndicatorsState, session)
    Object.assign(marketIndicatorsView, view)
  }
}

test('painel no modo mercado: último dado mensal, taxas básicas, trajetória, Focus, fonte e explicação', () => {
  withState(plan('BRL'), () => {
    assert.equal(setMarketAssumptions(fresh, today), true)
    const panel = panelOf(renderPlan())
    const text = textOf(panel)
    assert.match(panel, /id="indicadores-mercado"/)
    assert.match(panel, /<input type="radio" name="inflationSource" value="market" data-inflation-source checked/)
    assert.doesNotMatch(panel, /value="manual" data-inflation-source checked/)
    assert.match(text, /Atualizar automaticamente pelo mercado \(recomendado\)/)
    assert.match(text, /Usar minhas premissas/)
    assert.match(text, /IPCA de setembro\/2026: 0,82% no mês, 4,58% em 12 meses\./)
    assert.match(text, /Selic, meta do Copom 13,75% ao ano/)
    assert.match(text, /CDI 13,65% ao ano/)
    assert.match(text, /Expectativas: Focus de 06\/11\/2026\./)
    assert.match(panel, /<a href="https:\/\/dadosabertos\.bcb\.gov\.br\/" target="_blank" rel="noreferrer">Banco Central do Brasil<span class="sr-only">, abre em nova aba<\/span><\/a>/)
    assert.match(text, /IPC de setembro\/2026: −0,04% no mês, 0,99% em 12 meses\./)
    assert.match(text, /SARON −0,04% ao ano/)
    assert.match(text, /Taxa básica do SNB 0,00% ao ano/)
    // Table of the trajectory: header, a Focus year, and the long run.
    assert.match(panel, /<caption>Trajetória usada nas projeções, Brasil<\/caption><thead><tr><th scope="col">Ano<\/th><th scope="col">Inflação \(IPCA\)<\/th><th scope="col">CDI<\/th>/)
    assert.match(panel, /<th scope="row">2030<\/th><td>3,94%<\/td><td>10,03%<\/td>/)
    assert.match(panel, /<th scope="row">Longo prazo, depois de 2030<\/th><td>3,94%<\/td><td>9,90%<\/td>/)
    assert.match(panel, /<th scope="row">Longo prazo, depois de 2027<\/th><td>0,75%<\/td>/)
    assert.match(text, /Inflação do plano \(BRL\): .*até 3,94% no longo prazo/)
    // Explanation: CMN target and market median.
    assert.match(panel, /<details class="disclosure"><summary>Por que não usar a inflação do último mês por 30 anos<\/summary>/)
    assert.match(text, /meta do CMN é 3,0% ao ano/)
    assert.match(text, /mediana do mercado/)
    assert.doesNotMatch(panel, /Desatualizado/)
    assert.match(panel, /<button type="button" class="button button--secondary" data-market-refresh aria-describedby="market-refresh-status">/)
    // The plan assumption shows the long run.
    assert.match(textOf(renderPlan()), /Inflação anual esperada 3,9% no longo prazo, de mercado/)
  }, { snapshot: fresh })
})

test('painel no modo manual: escolha marcada, trajetória fora das projeções e campos editáveis na Carteira', () => {
  withState(plan('BRL'), () => {
    setMarketAssumptions(fresh, today)
    setInflationSource('manual')
    state.plan.annualInflation = 0.05
    const panel = panelOf(renderPlan())
    assert.match(panel, /value="manual" data-inflation-source checked/)
    assert.match(textOf(panel), /Modo manual: as projeções usam a inflação do plano, de 5,0% ao ano/)
    assert.match(panel, /Trajetória de mercado, Brasil\. Fora das projeções no modo manual\./)
    const html = renderInvestments()
    const form = assumptionsForm(html)
    assert.match(form, /name="annualInflation" value="5" min="-99" max="100" step="0.1" required/)
    assert.doesNotMatch(form, /readonly/)
    assert.doesNotMatch(trendsForm(html), /readonly/)
    // Texts of the Carteira go back to the contract rates.
    assert.match(html, /76,5% do CDI de 12% resulta em/)
    assert.match(html, /O sistema não busca a taxa automaticamente/)
  }, { snapshot: fresh })
})

test('Carteira no modo mercado: inflação do plano e das moedas somente leitura, EUR e USD editáveis', () => {
  withState(plan('BRL'), () => {
    setMarketAssumptions(fresh, today)
    const html = renderInvestments()
    const form = assumptionsForm(html)
    assert.match(form, /name="annualInflation" value="3.935" readonly aria-describedby="annual-inflation-market-help"/)
    assert.match(form, /De mercado, longo prazo\./)
    assert.match(form, /href="\/plano\?review=field&amp;field=inflationSource" data-route/)
    const trends = trendsForm(html)
    assert.match(trends, /name="inflation:CHF" value="0.75" readonly aria-describedby="inflation-CHF-market-help"/)
    assert.match(trends, /name="inflation:EUR" min="-20" max="20" step="0.1" value="" placeholder="Do plano"/)
    assert.doesNotMatch(trends, /name="inflation:EUR"[^>]*readonly/)
    assert.match(textOf(trends), /CHF segue a inflação de mercado e fica somente leitura/)
    assert.match(html, /a projeção usa o CDI de cada ano: 13,65% em \d{4} até 9,90% no longo prazo/)
  }, { snapshot: fresh })
})

test('Carteira no modo mercado: CDI e nominal mostram o ano seguinte e o longo prazo', () => {
  withState(plan('BRL'), () => {
    setMarketAssumptions(fresh, today)
    const html = textOf(renderInvestments())
    const [cdb, pre] = state.plan.investments
    const next = year + 1
    const pct = rate => formatMarketRate(rate, 1)
    const cdiNext = resolveGrossInvestmentRealReturn(cdb, state.plan, next), cdiLong = resolveGrossInvestmentRealReturn(cdb, state.plan)
    assert.ok(cdiLong < cdiNext, 'O CDI de mercado cai no longo prazo')
    assert.ok(html.includes(`76,5% do CDI: real de ${pct(cdiNext)} em ${next}, caindo para ${pct(cdiLong)} no longo prazo (CDI de mercado)`), html.match(/76,5% do CDI[^.]*/)?.[0])
    const preNext = resolveGrossInvestmentRealReturn(pre, state.plan, next), preLong = resolveGrossInvestmentRealReturn(pre, state.plan)
    assert.ok(html.includes(`12% nominal: real de ${pct(preNext)} em ${next}, subindo para ${pct(preLong)} no longo prazo (inflação de mercado de BRL)`), html.match(/12% nominal[^.]*/)?.[0])
    assert.match(html, new RegExp(`com retorno real que varia por ano, de [\\d,]+% em ${year} a [\\d,]+% no longo prazo, por`))
    // The comparisons keep one rate per year: unchanged returns give the same projection.
    const schedules = retirementContributionSchedules(state.cashFlow, state.currency, state.exchangeRates, state.customCategories)
    const real = projectRetirementWithSchedules(state.plan, schedules).projectedAssets
    const rebuilt = projectRetirementWithSchedules(planWithReturns(rate => rate), schedules).projectedAssets
    assert.ok(Math.abs(real - rebuilt) <= 1e-6 * real, `${real} ≠ ${rebuilt}`)
  }, { snapshot: fresh })
})

test('selo "Desatualizado" com a data quando a fonte não respondeu', () => {
  withState(plan('BRL'), () => {
    setMarketAssumptions(stale, today)
    const panel = panelOf(renderPlan())
    assert.equal(panel.match(/<span class="market-badge">Desatualizado · dados de 06\/11\/2026<\/span>/g).length, 2)
    // Without the session snapshot, the saved stale flag still shows.
    economicIndicatorsState.snapshot = null
    const saved = panelOf(renderPlan())
    assert.equal(saved.match(/Desatualizado · dados de 06\/11\/2026/g).length, 2)
    assert.match(textOf(saved), /O último dado mensal e a taxa básica aparecem depois da próxima busca\./)
    marketIndicatorsView.status = 'success'
    economicIndicatorsState.snapshot = stale
    assert.match(marketRefreshMessage(), /uma fonte não respondeu/)
  }, { snapshot: stale })
})

test('valores ocultos: o painel mantém taxas e datas e não mostra dinheiro', () => {
  withState(plan('BRL'), () => {
    setMarketAssumptions(fresh, today)
    state.valuesHidden = true
    const html = renderPlan()
    const panel = panelOf(html)
    assert.match(html, /•/, 'O restante da tela oculta valores')
    assert.match(textOf(panel), /4,58% em 12 meses/)
    assert.match(textOf(panel), /13,75% ao ano/)
    assert.doesNotMatch(panel, /R\$|CHF \d|•/)
  }, { snapshot: fresh })
})

test('estado vazio: sem indicadores, o painel explica e oferece a busca', () => {
  withState(plan('BRL'), () => {
    const panel = textOf(panelOf(renderPlan()))
    assert.match(panel, /Ainda não recebemos os indicadores\. Até lá, as projeções usam a inflação do plano, de 4,5% ao ano\./)
    assert.match(panel, /Ainda não há indicadores neste plano\. Use “Atualizar agora”/)
    marketIndicatorsView.status = 'loading'
    const loading = panelOf(renderPlan())
    assert.match(loading, /aria-disabled="true"/)
    assert.match(textOf(loading), /Atualizando… Buscando os indicadores do Banco Central do Brasil e do Banco Nacional Suíço…/)
    marketIndicatorsView.status = 'error'
    assert.match(textOf(panelOf(renderPlan())), /Não foi possível buscar os indicadores agora\. As projeções continuam com as premissas anteriores\./)
  })
})

test('moeda EUR: o plano mantém a premissa digitada e o painel explica', () => {
  withState(plan('EUR', { annualInflation: 0.02 }), () => {
    setMarketAssumptions(fresh, today)
    assert.equal(state.plan.annualInflation, 0.02)
    assert.match(textOf(panelOf(renderPlan())), /Não há dados de mercado para EUR\. A inflação do plano continua sendo a sua premissa, de 2,0% ao ano/)
    // The plan inflation stays editable. The default return follows the portfolio
    // (read-only), which is a separate choice (tests/portfolio-return-ui.test.js).
    assert.doesNotMatch(assumptionsForm(renderInvestments()), /name="annualInflation"[^>]*readonly/)
  }, { snapshot: fresh })
})

test('troca de moeda reaplica as premissas de mercado com o snapshot da sessão', () => {
  withState(plan('BRL'), () => {
    setMarketAssumptions(fresh, today)
    assert.equal(state.plan.annualInflation, 0.03935)
    setCurrency('CHF')
    assert.equal(reapplyMarketAssumptions(() => today), true)
    assert.equal(state.plan.annualInflation, 0.0075)
    assert.equal(state.plan.inflationByCurrency.base, 'CHF')
    assert.equal(state.plan.inflationByCurrency.rates.BRL, 0.03935)
    economicIndicatorsState.snapshot = null
    assert.equal(reapplyMarketAssumptions(() => today), false)
  }, { snapshot: fresh })
})

test('busca com fetch simulado: sucesso guarda o snapshot e falha mantém as premissas', async () => {
  const before = structuredClone(state)
  const session = { ...economicIndicatorsState }
  try {
    Object.assign(state, plan('BRL'))
    economicIndicatorsState.snapshot = null
    const calls = []
    const ok = async url => { calls.push(url); return { ok: true, json: async () => fresh } }
    assert.equal(await loadEconomicIndicators(ok, () => today), true)
    assert.deepEqual(calls, ['/api/economic-indicators'])
    assert.ok(economicIndicatorsState.snapshot.countries.BR)
    const applied = structuredClone(state.plan.marketAssumptions)
    const failed = async () => ({ ok: false, json: async () => ({}) })
    assert.equal(await loadEconomicIndicators(failed, () => today), false)
    assert.deepEqual(state.plan.marketAssumptions, applied)
  } finally {
    for (const key of Object.keys(state)) delete state[key]
    Object.assign(state, before)
    Object.assign(economicIndicatorsState, session)
  }
})

test('visão nominal da Evolução patrimonial é exata com a trajetória: renda fixa aparece com o valor do contrato', () => {
  const next = plan('CHF', { investments: [{ id: 'cash', name: 'Caixa', amount: 400000, currency: 'CHF', assetClass: 'cash', liquidity: 'available', returnType: 'real', returnValue: 0.02 }] })
  next.cashFlow.items = [{ id: 'bvg', type: 'income', categoryId: 'pension', description: 'Caixa de pensão', amount: 2500, currency: 'CHF', frequency: 'monthly', startDate: `${year + 20}-01-01`, endDate: null, source: 'manual', recordKind: 'planned', indexation: 'fixed' }]
  const view = { ...timelineView }, chart = { ...cashFlowChartView }
  try {
    withState(next, () => {
      setMarketAssumptions(fresh, today)
      timelineView.period = 'target'
      cashFlowChartView.basis = 'nominal'
      const html = renderCashFlowTimeline({ part: 'annual' })
      const table = html.match(/<caption>CHF · Valores nominais de cada ano<\/caption>[\s\S]*?<\/table>/g).find(markup => markup.includes('Receitas previstas'))
      for (const target of [year + 25, year + 40]) {
        const row = table.match(new RegExp(`<tr><th scope="row">${target}</th><td>([^<]*)</td>`))[1]
        assert.match(row.replace(/\s+/g, ' '), /^CHF 30\.000 /, `${target}: ${row}`)
      }
      const path = marketInflationPath(state.plan, 'CHF')
      const label = `Inflação variável por ano: inflação de mercado, ${formatMarketRate(trajectoryRate(path, year), 1)} em ${year} até 0,8% no longo prazo`
      assert.ok(textOf(html).includes(label), textOf(html).match(/Inflação variável[^.]*/)?.[0])
      assert.match(textOf(html), /Cada ano inclui a inflação acumulada da trajetória de mercado\./)
      assert.match(textOf(html), /o índice acumulado multiplica \(1 \+ inflação de cada ano\)/)
    })
  } finally {
    Object.assign(timelineView, view)
    Object.assign(cashFlowChartView, chart)
  }
})

test('rótulo da taxa nos gráficos: varia por ano com dados de mercado, constante sem eles', () => {
  withState(plan('BRL'), () => {
    assert.equal(inflationRateLabel(state.plan, 'BRL', 2026), 'Inflação anual do plano: 4,5%')
    setMarketAssumptions(fresh, new Date('2026-11-10T12:00:00Z'))
    assert.equal(inflationRateLabel(state.plan, 'BRL', 2026), 'Inflação variável por ano: inflação de mercado, 5,2% em 2026 até 3,9% no longo prazo')
    const rows = [{ year: '2026', months: 12, income: 1000, costs: 500, goals: 0, pensionCredits: 0, freeCashFlow: 500 }, { year: '2027', months: 12, income: 1000, costs: 500, goals: 0, pensionCredits: 0, freeCashFlow: 500 }]
    const chart = renderCashFlowLineChart({ rows, plan: state.plan, cashFlow: state.cashFlow, currency: 'BRL', baseYear: 2026 })
    assert.match(textOf(chart), /Inflação variável por ano: inflação de mercado, 5,2% em 2026 até 3,9% no longo prazo\./)
    setInflationSource('manual')
    assert.match(inflationRateLabel(state.plan, 'BRL', 2026), /^Inflação anual do plano: /)
  }, { snapshot: fresh })
})

test('Visão geral: indicador discreto com a data das premissas e link para o painel', () => {
  withState(plan('BRL'), () => {
    assert.doesNotMatch(renderDashboard(), /data-market-assumptions-note/)
    setMarketAssumptions(fresh, today)
    const html = renderDashboard()
    assert.match(html, /<p class="market-assumptions-note" data-market-assumptions-note>Premissas de mercado de 06\/11\/2026\. <a href="\/plano\?review=field&amp;field=inflationSource" data-route>Ver inflação e juros de mercado<\/a><\/p>/)
    assert.match(textOf(html), /inflação de mercado, [\d,]+% em \d{4} até 3,9% no longo prazo/)
    setMarketAssumptions(stale, today)
    assert.match(renderDashboard(), /Premissas de mercado de 06\/11\/2026, desatualizadas\./)
  }, { snapshot: fresh })
})
