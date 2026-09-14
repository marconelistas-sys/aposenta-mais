import { state } from './state.js'
import { ownedStorage } from './owned-storage.js'
import { storageKeys, sanitizeCashFlowItem } from './state-storage.js'
import { sanitizeStatementAnalysis, statementHistoryLimit } from '../domain/statement-history.js'
import { categoryById } from '../data/cash-flow-categories.js'

function commit(cashFlow) {
  const next = { ...state, cashFlow, isDemo: false, lastUpdatedAt: new Date().toISOString() }
  // Persist before changing live state, so quota failures do not appear successful.
  ownedStorage.setItem(storageKeys.current, JSON.stringify(next))
  Object.assign(state, next)
}
export function saveStatementAnalysis(candidate, expectedGeneration = ownedStorage.generation) {
  if (expectedGeneration !== ownedStorage.generation) throw new Error('A conta mudou durante a leitura. Abra o extrato novamente.')
  const analysis = sanitizeStatementAnalysis(candidate)
  if (!analysis) throw new Error('Resumo inválido. Salve análises com 2 a 24 meses completos.')
  const history = state.cashFlow.statementAnalyses || []
  if (history.some(row => row.id === analysis.id)) throw new Error('Esta análise já está no histórico. Abra o resumo salvo.')
  if (history.length >= statementHistoryLimit) throw new Error('O histórico aceita seis análises. Exclua um resumo antes de salvar outro.')
  commit({ ...state.cashFlow, statementAnalyses: [...history, analysis] })
  return analysis
}
export function deleteStatementAnalysis(id) {
  commit({ ...state.cashFlow, statementAnalyses: (state.cashFlow.statementAnalyses || []).filter(row => row.id !== id) })
}
export function applyStatementRecurrences(analysisId, candidates) {
  const analysis = (state.cashFlow.statementAnalyses || []).find(row => row.id === analysisId)
  if (!analysis || !Array.isArray(candidates) || !candidates.length) throw new Error('Escolha pelo menos uma recorrência do histórico.')
  if (candidates.length + state.cashFlow.items.length > 100) throw new Error('O orçamento aceita até 100 lançamentos. Nenhuma sugestão foi aplicada.')
  const indices = new Set()
  const items = candidates.map(candidate => {
    const index = candidate.index
    const origin = `${analysis.id}:${index}`
    const source = analysis.recurring[index]
    if (!Number.isInteger(index) || !source || indices.has(index)) throw new Error('Seleção de recorrência inválida.')
    indices.add(index)
    if (state.cashFlow.items.some(item => item.analysisOrigin === origin)) throw new Error('Esta recorrência já foi aplicada. Edite o lançamento existente.')
    const category = categoryById(candidate.categoryId, state.customCategories)
    if (!category || category.type !== source.type) throw new Error('A categoria deve corresponder à receita ou despesa selecionada.')
    if (!['primary', 'spouse', 'shared'].includes(candidate.householdOwner)) throw new Error('Defina a titularidade de cada recorrência.')
    if (!candidate.startDate || !candidate.endDate || candidate.endDate < candidate.startDate) throw new Error('Informe início e fim válidos para cada sugestão, inclusive receitas de aposentadoria.')
    const exactDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
    if (!exactDate(candidate.startDate) || !exactDate(candidate.endDate)) throw new Error('Data inválida na recorrência.')
    if (!Number.isFinite(candidate.amount) || candidate.amount < .01 || candidate.amount > 1e9) throw new Error('Valor mensal inválido.')
    if (!candidate.description?.trim()) throw new Error('Informe uma descrição para a recorrência.')
    const item = sanitizeCashFlowItem({ id: `statement-plan-${globalThis.crypto.randomUUID()}`, type: source.type, categoryId: candidate.categoryId, description: candidate.description, amount: candidate.amount, currency: analysis.currency, householdOwner: candidate.householdOwner, frequency: 'monthly', recordKind: 'planned', source: 'manual', startDate: candidate.startDate, endDate: candidate.endDate, endMode: 'date', analysisOrigin: origin }, 0, state.customCategories, analysis.currency)
    if (!item) throw new Error('Não foi possível validar o lançamento sugerido.')
    const duplicate = state.cashFlow.items.some(existing => existing.recordKind !== 'actual' && existing.type === item.type && existing.description.trim().toLowerCase() === item.description.trim().toLowerCase() && existing.currency === item.currency && (existing.householdOwner || 'unspecified') === item.householdOwner && existing.frequency === item.frequency && (!existing.endDate || existing.endDate >= item.startDate) && (!existing.startDate || existing.startDate <= item.endDate))
    if (duplicate) throw new Error('Já existe lançamento semelhante no período. Revise-o antes de aplicar a sugestão.')
    return item
  })
  for (let index = 0; index < items.length; index++) {
    if (items.slice(0, index).some(other => other.type === items[index].type && other.description.toLowerCase() === items[index].description.toLowerCase() && other.currency === items[index].currency && other.householdOwner === items[index].householdOwner && other.startDate <= items[index].endDate && other.endDate >= items[index].startDate)) throw new Error('Duas sugestões representam o mesmo lançamento no período. Revise a seleção.')
  }
  commit({ ...state.cashFlow, items: [...state.cashFlow.items, ...items] })
  return items.length
}
