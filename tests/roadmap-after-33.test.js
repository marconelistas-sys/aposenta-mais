import test from 'node:test'
import assert from 'node:assert/strict'
import { createOwnedStorage } from '../src/app/owned-storage.js'
import { createDataHistory } from '../src/app/data-history.js'
import { sanitizeStoredState, createExportableState } from '../src/app/state-storage.js'
import { financialCalendar, debtSchedule, commitmentEvents, validateCommitment } from '../src/domain/financial-calendar.js'
import { projectPostRetirement, defaultDecumulation, validateDecumulation } from '../src/domain/post-retirement.js'
import { reconcileMovement, movementLeg, refreshBudgetLinks } from '../src/domain/ledger-links.js'
import { sanitizeLedger } from '../src/domain/accounts.js'
import { calculateMultiCurrencyCashFlow } from '../src/domain/cash-flow.js'
import { guideCommitmentForm, guideMovementForm } from '../src/app/planning-forms.js'

const memory = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) } }
const now = new Date('2026-09-05T00:00:00Z')
const planState = (plan = {}, cashFlow = {}) => sanitizeStoredState({ plan: { currentAssets: 1200, monthlyContribution: 0, retirementMonth: '2026-09', annualRealReturn: 0, annualInflation: 0, expectedMonthlyBenefit: 0, targetMonthlyIncome: 100, ...plan }, cashFlow: { items: [], retirementMonth: '2026-09', ...cashFlow } })
const debt = { id: 'd', kind: 'debt', name: 'Dívida', amount: 1200, currency: 'BRL', date: '2026-01-31', installments: 12, annualRate: 0, saved: 0 }
const accounts = [{ id: 'a', name: 'Conta A', openingDate: '2026-01-01', openingBalance: 500, currency: 'BRL' }, { id: 'b', name: 'Conta B', openingDate: '2026-01-01', openingBalance: 0, currency: 'BRL' }]
const movement = { id: 'm', accountId: 'a', type: 'expense', amount: 100, date: '2026-08-10' }

test('espaços de visitante, conta A e conta B não compartilham plano nem exclusão', () => {
  const disk = memory(), storage = createOwnedStorage(() => disk)
  storage.setItem('plan', 'visitante')
  storage.select('user-a'); assert.equal(storage.getItem('plan'), null); storage.setItem('plan', 'a')
  storage.select('user-b'); assert.equal(storage.getItem('plan'), null); storage.setItem('plan', 'b')
  storage.removeItem('plan')
  storage.select('user-a'); assert.equal(storage.getItem('plan'), 'a')
  storage.select(null); assert.equal(storage.getItem('plan'), 'visitante')
  assert.throws(() => storage.select('../a'))
})
test('histórico e snapshots usam o mesmo isolamento do plano', () => {
  const disk = memory(), owned = createOwnedStorage(() => disk), scoped = createDataHistory(owned)
  owned.select('user-a'); scoped.checkpoint(planState()); scoped.record('export')
  owned.select('user-b'); assert.equal(scoped.read().snapshots.length, 0); assert.equal(scoped.read().events.length, 0)
  owned.select('user-a'); assert.equal(scoped.read().snapshots.length, 1)
})
test('dívida sem juros amortiza principal e ajusta última parcela em centavos', () => {
  const rows = debtSchedule({ ...debt, amount: 100, installments: 3 })
  assert.deepEqual(rows.map(row => row.amount), [33.33, 33.33, 33.34])
  assert.equal(rows.at(-1).balance, 0)
  assert.equal(rows[1].month, '2026-02')
})
test('dívida com juros efetivos respeita saldo, principal e prestação final', () => {
  const rows = debtSchedule({ ...debt, annualRate: 0.12 })
  assert.ok(rows[0].interest > 0)
  assert.ok(Math.abs(rows.reduce((sum, row) => sum + row.principal, 0) - 1200) < 0.001)
  assert.equal(rows.at(-1).balance, 0)
  assert.ok(rows.every(row => row.balance >= 0))
  assert.throws(() => validateCommitment({ ...debt, annualRate: NaN }))
  assert.throws(() => validateCommitment({ ...debt, installments: 0 }))
})
test('calendário ajusta dia 31, respeita anos bissextos e inclui fim manual', () => {
  const cashFlow = { items: [{ id: 'bill', type: 'expense', amount: 100, startDate: '2024-01-31', endDate: '2024-03-31', frequency: 'monthly', recordKind: 'planned' }] }
  assert.equal(financialCalendar(cashFlow, '2024-02').events[0].date, '2024-02-29')
  assert.equal(financialCalendar(cashFlow, '2024-03').events.length, 1)
  assert.equal(financialCalendar(cashFlow, '2024-04').events.length, 0)
})
test('calendário anual usa valor inteiro só no vencimento, não provisão', () => {
  const cashFlow = { items: [{ id: 'annual', amount: 1200, startDate: '2026-01-10', frequency: 'annual', recordKind: 'planned' }] }
  assert.equal(financialCalendar(cashFlow, '2027-01').events[0].amount, 1200)
  assert.equal(financialCalendar(cashFlow, '2027-02').events.length, 0)
})
test('calendário encerra salário, exclui realizados e informa os sem vencimento', () => {
  const cashFlow = { retirementMonth: '2026-09', items: [{ id: 'salary', type: 'income', startDate: '2026-01-01', frequency: 'monthly', endMode: 'retirement' }, { id: 'actual', recordKind: 'actual', startDate: '2026-09-01' }, { id: 'undated', frequency: 'monthly' }] }
  assert.equal(financialCalendar(cashFlow, '2026-08').events.length, 1)
  assert.equal(financialCalendar(cashFlow, '2026-09').events.length, 0)
  assert.equal(financialCalendar(cashFlow, '2026-09').undated.length, 1)
})
test('meta desembolsa só o restante no mês do prazo e nunca repete', () => {
  const goal = { ...debt, kind: 'goal', saved: 200 }
  assert.equal(commitmentEvents([goal], '2026-01')[0].amount, 1000)
  assert.equal(commitmentEvents([goal], '2026-02').length, 0)
  assert.equal(commitmentEvents([{ ...goal, saved: 1200 }], '2026-01').length, 0)
  assert.throws(() => validateCommitment({ ...goal, saved: 1500 }))
})
test('compromissos entram uma vez nas despesas e reduzem capacidade de aporte', () => {
  const state = planState({}, { commitments: [debt], currentEmergencyReserve: 0, emergencyReserveTarget: 0, items: [{ id: 'salary', type: 'income', categoryId: 'salary', amount: 1000, frequency: 'monthly', currency: 'BRL' }] })
  const result = calculateMultiCurrencyCashFlow(state.cashFlow, state.currency, state.exchangeRates, 0, [], now)
  assert.equal(result.monthlyExpenses, 100)
  assert.equal(result.sustainableContribution, 900)
})
test('pós-aposentadoria esgota patrimônio sem saldos negativos ou renda fictícia', () => {
  const state = planState(), before = structuredClone(state)
  const result = projectPostRetirement(state, { ...defaultDecumulation, years: 2 }, now)
  assert.equal(result.initialAssets, 1200)
  assert.equal(result.rows[11].assets, 0)
  assert.equal(result.firstShortfall, '2027-09')
  assert.equal(result.rows[12].shortfall, 100)
  assert.ok(result.rows.every(row => row.assets >= 0))
  assert.deepEqual(state, before)
})
test('benefício já cadastrado não é somado duas vezes', () => {
  const state = planState({ expectedMonthlyBenefit: 100 }, { items: [{ id: 'benefit', type: 'income', categoryId: 'other-income', amount: 100, frequency: 'monthly', currency: 'BRL' }] })
  const result = projectPostRetirement(state, { ...defaultDecumulation, years: 1, benefitIncluded: true }, now)
  assert.equal(result.rows[0].income, 100)
  assert.equal(result.endingAssets, 1200)
})
test('taxa efetiva de resgate aumenta retirada bruta para cobrir despesa líquida', () => {
  const result = projectPostRetirement(planState(), { ...defaultDecumulation, years: 1, withdrawalTax: 0.2 }, now)
  assert.equal(result.rows[0].withdrawn, 125)
  assert.equal(result.rows[0].taxes, 25)
  assert.equal(result.rows[0].shortfall, 0)
  assert.throws(() => validateDecumulation({ ...defaultDecumulation, withdrawalTax: 1 }))
})
test('custo anual e inflação nominal não alteram unidade dos gastos reais', () => {
  const result = projectPostRetirement(planState({ targetMonthlyIncome: 0, annualInflation: 0.1 }), { ...defaultDecumulation, years: 1, annualFee: 0.01 }, now)
  assert.ok(Math.abs(result.endingAssets - 1188) < 0.001)
  assert.ok(Math.abs(result.rows[11].nominalAssets - 1306.8) < 0.001)
})
test('rendimento individual cadastrado prevalece sobre retorno padrão', () => {
  const state = planState({ targetMonthlyIncome: 0, annualRealReturn: 0.5, investments: [{ id: 'i', name: 'Investimento', amount: 1000, monthlyContribution: 0, returnType: 'real', returnValue: 0.1 }] })
  const result = projectPostRetirement(state, { ...defaultDecumulation, years: 1 }, now)
  assert.ok(Math.abs(result.endingAssets - 1100) < 0.001)
})
test('modo orçamento segue despesas com prazo em vez da meta constante', () => {
  const state = planState({}, { items: [{ id: 'expense', type: 'expense', categoryId: 'housing', amount: 70, currency: 'BRL', frequency: 'monthly', startDate: '2026-09-01', endDate: '2026-09-30' }] })
  const result = projectPostRetirement(state, { ...defaultDecumulation, years: 1, expenseMode: 'budget' }, now)
  assert.equal(result.rows[0].expenses, 70)
  assert.equal(result.rows[1].expenses, 0)
  assert.equal(result.endingAssets, 1130)
})
test('conciliação verifica valor com sinal, data, conta e referência duplicada', () => {
  const ledger = { accounts, movements: [movement, { ...movement, id: 'other' }] }
  const input = { movementId: 'm', accountId: 'a', amount: -100, date: '2026-08-10', reference: 'extrato-1' }
  const result = reconcileMovement(ledger, input, now)
  assert.equal(result.movements[0].reconciliations[0].reference, 'extrato-1')
  assert.equal(ledger.movements[0].reconciliations, undefined)
  for (const patch of [{ amount: 100 }, { date: '2026-08-11' }, { accountId: 'b' }, { reference: '' }]) assert.throws(() => reconcileMovement(ledger, { ...input, ...patch }, now))
  assert.throws(() => reconcileMovement(result, { ...input, movementId: 'other' }, now))
})
test('transferência concilia os dois lados sem transformar em receita do orçamento', () => {
  const transfer = { ...movement, type: 'transfer', destinationId: 'b', receivedAmount: 100 }
  assert.equal(movementLeg(transfer, 'a'), -100)
  assert.equal(movementLeg(transfer, 'b'), 100)
  let ledger = { accounts, movements: [transfer] }
  for (const accountId of ['a', 'b']) ledger = reconcileMovement(ledger, { movementId: 'm', accountId, date: transfer.date, amount: movementLeg(transfer, accountId), reference: 'same-id' }, now)
  assert.equal(ledger.movements[0].reconciliations.length, 2)
  assert.throws(() => refreshBudgetLinks({ items: [] }, { accounts, movements: [{ ...transfer, budgetCategoryId: 'salary' }] }))
})
test('vínculo realizado é idempotente, atualiza valor e desaparece com movimento', () => {
  const ledger = { accounts, movements: [{ ...movement, budgetCategoryId: 'housing' }] }
  const first = refreshBudgetLinks({ items: [] }, ledger)
  assert.equal(refreshBudgetLinks({ items: first }, ledger).length, 1)
  assert.equal(first[0].recordKind, 'actual')
  ledger.movements[0].amount = 90
  assert.equal(refreshBudgetLinks({ items: first }, ledger)[0].amount, 90)
  assert.deepEqual(refreshBudgetLinks({ items: first }, { accounts, movements: [] }), [])
})
test('restauração mantém premissas, compromissos, vínculos e conciliações', () => {
  const ledger = reconcileMovement({ accounts, movements: [{ ...movement, budgetCategoryId: 'housing' }] }, { movementId: 'm', accountId: 'a', amount: -100, date: movement.date, reference: 'stmt' }, now)
  const source = planState({ decumulation: { ...defaultDecumulation, years: 40 } }, { commitments: [debt], ledger })
  const restored = sanitizeStoredState(createExportableState(source))
  assert.equal(restored.plan.decumulation.years, 40)
  assert.equal(restored.cashFlow.commitments.length, 1)
  assert.equal(restored.cashFlow.items.length, 1)
  assert.equal(restored.cashFlow.ledger.movements[0].reconciliations[0].reference, 'stmt')
  assert.equal(restored.plan.currentAssets, 1200)
})
test('conciliação adulterada não sobrevive à sanitização', () => {
  const ledger = sanitizeLedger({ accounts, movements: [{ ...movement, reconciliations: [{ accountId: 'a', amount: -99, date: movement.date, reference: 'x', at: now.toISOString() }] }] })
  assert.equal(ledger.movements[0].reconciliations, undefined)
})

globalThis.localStorage = memory()
const { state, selectPlanOwner, saveState, copyGuestPlanToAccount } = await import('../src/app/state.js')
const { updatePortfolioFromAccount } = await import('../src/app/portfolio-link.js')
const { changeAccounts, linkMovementBudget } = await import('../src/app/accounts.js')
const { renderCalendar } = await import('../src/features/cash-flow/calendar.js')
const { renderPostRetirement } = await import('../src/features/plan/post-retirement.js')
const { renderLedgerLinks } = await import('../src/features/accounts/links.js')
const { prepareLedgerStatement, ledgerStatementView, renderLedgerStatement } = await import('../src/features/accounts/statement-review.js')
test('troca real do estado limpa dados anteriores, migração preserva visitante e não sobrescreve conta', () => {
  selectPlanOwner(null); Object.assign(state, planState({ currentAssets: 876 })); state.isDemo = false; saveState()
  selectPlanOwner('a'); assert.notEqual(state.plan.currentAssets, 876)
  copyGuestPlanToAccount(); assert.equal(state.plan.currentAssets, 876)
  assert.throws(() => copyGuestPlanToAccount())
  selectPlanOwner('b'); assert.notEqual(state.plan.currentAssets, 876)
  selectPlanOwner(null); assert.equal(state.plan.currentAssets, 876)
})
test('saldo associado substitui patrimônio e mantém aporte sem dupla contagem', () => {
  Object.assign(state, planState({ investments: [{ id: 'i', name: 'Investimento', amount: 900, monthlyContribution: 10 }] }, { ledger: { accounts, movements: [movement] } }))
  const data = new FormData(); data.set('accountId', 'a'); data.set('investmentId', 'i'); data.set('date', '2026-08-10')
  updatePortfolioFromAccount(data, '2026-09-05')
  assert.equal(state.plan.currentAssets, 400)
  assert.equal(state.plan.monthlyContribution, 10)
  updatePortfolioFromAccount(data, '2026-09-05')
  assert.equal(state.plan.currentAssets, 400)
  data.set('date', '2027-01-01'); assert.throws(() => updatePortfolioFromAccount(data, '2026-09-05'))
})
test('realizado compatível exige substituição explícita e não duplica totais', () => {
  Object.assign(state, planState({}, { ledger: { accounts, movements: [movement] }, items: [{ id: 'actual', type: 'expense', categoryId: 'housing', amount: 100, currency: 'BRL', recordKind: 'actual', startDate: movement.date }] }))
  const data = new FormData(); data.set('movementId', 'm'); data.set('categoryId', 'housing')
  const before = structuredClone(state)
  assert.throws(() => linkMovementBudget(data), /Já existe/)
  assert.deepEqual(state, before)
  data.set('existingItemId', 'actual'); linkMovementBudget(data)
  assert.equal(state.cashFlow.items.length, 1)
  assert.equal(state.cashFlow.items[0].id, 'ledger:m')
  assert.equal(state.cashFlow.items[0].amount, 100)
  data.set('existingItemId', ''); linkMovementBudget(data)
  assert.equal(state.cashFlow.items.length, 1)
})
test('editar movimento cancela conciliação e atualiza realizado vinculado', () => {
  const ledger = reconcileMovement({ accounts, movements: [{ ...movement, budgetCategoryId: 'housing' }] }, { movementId: 'm', accountId: 'a', date: movement.date, amount: -100, reference: 'stmt' }, now)
  Object.assign(state, planState({}, { ledger }))
  const data = new FormData(); for (const [key, value] of Object.entries({ ...movement, amount: 90 })) data.set(key, value)
  changeAccounts('movement', data)
  assert.equal(state.cashFlow.ledger.movements[0].reconciliations, undefined)
  assert.equal(state.cashFlow.items[0].amount, 90)
  assert.deepEqual(state.cashFlow.ledger.reconciliationHistory.map(row => row.operation), ['confirmed', 'edited'])
})

test('prévia TXT não altera saldo e reconhece a referência após conciliar', async () => {
  Object.assign(state, planState({}, { ledger: { accounts, movements: [movement] } }))
  const before = structuredClone(state)
  const file = new File(['data;descricao;valor;moeda\n2026-08-10;Mercado;-100,00;BRL'], 'extrato.txt', { type: 'text/plain' })
  await prepareLedgerStatement(file, 'a')
  const row = ledgerStatementView.preview.rows[0]
  assert.equal(row.amount, -100)
  assert.deepEqual(state, before)
  assert.match(renderLedgerStatement(), /Escolha após conferir/)
  state.cashFlow.ledger = reconcileMovement(state.cashFlow.ledger, { ...row, movementId: 'm', accountId: 'a' }, now)
  await prepareLedgerStatement(file, 'a')
  assert.equal(ledgerStatementView.preview.rows[0].reference, row.reference)
  assert.match(renderLedgerStatement(), /<span>Conciliado<\/span>/)
})
test('prévia TXT rejeita moeda inválida, data impossível, linhas extras e extensão incorreta', async () => {
  Object.assign(state, planState({}, { ledger: { accounts, movements: [movement] } }))
  for (const line of ['2026-02-30;Mercado;-100;BRL', '2026-08-10;Mercado;-100;XYZ', '2026-08-10;Mercado;-100;USD', '2026-08-10;Mercado;-100,123;BRL']) {
    await assert.rejects(() => prepareLedgerStatement(new File([`data;descricao;valor;moeda\n${line}`], 'extrato.txt'), 'a'))
  }
  await assert.rejects(() => prepareLedgerStatement(new File(['data;descricao;valor\n2026-08-10;a;-1'], 'extrato.pdf'), 'a'))
  await assert.rejects(() => prepareLedgerStatement(new File(['data;descricao;valor\n' + Array.from({ length: 101 }, () => '2026-08-10;a;-1').join('\n')], 'extrato.txt'), 'a'))
})
test('telas novas escapam conteúdo e ocultam valores sem perder navegação', () => {
  Object.assign(state, planState({ currentAge: 60, targetAge: 62, horizonReferenceMonth: '2026-01' }, { commitments: [{ ...debt, name: '<script>bad</script>' }], ledger: { accounts, movements: [movement] } }))
  assert.match(renderCalendar(), /&lt;script&gt;/)
  assert.doesNotMatch(renderCalendar(), /<script>bad/)
  assert.match(renderPostRetirement(), /scope="col"/)
  assert.match(renderLedgerLinks(), /data-budget-link/)
  state.valuesHidden = true
  assert.equal(renderLedgerLinks(), '')
  assert.doesNotMatch(renderCalendar(), /data-commitment-form/)
  assert.doesNotMatch(renderPostRetirement(), /data-decumulation-form/)
})

test('formulário habilita apenas campos necessários para dívida ou meta', () => {
  const fields = { kind: { value: 'debt' }, saved: {}, installments: {}, annualRate: {} }
  const form = { elements: { namedItem: name => fields[name] } }
  guideCommitmentForm(form)
  assert.equal(fields.saved.disabled, true)
  assert.equal(fields.installments.required, true)
  fields.kind.value = 'goal'; guideCommitmentForm(form)
  assert.equal(fields.saved.disabled, false)
  assert.equal(fields.installments.disabled, true)
  assert.equal(fields.annualRate.required, false)
})
test('transferência na mesma moeda replica valor, outra moeda exige valor recebido', () => {
  const fields = { type: { value: 'expense' }, accountId: { value: 'a' }, destinationId: { value: 'b' }, amount: { value: '100' }, receivedAmount: { value: '' } }
  const form = { elements: { namedItem: name => fields[name] } }
  guideMovementForm(form, accounts)
  assert.equal(fields.receivedAmount.disabled, true)
  fields.type.value = 'transfer'; guideMovementForm(form, accounts)
  assert.equal(fields.receivedAmount.required, true)
  assert.equal(fields.receivedAmount.readOnly, true)
  assert.equal(fields.receivedAmount.value, '100')
  guideMovementForm(form, [accounts[0], { ...accounts[1], currency: 'USD' }])
  assert.equal(fields.receivedAmount.readOnly, false)
})
