import test from 'node:test'
import assert from 'node:assert/strict'
import { allocationRows, balanceInvestedLine, bridgeRows, currencyPairs, divergingRows, fanChart, historyLine, projectionLine, quotaRows, reserveBullet } from '../src/features/report/report-charts.js'
import { withMaskedMoney } from '../src/features/report/report-text.js'
import { buildFinancialReport } from '../src/domain/financial-report.js'
import { renderReportDocument } from '../src/features/report/report-view.js'
import { reportFixtureState, reportFixtureToday } from './fixtures/report-state.js'

const options = { currency: 'CHF', label: 'Histórico', caption: 'Valores' }
const dots = html => [...html.matchAll(/class="report-svg-dot" cx="([\d.]+)" cy="([\d.]+)"/g)].map(([, x, y]) => [Number(x), Number(y)])
const ends = html => [...html.matchAll(/class="report-svg-label[^"]*" x="[\d.]+" y="([\d.]+)"/g)].map(([, y]) => Number(y)).sort((a, b) => a - b)
const text = html => html.replace(/<[^>]+>/g, ' ')

test('fotos de janeiro, fevereiro e dezembro seguem meses decorridos, sem curva inventada', () => {
  const html = historyLine({ ...options, series: [{ month: '2026-12', netWorth: 1300 }, { month: '2026-01', netWorth: 1000 }, { month: '2026-02', netWorth: 1100 }] })
  const points = dots(html)
  assert.equal(points.length, 3)
  assert.ok(Math.abs((points[1][0] - points[0][0]) / (points[2][0] - points[0][0]) - 1 / 11) < 0.0001)
  assert.match(html, /class="report-svg-line" d="M[^"]+ L[^"]+ L/)
  assert.doesNotMatch(html, /class="report-svg-line" d="[^"]*C/)
  assert.match(html, /sem ajuste pela inflação/)
})

test('saldos usam dias reais e datas completas, aportado permanece em degraus', () => {
  const html = balanceInvestedLine({ ...options, series: [{ date: '2026-01-01', balance: 1000, invested: 1000 }, { date: '2026-01-11', balance: 1050, invested: 1020 }, { date: '2026-04-11', balance: 1100, invested: 1100 }] })
  const points = dots(html)
  assert.ok(Math.abs((points[1][0] - points[0][0]) / (points[2][0] - points[0][0]) - 0.1) < 0.0001)
  assert.match(html, /01\/01\/26/)
  assert.match(html, /11\/04\/26/)
  assert.match(html, /report-svg-line--muted" d="M[^"]+ H[\d.]+ V/)
  assert.match(html, /Degraus tracejados: aportado/)
  assert.ok(ends(html)[1] - ends(html)[0] >= 20, 'finais iguais permanecem separados')
  assert.equal((html.match(/report-svg-leader/g) || []).length, 2)
})

test('ponte: desvios em barras a partir do zero, na mesma escala, e a última linha soma tudo', () => {
  const html = bridgeRows({ ...options, netLabel: 'Diferença no saldo', netDetail: 'Realizado menos planejado', steps: [
    { label: 'Planejado', kind: 'total', value: 1000 },
    { label: 'Receitas', kind: 'delta', value: 400 },
    { label: 'Desejos', kind: 'delta', value: -800 },
    { label: 'Sem mudança', kind: 'delta', value: 0 },
    { label: 'Realizado', kind: 'total', value: 600 }
  ] })
  assert.match(html, /class="report-rowchart report-rowchart--bridge" aria-hidden="true"/)
  assert.match(html, /<div class="sr-only"><table><caption>Valores<\/caption>/, 'tabela acessível dentro de um bloco que não alarga a página')
  const visual = html.slice(0, html.indexOf('<div class="sr-only">'))
  assert.doesNotMatch(visual, /report-bar--total[^>]*width:100%/, 'totais não viram barras longas')
  assert.doesNotMatch(visual, />Planejado</, 'os totais ficam no título da figura, não no gráfico')
  assert.doesNotMatch(visual, /Saldo depois/, 'saldo corrente só na tabela acessível')
  assert.match(visual, /◀ reduziu<\/span><span>aumentou ▶/, 'com desvios dos dois lados, o zero fica no centro')
  assert.match(visual, /Receitas[\s\S]*?left:50%;width:25%[\s\S]*?\+CHF\s400[\s\S]*?↑<\/span> aumentou/, 'metade da maior barra')
  assert.match(visual, /Desejos[\s\S]*?left:0%;width:50%[\s\S]*?−CHF\s800[\s\S]*?↓<\/span> reduziu/)
  assert.match(visual, /report-rowchart__row--neutral[\s\S]*?report-rowchart__mark[\s\S]*?=<\/span> sem efeito/)
  assert.match(visual, /report-rowchart__row--total report-rowchart__row--net[\s\S]*?Diferença no saldo[\s\S]*?Realizado menos planejado[\s\S]*?report-bar--total" style="left:25%;width:25%[\s\S]*?−CHF\s400/, 'soma = realizado − planejado')
  assert.match(html, /<th scope="row">Desejos<\/th><td>−CHF\s800<\/td><td>reduziu o saldo<\/td><td>CHF\s600<\/td>/)
  assert.match(html, /<th scope="row">Diferença no saldo<\/th><td>−CHF\s400<\/td><td>reduziu o saldo<\/td>/)
  const onlyUp = bridgeRows({ ...options, steps: [{ label: 'Início', kind: 'start', value: 100 }, { label: 'Rendimento', kind: 'delta', value: 10 }, { label: 'Fim', kind: 'end', value: 110 }] })
  assert.match(onlyUp, /0 · aumentou ▶/)
  assert.match(onlyUp, /report-rowchart__axis" style="left:0%/)
  const onlyDown = bridgeRows({ ...options, steps: [{ label: 'Imposto', kind: 'delta', value: -10 }] })
  assert.match(onlyDown, /◀ reduziu · 0/)
  assert.match(onlyDown, /left:0%;width:100%/)
  const wealth = bridgeRows({ ...options, subject: 'o patrimônio', afterLabel: 'Patrimônio depois', steps: [{ label: 'Rendimento', kind: 'delta', value: 10 }] })
  assert.match(wealth, /Efeito no patrimônio/)
  assert.match(wealth, /<td>aumentou o patrimônio<\/td><td>CHF\s10<\/td>/, 'tabela acessível com a frase inteira e o patrimônio depois')
})

test('cota: a trilha é a cota inteira, o excesso vem escrito e o ritmo esperado tem rótulo próprio', () => {
  const html = quotaRows({ ...options, paceLabel: 'em jan/26', rows: [
    { category: 'Seguro anual', actual: 900, annualPlanned: 300, remaining: -600, usedShare: 3, elapsedShare: 1 / 12, status: 'exceeded' },
    { category: 'Mercado', actual: 50, annualPlanned: 600, usedShare: 50 / 600, elapsedShare: 1 / 12, status: 'on-track' }
  ] })
  assert.match(html, /<span>0%<\/span><span>100% = cota do ano<\/span>/)
  assert.match(html, /margin-left:8\.333%">▼ ritmo esperado em jan\/26: 8,3%/, 'no começo do ano o rótulo começa na linha')
  assert.match(html, /report-bar--unfavorable" style="width:100%"/, 'barra para no fim da cota')
  assert.match(html, /report-rowchart__row--over/)
  assert.match(html, /<td>300%<\/td><td>CHF\s900 de CHF\s300<\/td><td>passou CHF\s600<\/td><td>Estourou a cota<\/td>/)
  assert.match(html, /sobram CHF\s550/, 'sem `remaining`, a sobra vem da cota menos o gasto')
  assert.match(html, /aria-hidden="true">✓<\/span>Dentro do ritmo/)
  assert.doesNotMatch(html, /report-key|Fundo:|Traço:|▶/)
  const late = quotaRows({ ...options, rows: [{ category: 'X', actual: 10, annualPlanned: 12, usedShare: 10 / 12, elapsedShare: 10 / 12, status: 'on-track' }] })
  assert.match(late, /margin-right:16\.667%">ritmo esperado hoje: 83,3% ▼/, 'no fim do ano o rótulo termina na linha')
  assert.match(late, /cota toda usada|sobram CHF\s2/)
})

test('desvio: material primeiro, categorias iguais ao plano viram uma frase e o zero se adapta', () => {
  const rows = [
    { category: 'Mercado', delta: 900, deltaPercent: 0.05, plannedToDate: 18000, actual: 18900, material: false },
    { category: 'Lazer', delta: 600, deltaPercent: 0.4, plannedToDate: 1500, actual: 2100, material: true },
    { category: 'Moradia', delta: 0.3, deltaPercent: 0, plannedToDate: 100, actual: 100.3, material: false }
  ]
  const html = divergingRows({ ...options, rows })
  assert.ok(html.indexOf('Lazer') < html.indexOf('Mercado'), 'excesso material vem antes')
  assert.match(html, /report-rowchart__axis" style="left:0%/, 'sem categoria abaixo do plano, o zero fica à esquerda')
  assert.match(html, /0 = igual ao plano · gastou mais ▶/)
  assert.match(html, /Iguais ao plano<\/strong> \(1\): Moradia\./)
  assert.doesNotMatch(html.split('report-rowchart__aside')[0], /Moradia/)
  assert.match(html, /<td>\+CHF\s600 \(\+40%\)<\/td><td>Bem acima do plano<\/td>/)
  const flat = divergingRows({ ...options, rows: [rows[2]] })
  assert.match(flat, /Todas as categorias estão iguais ao plano/)
  assert.doesNotMatch(flat, /report-rowchart"|report-bar/)
})

test('fluxo de caixa: receita igual ao plano não é chamada de "acima do plano"', () => {
  const report = buildFinancialReport(reportFixtureState(), { today: reportFixtureToday, goals: null })
  assert.equal(Math.round(report.cashFlow.waterfall.steps.find(step => step.key === 'income').value), 0)
  const html = renderReportDocument(report)
  assert.match(html, /Receitas iguais ao plano/)
  assert.doesNotMatch(html, /Receitas acima do plano/)
  assert.match(html, /ritmo esperado em out\/26: 83,3% ▼/)
  assert.match(html, /10 de 12 meses passaram[\s\S]*?sem estourar a cota/, 'linha do ritmo e sazonalidade explicadas em Como ler')
  assert.match(html, /class="report-figure report-figure--breakable"[^>]*><figcaption class="report-figure__title">2 categorias já passaram da cota/)
})

test('leque coincidente separa três rótulos e mantém os valores em HTML', () => {
  const html = fanChart({ ...options, retirementYear: 2100, series: [2026, 2027].map(year => ({ year, p10: -100, p25: -100, p50: -100, p75: -100, p90: -100 })) })
  assert.deepEqual(ends(html).map((y, i, all) => i ? y - all[i - 1] : 0), [0, 20, 20])
  assert.doesNotMatch(html, /Aposentadoria 2100/)
  assert.match(html, /poder de compra de hoje/)
  assert.match(html, /Inferior \(P10\) em 2027<\/span><strong>−CHF 100/)
})

test('vazio, zero e observação única geram gráficos válidos', () => {
  for (const render of [historyLine, balanceInvestedLine, fanChart]) {
    assert.match(render({ ...options, series: [] }), /report-empty/)
    assert.match(render({ ...options, series: [{ month: 'inválido', date: 'inválido', year: NaN, netWorth: Infinity, balance: NaN }] }), /report-empty/)
  }
  const examples = [
    historyLine({ ...options, series: [{ month: '2026-01', netWorth: 0 }] }),
    balanceInvestedLine({ ...options, series: [{ date: '2026-01-01', balance: 0, invested: 0 }] }),
    projectionLine({ ...options, rows: [{ year: 2026, financialAssets: 0 }] })
  ]
  for (const html of examples) {
    assert.equal(dots(html).length, 1)
    assert.doesNotMatch(html, /NaN|Infinity|undefined/)
    assert.match(html, /role="region" tabindex="0"/)
  }
})

test('reserva e câmbio mostram unidade, meta e escala sem depender da cor', () => {
  const reserve = reserveBullet({ months: 3, targetMonths: 6, riskMonths: 3 })
  assert.match(reserve, /Escala em meses de despesas/)
  assert.match(reserve, /Traço: meta de 6 meses/)
  const extreme = reserveBullet({ months: 1000, targetMonths: 6, riskMonths: 3 })
  assert.match(extreme, /Traço: meta de 6 meses/)
  assert.match(extreme, /report-reserve__scale"><span style="left:0%">0<\/span><span style="left:100%">1001<\/span>/)
  assert.match(reserveBullet({ months: null, targetMonths: 6, riskMonths: 3 }), /report-empty/)
  const currencies = currencyPairs({ caption: 'Moedas', rows: [{ currency: 'CHF', assetShare: 0.8, expenseShare: 1, gap: -0.2 }] })
  assert.match(currencies, /<span>0%<\/span><span>100%<\/span>/)
  assert.match(allocationRows({ ...options, rows: [{ label: 'Ações', currentShare: 0.4, targetShare: 0.5, low: 0.45, high: 0.55, status: 'below', deviation: -0.1, amountToTarget: 100 }] }), /Ponto: parcela atual[\s\S]*Traço: alvo[\s\S]*Faixa: tolerância/)
})

test('novos saldos, escalas e resumos respeitam máscara financeira e escapam nomes', () => {
  const html = withMaskedMoney(true, () => bridgeRows({ ...options, steps: [{ label: '<img src=x>', kind: 'start', value: 1234567 }] }) + balanceInvestedLine({ ...options, series: [{ date: '2026-01-01', balance: 50000, invested: 40000 }] }))
  assert.match(html, /CHF •••••/)
  assert.doesNotMatch(text(html), /CHF\s?[−+]?\d/)
  assert.doesNotMatch(html, /<img/)
  assert.match(html, /&lt;img src=x&gt;/)
})

test('documento expõe dados históricos e traduz as faixas sem mudar o motor', () => {
  const state = reportFixtureState()
  state.plan.investments[0].balanceHistory = [{ date: '2026-01-01', amount: 20000, flow: 0 }, { date: '2026-10-31', amount: 21000, flow: 0 }]
  const report = buildFinancialReport(state, { today: reportFixtureToday, goals: null })
  report.retirement.fan = { available: true, simulations: 100, series: [2026, 2027].map(year => ({ year, p10: 0, p25: 100, p50: 200, p75: 300, p90: 400 })) }
  const html = renderReportDocument(report)
  assert.equal((html.match(/class="report-chart-data"/g) || []).length, 2)
  assert.match(html, /Saldo atual da carteira/)
  assert.match(html, /50% centrais \(P25 a P75\)/)
  assert.match(html, /80% centrais \(P10 a P90\)/)
  assert.match(html, /não representa um cenário individual/)
  assert.match(html, /não a probabilidade de cumprir o plano/)
})
