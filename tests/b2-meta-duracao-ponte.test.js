import test from 'node:test'
import assert from 'node:assert/strict'
import { projectRetirement, projectRetirementWithSchedules } from '../src/domain/retirement.js'
import { annuityFactor, incomeFromAssets, retirementTarget, withdrawalRuleMonthlyRate } from '../src/domain/retirement-target.js'

// B2: the wealth target is the present value of the monthly gap from retirement to the horizon,
// with the spouse benefit from its own start (bridge), discounted at the lower of the plan return
// and the rate implied by the withdrawal rule over 30 years.
const today = new Date('2026-01-15T00:00:00Z')
const base = {
  currentAge: 35, retirementAge: 65, retirementMonth: '2056-01', horizonReferenceMonth: '2026-01', targetAge: 94,
  currentAssets: 50000, monthlyContribution: 1000, annualRealReturn: 0.05,
  targetMonthlyIncome: 8000, expectedMonthlyBenefit: 3500, annualWithdrawalRate: 0.04
}
const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`)

test('B2: the rate implied by the 4% rule exhausts the capital in exactly 30 years', () => {
  const rate = withdrawalRuleMonthlyRate(0.04)
  close(annuityFactor(360, rate), 300)
  close((1 + rate) ** 12 - 1, 0.01303, 1e-3)
  assert.ok(withdrawalRuleMonthlyRate(0.03) < 0, 'a 3% withdrawal over 30 years implies a negative real rate')
})

test('B2: continuity, a constant gap over 30 years gives the old target, gap × 12 / withdrawal rate', () => {
  const result = projectRetirement(base, today)
  assert.equal(result.target.method, 'horizon')
  assert.equal(result.target.durationMonths, 360)
  close(result.targetAssets, 4500 * 12 / 0.04)
  close(result.projectedInvestmentIncome, result.projectedAssets * 0.04 / 12)
})

test('B2: without a valid target age the reference duration of 30 years applies', () => {
  for (const targetAge of [undefined, null, 60]) {
    const result = projectRetirement({ ...base, targetAge }, today)
    assert.equal(result.target.method, 'reference')
    close(result.targetAssets, 1350000)
  }
})

test('B2: a shorter retirement needs less, a longer one needs more', () => {
  const short = projectRetirement({ ...base, targetAge: 80 }, today)
  const long = projectRetirement({ ...base, targetAge: 105 }, today)
  assert.equal(short.target.durationMonths, 16 * 12)
  assert.equal(long.target.durationMonths, 41 * 12)
  const rate = withdrawalRuleMonthlyRate(0.04)
  close(short.targetAssets, 4500 * annuityFactor(192, rate))
  close(long.targetAssets, 4500 * annuityFactor(492, rate))
  assert.ok(short.targetAssets < 1350000 && long.targetAssets > 1350000)
  assert.ok(short.requiredMonthlyContribution < long.requiredMonthlyContribution)
})

test('B2: a plan return below the rule rate is used, so the target is never more optimistic than the plan', () => {
  const result = projectRetirement({ ...base, annualRealReturn: 0.005 }, today)
  assert.equal(result.target.discountSource, 'plan')
  close(result.target.discountAnnualRate, 0.005)
  close(result.targetAssets, 4500 * annuityFactor(360, 1.005 ** (1 / 12) - 1))
})

test('B2: bridge, the spouse benefit enters when the spouse retires, five years after', () => {
  const couple = { ...base, spouseEnabled: true, spouseRetirementMonth: '2061-01', spouseExpectedMonthlyBenefit: 2000 }
  const result = projectRetirement(couple, today)
  const rate = withdrawalRuleMonthlyRate(0.04)
  assert.equal(result.target.bridgeMonths, 60)
  close(result.targetAssets, 4500 * annuityFactor(60, rate) + 2500 * (annuityFactor(360, rate) - annuityFactor(60, rate)))
  // Before B2 the spouse benefit was ignored when it started after the retirement.
  assert.ok(result.targetAssets < 1350000)
  // Already retired spouse: active from the first month, no bridge.
  const earlier = projectRetirement({ ...couple, spouseRetirementMonth: '2050-01' }, today)
  assert.equal(earlier.target.bridgeMonths, 0)
  close(earlier.targetAssets, 2500 * 12 / 0.04)
  // Spouse benefit after the horizon: the whole retirement is bridge.
  const late = projectRetirement({ ...couple, spouseRetirementMonth: '2090-01' }, today)
  close(late.targetAssets, 1350000)
})

test('B2: the target capital pays every monthly gap and ends at zero at the horizon', () => {
  const couple = { ...base, targetAge: 90, spouseEnabled: true, spouseRetirementMonth: '2060-07', spouseExpectedMonthlyBenefit: 1500 }
  const { target } = projectRetirement(couple, today)
  const rate = (1 + target.discountAnnualRate) ** (1 / 12) - 1
  let assets = target.targetAssets
  for (let month = 0; month < target.durationMonths; month++) {
    assets = assets * (1 + rate) - (month < target.bridgeMonths ? 4500 : 3000)
  }
  close(assets, 0, 1e-6)
})

test('B2: reaching the target closes the income gap, with or without bridge', () => {
  for (const extra of [{}, { spouseEnabled: true, spouseRetirementMonth: '2061-01', spouseExpectedMonthlyBenefit: 2000 }]) {
    const input = { ...base, ...extra }
    const result = projectRetirement(input, today)
    const funded = projectRetirement({ ...input, monthlyContribution: result.requiredMonthlyContribution }, today)
    close(funded.projectedAssets, result.targetAssets)
    close(funded.monthlyIncomeGap, 0, 1e-6)
    close(funded.progress, 1)
  }
})

test('B2: with benefits above the target, assets turn into a level income until the horizon', () => {
  const result = projectRetirement({ ...base, expectedMonthlyBenefit: 9000 }, today)
  assert.equal(result.targetAssets, 0)
  close(result.projectedInvestmentIncome, result.projectedAssets / annuityFactor(360, withdrawalRuleMonthlyRate(0.04)))
  close(incomeFromAssets(result.target, 0), 0)
})

test('B2: scheduled contributions use the same target and income rule', () => {
  const input = { ...base, targetAge: 85 }
  const plain = projectRetirement(input, today)
  const scheduled = projectRetirementWithSchedules(input, [{ amount: 500, startDate: '2026-02-01', endDate: '2030-12-31' }], today)
  close(scheduled.targetAssets, plain.targetAssets)
  close(scheduled.projectedInvestmentIncome, incomeFromAssets(plain.target, scheduled.projectedAssets))
  assert.ok(scheduled.requiredMonthlyContribution < plain.requiredMonthlyContribution)
})

test('B2: target pieces are deterministic and do not depend on the contribution', () => {
  const a = retirementTarget(base, { months: 360, spouseMonths: null, asOfDate: today })
  const b = retirementTarget({ ...base, monthlyContribution: 9999 }, { months: 360, spouseMonths: null, asOfDate: today })
  assert.deepEqual(a, b)
})

test('B2: the explanation names the duration, the discount and the bridge', async () => {
  const { retirementTargetBasis, retirementTargetBridgeNote } = await import('../src/shared/retirement-target.js')
  const plain = text => text.replace(/[  ]/g, ' ')
  const couple = { ...base, spouseEnabled: true, spouseRetirementMonth: '2061-01', spouseExpectedMonthlyBenefit: 2000 }
  const text = plain(retirementTargetBasis(projectRetirement(couple, today), couple))
  assert.match(text, /^Meta para 30 anos de aposentadoria, até dezembro de 2085, quando você completa 94 anos\./)
  assert.match(text, /taxa que esgota o patrimônio em 30 anos com retirada de 4%/)
  assert.match(text, /Nos primeiros 5 anos, antes do benefício do cônjuge, o patrimônio cobre a lacuna maior\.$/)
  assert.equal(retirementTargetBridgeNote(projectRetirement(couple, today)), 'entra 5 anos depois da sua aposentadoria; a meta cobre esse período-ponte')
  const low = { ...base, annualRealReturn: 0.005, targetAge: undefined }
  const reference = plain(retirementTargetBasis(projectRetirement(low, today), low))
  assert.match(reference, /^Sem idade-alvo depois da aposentadoria, a meta cobre 30 anos/)
  assert.match(reference, /o retorno do plano, que é menor que a taxa implícita/)
  assert.equal(retirementTargetBridgeNote(projectRetirement(base, today)), '')
})
