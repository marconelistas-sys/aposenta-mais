import { previewInvestmentBalances } from '../domain/statement-investment-balances.js'
import { reconcileOwnTransfers } from '../domain/own-transfers.js'
import { planStatementUpdates } from '../domain/statement-batch.js'
import { cashFlowItemLimit } from '../shared/limits.js'
import { defaultPlan } from '../data/mock-plan.js'
import { sanitizeCurrencyTrends, validateAnnualRealReturns } from '../domain/investment-returns.js'
import { defaultCashFlow } from '../data/mock-cash-flow.js'
import {
  loadStoredState,
  removeStoredState,
  sanitizeCashFlow,
  sanitizeCashFlowItem,
  sanitizeCustomCategories,
  sanitizeInvestments,
  sanitizeStoredState,
  stateVersion,
  storageKeys
} from './state-storage.js'
import { convertCurrency, sanitizeExchangeRates } from '../shared/exchange-rates.js'
import { currencies, normalizeCurrency } from '../shared/currencies.js'
import { investmentBalanceCurrency, investmentNativeAmount, investmentNativeContribution, investmentTotals, syncInvestmentCurrencies, syncPlanInvestments, round2 } from '../domain/investment-currency.js'
import { ownedStorage } from './owned-storage.js'
import { validateTargetAllocation } from '../domain/target-allocation.js'
import { validatePensionInvestment } from '../domain/pension-investment-links.js'

const unavailableStorage = {
  getItem: () => null,
  setItem: () => { throw new Error('Armazenamento indisponível') },
  removeItem: () => { throw new Error('Armazenamento indisponível') }
}

function resolveStorage() {
  try {
    return globalThis.localStorage || unavailableStorage
  } catch {
    return unavailableStorage
  }
}

const appStorage = ownedStorage
const savedState = loadStoredState(appStorage)

export const state = {
  ...savedState,
  version: stateVersion
}

export function selectPlanOwner(userId = null) {
  ownedStorage.select(userId)
  for (const key of Object.keys(state)) delete state[key]
  Object.assign(state, loadStoredState(appStorage), { version: stateVersion })
}

export function copyGuestPlanToAccount() {
  if (!ownedStorage.owner) throw new Error('Entre em sua conta primeiro.')
  if (!state.isDemo) throw new Error('Exporte e revise o plano da conta antes de substituir seus dados.')
  const guest = loadStoredState(resolveStorage())
  if (guest.isDemo || guest.dataDeleted) throw new Error('Não há plano de visitante para copiar.')
  replaceFinancialData(guest)
}

export function saveState() {
  try {
    appStorage.setItem(storageKeys.current, JSON.stringify(state))
    try {
      appStorage.removeItem(storageKeys.deletionMarker)
    } catch {
      // A versão atual tem precedência sobre um marcador antigo.
    }
    return true
  } catch {
    // O aplicativo continua funcional quando o armazenamento está indisponível.
    return false
  }
}

export function toggleValues() {
  state.valuesHidden = !state.valuesHidden
  saveState()
}

export function updatePlan(patch) {
  const nextPlan = { ...state.plan, ...patch }
  if ((patch.retirementAge !== undefined && patch.retirementAge !== state.plan.retirementAge) || (patch.currentAge !== undefined && patch.currentAge !== state.plan.currentAge)) {
    const now = new Date()
    nextPlan.retirementMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + Math.round((nextPlan.retirementAge - nextPlan.currentAge) * 12), 1)).toISOString().slice(0, 7)
    state.cashFlow.retirementMonth = nextPlan.retirementMonth
  }
  if (nextPlan.spouseEnabled
    && Number.isFinite(nextPlan.spouseCurrentAge)
    && Number.isFinite(nextPlan.spouseRetirementAge)
    && !(patch.spouseRetirementMonth && patch.spouseRetirementMonth !== state.plan.spouseRetirementMonth)
    && (!nextPlan.spouseRetirementMonth || (patch.spouseRetirementAge !== undefined && patch.spouseRetirementAge !== state.plan.spouseRetirementAge)
      || (patch.spouseCurrentAge !== undefined && patch.spouseCurrentAge !== state.plan.spouseCurrentAge))) {
    const now = new Date()
    nextPlan.spouseRetirementMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + Math.round((nextPlan.spouseRetirementAge - nextPlan.spouseCurrentAge) * 12), 1)).toISOString().slice(0, 7)
  }
  if (Array.isArray(nextPlan.investments) && nextPlan.investments.length > 0) {
    const currentContribution = nextPlan.investments.reduce((total, investment) => total + investment.monthlyContribution, 0)
    const requestedContribution = Number.isFinite(patch.monthlyContribution)
      ? patch.monthlyContribution
      : currentContribution
    if (Math.abs(requestedContribution - currentContribution) > 0.001) {
      nextPlan.investments = nextPlan.investments.map((investment, index) => ({
        ...investment,
        monthlyContribution: currentContribution > 0
          ? investment.monthlyContribution * requestedContribution / currentContribution
          : index === 0 ? requestedContribution : 0
      }))
    }
    nextPlan.currentAssets = nextPlan.investments.reduce((total, investment) => total + investment.amount, 0)
    nextPlan.monthlyContribution = nextPlan.investments.reduce((total, investment) => total + investment.monthlyContribution, 0)
  }
  state.cashFlow.spouseRetirementMonth = nextPlan.spouseEnabled ? nextPlan.spouseRetirementMonth || null : null
  state.plan = nextPlan
  state.isDemo = false
  state.lastUpdatedAt = new Date().toISOString()
  saveState()
}

export function setMigrationResolved(table, id, resolved = true) {
  const migration = state.cashFlow.finappMigration
  if (!migration?.pending?.some(row => row.table === table && row.id === id)) throw new Error('Pendência não encontrada.')
  const others = (migration.resolved || []).filter(row => !(row.table === table && row.id === id))
  updateCashFlow({ finappMigration: { ...migration, resolved: resolved ? [...others, { table, id, at: new Date().toISOString() }] : others } })
}

export function setCurrencyTrends(rates) {
  updatePlan({ currencyTrends: sanitizeCurrencyTrends({ base: state.currency, rates }) })
}

export function setTargetAllocation(candidate) {
  updatePlan({ targetAllocation: candidate === null ? null : validateTargetAllocation(candidate) })
}

export function upsertInvestment(candidate) {
  validateAnnualRealReturns(candidate.annualRealReturns)
  if (candidate.annualFee !== undefined && candidate.annualFee !== null && (!Number.isFinite(candidate.annualFee) || candidate.annualFee < 0 || candidate.annualFee > 0.1)) throw new RangeError('Informe um custo anual entre 0% e 10%.')
  const releaseYear = candidate.releaseYear === '' || candidate.releaseYear == null ? null : Number(candidate.releaseYear)
  if (Object.hasOwn(candidate, 'releaseYear') && releaseYear !== null) {
    if (!Number.isInteger(releaseYear) || releaseYear < new Date().getUTCFullYear() || releaseYear > 2199) throw new TypeError('Informe um ano de liberação entre o ano atual e 2199.')
    if (candidate.liquidity === 'available') throw new TypeError('Para prever uma liberação futura, escolha liquidez restrita ou com prazo.')
  }
  const id = candidate.id || globalThis.crypto?.randomUUID?.() || `investment-${Date.now()}`
  const current = Array.isArray(state.plan.investments) ? state.plan.investments : []
  const existingIndex = current.findIndex((investment) => investment.id === id)
  const next = [...current]
  // A foreign balance currency means amount and contribution were typed in that currency.
  const foreign = currencies[candidate.currency] && candidate.currency !== state.currency
  const balanceAsOf = candidate.balanceAsOf || new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(balanceAsOf) || !Number.isFinite(Date.parse(balanceAsOf)) || new Date(balanceAsOf).toISOString().slice(0, 10) !== balanceAsOf) throw new TypeError('Informe uma data válida para o saldo.')
  const previousRecord = { ...(existingIndex >= 0 ? current[existingIndex] : {}) }
  candidate = { ...(previousRecord.statementAccount ? { statementAccount: previousRecord.statementAccount, statementInvestmentName: previousRecord.statementInvestmentName } : {}), ...candidate, balanceAsOf, balanceSource: 'manual' }
  const record = foreign
    ? { ...candidate, id, nativeAmount: round2(Number(candidate.amount)), nativeMonthlyContribution: round2(Number(candidate.monthlyContribution) || 0), amount: convertCurrency(Number(candidate.amount) || 0, candidate.currency, state.currency, state.exchangeRates), monthlyContribution: convertCurrency(Number(candidate.monthlyContribution) || 0, candidate.currency, state.currency, state.exchangeRates) }
    : { ...candidate, id }
  if (existingIndex >= 0) next[existingIndex] = record
  else next.push(record)
  const investments = syncInvestmentCurrencies(sanitizeInvestments(next), state.currency, state.exchangeRates)
  const saved = investments.find((investment) => investment.id === id)
  if (!saved) throw new TypeError('Revise os dados do investimento.')
  if (saved.assetClass !== 'pension' && state.cashFlow.items.some(item => item.pensionInvestmentId === id)) throw new TypeError('Desvincule as contribuições previdenciárias antes de mudar a classe deste investimento.')
  const method = state.plan.finappMethod || {}
  const releases = (method.releases || []).filter(row => row.investmentId !== id || !Object.hasOwn(candidate, 'releaseYear') && saved.liquidity !== 'available')
  if (Object.hasOwn(candidate, 'releaseYear') && releaseYear !== null) releases.push({ investmentId: id, year: releaseYear })
  updatePlan({
    investments,
    finappMethod: { ...method, releases },
    ...investmentTotals(investments)
  })
  return saved
}

export function removeInvestment(id) {
  if (state.cashFlow.items.some(item => item.pensionInvestmentId === id)) throw new TypeError('Desvincule as contribuições previdenciárias deste investimento antes de removê-lo.')
  const investments = (state.plan.investments || []).filter((investment) => investment.id !== id)
  if (investments.length === (state.plan.investments || []).length) {
    throw new TypeError('Investimento não encontrado.')
  }
  updatePlan({
    investments,
    finappMethod: { ...state.plan.finappMethod, releases: (state.plan.finappMethod?.releases || []).filter(row => row.investmentId !== id) },
    currentAssets: investments.reduce((total, investment) => total + investment.amount, 0),
    monthlyContribution: investments.reduce((total, investment) => total + investment.monthlyContribution, 0)
  })
}

export function updateCashFlow(patch) {
  state.cashFlow = { ...state.cashFlow, ...patch }
  state.cashFlow.items = reconcileOwnTransfers(state.cashFlow.items, state.cashFlow.ownStatementAccounts)
  state.isDemo = false
  state.lastUpdatedAt = new Date().toISOString()
  saveState()
}

export function addCashFlowItem(item) {
  validatePensionInvestment(item, state.plan.investments, state.customCategories)
  validateIncomeEnd(item)
  if (item.recordKind === 'actual' && !item.startDate) {
    throw new TypeError('Informe a data do lançamento realizado.')
  }
  if (item.startDate && item.endDate && item.endDate < item.startDate) {
    throw new RangeError('A data final deve ser igual ou posterior à data inicial.')
  }
  const nextCashFlow = sanitizeCashFlow({
    ...state.cashFlow,
    items: [...state.cashFlow.items, {
      ...item,
      id: globalThis.crypto?.randomUUID?.() || `item-${Date.now()}`
    }]
  }, state.currency, state.customCategories)
  if (nextCashFlow.items.length === state.cashFlow.items.length) {
    throw new TypeError('Revise os dados do lançamento.')
  }
  updateCashFlow(nextCashFlow)
}

export function importCashFlowItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new TypeError('Nenhum lançamento válido foi encontrado.')
  const availableSlots = Math.max(cashFlowItemLimit - state.cashFlow.items.length, 0)
  if (items.length > availableSlots) throw new RangeError(`Há espaço para ${availableSlots} lançamentos. Nenhuma linha foi importada.`)
  const nextCashFlow = sanitizeCashFlow({
    ...state.cashFlow,
    items: [...state.cashFlow.items, ...items]
  }, state.currency, state.customCategories)
  const importedCount = nextCashFlow.items.length - state.cashFlow.items.length
  if (importedCount === 0) throw new TypeError('Nenhum lançamento válido foi encontrado.')
  updateCashFlow(nextCashFlow)
  return importedCount
}

export function upsertStatementItems(items, { investmentBalances = [], allowUndatedBalances = false } = {}) {
  if (!Array.isArray(items) || (!items.length && !investmentBalances.length)) throw new TypeError('Nenhum lançamento selecionado.')
  const validated = items.map((item, index) => sanitizeCashFlowItem(item, index, state.customCategories, state.currency))
  if (validated.some(item => !item)) throw new TypeError('Há lançamentos inválidos no lote. Nenhuma alteração foi salva.')
  const plan = planStatementUpdates(state.cashFlow.items, validated)
  if (plan.items.length > cashFlowItemLimit) throw new RangeError(`O orçamento aceita até ${cashFlowItemLimit} lançamentos. Nenhuma alteração foi salva.`)
  const balances = previewInvestmentBalances(investmentBalances, state.plan.investments || [], { currency: state.currency, exchangeRates: state.exchangeRates, allowUndated: allowUndatedBalances })
  const investments = sanitizeInvestments(balances.investments)
  if (balances.updates.length && investments.length !== balances.investments.length) throw new TypeError('Saldo de investimento inválido. Nenhuma alteração foi salva.')
  const nextPlan = balances.updates.length ? { ...state.plan, investments, ...investmentTotals(investments) } : state.plan
  const next = { ...state, plan: nextPlan, cashFlow: { ...state.cashFlow, items: reconcileOwnTransfers(plan.items, state.cashFlow.ownStatementAccounts) }, isDemo: false, lastUpdatedAt: new Date().toISOString() }
  appStorage.setItem(storageKeys.current, JSON.stringify(next))
  Object.assign(state, next)
  return { added: plan.added, updated: plan.updated, ...(balances.updates.length ? { investmentUpdated: balances.updates.length } : {}) }
}

export function removeCashFlowItem(id) {
  if (id.startsWith('ledger:')) throw new Error('Desvincule o movimento em Contas para remover este realizado.')
  updateCashFlow({
    ...state.cashFlow,
    items: state.cashFlow.items.filter((item) => item.id !== id)
  })
}

export function updateCashFlowItem(id, patch) {
  if (id.startsWith('ledger:')) throw new Error('Edite o movimento em Contas. Este realizado acompanha a origem.')
  const index = state.cashFlow.items.findIndex((item) => item.id === id)
  if (index < 0) throw new TypeError('Lançamento não encontrado.')
  const current = state.cashFlow.items[index]
  const candidate = {
    ...current,
    ...patch,
    id: current.id,
    source: current.source,
    ...(patch.categoryId && patch.categoryId !== current.categoryId ? { categoryOrigin: 'confirmed' } : {}),
    ...(patch.description && patch.description !== current.description ? { categoryMerchantKey: undefined } : {})
  }
  validateIncomeEnd(candidate)
  validatePensionInvestment(candidate, state.plan.investments, state.customCategories)
  if (candidate.recordKind === 'actual' && !candidate.startDate) {
    throw new TypeError('Informe a data do lançamento realizado.')
  }
  if (candidate.startDate && candidate.endDate && candidate.endDate < candidate.startDate) {
    throw new RangeError('A data final deve ser igual ou posterior à data inicial.')
  }
  const updated = sanitizeCashFlowItem(candidate, index, state.customCategories, state.currency)
  if (!updated) throw new TypeError('Revise os dados do lançamento.')
  const items = [...state.cashFlow.items]
  items[index] = updated
  updateCashFlow({ ...state.cashFlow, items })
  return updated
}

function validateIncomeEnd(item) {
  if (item.endMode === 'spouse-retirement') {
    if (item.householdOwner !== 'spouse' || !state.plan.spouseEnabled || !state.cashFlow.spouseRetirementMonth) throw new RangeError('Inclua o cônjuge e confirme o mês de aposentadoria em Meu plano. Selecione titularidade Cônjuge.')
    if (item.type !== 'income' || item.recordKind === 'actual' || item.source === 'txt' || !['monthly', 'annual'].includes(item.frequency)) throw new RangeError('O vínculo exige uma receita planejada recorrente.')
    return
  }
  if (item.endMode !== 'retirement') return
  if (['spouse', 'shared'].includes(item.householdOwner)) throw new RangeError('Para receita do cônjuge ou compartilhada, informe a data final manual. O vínculo automático usa a aposentadoria do titular.')
  if (!state.cashFlow.retirementMonth) throw new RangeError('Confirme primeiro o mês da aposentadoria no orçamento.')
  if (item.type !== 'income' || item.recordKind === 'actual' || item.source === 'txt' || !['monthly', 'annual'].includes(item.frequency)) throw new RangeError('O vínculo exige uma receita planejada recorrente.')
}

export function setBudgetRetirementMonth(month) {
  if (typeof month !== 'string' || !/^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new RangeError('Informe um mês entre 2000 e 2199.')
  state.plan.retirementMonth = month
  updateCashFlow({ retirementMonth: month })
}

export function setCashFlowReferenceMonth(referenceMonth) {
  if (typeof referenceMonth !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(referenceMonth)) {
    throw new TypeError('Selecione um mês válido.')
  }
  updateCashFlow({ ...state.cashFlow, referenceMonth })
}

export function addCustomCategory(name, type) {
  const normalizedName = String(name || '').trim().slice(0, 40)
  if (!normalizedName) throw new TypeError('Informe o nome da categoria.')
  const id = `custom-${normalizedName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}`
  const categories = sanitizeCustomCategories([
    ...state.customCategories,
    { id, name: normalizedName, type }
  ])
  if (categories.length === state.customCategories.length) {
    throw new TypeError('Essa categoria já existe ou não é válida.')
  }
  state.customCategories = categories
  state.isDemo = false
  state.lastUpdatedAt = new Date().toISOString()
  saveState()
}

export function replaceFinancialData(candidate) {
  const safe = sanitizeStoredState({ ...candidate, isDemo: false })
  state.plan = safe.plan
  state.cashFlow = safe.cashFlow
  state.scenarios = safe.scenarios
  state.currency = safe.currency
  state.exchangeRates = safe.exchangeRates
  state.customCategories = safe.customCategories
  state.lastUpdatedAt = safe.lastUpdatedAt || new Date().toISOString()
  state.isDemo = false
  state.dataDeleted = false
  saveState()
}

export function toggleReminder() {
  state.reminderEnabled = !state.reminderEnabled
  saveState()
}

export function setCurrency(currency) {
  const nextCurrency = normalizeCurrency(currency)
  if (nextCurrency === state.currency) return
  const convert = (value) => convertCurrency(value, state.currency, nextCurrency, state.exchangeRates)
  for (const field of ['currentAssets', 'monthlyContribution', 'targetMonthlyIncome', 'expectedMonthlyBenefit', 'spouseExpectedMonthlyBenefit']) {
    state.plan[field] = convert(state.plan[field])
  }
  // Each investment keeps its own balance currency. Only the plan-currency view changes.
  const pinned = (state.plan.investments || []).map((investment) => ({
    ...investment,
    currency: investmentBalanceCurrency(investment, state.currency),
    nativeAmount: investmentNativeAmount(investment, state.currency),
    nativeMonthlyContribution: investmentNativeContribution(investment, state.currency)
  }))
  state.plan.investments = syncInvestmentCurrencies(pinned, nextCurrency, state.exchangeRates)
  if (state.plan.investments.length) Object.assign(state.plan, investmentTotals(state.plan.investments))
  for (const field of ['currentEmergencyReserve', 'emergencyReserveTarget']) {
    state.cashFlow[field] = convert(state.cashFlow[field])
  }
  // Trends are relative to the previous plan currency and would change meaning.
  state.plan.currencyTrends = null
  state.currency = nextCurrency
  state.lastUpdatedAt = new Date().toISOString()
  saveState()
}

export function setExchangeRates(exchangeRates) {
  const next = sanitizeExchangeRates(exchangeRates)
  // Same quote again: nothing to recalculate or save.
  if (JSON.stringify(next.rates) === JSON.stringify(state.exchangeRates?.rates) && next.date === state.exchangeRates?.date && next.stale === state.exchangeRates?.stale && next.source === state.exchangeRates?.source) return false
  state.exchangeRates = next
  if (state.plan.investments?.length) {
    state.plan.investments = syncInvestmentCurrencies(state.plan.investments, state.currency, state.exchangeRates)
    Object.assign(state.plan, investmentTotals(state.plan.investments))
  }
  saveState()
  return true
}

export function addScenario(name, plan, context = {}) {
  if (state.scenarios.length >= 3) {
    throw new RangeError('Você pode salvar até três cenários.')
  }
  const id = globalThis.crypto?.randomUUID?.() || `scenario-${Date.now()}`
  state.scenarios.push({
    id,
    name: name.trim().slice(0, 40),
    currency: context.currency || state.currency,
    plan: structuredClone(plan),
    cashFlow: structuredClone(context.cashFlow || state.cashFlow),
    createdAt: new Date().toISOString()
  })
  saveState()
}

export function updateScenario(id, name, plan, context = {}) {
  const index = state.scenarios.findIndex(item => item.id === id)
  if (index < 0) throw new Error('Cenário não encontrado.')
  state.scenarios[index] = { ...state.scenarios[index], name: name.trim().slice(0, 40), plan: structuredClone(plan), currency: context.currency || state.scenarios[index].currency, cashFlow: structuredClone(context.cashFlow || state.scenarios[index].cashFlow) }
  saveState()
}

export function loadScenario(id) {
  const scenario = state.scenarios.find((item) => item.id === id)
  if (!scenario) throw new TypeError('Cenário não encontrado.')
  // Foreign balances follow the current exchange rates, not the rates of the day it was saved.
  state.plan = syncPlanInvestments(structuredClone(scenario.plan), scenario.currency, state.exchangeRates)
  if (scenario.cashFlow) state.cashFlow = structuredClone(scenario.cashFlow)
  state.currency = scenario.currency
  state.isDemo = false
  state.lastUpdatedAt = new Date().toISOString()
  saveState()
}

export function removeScenario(id) {
  state.scenarios = state.scenarios.filter((scenario) => scenario.id !== id)
  saveState()
}

export function setChartRange(range) {
  state.activeChartRange = range
  saveState()
}

export function resetState() {
  Object.assign(state, sanitizeStoredState({ plan: { ...defaultPlan }, cashFlow: { ...defaultCashFlow }, isDemo: true }), { dataDeleted: false })
  const saved = saveState()
  const failedKeys = saved ? [] : [storageKeys.current]
  if (saved) {
    for (const key of [storageKeys.previous, storageKeys.legacy, storageKeys.older, storageKeys.oldest, storageKeys.earlier, storageKeys.earliest, storageKeys.original, storageKeys.first, storageKeys.initial]) {
      try {
        appStorage.removeItem(key)
      } catch {
        failedKeys.push(key)
      }
    }
  }
  return { success: failedKeys.length === 0, failedKeys }
}

export function deleteLocalData() {
  const result = removeStoredState(appStorage)
  Object.assign(state, sanitizeStoredState({ plan: { ...defaultPlan }, cashFlow: { ...defaultCashFlow }, isDemo: true }), { dataDeleted: true })
  return result
}

export function saveOwnTransferSettings(data) {
  const accounts = data.getAll('ownAccount')
  const items = state.cashFlow.items.map(item => {
    const decision = data.get(`decision:${item.id}`)
    if (decision === null) return item
    const copy = { ...item }
    delete copy.transferDecision
    if (['own', 'payment'].includes(decision)) copy.transferDecision = decision
    return copy
  })
  const cashFlow = sanitizeCashFlow({ ...state.cashFlow, items, ownStatementAccounts: accounts }, state.currency, state.customCategories)
  const next = { ...state, cashFlow, isDemo: false, lastUpdatedAt: new Date().toISOString() }
  appStorage.setItem(storageKeys.current, JSON.stringify(next))
  Object.assign(state, next)
}
