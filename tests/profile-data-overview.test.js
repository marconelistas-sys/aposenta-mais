import test from 'node:test'
import assert from 'node:assert/strict'
import { state } from '../src/app/state.js'
import { authState } from '../src/app/auth-state.js'
import { syncState, resetSyncState } from '../src/app/sync-state.js'
import { ownedStorage } from '../src/app/owned-storage.js'
import { createExportableState } from '../src/app/state-storage.js'
import { compareSavedPlan } from '../src/domain/sync-comparison.js'
import { inspectSavedPlan, clearSyncComparison, currentSyncComparison } from '../src/features/profile/sync-comparison.js'
import { renderDataOverview, focusSaveCopy } from '../src/features/profile/data-overview.js'
import { renderProfile } from '../src/features/profile/profile.js'

function fixture(t) {
  const original = structuredClone(state), auth = { ...authState }, fetch = globalThis.fetch
  Object.assign(state, createExportableState({ plan: { investments: Array.from({ length: 8 }, (_, i) => ({ id: `investment-${i}`, name: 'Investimento', amount: 100 })) }, cashFlow: { items: Array.from({ length: 40 }, (_, i) => ({ id: `entry-${i}`, type: 'expense', categoryId: 'housing', amount: 100, frequency: 'monthly', startDate: '2030-01-01' })) } }), { valuesHidden: false, isDemo: false })
  Object.assign(authState, { authenticated: true, storageProvider: 'local', provider: 'supabase' })
  Object.assign(syncState, { available: true, loading: false, exists: true, error: '' })
  ownedStorage.select('account-a')
  clearSyncComparison()
  t.after(() => { Object.assign(state, original); Object.assign(authState, auth); resetSyncState(); ownedStorage.select(null); clearSyncComparison(); globalThis.fetch = fetch })
}

test('readouts show the full inventory, links and unknown copy without writes', t => {
  fixture(t)
  globalThis.fetch = () => { throw new Error('Render must not fetch') }
  const html = renderDataOverview()
  assert.match(html, /<dd>40<\/dd>/)
  assert.match(html, /<dd>8<\/dd>/)
  assert.match(html, /A consultar/)
  for (const href of ['/orcamento', '/carteira', '/calendario', '/riscos']) assert.ok(html.includes(`href="${href}"`))
  assert.match(html, /Banco deste computador/)
  assert.match(html, /Ainda não comparada/)
  assert.match(html, /data-open-save-copy/)
  const profile = renderProfile()
  assert.ok(profile.indexOf('data-overview-title') < profile.indexOf('profile-layout'))
  assert.match(profile, /id="profile-save-copy"/)
})

test('equal counts never imply equal financial content and comparison remains read only', async t => {
  fixture(t)
  const saved = createExportableState(state)
  saved.plan.investments[0].amount += 7
  const comparison = compareSavedPlan(state, saved)
  assert.deepEqual(comparison.currentCounts, comparison.savedCounts)
  assert.equal(comparison.identical, false)
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.method, 'GET')
    return { ok: true, json: async () => ({ state: saved, updatedAt: '2026-09-15T00:00:00Z' }) }
  }
  await inspectSavedPlan()
  assert.match(renderDataOverview(), /Conteúdo diferente/)
  assert.doesNotMatch(renderDataOverview(), /A consultar/)
  state.cashFlow.items[0].amount += 1
  assert.equal(currentSyncComparison(), null)
  assert.match(renderDataOverview(), /Ainda não comparada/)
})

test('privacy hides inventory and comparison, including when the copy was fetched', async t => {
  fixture(t)
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ state: createExportableState(state) }) })
  await inspectSavedPlan()
  assert.match(renderDataOverview(), /Conteúdo igual na consulta/)
  state.valuesHidden = true
  const html = renderDataOverview()
  assert.doesNotMatch(html, /<dd>40|<dd>8|Conteúdo igual na consulta|Conteúdo diferente/)
  assert.match(html, /••••/)
  assert.match(html, /Comparação oculta/)
})

test('changing destination or account invalidates the compared inventory', async t => {
  fixture(t)
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ state: createExportableState(state) }) })
  await inspectSavedPlan()
  authState.storageProvider = 'supabase'
  assert.equal(currentSyncComparison(), null)
  assert.match(renderDataOverview(), /Nuvem · Supabase/)
  authState.storageProvider = 'local'
  ownedStorage.select('account-b')
  assert.equal(currentSyncComparison(), null)
})

test('absent copy, errors and signed-out state do not offer restoration or imply zero records', t => {
  fixture(t)
  syncState.exists = false
  assert.match(renderDataOverview(), /Nenhuma cópia neste destino/)
  assert.doesNotMatch(renderDataOverview(), /data-sync-pull/)
  syncState.available = false
  syncState.error = '<img src=x>'
  assert.match(renderDataOverview(), /&lt;img src=x&gt;/)
  assert.doesNotMatch(renderDataOverview(), /data-sync-pull|data-open-save-copy/)
  authState.authenticated = false
  assert.match(renderDataOverview(), /Entrar na conta/)
  assert.doesNotMatch(renderDataOverview(), /Banco deste computador|Nuvem · Supabase/)
})

test('save shortcut opens and focuses consent without submitting, even with values hidden', () => {
  const events = []
  const root = {}
  const details = { tagName: 'DETAILS', open: false, parentElement: root }
  const form = { parentElement: details, focus: () => events.push('focus'), scrollIntoView: () => events.push('scroll'), submit: () => events.push('submit') }
  root.querySelector = selector => selector === '#profile-save-copy' ? form : null
  assert.equal(focusSaveCopy(root), true)
  assert.equal(details.open, true)
  assert.deepEqual(events, ['focus', 'scroll'])
  assert.equal(focusSaveCopy({ querySelector: () => null }), false)
})
