// Optional local audit. Reads financial tables only, never users or credentials.
// Does not write source data, import records, or print individual records.
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { createExportableState } from '../src/app/state-storage.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { cashFlowTimeline } from '../src/domain/cash-flow-timeline.js'
import { calculateFinappRisk } from '../src/domain/finapp-risk.js'
import { defaultRiskSettings } from '../src/domain/risk-plan.js'

const python = `import sys,json,sqlite3,dataclasses,random
from pathlib import Path
sys.path.insert(0,'../finapp/backend')
from app import engine,adapter
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
path=Path(sys.argv[1]).resolve()
uri='file:'+str(path)+'?mode=ro'
con=sqlite3.connect(uri,uri=True);con.row_factory=sqlite3.Row
fields=[f.name for f in dataclasses.fields(engine.Parameters)]
p=dict(con.execute('SELECT '+','.join(fields)+' FROM parameters').fetchone())
fx_mode=con.execute('SELECT chf_brl_rate_mode FROM parameters').fetchone()[0]
if len(sys.argv)>2: p['chf_brl_rate']=float(sys.argv[2])
params=engine.Parameters(**p)
db=Session(create_engine('sqlite:///'+uri+'&uri=true'))
inputs=dict(revenues=adapter.load_revenues(db),budget_brazil=adapter.load_budget_items(db,'Brazil'),budget_switzerland=adapter.load_budget_items(db,'Switzerland'),goals=adapter.load_goals(db),assets=adapter.load_assets(db),one_time_flows=adapter.load_one_time_flows(db),initial_assets=adapter.load_initial_assets(db),pension_contributions=adapter.load_pension_contributions(db,params.chf_brl_rate))
end=params.current_year+params.target_age-params.current_age
proj=engine.run_projection(params,**inputs,horizon_end_year=end)
matrix=engine.compute_sensitivity(params,**inputs)
# Capture the actual normal draws from Python, including its inflation draws.
draws=[]
class Capture(random.Random):
 def normalvariate(self,mu,sigma):
  value=super().normalvariate(mu,sigma);draws.append(value);return value
engine.random.Random=Capture
mc=engine.run_monte_carlo(params,**inputs,horizon_end_year=end,n_simulations=50,seed=12345)
length=len(proj.years);stride=2*length-1
paths=[[draws[s*stride+(0 if y==0 else 2*y-1)] for y in range(length)] for s in range(50)]
print(json.dumps(dict(params=p,fx_mode=fx_mode,inputs={k:[dataclasses.asdict(r) for r in v] for k,v in inputs.items()},projection=[dict(year=y,fcx=proj.fcx[y],af=proj.af[y]) for y in proj.years],matrix=[dataclasses.asdict(c) for c in matrix],mc=dict(success=mc.probability_of_success_at_target_age,p10=mc.af_p10,p50=mc.af_p50,p90=mc.af_p90),paths=paths)))
db.close();con.close()`
const rateOverride = process.argv[3]
if (rateOverride !== undefined && (!Number.isFinite(Number(rateOverride)) || Number(rateOverride) <= 0 || Number(rateOverride) >= 1000000)) throw new Error('Cotação de comparação inválida.')
const source = JSON.parse(execFileSync('../finapp/backend/venv/bin/python', ['-B', '-c', python, process.argv[2] || '../finapp/backend/data/finad.db', ...(rateOverride ? [rateOverride] : [])], { encoding: 'utf8', maxBuffer: 4000000, timeout: 30000 }))
const { params: p, inputs: input } = source
const items = []
for (const [key, categoryId, type] of [['revenues', 'salary', 'income'], ['budget_brazil', 'other-expense', 'expense'], ['budget_switzerland', 'other-expense', 'expense'], ['pension_contributions', 'private-pension', 'expense']]) {
  input[key].filter(row => row.include).forEach((row, index) => {
    if (row.real_growth !== 0 || (row.periodicity ?? 1) !== 1) throw new Error('Auditoria exige adaptador adicional para crescimento ou periodicidade dos lançamentos.')
    items.push({ id: `${key}:${index}`, description: key, type, categoryId, amount: row.monthly_amount, currency: row.currency, frequency: 'monthly', startDate: `${row.start_year}-01-01`, endDate: `${row.end_year}-12-31`, source: 'manual', recordKind: 'planned' })
  })
}
for (const [index, row] of input.one_time_flows.entries()) if (row.include && row.classification === 'New cash flow' && !row.already_included_in_opening_wealth) items.push({ id: `flow:${index}`, type: 'income', categoryId: 'other-income', amount: row.amount, currency: row.currency, frequency: 'occasional', startDate: `${row.year}-01-01`, recordKind: 'planned' })
const annual = (list, amount) => list.filter(row => row.include).map((row, index) => ({ id: `${amount}:${index}`, name: amount, amount: row[amount], currency: row.currency, startYear: row.start_year, endYear: row.end_year, everyYears: row.periodicity || 1, realGrowth: row.real_growth }))
const value = createExportableState({ currency: 'BRL', exchangeRates: { rates: { EUR: 1, CHF: 1, BRL: p.chf_brl_rate, USD: 1 } }, plan: { currentAge: p.current_age, targetAge: p.target_age, horizonReferenceMonth: `${p.current_year}-01`, annualRealReturn: p.real_return, annualInflation: p.inflation, targetMonthlyIncome: 0, investments: input.initial_assets.filter(row => row.include).map((row, index) => ({ id: `initial:${index}`, name: 'Saldo inicial', amount: row.amount * (row.currency === 'CHF' ? p.chf_brl_rate : 1), liquidity: row.liquid_now ? 'available' : 'restricted', returnType: 'real', returnValue: p.real_return })), finappMethod: { openingYearPeriod: p.opening_year_period, pensionMode: 'external' } }, cashFlow: { items, annualGoals: annual(input.goals, 'monthly_amount'), nonFinancialAssets: annual(input.assets, 'value') } })
const today = new Date(`${p.current_year}-01-01T00:00:00Z`)
const base = finappViability(value, undefined, today)
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 0.5, `${label}: diferença acima de 0,50 na moeda-base`)
base.rows.forEach((row, index) => { close(row.freeCashFlow, source.projection[index].fcx, 'FCX'); close(row.financialAssets, source.projection[index].af, 'AF') })
const monthly = cashFlowTimeline(value, `${p.current_year}-01`, 12)
close(monthly.reduce((sum, row) => sum + row.balance, 0), source.projection[0].fcx, 'FCX mensal somado')
const risk = calculateFinappRisk(value, { ...defaultRiskSettings, annualVolatility: p.return_volatility, simulations: 50 }, today, source.paths)
assert.equal(risk.simulated.probabilitySuccess, source.mc.success)
for (const row of risk.simulated.series) for (const percentile of [10, 50, 90]) close(row[`afP${percentile}`], source.mc[`p${percentile}`][row.year], 'Monte Carlo com os mesmos sorteios')
for (const cell of risk.matrix) {
  const reference = source.matrix.find(row => row.cost_level === cell.costMultiplier && row.return_rate === cell.annualRealReturn)
  assert.ok(reference)
  close(cell.financialAssets, reference.af_at_target_age, 'Matriz AF final')
  close(cell.minFinancial, reference.min_af_through_target_age, 'Matriz AF mínimo')
}
console.log(JSON.stringify({ audit: 'passed', sourceConfiguredFxMode: source.fx_mode, comparisonFxBasis: rateOverride ? 'explicit override, same for both engines' : 'stored fixed baseline, same for both engines, not the live quote', years: base.rows.length, source: 'read-only financial tables', fcx: 'all years agree', financialAssets: 'all years agree', risk: '50 identical return paths, P10/P50/P90 and success agree', matrixCells: risk.matrix.length, firstYearFcxSign: Math.sign(base.rows[0].freeCashFlow), firstYearLegacyFundedSign: Math.sign(base.rows[0].freeCashFlow - base.rows[0].pensionCredits), negativeFlowYears: base.rows.filter(row => row.freeCashFlow < 0).length, tolerance: '0.50 BRL for cent rounding', excluded: 'Source consortium not imported. Liquidity release mapping and account browser state not audited.' }, null, 2))
