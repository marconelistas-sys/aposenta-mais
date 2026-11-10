import test from 'node:test'
import assert from 'node:assert/strict'
import { createExportableState } from '../src/app/state-storage.js'
import { setDefaultReturnSource, setMarketAssumptions, state, upsertInvestment } from '../src/app/state.js'
import { economicIndicatorsState } from '../src/app/economic-indicators-state.js'
import { bundledEconomicIndicators } from '../src/shared/economic-indicators.js'
import { derivedDefaultReturn, returnSourceLimits } from '../src/domain/portfolio-return.js'
import { buildFinancialReport } from '../src/domain/financial-report.js'
import { renderInvestments } from '../src/features/investments/investments.js'
import { renderDashboard } from '../src/features/dashboard/dashboard.js'
import { renderPlan } from '../src/features/plan/plan.js'
import { renderViabilityPremises } from '../src/features/plan/viability.js'
import { renderGuidedPlan } from '../src/features/welcome/guided-plan.js'
import { renderSimulations } from '../src/features/simulations/simulations.js'
import { clearScenarioEditor, simulationInputFromData } from '../src/features/simulations/scenario-editor.js'
import { renderReportDocument, renderReportScreen } from '../src/features/report/report-view.js'
import { defaultReturnOriginNote, rateTone, returnSourceHtml } from '../src/shared/portfolio-return.js'
import { formatMarketRate } from '../src/shared/market-indicators.js'

// Synthetic plans only. The market snapshot is the embedded one (Focus of
// 06/11/2026), marked fresh. No test touches the network.
const today = new Date()
const year = today.getUTCFullYear()
const fresh = structuredClone(bundledEconomicIndicators)
fresh.fetchedAt = today.toISOString()
for (const country of Object.values(fresh.countries)) Object.assign(country, { stale: false, fetchedAt: today.toISOString() })

const textOf = markup => markup.replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ')
const panelOf = html => html.match(/<section class="panel portfolio-return"[\s\S]*?<\/section>/)[0]
const assumptionsForm = html => html.match(/<form class="panel investment-assumptions"[\s\S]*?<\/form>/)[0]
const cards = html => [...html.matchAll(/<article class="investment-card">[\s\S]*?<\/article>/g)].map(match => match[0])

const contract = { label: 'Contrato <CDB> do banco', url: 'https://banco.example/cdb?a=1&b=2', asOf: '2026-11-01', note: 'Liquidez diária' }
function plan(extra = {}, investments = null) {
  return createExportableState({
    isDemo: false,
    currency: 'BRL',
    plan: {
      currentAge: 45, retirementAge: 65, targetAge: 90, horizonReferenceMonth: `${year}-01`, retirementMonth: `${year + 20}-01`,
      annualRealReturn: 0.05, annualInflation: 0.045,
      investments: investments || [
        { id: 'cdb', name: 'CDB', assetClass: 'fixed-income', amount: 100000, monthlyContribution: 500, currency: 'BRL', liquidity: 'available', returnType: 'cdi', returnValue: 0.765, indexAnnualRate: 0.12, returnSource: contract },
        { id: 'poupanca', name: 'Poupança', assetClass: 'cash', amount: 20000, monthlyContribution: 0, currency: 'BRL', liquidity: 'available', returnType: 'nominal', returnValue: 0.068 },
        { id: 'prev', name: 'Previdência', assetClass: 'pension', amount: 150000, monthlyContribution: 0, currency: 'BRL', liquidity: 'restricted', returnType: 'ipca', returnValue: 0.04 },
        { id: 'resto', name: 'Outros', assetClass: 'other', amount: 10000, monthlyContribution: 0, currency: 'BRL', liquidity: 'restricted', returnType: 'default', returnValue: null }
      ],
      finappMethod: { openingConfirmed: true, pensionConfirmed: true },
      ...extra
    },
    cashFlow: { referenceMonth: `${year}-01`, retirementMonth: `${year + 20}-01`, items: [] }
  })
}

function withState(next, run, { market = true, hidden = false } = {}) {
  const before = structuredClone(state)
  const session = { ...economicIndicatorsState }
  try {
    Object.assign(state, next, { valuesHidden: false, dataDeleted: false })
    economicIndicatorsState.snapshot = market ? fresh : null
    if (market) setMarketAssumptions(fresh, today)
    state.valuesHidden = hidden
    return run()
  } finally {
    for (const key of Object.keys(state)) delete state[key]
    Object.assign(state, before)
    Object.assign(economicIndicatorsState, session)
    clearScenarioEditor()
  }
}

test('Carteira: bloco do rendimento com ano seguinte, longo prazo, líquidos, trajetória e data das premissas', () => {
  withState(plan(), () => {
    const panel = panelOf(renderInvestments())
    const text = textOf(panel)
    assert.match(panel, /<h2 id="portfolio-return-title">Rendimento da carteira \(fontes oficiais\)<\/h2>/)
    assert.match(text, new RegExp(`Retorno real médio, ponderado pelo saldo\\. Longo prazo: a partir de \\d{4} Investimentos Em ${year + 1} Longo prazo`))
    assert.match(text, /Toda a carteira [−\d,]+% [−\d,]+% Só os líquidos [−\d,]+% [−\d,]+%/)
    assert.match(text, new RegExp(`Trajetória da carteira toda: ${year + 1}: [\\d,]+% · ${year + 2}: [\\d,]+% · .*longo prazo: [\\d,]+% ?\\.`))
    assert.match(text, /Premissas de mercado de 06\/11\/2026\. CDI e inflação vêm do Banco Central do Brasil \(Focus\) e do Banco Nacional Suíço/)
    // The default return in use is the derived one, not the 5% of the fixture.
    const derived = derivedDefaultReturn(state.plan)
    assert.equal(state.plan.annualRealReturn, derived)
    assert.match(text, new RegExp(`Retorno padrão do plano: ${formatMarketRate(derived, 1)} real ao ano, derivado da carteira \\(média dos investimentos líquidos, longo prazo\\)`))
    // Poupança and Previdência have no source of their own: the CDI one has a contract,
    // the nominal one shows the official index, so only Previdência counts as missing.
    assert.match(text, /1 investimento está sem fonte informada/)
  })
})

test('Carteira: cada cartão mostra a fonte, com link seguro em nova aba, data e observação', () => {
  withState(plan(), () => {
    const [cdb, poupanca, prev, resto] = cards(renderInvestments())
    const source = cdb.match(/<p class="investment-return-source__origin"[^>]*>([\s\S]*?)<\/p>/)[1]
    assert.match(cdb, /76,5% do CDI: real de [\d,]+% em \d{4}, caindo para [\d,]+% no longo prazo \(CDI de mercado\)/)
    assert.match(source, /^Fonte: <a href="https:\/\/banco\.example\/cdb\?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">Contrato &lt;CDB&gt; do banco<span class="sr-only">, abre em nova aba<\/span><\/a>, de 01\/11\/2026\. Liquidez diária\.$/)
    assert.match(textOf(poupanca), /Fonte do índice: Banco Central do Brasil: inflação pela mediana do IPCA no Focus , abre em nova aba , de 06\/11\/2026\./)
    assert.match(poupanca, /rel="noopener noreferrer"/)
    assert.match(textOf(prev), /Fonte não informada\./)
    assert.match(textOf(resto), /o retorno padrão do plano \(derivado da carteira\).*Usa o retorno padrão do plano\./)
  })
})

test('Carteira: retorno padrão derivado fica somente leitura e explica a origem', () => {
  withState(plan(), () => {
    const form = assumptionsForm(renderInvestments())
    assert.match(form, /<legend>Retorno real padrão do plano<\/legend>/)
    assert.match(form, /value="portfolio" data-default-return-source checked/)
    assert.doesNotMatch(form, /value="manual" data-default-return-source checked/)
    assert.match(form, /name="defaultRealReturn" value="[\d.]+" readonly aria-describedby="default-return-help"/)
    assert.match(textOf(form), /Retorno padrão: [\d,]+% real, derivado da carteira \(média dos investimentos líquidos, longo prazo\)\. Para digitar outra taxa, escolha “Informar manualmente”\./)
    // Inflation follows the market too: nothing to save, so no submit button.
    assert.doesNotMatch(form, /type="submit"/)
  })
})

test('Carteira: modo manual deixa o campo editável e as telas dizem que a taxa é informada', () => {
  withState(plan(), () => {
    const derived = state.plan.annualRealReturn
    setDefaultReturnSource('manual')
    assert.equal(state.plan.defaultReturnSource, 'manual')
    assert.equal(state.plan.annualRealReturn, derived, 'ir para o manual mantém o último valor')
    const form = assumptionsForm(renderInvestments())
    assert.match(form, /value="manual" data-default-return-source checked/)
    assert.match(form, /name="defaultRealReturn" value="[\d.]+" min="-99" max="100" step="0.1" required/)
    assert.doesNotMatch(form, /name="defaultRealReturn"[^>]*readonly/)
    assert.match(form, /type="submit">Salvar premissas/)
    assert.match(textOf(panelOf(renderInvestments())), /Retorno padrão do plano: [\d,]+% real ao ano, informado manualmente\./)
    assert.match(textOf(renderPlan()), /Retorno padrão [\d,]+% informado manualmente, para investimentos sem taxa própria/)
    assert.match(textOf(renderViabilityPremises()), /Taxa real global do plano \(retorno padrão\): [\d,]+%, informado manualmente\./)
    setDefaultReturnSource('portfolio')
    assert.equal(state.plan.annualRealReturn, derivedDefaultReturn(state.plan))
  })
})

test('sem dados de mercado e sem fonte salva: retorno padrão manual, como antes', () => {
  withState(plan(), () => {
    const form = assumptionsForm(renderInvestments())
    assert.match(form, /value="manual" data-default-return-source checked/)
    assert.equal(state.plan.annualRealReturn, 0.05)
    assert.match(textOf(panelOf(renderInvestments())), /Sem premissas de mercado em uso: CDI e inflação seguem as taxas informadas nesta página/)
  }, { market: false })
})

test('fonte da carteira sem investimento com taxa própria: mantém o último valor e diz por quê', () => {
  const onlyDefault = [{ id: 'resto', name: 'Outros', assetClass: 'other', amount: 10000, monthlyContribution: 0, currency: 'BRL', liquidity: 'available', returnType: 'default', returnValue: null }]
  withState(plan({}, onlyDefault), () => {
    assert.equal(state.plan.annualRealReturn, 0.05)
    const html = renderInvestments()
    assert.match(textOf(assumptionsForm(html)), /Nenhum investimento com saldo tem taxa própria para derivar o retorno da carteira, então vale o último valor salvo/)
    assert.match(textOf(panelOf(html)), /último valor salvo/)
  })
})

test('estado vazio: sem investimentos, o bloco orienta o cadastro', () => {
  withState(plan({}, []), () => {
    const text = textOf(panelOf(renderInvestments()))
    assert.match(text, /Cadastre investimentos com saldo para ver o rendimento da carteira e a fonte de cada taxa\./)
    assert.match(text, /Retorno padrão do plano: 5,0% real ao ano/)
  }, { market: false })
})

test('retorno real negativo aparece com sinal e tom negativo; zero é neutro', () => {
  assert.equal(rateTone(-0.005), 'negative')
  assert.equal(rateTone(0.0004), 'zero')
  assert.equal(rateTone(-0.0004), 'zero')
  assert.equal(rateTone(0.02), 'positive')
  const negative = [{ id: 'conta', name: 'Conta', assetClass: 'cash', amount: 10000, monthlyContribution: 0, currency: 'BRL', liquidity: 'available', returnType: 'real', returnValue: -0.005 }]
  withState(plan({}, negative), () => {
    const html = renderInvestments()
    assert.match(panelOf(html), /<span class="rate-value" data-tone="negative">−0,5%<\/span>/)
    assert.doesNotMatch(panelOf(html), /data-tone="(positive|zero)">−/)
    assert.match(cards(html)[0], /<span class="rate-value" data-tone="negative">−0,5%<\/span> real ao ano/)
  }, { market: false })
})

test('valores ocultos: o bloco mantém taxas e datas e não mostra dinheiro', () => {
  withState(plan(), () => {
    const panel = panelOf(renderInvestments())
    assert.match(panel, /data-tone="positive">[\d,]+%/)
    assert.match(textOf(panel), /Premissas de mercado de 06\/11\/2026/)
    assert.doesNotMatch(panel, /R\$/)
  }, { hidden: true })
})

test('formulário do investimento: fonte opcional com os limites do domínio, salva e removida', () => {
  withState(plan(), () => {
    const html = renderInvestments()
    assert.match(html, /<legend>Fonte do rendimento, opcional<\/legend>/)
    assert.match(html, new RegExp(`name="returnSourceLabel" maxlength="${returnSourceLimits.label}"`))
    assert.match(html, new RegExp(`type="url" name="returnSourceUrl" maxlength="${returnSourceLimits.url}"`))
    assert.match(html, /type="date" name="returnSourceAsOf"/)
    assert.match(html, new RegExp(`name="returnSourceNote" rows="2" maxlength="${returnSourceLimits.note}"`))
    const base = { id: 'prev', name: 'Previdência', assetClass: 'pension', amount: 150000, monthlyContribution: 0, currency: 'BRL', liquidity: 'restricted', returnType: 'ipca', returnValue: 0.04, balanceAsOf: today.toISOString().slice(0, 10) }
    assert.throws(() => upsertInvestment({ ...base, returnSource: { label: 'Regulamento', url: 'http://inseguro.example' } }), /https:\/\//)
    upsertInvestment({ ...base, returnSource: { label: 'Regulamento do plano', url: '', asOf: '2026-10-01', note: '' } })
    assert.deepEqual(state.plan.investments.find(item => item.id === 'prev').returnSource, { label: 'Regulamento do plano', asOf: '2026-10-01' })
    assert.match(textOf(cards(renderInvestments())[2]), /Fonte: Regulamento do plano, de 01\/10\/2026\./)
    upsertInvestment({ ...base, returnSource: { label: '', url: '', asOf: '', note: '' } })
    assert.equal(state.plan.investments.find(item => item.id === 'prev').returnSource, undefined)
  })
})

test('Visão geral e Meu plano: retorno da carteira com longo prazo, origem e link para a Carteira', () => {
  withState(plan(), () => {
    const dashboard = renderDashboard()
    const line = dashboard.match(/<p data-dashboard-return>([\s\S]*?)<\/p>/)[1]
    assert.match(textOf(line), new RegExp(`^Retorno da carteira de [\\d,]+% real em ${year + 1} e [\\d,]+% no longo prazo, com CDI e inflação de fontes oficiais \\(Banco Central do Brasil e Banco Nacional Suíço\\)\\. Retorno padrão de [\\d,]+%, derivado da carteira, para investimentos sem taxa própria; inflação de mercado`))
    assert.match(line, /<a href="\/carteira" data-route>Ver o rendimento na Carteira<\/a>/)
    const planText = textOf(renderPlan())
    assert.match(planText, new RegExp(`Retorno da carteira [\\d,]+% em ${year + 1} · [\\d,]+% no longo prazo real ao ano, com CDI e inflação de fontes oficiais`))
    assert.match(planText, /Retorno padrão [\d,]+% derivado da carteira, para investimentos sem taxa própria/)
    assert.doesNotMatch(planText, /Retorno real anual/)
    assert.match(textOf(renderViabilityPremises()), /Taxa real global do plano \(retorno padrão\): [\d,]+%, derivado da carteira \(média dos investimentos líquidos, longo prazo\)\./)
    assert.match(textOf(defaultReturnOriginNote(state.plan)).trim(), /^Retorno real padrão do plano: [\d,]+% ao ano, derivado da carteira/)
  })
})

test('plano guiado: rótulo coerente com a origem do retorno padrão', () => {
  withState(plan(), () => {
    const html = renderGuidedPlan('objetivo')
    assert.match(html, /Retorno real padrão \(%\), derivado da carteira/)
    assert.match(textOf(html), /Digitar outro valor passa a usar a sua taxa, informada manualmente\./)
    setDefaultReturnSource('manual')
    assert.match(renderGuidedPlan('objetivo'), /Retorno real padrão informado \(%\)/)
  })
})

test('simulações: o plano atual indica a origem; mudar o retorno grava o cenário como manual', () => {
  withState(plan(), () => {
    const html = renderSimulations()
    assert.match(html, /Retorno real padrão anual/)
    assert.match(textOf(html), /Hoje, derivado da carteira\. Vale para investimentos sem taxa própria\. Outro valor passa a valer só neste cenário, como taxa informada\./)
    const form = new Map(Object.entries({ currentAge: '45', retirementAge: '65', currentAssets: String(state.plan.currentAssets), monthlyContribution: String(state.plan.monthlyContribution), targetMonthlyIncome: '8000', expectedMonthlyBenefit: '0', annualRealReturn: String(state.plan.annualRealReturn * 100), annualInflation: '4.5', annualWithdrawalRate: '4' }))
    const same = simulationInputFromData(form)
    assert.equal(same.defaultReturnSource, undefined, 'mesmo retorno: o cenário continua seguindo a origem do plano')
    form.set('annualRealReturn', '4')
    const changed = simulationInputFromData(form)
    assert.equal(changed.defaultReturnSource, 'manual')
    assert.equal(changed.annualRealReturn, 0.04)
    assert.equal(state.plan.defaultReturnSource, undefined, 'o plano principal não muda')
  })
})

test('relatório: premissas com retorno da carteira e origem, e tabela por instrumento com fonte', () => {
  withState(plan(), () => {
    const report = buildFinancialReport(state, { today })
    const portfolio = report.appendix.assumptions.portfolioReturn
    assert.equal(portfolio.year, year + 1)
    assert.equal(portfolio.defaultReturnSource, 'portfolio')
    assert.equal(portfolio.basis, 'liquid')
    assert.equal(portfolio.items.length, 4)
    assert.equal(portfolio.items[0].sourceKind, 'investment')
    assert.equal(portfolio.items[1].sourceKind, 'market')
    assert.equal(Object.hasOwn(portfolio.items[0], 'amount'), false, 'o modelo da tabela não traz valores em dinheiro')
    const appendix = renderReportDocument(report).match(/data-report-chapter="appendix"[\s\S]*$/)[0]
    const text = textOf(appendix)
    assert.match(text, new RegExp(`Retorno da carteira [\\d,]+% em ${year + 1} e [\\d,]+% no longo prazo, real ao ano, ponderado pelo saldo; só os líquidos`))
    assert.match(text, /Retorno padrão [\d,]+% ao ano, derivado da carteira \(média dos investimentos líquidos, longo prazo\); vale para investimentos sem taxa própria/)
    assert.match(text, /Premissas de mercado De 06\/11\/2026\. CDI e inflação do Banco Central do Brasil e do Banco Nacional Suíço/)
    assert.match(appendix, /<h3 class="report-subtitle">Rendimento por investimento<\/h3>/)
    assert.match(text, new RegExp(`Investimento Tipo Real em ${year + 1} Real no longo prazo Fonte`))
    assert.match(appendix, /<th scope="row">CDB<\/th><td>% do CDI<\/td><td><span class="report-num--favorable">[\d,]+%<\/span><\/td>/)
    assert.match(appendix, /<a href="https:\/\/banco\.example\/cdb\?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">Contrato &lt;CDB&gt; do banco<span class="sr-only">, abre em nova aba<\/span><\/a>, de 01\/11\/2026\. Liquidez diária/)
    assert.match(text, /Índice: Banco Central do Brasil: inflação pela mediana do IPCA no Focus/)
    assert.match(text, /Previdência IPCA \+ taxa [\d,]+% [\d,]+% Não informada/)
    assert.match(text, /Outros Padrão do plano [\d,]+% [\d,]+% Retorno padrão do plano/)
    assert.doesNotMatch(appendix, /<details/)
  })
})

test('relatório com valores ocultos: as taxas aparecem, o dinheiro não', () => {
  withState(plan(), () => {
    const report = buildFinancialReport(state, { today })
    const screen = renderReportScreen({ status: 'ready', report, hidden: true })
    const appendix = screen.match(/data-report-chapter="appendix"[\s\S]*$/)[0]
    assert.match(appendix, /Rendimento por investimento/)
    assert.match(appendix, /<span class="report-num--favorable">[\d,]+%<\/span>/)
    assert.match(textOf(appendix), /Retorno padrão [\d,]+% ao ano, derivado da carteira/)
    assert.match(screen, /R\$ •••••/, 'o restante do panorama segue mascarado')
    assert.doesNotMatch(appendix, /R\$ ?\d/)
  }, { hidden: true })
})

test('fonte sem link e sem data, e link que não é https, nunca viram âncora', () => {
  assert.equal(returnSourceHtml({ source: { label: 'Lâmina' }, returnSource: { label: 'Lâmina' } }), 'Fonte: Lâmina.')
  assert.equal(returnSourceHtml({ source: { label: 'X', url: 'javascript:alert(1)' }, returnSource: {} }), 'Fonte: X.')
  assert.equal(returnSourceHtml({ source: null, usesDefault: false }), 'Fonte não informada.')
})
