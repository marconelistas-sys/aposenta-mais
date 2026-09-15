import test from 'node:test'
import assert from 'node:assert/strict'

const memory = new Map()
globalThis.localStorage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key)
}

const { removeInvestment, resetState, state, updatePlan, upsertInvestment } = await import('../src/app/state.js')
const { renderInvestments } = await import('../src/features/investments/investments.js')

test('cadastro deriva os totais da carteira e permite edição', () => {
  resetState()
  const saved = upsertInvestment({
    id: 'tesouro',
    name: 'Tesouro IPCA',
    assetClass: 'fixed-income',
    amount: 50000,
    monthlyContribution: 700,
    annualRealReturn: null
  })
  upsertInvestment({
    id: saved.id,
    name: 'Tesouro IPCA 2035',
    assetClass: 'fixed-income',
    amount: 52000,
    monthlyContribution: 800,
    annualRealReturn: 0.06
  })

  assert.equal(state.plan.investments.length, 1)
  assert.equal(state.plan.currentAssets, 52000)
  assert.equal(state.plan.monthlyContribution, 800)
  assert.equal(state.plan.investments[0].name, 'Tesouro IPCA 2035')
  assert.equal(state.plan.investments[0].returnType, 'real')
  assert.equal(state.plan.investments[0].returnValue, 0.06)
})

test('alterar o retorno padrão preserva a taxa específica', () => {
  resetState()
  upsertInvestment({ id: 'padrao', name: 'Carteira padrão', assetClass: 'fund', amount: 30000, monthlyContribution: 300, annualRealReturn: null })
  upsertInvestment({ id: 'especifico', name: 'Fundo específico', assetClass: 'fund', amount: 20000, monthlyContribution: 200, annualRealReturn: 0.08 })

  updatePlan({ annualRealReturn: 0.03 })

  assert.equal(state.plan.investments[0].returnType, 'default')
  assert.equal(state.plan.investments[1].returnValue, 0.08)
})

test('interface explica o padrão, o retorno específico e os impactos', () => {
  resetState()
  upsertInvestment({ id: 'padrao', name: 'Reserva investida', assetClass: 'fixed-income', amount: 40000, monthlyContribution: 500, annualRealReturn: null })
  upsertInvestment({ id: 'especifico', name: '<Fundo global>', assetClass: 'fund', amount: 10000, monthlyContribution: 100, annualRealReturn: 0.07 })

  const html = renderInvestments()

  assert.match(html, /1 de 2/)
  assert.match(html, /Padrão do plano/)
  assert.match(html, /Taxa nominal anual/)
  assert.match(html, /Percentual do CDI/)
  assert.match(html, /IPCA mais taxa real/)
  assert.match(html, /Com os rendimentos cadastrados/)
  assert.match(html, /Sem rendimento real/)
  assert.match(html, /1 ponto percentual menores/)
  assert.match(html, /renda mensal retirada do patrimônio usa outra regra/i)
  assert.match(html, /Padrão/)
  assert.match(html, />Real</)
  assert.doesNotMatch(html, /<Fundo global>/)
})

test('carteira preserva rendimento nominal, CDI e IPCA informado', () => {
  resetState()
  upsertInvestment({ id: 'nominal', name: 'Prefixado', assetClass: 'fixed-income', amount: 10000, monthlyContribution: 0, returnType: 'nominal', returnValue: 0.12 })
  upsertInvestment({ id: 'cdi', name: 'CDB', assetClass: 'fixed-income', amount: 10000, monthlyContribution: 0, returnType: 'cdi', returnValue: 1.1, indexAnnualRate: 0.14 })
  upsertInvestment({ id: 'ipca', name: 'Tesouro IPCA', assetClass: 'fixed-income', amount: 10000, monthlyContribution: 0, returnType: 'ipca', returnValue: 0.06 })

  const html = renderInvestments()

  assert.equal(state.plan.investments[0].returnType, 'nominal')
  assert.equal(state.plan.investments[1].indexAnnualRate, 0.14)
  assert.match(html, /nominal resulta em/)
  assert.match(html, /do CDI de/)
  assert.match(html, /IPCA \+/)
})

test('exclusão recalcula patrimônio e aportes', () => {
  resetState()
  upsertInvestment({ id: 'a', name: 'A', assetClass: 'other', amount: 10000, monthlyContribution: 100, annualRealReturn: null })
  upsertInvestment({ id: 'b', name: 'B', assetClass: 'other', amount: 20000, monthlyContribution: 200, annualRealReturn: null })

  removeInvestment('a')

  assert.equal(state.plan.currentAssets, 20000)
  assert.equal(state.plan.monthlyContribution, 200)
})

test('a carteira exibe o mostrador de liquidez com a distribuição declarada e o oculta na privacidade', () => {
  resetState()
  upsertInvestment({ id: 'liquido', name: 'Conta líquida', assetClass: 'cash', amount: 6000, monthlyContribution: 0, liquidity: 'available', annualRealReturn: null })
  upsertInvestment({ id: 'preso', name: 'Precatório', assetClass: 'other', amount: 3000, monthlyContribution: 0, liquidity: 'restricted', annualRealReturn: null })
  upsertInvestment({ id: 'sem-info', name: 'Fundo legado', assetClass: 'fund', amount: 1000, monthlyContribution: 0, liquidity: 'unknown', annualRealReturn: null })

  const html = renderInvestments()
  assert.match(html, /liquidity-gauge-face/)
  assert.match(html, /Disponível para resgate — 60%/)
  assert.match(html, /Restrita ou com prazo — 30%/)
  assert.match(html, /Não informada — 10%/)

  state.valuesHidden = true
  const hiddenHtml = renderInvestments()
  assert.doesNotMatch(hiddenHtml, /liquidity-gauge-face|60%|30%|10%/)
  state.valuesHidden = false
})

test('carteira recém-criada, sem investimentos declarados, mostra 100% de liquidez não informada', () => {
  resetState()
  assert.equal(state.plan.investments.length, 0)
  assert.ok(state.plan.currentAssets > 0)

  const html = renderInvestments()
  assert.match(html, /Não informada — 100%/)
  assert.match(html, /Disponível para resgate — 0%/)
  assert.match(html, /Restrita ou com prazo — 0%/)
})
