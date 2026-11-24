import test from 'node:test'
import assert from 'node:assert/strict'
import { depletionMonth, freedomCapital, monthlyRate, retirementMultiple, retirementMultipleSensitivity } from '../src/domain/retirement-multiple.js'

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} ≠ ${expected} ± ${tolerance}`)
const slide = { schedule: [{ from: 0, monthly: 30000 }], monthlyCost: 30000, currentCapital: 3000000, monthlyContribution: 0, monthsToRetirement: 120, startAge: 50, targetAge: 85, realRate: 0.04 }
const scenario = (result, key) => result.scenarios.find(row => row.key === key)

test('H6: reproduz o slide (Regra do 1%, Liberdade e Legado)', () => {
  const result = retirementMultiple(slide)
  near(result.monthlyRate, 0.0032737, 1e-7, 'taxa mensal')
  near(result.grownCapital, 4440733, 1, 'capital atual na aposentadoria')

  const one = scenario(result, 'onePercent')
  assert.equal(Math.round(one.capital), 3000000)
  assert.equal(Math.round(one.multiple), 100)
  near(one.withdrawalRate, 0.12, 1e-9, 'retirada 1%')
  assert.equal(one.depletionMonth, 120)
  assert.equal(one.depletionAge, 60)
  assert.equal(one.requiredContribution, 0)
  assert.equal(one.status, 'has')

  const freedom = scenario(result, 'freedom')
  near(freedom.capital, 6863972, 50, 'Liberdade')
  assert.equal(Math.round(freedom.multiple), 229)
  near(freedom.withdrawalRate, 0.052, 0.0005, 'retirada Liberdade')
  near(freedom.requiredContribution, 16519, 2, 'aporte Liberdade')
  assert.equal(freedom.depletionAge, null)
  assert.equal(freedom.lastsUntilAge, 85)
  assert.equal(freedom.status, 'short')

  const legacy = scenario(result, 'legacy')
  near(legacy.capital, 9193840, 50, 'Legado')
  assert.equal(Math.round(legacy.multiple), 306)
  near(legacy.withdrawalRate, 0.039, 0.0005, 'retirada Legado')
  near(legacy.requiredContribution, 32401, 2, 'aporte Legado')

  near(result.current.capital, 4440733, 1, 'plano atual')
  assert.equal(Math.round(result.current.multiple), 148)
  assert.equal(result.current.depletionMonth, 201)
  assert.equal(result.current.depletionAge, 66)
})

test('H6.5: o alvo arredondado do slide dá 16,5 mil de aporte', () => {
  const i = monthlyRate(0.04)
  const factor = (Math.pow(1 + i, 120) - 1) / i
  near((6860000 - 3000000 * Math.pow(1 + i, 120)) / factor, 16492, 2, 'aporte com alvo arredondado')
})

test('H6: renda garantida de 10 mil desde os 50 reduz a lacuna', () => {
  const result = retirementMultiple({ ...slide, schedule: [{ from: 0, monthly: 20000 }] })
  near(scenario(result, 'onePercent').capital, 2000000, 1, '1%')
  assert.equal(Math.round(scenario(result, 'onePercent').multiple), 67)
  assert.equal(scenario(result, 'onePercent').depletionAge, 60)
  near(scenario(result, 'freedom').capital, 4575981, 50, 'Liberdade')
  assert.equal(Math.round(scenario(result, 'freedom').multiple), 153)
  near(scenario(result, 'freedom').requiredContribution, 922, 2, 'aporte Liberdade')
  near(scenario(result, 'legacy').capital, 6129227, 50, 'Legado')
  assert.equal(Math.round(scenario(result, 'legacy').multiple), 204)
  near(scenario(result, 'legacy').requiredContribution, 11510, 2, 'aporte Legado')
  assert.equal(result.guaranteedIncome, 10000)
})

test('H6: período-ponte (renda de 10 mil só aos 65)', () => {
  const result = retirementMultiple({ ...slide, schedule: [{ from: 0, monthly: 30000 }, { from: 180, monthly: 20000 }] })
  near(scenario(result, 'freedom').capital, 5938917, 50, 'Liberdade')
  assert.equal(Math.round(scenario(result, 'freedom').multiple), 198)
  near(scenario(result, 'freedom').withdrawalRate, 0.061, 0.0005, 'retirada')
  near(scenario(result, 'legacy').capital, 7492160, 50, 'Legado')
  assert.equal(Math.round(scenario(result, 'legacy').multiple), 250)
})

test('H7: sensibilidade a 3%, 4%, 5% e à taxa do plano', () => {
  const rows = retirementMultipleSensitivity(slide, [{ rate: 0.03, source: 'fixed' }, { rate: 0.04, source: 'fixed' }, { rate: 0.05, source: 'fixed' }, { rate: 0, source: 'plan' }])
  assert.deepEqual(rows.map(row => Math.round(row.freedom.multiple)), [262, 229, 202, 420])
  assert.deepEqual(rows.slice(0, 3).map(row => Math.round(row.legacy.multiple)), [406, 306, 246])
  assert.equal(rows[3].legacy.multiple, null)
  assert.equal(rows[3].legacy.reason, 'rate')
})

test('sensibilidade: a taxa do plano igual a uma fixa aparece uma vez', () => {
  const rows = retirementMultipleSensitivity(slide, [{ rate: 0.04, source: 'fixed' }, { rate: 0.04, source: 'plan' }])
  assert.equal(rows.length, 1)
})

test('bordas: lacuna zero, capital acima do alvo, já aposentado e sem idades', () => {
  const noGap = retirementMultiple({ ...slide, schedule: [{ from: 0, monthly: 0 }] })
  for (const row of noGap.scenarios) {
    assert.equal(row.capital, 0)
    assert.equal(row.multiple, 0)
    assert.equal(row.status, 'no-gap')
  }

  const rich = retirementMultiple({ ...slide, currentCapital: 8000000 })
  assert.equal(scenario(rich, 'freedom').status, 'has')
  assert.equal(scenario(rich, 'legacy').status, 'grows-there')
  assert.equal(scenario(rich, 'legacy').requiredContribution, 0)

  const covered = retirementMultiple({ ...slide, monthlyContribution: 20000 })
  assert.equal(scenario(covered, 'freedom').status, 'contribution-covers')

  const retired = retirementMultiple({ ...slide, monthsToRetirement: 0, startAge: 60, currentCapital: 5000000 })
  assert.equal(scenario(retired, 'freedom').requiredContribution, null)
  assert.equal(scenario(retired, 'freedom').status, 'short')
  near(scenario(retired, 'freedom').shortfall, scenario(retired, 'freedom').capital - 5000000, 1e-6, 'falta')
  assert.equal(retired.current.capital, 5000000)

  const noAges = retirementMultiple({ ...slide, monthsToRetirement: null, startAge: null })
  assert.equal(scenario(noAges, 'freedom').available, false)
  assert.equal(scenario(noAges, 'freedom').reason, 'ages')
  assert.equal(Math.round(scenario(noAges, 'legacy').multiple), 306)
  assert.equal(scenario(noAges, 'onePercent').status, 'unknown')
  assert.equal(noAges.current, null)

  const pastHorizon = retirementMultiple({ ...slide, targetAge: 50 })
  assert.equal(scenario(pastHorizon, 'freedom').reason, 'horizon')
})

test('Liberdade com taxa zero soma as lacunas; duração sem fim vira null', () => {
  assert.equal(freedomCapital([{ from: 0, monthly: 1000 }], 12, 0), 12000)
  assert.equal(depletionMonth(1e9, [{ from: 0, monthly: 1 }], monthlyRate(0.04)), null)
  assert.throws(() => retirementMultiple({ ...slide, monthlyCost: 0 }), RangeError)
})

test('lacuna de referência: renda que cobre os primeiros meses não zera a Regra do 1%', () => {
  const result = retirementMultiple({ ...slide, schedule: [{ from: 0, monthly: 0 }, { from: 12, monthly: 30000 }] })
  assert.equal(result.firstGap, 30000)
  assert.equal(Math.round(scenario(result, 'onePercent').capital), 3000000)
  assert.ok(scenario(result, 'freedom').capital < 6863972, 'o primeiro ano coberto reduz a Liberdade')
  assert.equal(scenario(result, 'onePercent').depletionAge, 61, 'o primeiro ano sem saques adia o fim')
})
