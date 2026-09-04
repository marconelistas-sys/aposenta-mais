import test from 'node:test'
import assert from 'node:assert/strict'

import {
  projectAssetSeriesDetailed,
  projectAssetSeries,
  projectAssetSeriesWithSchedules,
  projectRetirement,
  projectRetirementWithSchedules,
  validateProjectionInput,
  yearsUntilGoal
} from '../src/domain/retirement.js'

const baseInput = {
  currentAge: 35,
  retirementAge: 65,
  currentAssets: 50000,
  monthlyContribution: 1000,
  annualRealReturn: 0.05,
  targetMonthlyIncome: 8000,
  expectedMonthlyBenefit: 3500,
  annualWithdrawalRate: 0.04
}

function assertClose(actual, expected, tolerance = 0.02) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Esperava ${expected}, recebeu ${actual}`
  )
}

test('projeta patrimônio e renda para o cenário base', () => {
  const result = projectRetirement(baseInput)

  assert.equal(result.months, 360)
  assertClose(result.projectedAssets, 1031473.03)
  assertClose(result.targetAssets, 1350000)
  assertClose(result.projectedMonthlyIncome, 6938.24)
  assertClose(result.monthlyIncomeGap, 1061.76)
  assertClose(result.requiredMonthlyContribution, 1390.65)
  assert.equal(result.goalReached, false)
})

test('calcula aportes sem retorno real', () => {
  const result = projectRetirement({
    ...baseInput,
    currentAssets: 0,
    annualRealReturn: 0
  })

  assert.equal(result.projectedAssets, 360000)
  assert.equal(result.monthlyRate, 0)
  assert.equal(result.requiredMonthlyContribution, 3750)
})

test('identifica meta atingida', () => {
  const result = projectRetirement({
    ...baseInput,
    currentAssets: 500000,
    monthlyContribution: 4000
  })

  assert.equal(result.goalReached, true)
  assert.ok(result.monthlyIncomeGap < 0)
  assert.ok(result.progress > 1)
})

test('trata renda já coberta pelo benefício', () => {
  const result = projectRetirement({
    ...baseInput,
    targetMonthlyIncome: 3000,
    expectedMonthlyBenefit: 3500
  })

  assert.equal(result.targetAssets, 0)
  assert.equal(result.progress, 1)
  assert.equal(result.requiredMonthlyContribution, 0)
  assert.equal(result.goalReached, true)
})

test('rejeita idades e valores inválidos', () => {
  assert.throws(
    () => validateProjectionInput({ ...baseInput, retirementAge: 30 }),
    /maior que a idade atual/
  )
  assert.throws(
    () => validateProjectionInput({ ...baseInput, currentAssets: -1 }),
    /não pode ser negativo/
  )
  assert.throws(
    () => validateProjectionInput({ ...baseInput, annualWithdrawalRate: 0 }),
    /taxa de retirada/
  )
})

test('encontra o primeiro prazo anual que alcança a meta', () => {
  const years = yearsUntilGoal({
    ...baseInput,
    retirementAge: 65,
    monthlyContribution: 2000
  })

  assert.equal(years, 26)
})

test('gera série anual coerente com a projeção final', () => {
  const series = projectAssetSeries(baseInput, 30)
  const result = projectRetirement(baseInput)

  assert.equal(series.length, 31)
  assertClose(series.at(-1).assets, result.projectedAssets)
})

test('decompõe o saldo entre capital aportado e rendimento real composto', () => {
  const series = projectAssetSeriesDetailed(baseInput, 30)
  const last = series.at(-1)

  assert.equal(last.contributedCapital, baseInput.currentAssets + baseInput.monthlyContribution * 360)
  assertClose(last.contributedCapital + last.investmentGrowth, last.assets)
  assert.ok(last.investmentGrowth > 0)
})

test('mantém resultados finitos quando renda desejada e benefício são zero', () => {
  const result = projectRetirement({
    ...baseInput,
    targetMonthlyIncome: 0,
    expectedMonthlyBenefit: 0
  })

  for (const value of Object.values(result)) {
    if (typeof value === 'number') assert.equal(Number.isFinite(value), true)
  }
})

test('mais aporte não reduz o patrimônio projetado', () => {
  const base = projectRetirement(baseInput)
  const increased = projectRetirement({ ...baseInput, monthlyContribution: 1500 })
  assert.ok(increased.projectedAssets > base.projectedAssets)
})

test('contribuições previdenciárias programadas aumentam o patrimônio somente durante o prazo', () => {
  const input = {
    ...baseInput,
    currentAge: 40,
    retirementAge: 42,
    currentAssets: 0,
    monthlyContribution: 100,
    annualRealReturn: 0,
    targetMonthlyIncome: 0,
    expectedMonthlyBenefit: 0
  }
  const schedules = [{ amount: 50, startDate: '2026-09-01', endDate: '2027-08-31' }]
  const result = projectRetirementWithSchedules(input, schedules, new Date('2026-09-04T12:00:00Z'))
  const series = projectAssetSeriesWithSchedules(input, schedules, 2, new Date('2026-09-04T12:00:00Z'))

  assert.equal(result.scheduledContributionTotal, 600)
  assert.equal(result.currentScheduledMonthlyContribution, 50)
  assert.equal(result.projectedAssets, 3000)
  assert.equal(series.at(-1).assets, 3000)
  assert.equal(series.at(-1).scheduledContributionTotal, 600)
})
