// Optional read-only differential check against the sibling finapp engine.
// No database or credentials, only synthetic fixtures.
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { finappViability } from '../src/domain/finapp-viability.js'
import { createExportableState } from '../src/app/state-storage.js'

const python = `import sys,json
sys.path.insert(0,'../finapp/backend')
from app.engine import Parameters,ItemRow,InitialAssetRow,PensionContributionRow,run_projection
p=Parameters(current_year=2026,current_age=60,target_age=62,end_age=62,real_return=0.1,opening_year_period=0.5)
results=[]
for expense,salary_end,cost_end in ((90,2028,2028),(200,2028,2028),(90,2026,2028),(90,2026,2027)):
 r=run_projection(p,[ItemRow(True,100,'BRL',2026,salary_end)],[ItemRow(True,expense,'BRL',2026,cost_end)],[],[ItemRow(True,60,'BRL',2026,2028)],[],[],[InitialAssetRow(True,600,'BRL',True),InitialAssetRow(True,400,'BRL',False)],horizon_end_year=2028,pension_contributions=[PensionContributionRow(True,'P','P','Brazil',10,'BRL',2026,2027,opening_restricted_balance_brl=400)])
 results.append([dict(af=r.af[y],liquid=r.liquid_af[y],fcx=r.fcx[y]) for y in r.years])
print(json.dumps(results))`
const reference = JSON.parse(execFileSync('../finapp/backend/venv/bin/python', ['-B', '-c', python], { encoding: 'utf8', timeout: 30000 }))
function item(id, categoryId, amount, endDate = '2028-12-31') {
  return { id, type: categoryId === 'salary' ? 'income' : 'expense', categoryId, amount, currency: 'BRL', frequency: 'monthly', startDate: '2026-01-01', endDate, source: 'manual', recordKind: 'planned' }
}
for (const [index, [expense, salaryEnd, costEnd]] of [[90, 2028, 2028], [200, 2028, 2028], [90, 2026, 2028], [90, 2026, 2027]].entries()) {
  const state = createExportableState({ isDemo: false, plan: { currentAge: 60, retirementAge: 61, retirementMonth: '2027-01', targetAge: 62, horizonReferenceMonth: '2026-01', annualRealReturn: 0.1, investments: [{ id: 'cash', name: 'Cash', amount: 600, liquidity: 'available' }, { id: 'pension', name: 'Pension', amount: 400, liquidity: 'restricted', assetClass: 'pension' }] }, cashFlow: { items: [item('salary', 'salary', 100), item('cost', 'housing', expense), item('contribution', 'private-pension', 10, '2027-12-31')], annualGoals: [{ id: 'goal', name: 'Goal', amount: 60, currency: 'BRL', startYear: 2026, endYear: 2028, everyYears: 1, realGrowth: 0 }] } })
  state.plan.targetMonthlyIncome = 0
  state.cashFlow.items[0].endDate = `${salaryEnd}-12-31`
  state.cashFlow.items[1].endDate = `${costEnd}-12-31`
  const result = finappViability(state, { openingYearPeriod: 0.5, pensionMode: 'external', releases: [{ investmentId: 'pension', year: 2027 }] }, new Date('2026-01-01'))
  result.rows.forEach((row, year) => {
    for (const [actual, expected] of [[row.financialAssets, reference[index][year].af], [row.liquidAssets, reference[index][year].liquid], [row.freeCashFlow, reference[index][year].fcx]]) assert.ok(Math.abs(actual - expected) < 1e-8, `Diferença no cenário ${index}, ano ${row.year}`)
  })
}
console.log('Paridade aprovada com finapp: AF, liquidez e FCX, quatro cenários de três anos, com déficit, ano parcial, liberação previdenciária, salário encerrado e despesas com prazo.')
