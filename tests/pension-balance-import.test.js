import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePensionBalance, applyPensionBalance, pensionBalanceTargets } from '../src/domain/pension-balance-import.js'
import { renderPensionImport } from '../src/features/investments/pension-import.js'
import { bundledExchangeRates } from '../src/shared/exchange-rates.js'
import { investmentNativeAmount } from '../src/domain/investment-currency.js'
import { sanitizeInvestments } from '../src/app/state-storage.js'

const text = `Vorsorgedaten per 27.10.2026
Policen-Nr 123456
Sparguthaben per Ende Vorjahr 0 CHF
Sparguthaben aktuell = 89'607 CHF
Davon Teil gemäss BVG 41'795 CHF
Maximal möglicher Einkauf 1'026'462 CHF
Voraussichtliche Altersleistungen bei Pensionierung
60 339'112 CHF`
const snapshot = () => parsePensionBalance(text)
const plan = () => ({ investments: [{ id: 'pension', name: 'BVK (Fundo suíço)', assetClass: 'pension', currency: 'CHF', amount: 1000, monthlyContribution: 50, liquidity: 'restricted', returnType: 'real', returnValue: .02 }], finappMethod: { releases: [{ investmentId: 'pension', year: 2030 }] } })

test('extrai apenas capital atual e data, nunca projeções ou parcela BVG', () => {
  assert.deepEqual(snapshot(), { name: 'BVK', sourceAccount: 'bvk:123456', currency: 'CHF', asOfDate: '2026-10-27', amount: 89607, provider: 'bvk' })
  assert.equal(parsePensionBalance(text.replace("89'607", '89’607.25')).amount, 89607.25)
  assert.throws(() => parsePensionBalance(text.replace('27.10.2026', '31.02.2026')), /inválidos/)
  assert.throws(() => parsePensionBalance(text + '\nSparguthaben aktuell = 1 CHF'), /ambíguos/)
  assert.throws(() => parsePensionBalance(text.replace('Sparguthaben aktuell =', 'Projeção')), /não reconhecido/)
  assert.throws(() => parsePensionBalance(text.replace("89'607", '-123')), /ambíguos/)
})

test('atualiza patrimônio sem mutar o plano, preservando aportes e liberação', () => {
  const before = plan(), copy = structuredClone(before)
  const next = applyPensionBalance(before, snapshot(), 'pension', 'CHF', bundledExchangeRates)
  assert.equal(next.currentAssets, 89607)
  assert.equal(next.monthlyContribution, 50)
  assert.equal(next.investments[0].balanceSource, 'statement')
  assert.deepEqual(next.finappMethod, before.finappMethod)
  assert.equal(next.investments[0].returnValue, .02)
  assert.deepEqual(before, copy)
  assert.throws(() => applyPensionBalance(next, snapshot(), 'pension', 'CHF', bundledExchangeRates), /posterior/)
  const stored = sanitizeInvestments(next.investments)[0]
  assert.equal(stored.statementAccount, snapshot().sourceAccount)
  assert.equal(stored.balanceAsOf, '2026-10-27')
  assert.equal(stored.balanceSource, 'statement')
})

test('atualiza saldo nativo e conversão sem alterar aporte em outra moeda', () => {
  const before = plan()
  before.investments[0].nativeAmount = 100
  before.investments[0].nativeMonthlyContribution = 10
  const next = applyPensionBalance(before, snapshot(), 'pension', 'BRL', bundledExchangeRates)
  assert.equal(investmentNativeAmount(next.investments[0], 'BRL'), 89607)
  assert.equal(next.currentAssets, next.investments[0].amount)
  assert.ok(next.currentAssets > 89607)
  assert.equal(next.investments[0].nativeMonthlyContribution, 10)
})

test('exige conta previdenciária na moeda correta e protege vínculo anterior', () => {
  const before = plan()
  assert.throws(() => applyPensionBalance(before, snapshot(), 'missing', 'CHF', bundledExchangeRates), /Selecione/)
  before.investments[0].assetClass = 'fixed-income'
  assert.throws(() => applyPensionBalance(before, snapshot(), 'pension', 'CHF', bundledExchangeRates), /Selecione/)
  before.investments[0].assetClass = 'pension'
  before.investments[0].currency = 'BRL'
  assert.throws(() => applyPensionBalance(before, snapshot(), 'pension', 'CHF', bundledExchangeRates), /moeda/)
  before.investments[0].currency = 'CHF'
  before.investments[0].statementAccount = 'bvk:another'
  assert.throws(() => applyPensionBalance(before, snapshot(), 'pension', 'CHF', bundledExchangeRates), /outra conta/)
  assert.deepEqual(pensionBalanceTargets(snapshot(), before.investments, 'CHF'), [])
})

test('outros fundos usam o mesmo contrato de saldo e seleção explícita de conta', () => {
  const before = plan()
  before.investments[0].name = 'Outro fundo'
  const candidate = { name: 'Outro fundo', sourceAccount: 'outro:conta-1', currency: 'CHF', amount: 25000.25, asOfDate: '2026-09-30' }
  const next = applyPensionBalance(before, candidate, 'pension', 'CHF', bundledExchangeRates)
  assert.equal(next.currentAssets, 25000.25)
  assert.equal(next.investments[0].statementAccount, 'outro:conta-1')
  assert.throws(() => applyPensionBalance(before, { ...candidate, amount: NaN }, 'pension', 'CHF', bundledExchangeRates), /válidos/)
})

test('sugere conta única por nome ou vínculo e respeita privacidade no formulário', () => {
  const before = plan()
  assert.equal(pensionBalanceTargets(snapshot(), before.investments, 'CHF')[0].id, 'pension')
  const state = { plan: before, currency: 'CHF', valuesHidden: false }
  assert.match(renderPensionImport(state), /data-pension-import-form/)
  const hidden = renderPensionImport({ ...state, valuesHidden: true })
  assert.doesNotMatch(hidden, /data-pension-import-form|BVK/)
  assert.match(renderPensionImport({ ...state, plan: { investments: [] } }), /Cadastre abaixo/)
})

test('importador geral lê BVK sem criar movimentos e encontra a previdência pelo nome completo', async () => {
  const { readStatementFile } = await import('../src/domain/statement-file.js')
  const { reviewStatementBatch } = await import('../src/domain/statement-batch.js')
  const { previewInvestmentBalances } = await import('../src/domain/statement-investment-balances.js')
  const file = { name: 'bvk.txt', size: text.length, text: async () => text }
  const { inspection } = await readStatementFile(file)
  const review = reviewStatementBatch([{ fileName: file.name, inspection, mapping: inspection.suggestedMapping }])
  assert.deepEqual(review.rows, [])
  assert.deepEqual(review.mappingErrors, [])
  assert.equal(inspection.investmentBalances[0].amount, 89607)
  const before = plan()
  const preview = previewInvestmentBalances(inspection.investmentBalances, before.investments, { currency: 'CHF', exchangeRates: bundledExchangeRates, allowUndated: true })
  assert.equal(preview.updates.length, 1)
  assert.equal(preview.investments[0].amount, 89607)
  const ambiguous = previewInvestmentBalances(inspection.investmentBalances, [...before.investments, { ...before.investments[0], id: 'another' }], { currency: 'CHF', allowUndated: true })
  assert.equal(ambiguous.rows[0].status, 'ambiguous')
  assert.equal(ambiguous.updates.length, 0)
  const wrongClass = previewInvestmentBalances(inspection.investmentBalances, [{ ...before.investments[0], assetClass: 'other' }], { currency: 'CHF', allowUndated: true })
  assert.equal(wrongClass.updates.length, 0)
})
