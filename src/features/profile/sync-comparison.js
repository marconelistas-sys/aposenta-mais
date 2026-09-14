import { state } from '../../app/state.js'
import { authState } from '../../app/auth-state.js'
import { loadRemoteState } from '../../app/sync-state.js'
import { ownedStorage } from '../../app/owned-storage.js'
import { compareSavedPlan, financialSignature } from '../../domain/sync-comparison.js'
import { escapeHtml, formatUpdateTime } from '../../shared/formatters.js'

export const syncComparisonView = { result: null }
export function clearSyncComparison() { syncComparisonView.result = null }
export async function inspectSavedPlan() {
  clearSyncComparison()
  const generation = ownedStorage.generation, provider = authState.storageProvider
  const signature = financialSignature(state)
  const saved = await loadRemoteState()
  if (generation !== ownedStorage.generation || provider !== authState.storageProvider || signature !== financialSignature(state)) throw new Error('O plano, a conta ou o destino mudou. Faça a comparação novamente.')
  syncComparisonView.result = { ...compareSavedPlan(state, saved.state), signature, provider, generation, updatedAt: saved.updatedAt }
}
export function renderSyncComparison() {
  const result = syncComparisonView.result
  if (!result || result.generation !== ownedStorage.generation || result.provider !== authState.storageProvider || result.signature !== financialSignature(state)) return ''
  if (state.valuesHidden) return '<p>Comparação da cópia oculta. Mostre os valores para consultar.</p>'
  return `<div role="status"><h3>${result.identical ? 'O conteúdo financeiro é igual' : 'As versões têm diferenças'}</h3><p>Cópia consultada: ${escapeHtml(formatUpdateTime(result.updatedAt))}. Esta leitura não salvou nem restaurou dados.</p>${result.differences.length ? `<ul>${result.differences.map(label => `<li>${escapeHtml(label)}</li>`).join('')}</ul><p>Restaurar traz a cópia para o navegador. Salvar envia o plano deste navegador ao destino selecionado. Confira qual versão quer manter.</p>` : '<p>Não é necessário substituir a cópia para atualizar apenas preferências visuais.</p>'}</div>`
}
