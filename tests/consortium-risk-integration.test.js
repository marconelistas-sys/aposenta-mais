import test from 'node:test'
import assert from 'node:assert/strict'
import { Worker } from 'node:worker_threads'
import { consortiumSchedule, consortiumEvents, validateConsortium, validateConsortiumAsOf, sanitizeConsortia } from '../src/domain/consortium.js'
import { prepareRiskInput, defaultRiskSettings } from '../src/domain/risk-plan.js'
import { deterministicPath, simulateRisk, riskMatrix } from '../src/domain/risk-simulation.js'
import { sanitizeStoredState, createExportableState } from '../src/app/state-storage.js'
import { calculateMultiCurrencyCashFlow } from '../src/domain/cash-flow.js'
import { financialCalendar } from '../src/domain/financial-calendar.js'

const now = new Date('2026-09-05T00:00:00Z')
const consortium = { id: 'c', name: 'Consórcio', currency: 'BRL', referenceMonth: '2026-09', stage: 'pending', useType: 'asset', credit: 100000, principal: 80000, months: 80, administration: 0, reserve: 0, insurance: 0, annualAdjustment: 0, ownBid: 0, embeddedBid: 0, purchaseValue: 0, assetReturn: 0, creditReturn: 0, awardMonth: null, earlyMonth: null, lateMonth: null, useMonth: null }
const settings = { ...defaultRiskSettings, months: 12, simulations: 50, aggregateLiquid: true }
const source = (consortia = [], cash = {}, plan = {}) => sanitizeStoredState({ plan: { currentAssets: 100000, monthlyContribution: 0, annualRealReturn: 0, expectedMonthlyBenefit: 0, ...plan }, cashFlow: { items: [], consortia, ...cash } })

test('parcela separa amortização e encargos, que não viram patrimônio', () => {
  const item = { ...consortium, administration: 800, reserve: 400, insurance: 2 }
  const row = consortiumSchedule(item, 1)[0]
  assert.equal(row.common, 1000)
  assert.equal(row.administration, 10)
  assert.equal(row.reserve, 5)
  assert.equal(row.cashExpense, 1017)
  assert.equal(row.restrictedEquity, 21000)
  assert.equal(100000 - row.cashExpense + row.restrictedEquity, 119983)
})
test('contemplação não cria renda livre nem salto no patrimônio', () => {
  const before = consortiumSchedule(consortium, 1)[0]
  const after = consortiumSchedule({ ...consortium, awardMonth: '2026-09' }, 1)[0]
  assert.equal(after.restrictedEquity, before.restrictedEquity)
  assert.equal(after.cashExpense, before.cashExpense)
  assert.equal(before.credit, 0)
  assert.equal(after.credit, 100000)
})
test('lance próprio reduz caixa e principal, conservando patrimônio sem encargos', () => {
  const row = consortiumSchedule({ ...consortium, awardMonth: '2026-09', ownBid: 30000 }, 1)[0]
  assert.equal(row.ownBid, 30000)
  assert.equal(row.principal, 49375)
  assert.equal(100000 - row.cashExpense + row.restrictedEquity, 120000)
})
test('lance embutido não sai do caixa e reduz crédito e principal em conjunto', () => {
  const row = consortiumSchedule({ ...consortium, awardMonth: '2026-09', embeddedBid: 30000 }, 1)[0]
  assert.equal(row.credit, 70000)
  assert.equal(row.cashExpense, 625)
  assert.equal(100000 - row.cashExpense + row.restrictedEquity, 120000)
})
test('sem contemplação hipotética não executa lance e saldo ainda vinculado permanece', () => {
  const rows = consortiumSchedule(consortium, 81)
  assert.ok(rows.every(row => row.ownBid === 0 && row.embeddedBid === 0 && !row.awarded))
  assert.equal(rows[80].cashExpense, 0)
  assert.equal(rows[80].credit, 0)
  assert.equal(rows[80].restrictedEquity, 100000)
  assert.throws(() => validateConsortium({ ...consortium, ownBid: 1000 }), /hipótese/)
})
test('compra troca direito por bem e preserva crédito remanescente sem duplicar', () => {
  const row = consortiumSchedule({ ...consortium, awardMonth: '2026-09', useMonth: '2026-09', purchaseValue: 70000 }, 1)[0]
  assert.equal(row.asset, 70000)
  assert.equal(row.credit, 30000)
  assert.equal(100000 - row.cashExpense + row.restrictedEquity, 120000)
})
test('serviço é consumido, complemento sai do caixa e não vira ativo fictício', () => {
  const row = consortiumSchedule({ ...consortium, awardMonth: '2026-09', useMonth: '2026-09', purchaseValue: 120000, useType: 'service' }, 1)[0]
  assert.equal(row.topUp, 20000)
  assert.equal(row.asset, 0)
  assert.equal(row.credit, 0)
  assert.equal(100000 - row.cashExpense + row.restrictedEquity, 0)
})
test('bem atual pode ter posição líquida negativa e valoriza desde primeiro mês', () => {
  const row = consortiumSchedule({ ...consortium, stage: 'asset', purchaseValue: 10000, assetReturn: 0.1 }, 12).at(-1)
  assert.ok(Math.abs(row.asset - 11000) < 0.001)
  assert.ok(row.restrictedEquity < 0)
})
test('crédito contempla rendimento específico, não usa taxa da Carteira', () => {
  const row = consortiumSchedule({ ...consortium, stage: 'credit', creditReturn: 0.1 }, 12).at(-1)
  assert.ok(Math.abs(row.credit - 110000) < 0.001)
})
test('reajuste anual atualiza principal e encargos no aniversário', () => {
  const rows = consortiumSchedule({ ...consortium, annualAdjustment: 0.1, administration: 800 }, 13)
  assert.equal(rows[11].common, 1000)
  assert.equal(rows[12].common, 1100)
  assert.equal(rows[12].administration, 11)
  assert.equal(rows[12].restrictedEquity, 36300)
})
test('lance incompatível com saldo tardio é rejeitado sem reduzir silenciosamente o lance', () => {
  assert.throws(() => consortiumSchedule({ ...consortium, months: 2, awardMonth: '2026-10', ownBid: 50000 }, 2), /supera/)
  assert.deepEqual(sanitizeConsortia([{ ...consortium, months: 2, awardMonth: '2026-10', ownBid: 50000 }]), [])
})
test('parcelas entram uma única vez em orçamento e calendário', () => {
  const state = source([consortium])
  const budget = calculateMultiCurrencyCashFlow(state.cashFlow, state.currency, state.exchangeRates, 0, [], now)
  assert.equal(budget.monthlyExpenses, 1000)
  assert.equal(budget.convertedItems.filter(row => row.consortiumId).length, 1)
  assert.equal(financialCalendar(state.cashFlow, '2026-09').events[0].amount, 1000)
  assert.equal(consortiumEvents([consortium], '2026-08').length, 0)
})
test('preparação e motor conservam patrimônio com principal de consórcio deduzido uma vez', () => {
  const state = source([consortium]), unchanged = structuredClone(state)
  const input = prepareRiskInput(state, settings, now)
  const result = deterministicPath(input)
  assert.equal(input.initial.nonLiquidAssets, 20000)
  assert.equal(input.initial.liabilities, 0)
  assert.equal(result.rows[0].financialAssets, 99000)
  assert.equal(result.rows[0].netWorth, 120000)
  assert.ok(result.rows.every(row => Math.abs(row.netWorth - 120000) < 0.001))
  assert.deepEqual(state, unchanged)
})
test('dívida existente é reconhecida antes da primeira parcela futura', () => {
  const debt = { id: 'd', kind: 'debt', name: 'Dívida', amount: 12000, date: '2026-11-01', installments: 12, annualRate: 0, currency: 'BRL', saved: 0 }
  const input = prepareRiskInput(source([], { commitments: [debt] }), settings, now)
  assert.equal(input.initial.liabilities, 12000)
  assert.equal(input.timelines[0][0].liabilities, 12000)
  assert.equal(deterministicPath(input).rows[0].netWorth, 88000)
  assert.equal(deterministicPath(input).rows[2].netWorth, 88000)
})
test('cota futura não pode injetar direito pré-pago sem contrapartida', () => {
  assert.throws(() => prepareRiskInput(source([{ ...consortium, referenceMonth: '2027-01' }]), settings, now), /referência/)
  const valid = prepareRiskInput(source([{ ...consortium, referenceMonth: '2027-01', principal: 100000 }]), settings, now)
  assert.equal(deterministicPath(valid).rows[4].netWorth, 100000)
})
test('cenários de uma cota pendente não contemplam retroativamente', () => {
  const past = { ...consortium, referenceMonth: '2026-01', earlyMonth: '2026-03', awardMonth: '2026-10', lateMonth: '2026-12' }
  assert.throws(() => validateConsortiumAsOf(past, '2026-09'), /passado/)
  assert.throws(() => prepareRiskInput(source([past]), { ...settings, varyContemplation: true }, now), /passado/)
})
test('hipóteses antecipada/base/tardia só afetam cotas pendentes e têm cronologia válida', () => {
  const item = { ...consortium, earlyMonth: '2026-09', awardMonth: '2026-10', lateMonth: '2026-11', useMonth: '2026-10', purchaseValue: 100000 }
  const input = prepareRiskInput(source([item]), { ...settings, varyContemplation: true }, now)
  assert.equal(input.timelines.length, 3)
  assert.equal(input.timelines[0][1].events.length, 2)
  assert.equal(input.timelines[1][0].events.length, 2)
  assert.equal(input.timelines[2][2].events.length, 2)
  assert.equal(input.timelines[0][0].nonLiquidAssets, input.timelines[1][0].nonLiquidAssets)
})
test('salário termina, benefício não duplica e aportes fixos não são somados ao saldo', () => {
  const items = [{ id: 'salary', type: 'income', categoryId: 'salary', amount: 1000, currency: 'BRL', frequency: 'monthly', endMode: 'retirement' }, { id: 'benefit', type: 'income', categoryId: 'other-income', amount: 200, currency: 'BRL', frequency: 'monthly', startDate: '2026-10-01' }]
  const input = prepareRiskInput(source([], { items, retirementMonth: '2026-10' }, { monthlyContribution: 500, expectedMonthlyBenefit: 200 }), { ...settings, benefitIncluded: true }, now)
  assert.equal(input.timelines[0][0].cashFlow, 1000)
  assert.equal(input.timelines[0][1].cashFlow, 200)
  assert.equal(deterministicPath(input).rows[0].financialAssets, 101000)
})
test('matriz não altera principal contratado e centro coincide com cenário base', () => {
  const input = prepareRiskInput(source([consortium]), settings, now)
  const cells = riskMatrix(input), baseline = deterministicPath(input)
  assert.equal(cells[4].netWorth, baseline.rows.at(-1).netWorth)
  assert.equal(cells[1].netWorth, cells[4].netWorth)
  assert.equal(cells[7].netWorth, cells[4].netWorth)
})
test('Monte Carlo zero vol coincide com base, mantém posições restritas e não quita déficit com bem', () => {
  const input = prepareRiskInput(source([consortium], {}, { currentAssets: 0 }), settings, now)
  const result = simulateRisk(input), base = deterministicPath(input)
  assert.equal(result.probabilityShortfall, 1)
  assert.equal(result.series[0].p50, base.rows[0].netWorth)
  assert.equal(base.rows[0].unfunded, 1000)
  assert.equal(base.rows[0].financialAssets, 0)
})
test('dados de dívida, consórcio e premissas sobrevivem exportação e sanitização', () => {
  const state = source([consortium], { commitments: [{ id: 'd', kind: 'debt', name: 'Dívida', amount: 12000, date: '2026-09-01', installments: 12, annualRate: 0.1, currency: 'BRL', amortization: 'sac', monthlyFee: 5, extraPayments: [{ month: '2026-10', amount: 1000 }] }] }, { riskSettings: { ...settings, seed: 99 } })
  const restored = sanitizeStoredState(createExportableState(state))
  assert.equal(restored.cashFlow.consortia.length, 1)
  assert.equal(restored.cashFlow.commitments[0].amortization, 'sac')
  assert.equal(restored.cashFlow.commitments[0].extraPayments[0].amount, 1000)
  assert.equal(restored.plan.riskSettings.seed, 99)
})
test('worker executa pipeline real em segundo plano sem DOM ou credenciais', async () => {
  const url = new URL('../src/domain/risk-worker.js', import.meta.url).href
  const bootstrap = `import { parentPort } from 'node:worker_threads'; globalThis.self = { postMessage: value => parentPort.postMessage(value) }; await import(${JSON.stringify(url)}); parentPort.on('message', data => self.onmessage({data}));`
  const worker = new Worker(new URL(`data:text/javascript,${encodeURIComponent(bootstrap)}`))
  try {
    const message = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Worker excedeu tempo')), 10000)
      worker.once('message', data => { clearTimeout(timeout); resolve(data) })
      worker.once('error', error => { clearTimeout(timeout); reject(error) })
      worker.postMessage({ state: source([consortium]), settings: { ...settings, method: 'monthly' }, revision: 'test' })
    })
    assert.equal(message.error, undefined)
    assert.equal(message.result.simulated.simulations, 50)
    assert.equal(message.result.matrix.length, 9)
    assert.equal(message.revision, 'test')
  } finally { await worker.terminate() }
})
