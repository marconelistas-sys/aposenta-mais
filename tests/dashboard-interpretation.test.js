import test from 'node:test'
import assert from 'node:assert/strict'
import { renderPlanInterpretation } from '../src/features/dashboard/plan-interpretation.js'
import { renderDashboard } from '../src/features/dashboard/dashboard.js'
import { state } from '../src/app/state.js'

function fixture() {
  const rows = [
    { year: '2026', previousFinancial: 10000, previousLiquid: 8000, financialAssets: 9500, liquidAssets: 7500, freeCashFlow: -1000, netFinancial: 9500, netWorth: 19500 },
    { year: '2027', previousFinancial: 9500, previousLiquid: 7500, financialAssets: 9000, liquidAssets: 7000, freeCashFlow: -1000, netFinancial: 9000, netWorth: 19000 },
    { year: '2028', previousFinancial: 9000, previousLiquid: 7000, financialAssets: 8500, liquidAssets: 6500, freeCashFlow: -1000, netFinancial: 8500, netWorth: 18500 }
  ]
  return { rows, openingFinancial: 10000, openingLiquid: 8000, retirement: '2027-07', viable: true, issues: [], firstFailure: null }
}

test('marcos distinguem saldos cadastrados, abertura do ano de aposentadoria e fechamento final', () => {
  const value = fixture(), before = structuredClone(value)
  const html = renderPlanInterpretation(value, { currency: 'BRL' })
  assert.match(html, /Hoje/)
  assert.match(html, /Saldos cadastrados, usados na abertura de 2026/)
  assert.match(html, /07\/2027/)
  assert.match(html, /Abertura de 2027, antes dos movimentos do ano/)
  assert.match(html, /Não representa o saldo no mês exato/)
  assert.match(html, /Dezembro de 2028/)
  assert.match(html, /R\$\s*9\.500,00/)
  assert.match(html, /Patrimônio total líquido de dívidas: R\$\s*18\.500,00/)
  assert.deepEqual(value, before)
})

test('orçamento negativo coberto por patrimônio não vira insuficiência e ações têm limite de três', () => {
  const html = renderPlanInterpretation(fixture(), { currency: 'BRL' })
  assert.match(html, /déficit do orçamento é coberto na projeção/)
  assert.match(html, /R\$\s*7\.500,00 de liquidez/)
  assert.doesNotMatch(html, /Falta dinheiro disponível/)
  const actions = html.split('class="plan-next-actions"')[1]
  assert.ok((actions.match(/<li>/g) || []).length <= 3)
  assert.match(actions, /Conferir os meses/)
  assert.match(actions, /Testar cenários menos favoráveis/)
})

test('primeira falta de liquidez prevalece mesmo com patrimônio positivo e pendências', () => {
  const value = fixture()
  value.firstFailure = { ...value.rows[1], liquidAssets: -500 }
  value.issues = ['Saldo de abertura']
  const html = renderPlanInterpretation(value, { currency: 'BRL' })
  assert.match(html, /Em 2027, a liquidez projetada é -R\$\s*500,00/)
  assert.match(html, /Falta dinheiro disponível/)
  assert.doesNotMatch(html, /déficit do orçamento é coberto/)
  const actions = html.split('class="plan-next-actions"')[1]
  assert.equal((actions.match(/<li>/g) || []).length, 3)
  assert.match(actions, /Revisar recursos disponíveis/)
  assert.match(actions, /Conferir dados e premissas/)
})

test('aposentadoria fora do horizonte não inventa saldo nem exige mudar aposentadoria passada', () => {
  const value = fixture()
  value.retirement = '2040-01'
  let html = renderPlanInterpretation(value, { currency: 'BRL' })
  assert.match(html, /Sem saldo projetado para esse marco/)
  assert.match(html, /Confirmar aposentadoria e horizonte/)
  value.retirement = '2020-01'
  html = renderPlanInterpretation(value, { currency: 'BRL' })
  assert.match(html, /Aposentadoria anterior ao horizonte/)
  assert.doesNotMatch(html, /Confirmar aposentadoria e horizonte/)
})

test('privacidade remove marcos, ações e forma do indicador complementar', () => {
  assert.equal(renderPlanInterpretation(fixture(), { currency: 'BRL', hidden: true }), '')
  const before = structuredClone(state)
  try {
    state.valuesHidden = true
    const html = renderDashboard()
    assert.doesNotMatch(html, /plan-milestones|plan-next-actions|Medidor de prontidão|stroke-dasharray/)
    assert.match(html, /Mostre os valores para consultar o indicador/)
  } finally { Object.assign(state, before) }
})
