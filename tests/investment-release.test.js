import test from 'node:test'
import assert from 'node:assert/strict'
import { state, upsertInvestment, removeInvestment } from '../src/app/state.js'
import { sanitizeStoredState } from '../src/app/state-storage.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { renderInvestments } from '../src/features/investments/investments.js'

const year = new Date().getUTCFullYear()
const investment = { id: 'precatorio', name: 'Precatório', assetClass: 'other', liquidity: 'restricted', amount: 10000, monthlyContribution: 0, returnType: 'real', returnValue: 0 }
function setup() {
  Object.assign(state, sanitizeStoredState({ valuesHidden: false, plan: { currentAge: 60, retirementAge: 61, targetAge: 62, horizonReferenceMonth: `${year}-01`, retirementMonth: `${year + 1}-01`, annualRealReturn: 0, finappMethod: { openingConfirmed: true, pensionConfirmed: true, releases: [] } }, cashFlow: { items: [] } }))
}

test('release entered in the portfolio persists and makes the balance liquid only in the chosen year', () => {
  const before = structuredClone(state)
  try {
    setup()
    upsertInvestment({ ...investment, releaseYear: String(year + 1), acquiredAt: `${year}-01-01` })
    assert.deepEqual(state.plan.finappMethod.releases, [{ investmentId: investment.id, year: year + 1 }])
    assert.equal(state.plan.investments[0].acquiredAt, undefined)
    Object.assign(state, sanitizeStoredState(JSON.parse(JSON.stringify(state))))
    const rows = finappViability(state).rows
    assert.equal(rows[0].liquidAssets, 0)
    assert.equal(rows[1].liquidAssets, 10000)
    assert.equal(rows[2].liquidAssets, 10000)
    assert.ok(rows.every(row => row.income === 0 && row.financialAssets === 10000))
    const html = renderInvestments()
    assert.match(html, /name="investmentReleaseYear"/)
    assert.match(html, /Para precatórios e outros saldos restritos/)
    assert.match(html, new RegExp(`<dt>Ano previsto de liberação</dt><dd>${year + 1}</dd>`))
    state.valuesHidden = true
    assert.match(renderInvestments(), /<dt>Ano previsto de liberação<\/dt><dd>Oculto<\/dd>/)
  } finally { Object.assign(state, before) }
})

test('editing, clearing, making available and deleting keep the shared release schedule consistent', () => {
  const before = structuredClone(state)
  try {
    setup()
    upsertInvestment({ ...investment, releaseYear: year + 1 })
    upsertInvestment({ ...investment, id: 'other', releaseYear: year + 2 })
    upsertInvestment({ ...investment, name: 'Precatório atualizado' })
    assert.equal(state.plan.finappMethod.releases.length, 2)
    upsertInvestment({ ...investment, releaseYear: year + 2 })
    assert.equal(state.plan.finappMethod.releases.length, 2)
    assert.equal(state.plan.finappMethod.releases.find(row => row.investmentId === investment.id).year, year + 2)
    upsertInvestment({ ...investment, releaseYear: '' })
    assert.deepEqual(state.plan.finappMethod.releases, [{ investmentId: 'other', year: year + 2 }])
    upsertInvestment({ ...investment, releaseYear: year + 1 })
    upsertInvestment({ ...investment, liquidity: 'available' })
    assert.deepEqual(state.plan.finappMethod.releases, [{ investmentId: 'other', year: year + 2 }])
    removeInvestment('other')
    assert.deepEqual(state.plan.finappMethod.releases, [])
  } finally { Object.assign(state, before) }
})

test('invalid release years and already available balances are rejected before mutating the plan', () => {
  const before = structuredClone(state)
  try {
    setup()
    const initial = structuredClone(state)
    for (const releaseYear of [year - 1, 2200, year + .5, 'invalid']) assert.throws(() => upsertInvestment({ ...investment, releaseYear }), /ano de liberação/)
    assert.throws(() => upsertInvestment({ ...investment, liquidity: 'available', releaseYear: year + 1 }), /liquidez restrita/)
    assert.deepEqual(state, initial)
  } finally { Object.assign(state, before) }
})
