import test from 'node:test'
import assert from 'node:assert/strict'
import { formatReportDate, formatReportMoney, formatReportMonths, formatReportPercent, formatReportPoints, formatReportText, formatReportValue, minusSign, valueTone } from '../src/features/report/report-text.js'

const plain = value => value.replace(/ /g, ' ')

test('dinheiro do relatório: sem centavos, menos U+2212, zero sem sinal', () => {
  assert.equal(minusSign, '−')
  assert.equal(plain(formatReportMoney(1234.56, 'CHF')), 'CHF 1.235')
  assert.equal(plain(formatReportMoney(1234.4, 'BRL')), 'R$ 1.234')
  assert.equal(plain(formatReportMoney(-870, 'CHF')), '−CHF 870', 'negativo nunca fica neutro, mesmo sem signed')
  assert.equal(plain(formatReportMoney(-870, 'CHF', { signed: true })), '−CHF 870')
  assert.equal(plain(formatReportMoney(870, 'CHF', { signed: true })), '+CHF 870')
  assert.equal(plain(formatReportMoney(870, 'CHF')), 'CHF 870')
  for (const zero of [0, -0, 0.4, -0.4]) assert.equal(plain(formatReportMoney(zero, 'CHF', { signed: true })), 'CHF 0', `zero ${zero}`)
  assert.equal(formatReportMoney(Number.NaN, 'CHF'), 'indisponível')
  assert.doesNotMatch(formatReportMoney(-1, 'CHF'), /-/, 'hífen não é sinal de menos')
})

test('percentuais, pontos percentuais e meses', () => {
  assert.equal(formatReportPercent(0.2), '20%')
  assert.equal(formatReportPercent(0.18692), '18,7%')
  assert.equal(formatReportPercent(0.0036), '0,36%', 'custo pequeno mantém duas casas')
  assert.equal(formatReportPercent(-0.05, { signed: true }), '−5%')
  assert.equal(formatReportPercent(-0.05), '−5%')
  assert.equal(formatReportPercent(0.4756, { signed: true }), '+47,6%')
  assert.equal(formatReportPercent(0.00001, { signed: true }), '0%')
  assert.equal(formatReportPercent(null), 'indisponível')
  assert.equal(formatReportPoints(0.2796), '28 p.p.')
  assert.equal(formatReportPoints(-0.0854, { signed: true }), '−8,5 p.p.')
  assert.equal(formatReportMonths(12.0992), '12,1 meses')
  assert.equal(formatReportMonths(1), '1 mês')
  assert.equal(formatReportDate('2026-09-03'), '03/09/2026')
  assert.equal(formatReportDate(null), 'data não informada')
})

test('cada unidade de Text e o template com a palavra da unidade', () => {
  const text = (template, params) => formatReportText({ template, params })
  assert.equal(text('O saldo cobre {months} meses de despesas.', { months: { value: 12.0992, unit: 'months' } }), 'O saldo cobre 12,1 meses de despesas.')
  assert.equal(text('Adiar em {years} ano(s)', { years: { value: 2, unit: 'years' } }), 'Adiar em 2 ano(s)')
  assert.equal(text('aos {age} anos', { age: { value: 90, unit: 'age' } }), 'aos 90 anos')
  assert.equal(text('{count} meses', { count: { value: 10, unit: 'count' } }), '10 meses')
  assert.equal(text('desde {first}', { first: { value: '2026-05', unit: 'month' } }), 'desde maio de 2026')
  assert.equal(text('em {year}', { year: { value: 2051, unit: 'year' } }), 'em 2051')
  assert.equal(text('Câmbio de {date}.', { date: { value: '2026-09-03', unit: 'date' } }), 'Câmbio de 03/09/2026.')
  assert.equal(text('Câmbio de {date}.', { date: { value: null, unit: 'date' } }), 'Câmbio de data não informada.')
  assert.equal(plain(text('{delta} em valor', { delta: { value: 6510, unit: 'currency', currency: 'CHF', signed: true } })), '+CHF 6.510 em valor')
  assert.equal(text('{gap} entre ativos', { gap: { value: 0.2796, unit: 'pp' } }), '28 p.p. entre ativos')
  assert.equal(text('Sem parâmetros.', {}), 'Sem parâmetros.')
  assert.equal(formatReportText(null), '')
  assert.equal(formatReportValue({ value: 'Lazer', unit: 'text' }), 'Lazer')
})

test('nomes digitados pelo usuário são escapados e chaves desconhecidas ficam visíveis', () => {
  const html = formatReportText({ template: '{name} representa {rate} da carteira <b>', params: { name: { value: '<img src=x onerror="alert(1)">', unit: 'text' }, rate: { value: 0.43, unit: 'percent' } } })
  assert.equal(html, '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; representa 43% da carteira &lt;b&gt;')
  assert.equal(formatReportText({ template: 'Falta {missing}.', params: {} }), 'Falta {missing}.')
})

test('tom do valor: zero é neutro, nunca positivo', () => {
  assert.equal(valueTone(0), 'neutral')
  assert.equal(valueTone(-0.3), 'neutral')
  assert.equal(valueTone(10), 'favorable')
  assert.equal(valueTone(-10), 'unfavorable')
  assert.equal(valueTone(10, { higherIsBetter: false }), 'unfavorable')
})
