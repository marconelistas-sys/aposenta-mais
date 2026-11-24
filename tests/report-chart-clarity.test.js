import test from 'node:test'
import assert from 'node:assert/strict'
import { allocationRows, balanceInvestedLine, bridgeRows, currencyPairs, fanChart, historyLine, projectionLine, quotaRows, reserveBullet } from '../src/features/report/report-charts.js'
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

test('ponte cruza zero e permite conferir o saldo depois de cada etapa', () => {
  const html = bridgeRows({ ...options, steps: [{ label: 'Início', kind: 'start', value: 100 }, { label: 'Despesa', kind: 'delta', value: -150 }, { label: 'Sem mudança', kind: 'delta', value: 0 }, { label: 'Fim', kind: 'end', value: -50 }] })
  assert.match(html, /Efeito da etapa/)
  assert.match(html, /Saldo após a etapa/)
  assert.match(html, /Despesa<\/th>[\s\S]*?<td class="report-num--unfavorable">−CHF 150<\/td><td>−CHF 50<\/td>/)
  assert.match(html, /Sem mudança<\/th>[\s\S]*?report-bridge__zero[\s\S]*?<td class="report-num--neutral">CHF 0<\/td><td>−CHF 50<\/td>/)
  assert.equal((html.match(/class="report-bridge__axis"/g) || []).length, 4)
  const positive = bridgeRows({ ...options, steps: [{ label: 'Início', kind: 'start', value: 100 }] })
  assert.match(positive, /report-bridge__axis" style="left:0%/)
})

test('cota acima da escala mantém percentual exato e distingue referência linear de excesso anual', () => {
  const html = quotaRows({ ...options, rows: [{ category: 'Seguro anual', actual: 900, annualPlanned: 300, usedShare: 3, elapsedShare: 1 / 12, status: 'exceeded' }] })
  assert.match(html, /Fundo: cota anual \(100%\)/)
  assert.match(html, /Referência linear: 8,3%/)
  assert.match(html, /sem considerar gastos sazonais/)
  assert.match(html, /report-bullet__overflow/)
  assert.match(html, /<td>300%<\/td>/)
  assert.match(html, /160%/)
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
