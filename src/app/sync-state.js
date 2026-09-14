import { createExportableState } from './state-storage.js'
import { financialPayload, syncConsentVersion } from '../shared/sync-contract.js'
import { authState } from './auth-state.js'
import { ownedStorage } from './owned-storage.js'

export const syncState = {
  loading: false,
  available: null,
  exists: false,
  updatedAt: null,
  consentVersion: null,
  error: ''
}

async function request(path, { method = 'GET', body } = {}) {
  if (!ownedStorage.owner) throw new Error('Entre na conta e reabra seu plano antes de sincronizar.')
  const generation = ownedStorage.generation
  const provider = authState.storageProvider
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { ...(provider ? { 'X-Storage-Provider': provider } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(ownedStorage.owner ? { 'X-Plan-Owner': ownedStorage.owner } : {}) },
    body: body ? JSON.stringify(body) : undefined
  })
  const payload = await response.json().catch(() => ({}))
  if (generation !== ownedStorage.generation || provider !== authState.storageProvider) throw new Error('A sessão mudou. Reabra o plano antes de sincronizar.')
  if (!response.ok) throw new Error(payload.error || 'Não foi possível acessar a cópia salva da conta.')
  return payload
}

export function resetSyncState() {
  Object.assign(syncState, {
    loading: false,
    available: null,
    exists: false,
    updatedAt: null,
    consentVersion: null,
    error: ''
  })
}

export async function loadSyncState() {
  const generation = ownedStorage.generation
  const provider = authState.storageProvider
  syncState.loading = true
  syncState.error = ''
  try {
    const payload = await request('/api/sync/status')
    Object.assign(syncState, payload)
  } catch (error) {
    if (generation !== ownedStorage.generation || provider !== authState.storageProvider) return syncState
    syncState.available = false
    syncState.error = error.message
  } finally {
    if (generation === ownedStorage.generation && provider === authState.storageProvider) syncState.loading = false
  }
  return syncState
}

export async function saveRemoteState(state) {
  if (syncState.available !== true) throw new Error('Consulte a cópia salva da conta antes de enviar.')
  const payload = await request('/api/sync/data', {
    method: 'POST',
    body: {
      acceptedSyncConsent: true,
      consentVersion: syncConsentVersion,
      expectedUpdatedAt: syncState.exists ? syncState.updatedAt : null,
      state: financialPayload(createExportableState(state))
    }
  })
  Object.assign(syncState, payload, { available: true, error: '' })
  return payload
}

export async function loadRemoteState() {
  return request('/api/sync/data')
}

export async function deleteRemoteState() {
  const payload = await request('/api/sync/data', { method: 'DELETE' })
  Object.assign(syncState, {
    available: true,
    exists: false,
    updatedAt: null,
    consentVersion: null,
    error: ''
  })
  return payload
}
