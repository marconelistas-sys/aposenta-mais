import { createExportableState } from './state-storage.js'
import { financialPayload, syncConsentVersion } from '../shared/sync-contract.js'

export const syncState = {
  loading: false,
  available: null,
  exists: false,
  updatedAt: null,
  consentVersion: null,
  error: ''
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Não foi possível acessar a cópia remota.')
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
  syncState.loading = true
  syncState.error = ''
  try {
    const payload = await request('/api/sync/status')
    Object.assign(syncState, payload)
  } catch (error) {
    syncState.available = false
    syncState.error = error.message
  } finally {
    syncState.loading = false
  }
  return syncState
}

export async function saveRemoteState(state) {
  if (syncState.available !== true) throw new Error('Consulte a cópia remota antes de enviar.')
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
