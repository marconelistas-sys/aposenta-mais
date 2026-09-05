import { sanitizeCashFlowItem, sanitizeInvestment, createExportableState } from '../app/state-storage.js'
import { convertCurrency } from '../shared/exchange-rates.js'
import { sanitizeAnnualRows, sanitizeMigration } from './annual-planning.js'

const equal = (left, right) => JSON.stringify(Object.entries(left).sort()) === JSON.stringify(Object.entries(right).sort())

export function parseFinappImport(text) {
  if (typeof text !== 'string' || text.length > 2000000) throw new Error('Arquivo excede 2 MB.')
  const file = JSON.parse(text)
  if (file?.format !== 'aposenta-finapp-import' || ![1, 2].includes(file.version) || !Array.isArray(file.items) || !Array.isArray(file.investments) || !Array.isArray(file.pending)) throw new Error('Formato de importação inválido.')
  if (file.scope !== undefined && !['full', 'horizon'].includes(file.scope)) throw new Error('Escopo do arquivo inválido.')
  if (file.items.length > 100 || file.investments.length > 30 || file.pending.length > 100) throw new Error('Arquivo excede os limites de importação.')
  const ids = new Set()
  const checkId = item => {
    if (!/^finapp:[a-z_]+:\d+$/.test(item.id) || ids.has(item.id)) throw new Error('Identificador inválido ou repetido.')
    ids.add(item.id)
  }
  const items = file.items.map(item => {
    checkId(item)
    if (!['BRL', 'CHF', 'USD', 'EUR'].includes(item.currency) || item.source !== 'manual' || item.recordKind !== 'planned') throw new Error('Lançamento inválido.')
    const safe = sanitizeCashFlowItem(item)
    if (!safe || !equal(safe, item)) throw new Error('Lançamento requer correção antes da importação.')
    return safe
  })
  const investments = file.investments.map(item => {
    checkId(item)
    const safe = sanitizeInvestment(item)
    if (!safe || !equal(safe, item)) throw new Error('Investimento inválido.')
    return safe
  })
  if (file.investmentCurrency !== 'BRL') throw new Error('Moeda patrimonial inválida.')
  function annual(key) {
    const rows = file[key] ?? []
    if (!Array.isArray(rows) || rows.length > 50) throw new Error('Lista anual inválida.')
    for (const row of rows) checkId(row)
    const safe = sanitizeAnnualRows(rows)
    if (safe.length !== rows.length || safe.some((row, index) => !equal(row, rows[index]))) throw new Error('Registro anual inválido.')
    return safe
  }
  const planParameters = {}
  for (const [key, min, max] of [['currentAge', 16, 99], ['targetAge', 17, 110], ['annualRealReturn', -0.99, 1], ['annualInflation', -0.99, 1]]) {
    const value = file.planParameters?.[key]
    if (value !== undefined) {
      if (!Number.isFinite(value) || value < min || value > max || (key === 'targetAge' && !Number.isInteger(value))) throw new Error('Premissa inválida.')
      planParameters[key] = value
    }
  }
  if (file.planParameters?.horizonReferenceMonth !== undefined) {
    if (!/^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(file.planParameters.horizonReferenceMonth)) throw new Error('Referência do horizonte inválida.')
    planParameters.horizonReferenceMonth = file.planParameters.horizonReferenceMonth
  }
  const migration = sanitizeMigration({ source: 'finapp', pending: file.pending, importedAt: file.createdAt })
  if (file.version === 2 && migration.pending.length !== file.pending.length) throw new Error('Pendência inválida.')
  return { items, investments, annualGoals: annual('annualGoals'), nonFinancialAssets: annual('nonFinancialAssets'), migration, planParameters, scope: file.scope || 'full', pendingCount: file.pending.length }
}

export function mergeFinappImport(current, file, mode = 'merge') {
  if (!['merge', 'replace', 'horizon'].includes(mode)) throw new Error('Modo de importação inválido.')
  if (file.scope === 'horizon' && mode !== 'horizon') throw new Error('Este arquivo só atualiza a idade-alvo. Selecione Atualizar somente a idade-alvo do horizonte.')
  const replacing = mode === 'replace'
  const next = createExportableState(current)
  if (mode === 'horizon') {
    const parameters = file.planParameters
    if (!Number.isInteger(parameters?.targetAge) || parameters.targetAge <= next.plan.currentAge || parameters.currentAge !== next.plan.currentAge || !parameters.horizonReferenceMonth) throw new Error('O arquivo precisa conter idade-alvo e idade atual compatível com o plano. Revise as idades antes de aplicar o horizonte.')
    next.plan.targetAge = parameters.targetAge
    next.plan.horizonReferenceMonth = parameters.horizonReferenceMonth
    return { state: createExportableState(next), added: 0, skipped: 0, pending: 0, removed: 0, mode }
  }
  const removed = next.plan.investments.length + next.cashFlow.items.length + next.cashFlow.commitments.length + next.cashFlow.consortia.length + next.cashFlow.annualGoals.length + next.cashFlow.nonFinancialAssets.length + next.cashFlow.ledger.accounts.length + next.cashFlow.ledger.movements.length + next.scenarios.length + next.customCategories.length
  if (replacing) {
    next.plan = { ...next.plan, ...file.planParameters, investments: [], currentAssets: 0, monthlyContribution: 0, expectedMonthlyBenefit: 0, targetMonthlyIncome: 0, decumulation: undefined, riskSettings: undefined, finappMethod: undefined }
    // Retirement dates are user choices, not the source's projection/checkpoint horizon.
    next.plan.retirementMonth = null
    next.cashFlow = { items: [], annualGoals: [], nonFinancialAssets: [], recurringIncome: 0, occasionalIncome: 0, essentialExpenses: 0, variableExpenses: 0, debtPayments: 0, annualExpenses: 0, currentEmergencyReserve: 0, emergencyReserveTarget: 0, reserveBuildMonths: 12 }
    next.scenarios = []; next.customCategories = []; next.isDemo = false
  }
  if (!replacing && current.isDemo) throw new Error('Crie um plano pessoal antes de importar. Dados de demonstração não serão misturados.')
  if (!replacing && !next.plan.investments.length && (next.plan.currentAssets > 0 || next.plan.monthlyContribution > 0) && file.investments.length) throw new Error('Detalhe o patrimônio e o aporte existentes na Carteira antes de importar, para não perder valores agregados.')
  let added = 0, skipped = 0
  function merge(existing, incoming, limit) {
    const result = [...existing]
    for (const item of incoming) {
      const previous = result.find(row => row.id === item.id)
      if (previous) {
        if (!equal(previous, item)) throw new Error(`Conflito no registro ${item.id}. Nenhum dado foi aplicado.`)
        skipped++
      } else { result.push(item); added++ }
    }
    if (result.length > limit) throw new Error(`Importação excederia o limite de ${limit} registros. Nenhum dado foi aplicado.`)
    return result
  }
  const investments = file.investments.map(item => ({ ...item, amount: Math.round(convertCurrency(item.amount, 'BRL', next.currency, next.exchangeRates) * 100) / 100 }))
  next.plan.investments = merge(next.plan.investments, investments, 30)
  next.cashFlow.items = merge(next.cashFlow.items, file.items, 100)
  next.cashFlow.annualGoals = merge(next.cashFlow.annualGoals, file.annualGoals || [], 50)
  next.cashFlow.nonFinancialAssets = merge(next.cashFlow.nonFinancialAssets, file.nonFinancialAssets || [], 50)
  if (file.migration) {
    const previous = replacing ? [] : next.cashFlow.finappMigration?.pending || []
    const pending = [...previous.filter(row => !file.migration.pending.some(other => other.table === row.table && other.id === row.id)), ...file.migration.pending]
    if (pending.length > 100) throw new Error('Limite de pendências excedido.')
    next.cashFlow.finappMigration = { ...file.migration, pending }
  }
  return { state: createExportableState(next), added, skipped, pending: file.pendingCount, removed: replacing ? removed : 0, mode }
}
