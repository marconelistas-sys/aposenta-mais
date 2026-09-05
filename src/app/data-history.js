import { createExportableState } from './state-storage.js'
import { ownedStorage } from './owned-storage.js'

export const historyKey = 'aposenta-plus-data-history-v1'
export const operationLabels = Object.freeze({
  export: 'Arquivo de portabilidade preparado',
  file_import: 'Arquivo do finapp importado localmente',
  restore: 'Cópia remota restaurada',
  recover: 'Versão local recuperada',
  upload: 'Cópia remota enviada',
  remote_delete: 'Cópia remota excluída',
  correction: 'Dados corrigidos'
})

export function createDataHistory(storage) {
  function read() {
    try {
      const value = JSON.parse(storage.getItem(historyKey) || '{}')
      return {
        events: (Array.isArray(value.events) ? value.events : []).filter(event =>
          event && Object.hasOwn(operationLabels, event.operation) &&
          ['success', 'failure'].includes(event.result) && Number.isFinite(Date.parse(event.at))
        ).slice(-50).map(({ operation, result, at }) => ({ operation, result, at })),
        snapshots: (Array.isArray(value.snapshots) ? value.snapshots : []).filter(item =>
          item && typeof item.id === 'string' && Number.isFinite(Date.parse(item.at)) && item.state?.plan
        ).slice(-3).map(item => ({ id: item.id, at: item.at, state: createExportableState(item.state) }))
      }
    } catch { return { events: [], snapshots: [] } }
  }
  function write(value) {
    storage.setItem(historyKey, JSON.stringify(value))
  }
  return {
    read,
    checkpoint(state) {
      const history = read()
      const snapshot = {
        id: globalThis.crypto.randomUUID(), at: new Date().toISOString(),
        state: createExportableState(state)
      }
      history.snapshots = [...history.snapshots, snapshot].slice(-3)
      write(history)
      return snapshot.id
    },
    record(operation, result = 'success') {
      if (!Object.hasOwn(operationLabels, operation) || !['success', 'failure'].includes(result)) {
        throw new TypeError('Operação inválida.')
      }
      const history = read()
      history.events = [...history.events, { operation, result, at: new Date().toISOString() }].slice(-50)
      write(history)
    },
    snapshot(id) {
      const snapshot = read().snapshots.find(item => item.id === id)
      if (!snapshot) throw new Error('Versão não encontrada.')
      return snapshot.state
    },
    clear() { storage.removeItem(historyKey) }
  }
}

export const dataHistory = createDataHistory(ownedStorage)

// Falha de auditoria não deve converter uma operação já concluída em falha.
export function recordDataOperation(operation, result = 'success') {
  try { dataHistory.record(operation, result); return true } catch { return false }
}
