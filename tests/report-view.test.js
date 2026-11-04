import test from 'node:test'
import assert from 'node:assert/strict'
import { createExportableState } from '../src/app/state-storage.js'
import { buildFinancialReport, reportChapters } from '../src/domain/financial-report.js'
import { confidenceStatus } from '../src/domain/goals-planning.js'
import { bridgeRows, categorySegments, divergingRows, fanChart, quotaRows, segmentedBar, statusBadge } from '../src/features/report/report-charts.js'
import { chapterTitles, compactReference, panoramaTabs, renderReportDocument, renderReportScreen, reportDocumentTitle, reportPageStyle } from '../src/features/report/report-view.js'
import { readFileSync } from 'node:fs'
import { pageTabState } from '../src/shared/page-tabs.js'
import { printReport, reportView } from '../src/features/report/report.js'
import { groupedNavigation } from '../src/app/navigation.js'
import { state } from '../src/app/state.js'
import { reportFixtureState, reportFixtureToday as today } from './fixtures/report-state.js'

// Synthetic goals result, so the test does not run the Monte Carlo.
const goals = probability => ({ probability, status: confidenceStatus(probability), target: 0.8, tiers: [{ priority: 'essential', probability, count: 1, firstShortfall: null }], levers: { saving: { status: 'needed', monthly: 1370 }, spending: { status: 'needed', share: 0.108, monthly: 790 }, retirement: { status: 'unreachable' }, flexibleGoals: { status: 'unavailable' } }, legacy: { p10: -1000, p50: 20000, p90: 90000, year: '2075' }, reserves: null, balance: null, settings: { simulations: 50 } })

const hostile = '<img src=x onerror="alert(1)">'
const fixture = reportFixtureState()
fixture.plan.investments[1] = { ...fixture.plan.investments[1], name: `ETF ${hostile}` }
fixture.cashFlow.commitments = fixture.cashFlow.commitments.map(item => ({ ...item, name: `Carro ${hostile}` }))
const report = buildFinancialReport(fixture, { today, goals: goals(0.48) })
const html = renderReportDocument(report)
const textOf = markup => markup.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ')

test('o documento traz capa, sumário e os capítulos na ordem do modelo, sem <details>', () => {
  const order = [...html.matchAll(/data-report-chapter="([a-zA-Z]+)"/g)].map(match => match[1])
  assert.deepEqual(order, ['summary', ...reportChapters])
  for (const key of reportChapters) assert.match(html, new RegExp(`<h2 id="report-${key}-title"[^>]*>${chapterTitles[key]}</h2>`))
  assert.doesNotMatch(html, /<details/)
  assert.match(html, /data-report-cover/)
  assert.match(html, /<h2 id="report-title" class="report-cover__heading"/)
  assert.doesNotMatch(html, /<h1/, 'o h1 é o da tela (Panorama financeiro)')
  // Long chapters start a new A4 page; short ones continue on the sheet before.
  for (const key of ['cashFlow', 'spending', 'balanceSheet', 'retirement']) assert.match(html, new RegExp(`report-chapter--page"? data-report-chapter="${key}"|class="report-chapter report-chapter--page" data-report-chapter="${key}"`))
  assert.match(html, /class="report-chapter report-chapter--flow" data-report-chapter="appendix"/)
})

test('textos do modelo resolvidos: sem {chave}, NaN, undefined ou hífen como sinal', () => {
  const text = textOf(html)
  assert.doesNotMatch(text, /\{[a-zA-Z]+\}/)
  assert.doesNotMatch(text, /NaN|undefined|Infinity|\[object Object\]/)
  assert.doesNotMatch(text, /-CHF|-\d+(,\d+)?%/)
  assert.doesNotMatch(text, /CHF\s?\d{1,3}(\.\d{3})*,\d{2}/, 'sem centavos em totais e projeções')
  assert.match(text, /−CHF/)
})

test('nomes digitados são escapados em todos os capítulos', () => {
  assert.doesNotMatch(html, /<img src=x/)
  assert.match(html, /ETF &lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/)
  assert.match(html, /Carro &lt;img/)
})

test('grade de indicadores: estado com ícone e rótulo, valor, frase e limites', () => {
  const cards = [...html.matchAll(/<li class="report-indicator report-indicator--(\w+)" data-report-indicator="(\w+)">([\s\S]*?)<\/li>/g)]
  assert.equal(cards.length, 11)
  for (const [, status, id, body] of cards) {
    const indicator = report.indicators.find(row => row.id === id)
    assert.equal(status, indicator.status, id)
    assert.match(body, new RegExp(`report-status--${status}"><span class="report-status__icon" aria-hidden="true">[^<]+</span>[A-Za-zçã ]+</span>`), id)
    assert.match(body, /report-indicator__sentence/)
    assert.match(body, /report-indicator__reference">(Ok|Uma classe)/)
  }
  assert.equal(compactReference('Ok ≥ 20% · Atenção 10% a 20%. Aportes contam.'), 'Ok ≥ 20% · Atenção 10% a 20%.')
  assert.match(html, /class="report-findings"/)
  assert.equal((html.match(/class="report-finding /g) || []).length, report.findings.length)
  assert.equal((html.match(/class="report-action"/g) || []).length, report.actions.length)
})

test('cada figura tem título-conclusão, Como ler e Fonte', () => {
  const figures = [...html.matchAll(/<figure class="report-figure[^"]*"[^>]*>([\s\S]*?)<\/figure>/g)].map(match => match[1])
  assert.ok(figures.length >= 12, `${figures.length} figuras`)
  for (const body of figures) {
    assert.match(body, /^<figcaption class="report-figure__title">[^<]{8,}/)
    assert.match(body, /<dt>Fonte<\/dt>/)
  }
  assert.ok(figures.filter(body => /<dt>Como ler<\/dt>/.test(body)).length >= 10)
  assert.match(html, /Patrimônio líquido de CHF [\d.]+ em out\/26/, 'linha do histórico com 6 fotos')
  assert.match(html, /Cenário base: patrimônio financeiro/, 'sem as faixas, mostra o cenário base')
  assert.match(reportPageStyle(report), /^@page \{ size: A4; margin: 14mm 16mm 18mm; @bottom-left \{ content: "Aposenta\+ · Relatório financeiro · data-base outubro de 2026 · CHF";/)
  assert.match(reportPageStyle(report), /counter\(page\) " de " counter\(pages\)/)
})

test('estado vazio explícito em cada capítulo sem dados', () => {
  const empty = buildFinancialReport(createExportableState({ currency: 'BRL', isDemo: false, plan: { currentAge: 40, retirementAge: 65, targetAge: 90, currentAssets: 0, monthlyContribution: 0, horizonReferenceMonth: '2026-11', retirementMonth: '2051-11', investments: [] }, cashFlow: { referenceMonth: '2026-10', items: [], commitments: [] } }), { today, goals: null })
  const markup = renderReportDocument(empty)
  for (const key of reportChapters.filter(key => !['checklist', 'appendix'].includes(key))) {
    const section = markup.match(new RegExp(`data-report-chapter="${key}"[\\s\\S]*?</section>`))[0]
    assert.match(section, /class="report-empty"/, key)
  }
  assert.match(markup, /Nenhum indicador em atenção ou risco/)
  assert.equal((markup.match(/report-indicator--unavailable/g) || []).length, 11)
  assert.doesNotMatch(textOf(markup), /\{[a-zA-Z]+\}|NaN|undefined/)
  assert.match(markup, /class="report-chapter report-chapter--flow report-chapter--empty" data-report-chapter="cashFlow"/, 'capítulo vazio não ocupa página inteira')
})

test('tela: carregamento, faixas em cálculo, erro e valores ocultos', () => {
  const loading = renderReportScreen({ status: 'running', step: 'goals' })
  assert.match(loading, /etapa 1 de 3/)
  assert.match(loading, /data-report-print disabled/)
  assert.doesNotMatch(loading, /data-report[ >]/)
  const partial = renderReportScreen({ status: 'partial', step: 'risk', report })
  assert.doesNotMatch(partial, /data-report-print disabled/)
  assert.match(partial, /Se salvar o PDF agora, ele sai com o cenário base/)
  assert.match(partial, /Calculando as faixas P10 a P90/)
  assert.match(partial, /não é enviado a nenhum servidor/)
  assert.match(partial, /Cabeçalhos e rodapés/)
  const failed = renderReportScreen({ status: 'error', error: 'Horizonte inválido.' })
  assert.match(failed, /data-report-retry/)
  assert.match(failed, /Horizonte inválido\./)
  // Values hidden: the Panorama still shows, every amount masked; only the PDF is blocked.
  const hidden = renderReportScreen({ status: 'complete', report, hidden: true })
  assert.match(hidden, /data-report-print disabled/)
  assert.match(hidden, /data-toggle-values/)
  assert.match(hidden, /nunca sai com valores mascarados/)
  assert.match(hidden, /data-report aria-labelledby/)
  assert.equal((hidden.match(/data-page-tab="panorama:/g) || []).length, 7)
  assert.match(hidden, /CHF •••••/)
  assert.doesNotMatch(textOf(hidden), /CHF\s?[−+]?\d/)
  assert.match(renderReportScreen({ status: 'complete', report }), /CHF\s?[−+]?\d/, 'sem máscara depois de mostrar os valores')
  const hiddenLoading = renderReportScreen({ status: 'running', step: 'report', hidden: true })
  assert.match(hiddenLoading, /etapa 2 de 3/)
  assert.equal(reportDocumentTitle(report), 'Relatório financeiro Aposenta+ 2026-10')
})

test('gráficos: zero neutro, vermelho só material, ponte e categorias com Outros', () => {
  const rows = divergingRows({ currency: 'CHF', caption: 'x', rows: [
    { category: 'Lazer', delta: 1300, deltaPercent: 0.43, plannedToDate: 3000, actual: 4300, material: true },
    { category: 'Mercado', delta: 670, deltaPercent: 0.07, plannedToDate: 9000, actual: 9670, material: false },
    { category: 'Moradia', delta: 0, deltaPercent: 0, plannedToDate: 100, actual: 100, material: false },
    { category: 'Transporte', delta: -200, deltaPercent: -0.05, plannedToDate: 3800, actual: 3600, material: false }
  ] })
  assert.match(rows, /report-diverge__row--unfavorable[\s\S]*Lazer/)
  assert.match(rows, /report-diverge__row--muted[\s\S]*Mercado/)
  assert.match(rows, /report-diverge__row--neutral"><th scope="row">Moradia[\s\S]*?report-diverge__zero-dot[\s\S]*?report-num--neutral">CHF 0 \(0%\)/)
  assert.match(rows, /report-diverge__row--favorable[\s\S]*−CHF 200/)
  assert.equal((rows.match(/report-bar--unfavorable/g) || []).length, 1)
  const bridge = bridgeRows({ currency: 'CHF', caption: 'p', steps: [{ key: 'a', label: 'Início', kind: 'total', value: 100 }, { key: 'b', label: 'Zero', kind: 'delta', value: 0 }, { key: 'c', label: 'Perda', kind: 'delta', value: -40 }, { key: 'd', label: 'Fim', kind: 'total', value: 60 }] })
  assert.match(bridge, /report-bridge__zero/)
  assert.match(bridge, /report-num--neutral">CHF 0</)
  assert.match(bridge, /report-num--unfavorable">−CHF 40/)
  const many = categorySegments(['a', 'b', 'c', 'd', 'e', 'f', 'other'].map((key, index) => ({ key, label: key.toUpperCase(), amount: 10 + index, share: 0.1 })))
  assert.deepEqual(many.map(row => row.slot), [1, 2, 3, 4, 5, 'other'])
  assert.equal(many.at(-1).label, 'Outros: F, OTHER')
  const bar = segmentedBar({ segments: [{ key: 'x', label: `Nome ${hostile}`, amount: 50, share: 0.5 }, { key: 'y', label: 'Y', amount: 50, share: 0.5 }], currency: 'CHF', label: 'Teste' })
  assert.match(bar, /report-stack__bar" aria-hidden="true"/)
  assert.match(bar, /Nome &lt;img/)
  assert.equal((bar.match(/<li>/g) || []).length, 2)
  assert.match(quotaRows({ currency: 'CHF', caption: 'q', rows: [{ category: 'Lazer', usedShare: 1.2, elapsedShare: 0.83, status: 'exceeded', actual: 4300, annualPlanned: 3600 }] }), /Cota ultrapassada/)
  const fan = fanChart({ currency: 'CHF', retirementYear: 2027, label: 'Leque', series: [{ year: 2026, p10: -10, p25: 0, p50: 10, p75: 20, p90: 30 }, { year: 2027, p10: -20, p25: 0, p50: 15, p75: 30, p90: 50 }] })
  assert.match(fan, /role="img" aria-label="Leque"/)
  assert.match(fan, /report-svg-grid--zero/)
  assert.match(fan, /Aposentadoria 2027/)
  assert.match(fan, /P10 −CHF 20/)
  assert.match(statusBadge('attention'), /aria-hidden="true">!<\/span>Atenção/)
})

test('Panorama no grupo Entender; PDF só pelo botão e bloqueado com valores ocultos', () => {
  const understand = groupedNavigation().find(group => group.title === 'Entender')
  assert.deepEqual(understand.items.map(item => item.href), ['/', '/panorama'])
  const calls = []
  const view = { print: () => calls.push('print') }
  const previous = { hidden: state.valuesHidden, report: reportView.report }
  try {
    reportView.report = report
    state.valuesHidden = true
    assert.equal(printReport(view), false)
    reportView.report = null
    state.valuesHidden = false
    assert.equal(printReport(view), false)
    reportView.report = report
    assert.equal(printReport(view), true)
    assert.deepEqual(calls, ['print'])
    // With a document: the print layout and the A4 page style exist only during that print.
    const listeners = {}
    const head = { nodes: [], append(node) { this.nodes.push(node); node.remove = () => { this.nodes = this.nodes.filter(item => item !== node) } } }
    const root = { dataset: {} }
    const seen = []
    const browser = {
      onafterprint: null,
      document: { documentElement: root, head, createElement: () => ({ dataset: {}, textContent: '' }) },
      addEventListener: (name, listener) => { listeners[name] = listener },
      removeEventListener: name => { delete listeners[name] },
      print: () => seen.push({ printing: 'reportPrinting' in root.dataset, page: head.nodes[0]?.textContent })
    }
    assert.equal(printReport(browser), true)
    assert.equal(seen[0].printing, true)
    assert.match(seen[0].page, /@page \{ size: A4;[\s\S]*data-base outubro de 2026/)
    listeners.afterprint()
    assert.equal('reportPrinting' in root.dataset, false)
    assert.equal(head.nodes.length, 0)
  } finally {
    state.valuesHidden = previous.hidden
    reportView.report = previous.report
  }
})

test('Panorama: 7 abas na ordem do relatório, capítulos contíguos e links para ajustar fora da impressão', () => {
  delete pageTabState.panorama
  const tabs = [...html.matchAll(/data-page-tab="panorama:(\w+)"[^>]*>([^<]+)</g)].map(match => [match[1], match[2]])
  assert.deepEqual(tabs, [['resumo', 'Resumo'], ['gastos', 'Fluxo e gastos'], ['patrimonio', 'Patrimônio'], ['carteira', 'Carteira'], ['reserva', 'Reserva, dívidas e câmbio'], ['aposentadoria', 'Aposentadoria'], ['premissas', 'Verificação e premissas']])
  const panels = Object.fromEntries([...html.matchAll(/data-page-tab-panel="panorama:(\w+)"[^>]*>([\s\S]*?)(?=<div class="page-tab-panel"|<\/article>)/g)].map(match => [match[1], match[2]]))
  const chaptersOf = key => [...panels[key].matchAll(/data-report-chapter="(\w+)"/g)].map(match => match[1])
  assert.deepEqual(chaptersOf('resumo'), ['summary'])
  assert.match(panels.resumo, /data-report-cover/)
  assert.deepEqual(chaptersOf('gastos'), ['cashFlow', 'spending'])
  assert.deepEqual(chaptersOf('patrimonio'), ['balanceSheet', 'wealth'])
  assert.deepEqual(chaptersOf('carteira'), ['portfolio'])
  assert.deepEqual(chaptersOf('reserva'), ['liquidity', 'debts', 'currency'])
  assert.deepEqual(chaptersOf('aposentadoria'), ['retirement'])
  assert.deepEqual(chaptersOf('premissas'), ['checklist', 'appendix'])
  // Only the first tab is visible; the others are in the page, hidden.
  assert.match(html, /data-page-tab-panel="panorama:resumo" >/)
  assert.equal((html.match(/data-page-tab-panel="panorama:\w+" hidden/g) || []).length, 6)
  for (const tab of panoramaTabs) {
    const nav = panels[tab.key].match(/<nav class="report-adjust report-screen-only"[^>]*data-report-adjust="(\w+)">([\s\S]*?)<\/nav>/)
    assert.equal(nav?.[1], tab.key)
    assert.match(nav[2], /Ajustar em/)
    for (const [, href] of tab.adjust) assert.match(nav[2], new RegExp(`href="${href.replace(/[?]/g, '\\?')}" data-route`))
    assert.equal(/Simular em/.test(nav[2]), tab.simulate.length > 0)
  }
  assert.match(panels.gastos, /href="\/orcamento\?aba=lancamentos" data-route>Lançamentos</)
})

test('Panorama: tela com h1 próprio, sem sumário de capítulos, e a aba pedida na URL', () => {
  const screen = renderReportScreen({ status: 'complete', report })
  assert.equal((screen.match(/<h1/g) || []).length, 1)
  assert.match(screen, /<h1>Panorama financeiro<\/h1>/)
  assert.doesNotMatch(screen, /report-toc|data-report-jump/)
  assert.match(screen, /Salvar relatório em PDF/)
  assert.match(screen, /O PDF traz todas as abas/)
  pageTabState.panorama = 'reserva'
  try {
    const opened = renderReportDocument(report)
    assert.match(opened, /data-page-tab-panel="panorama:reserva" >/)
    assert.match(opened, /aria-selected="true" tabindex="0" data-page-tab="panorama:reserva"/)
    assert.match(opened, /data-page-tab-panel="panorama:resumo" hidden/)
  } finally { delete pageTabState.panorama }
})

test('impressão: só pelo botão; todas as abas saem, sem a barra de abas nem os links de ajuste', () => {
  const css = readFileSync(new URL('../src/styles/report.css', import.meta.url), 'utf8')
  const print = css.slice(css.indexOf('@media print'))
  assert.match(print, /\[data-report-printing\] \.report > \[data-page-tab-panel\]\[hidden\] \{ display: block !important; \}/)
  assert.match(print, /\.report > \.page-tabs, \.report-screen-only/)
  // Ctrl+P is not the PDF: every print rule waits for the button's mark.
  const rules = print.slice(print.indexOf('{') + 1).split('\n').filter(line => line.includes('{') && !line.trim().startsWith('/*'))
  for (const rule of rules) for (const selector of rule.slice(0, rule.indexOf('{')).split(/,(?![^()]*\))/)) assert.match(selector.trim(), /^:root\[data-report-printing\]/, selector)
  // The A4 @page is not in the screen document either.
  assert.doesNotMatch(renderReportDocument(report), /@page|data-report-page-style/)
})
