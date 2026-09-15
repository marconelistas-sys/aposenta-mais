import { savedPlanCounts } from '../../domain/sync-comparison.js'
import { state } from '../../app/state.js'
import { authState } from '../../app/auth-state.js'
import { syncState } from '../../app/sync-state.js'
import { currentSyncComparison, renderSyncComparison } from './sync-comparison.js'
import { escapeHtml, formatUpdateTime } from '../../shared/formatters.js'

const fields = [
  ['items', 'Lançamentos', '/orcamento'],
  ['investments', 'Investimentos', '/carteira'],
  ['goals', 'Metas', '/calendario'],
  ['assets', 'Bens', '/riscos']
]

function readouts(counts, links = false) {
  return `<dl class="data-readouts">${fields.map(([key, label, href]) => {
    const value = state.valuesHidden ? '••••' : counts ? String(counts[key]) : 'A consultar'
    return `<div><dt>${links ? `<a href="${href}" data-route>${label}</a>` : label}</dt><dd${!counts ? ' class="data-readouts__unknown"' : ''}>${value}</dd></div>`
  }).join('')}</dl>`
}

export function focusSaveCopy(root) {
  const form = root.querySelector('#profile-save-copy')
  if (!form) return false
  for (let parent = form.parentElement; parent && parent !== root; parent = parent.parentElement) {
    if (parent.tagName === 'DETAILS') parent.open = true
  }
  form.focus({ preventScroll: true })
  form.scrollIntoView({ block: 'center', behavior: 'instant' })
  return true
}

export function renderDataOverview() {
  const local = (authState.storageProvider || authState.provider) === 'local'
  const destination = local ? 'Banco deste computador' : 'Nuvem · Supabase'
  const ready = authState.authenticated && syncState.available === true && !syncState.loading
  const comparison = ready && syncState.exists ? currentSyncComparison() : null
  const status = !authState.authenticated ? 'Entre na conta para consultar'
    : syncState.loading || syncState.available === null ? 'Consultando disponibilidade'
    : !ready ? 'Não foi possível consultar'
    : !syncState.exists ? 'Nenhuma cópia neste destino'
    : state.valuesHidden ? 'Comparação oculta'
    : comparison ? comparison.identical ? 'Conteúdo igual na consulta' : 'Conteúdo diferente'
    : 'Cópia disponível · Ainda não comparada'
  return `<section class="panel data-overview" aria-labelledby="data-overview-title">
    <div class="panel__header"><div><p class="eyebrow">SEUS DADOS</p><h2 id="data-overview-title">Qual plano está em uso?</h2></div></div>
    <div class="data-overview__grid">
      <section class="data-overview__source" aria-labelledby="data-current-title">
        <div class="data-overview__intro">
        <p class="data-overview__tag">EXIBIDO AGORA</p><h3 id="data-current-title">Plano deste navegador</h3>
        <p>${state.isDemo ? 'Você está usando dados de demonstração.' : 'Estes são os cadastros usados nas telas e nos cálculos.'}</p>
        </div>
        ${readouts(savedPlanCounts(state), true)}
        <p class="data-overview__hint">Contagem de todos os cadastros, incluindo os que estão fora do mês selecionado.</p>
      </section>
      <section class="data-overview__saved" aria-labelledby="data-saved-title">
        <div class="data-overview__intro">
        <p class="data-overview__tag">DESTINO DA CÓPIA</p><h3 id="data-saved-title">${authState.authenticated ? destination : 'Conta não conectada'}</h3>
        <p class="data-overview__status" role="status">${status}</p>
        ${ready && syncState.exists && (comparison?.updatedAt || syncState.updatedAt) ? `<p class="data-overview__hint">Cópia salva em ${escapeHtml(formatUpdateTime(comparison?.updatedAt || syncState.updatedAt))}.</p>` : ''}
        </div>
        ${ready && syncState.exists ? readouts(comparison?.savedCounts) : ''}
        <p class="data-overview__hint">Salvar copia do navegador para o banco. Restaurar substitui o plano deste navegador pela cópia do banco.</p>
        <div class="data-actions">
          ${ready && syncState.exists ? '<button class="button button--secondary" type="button" data-compare-saved-plan>Comparar os cadastros</button>' : ''}
          ${ready ? '<a class="button button--primary" href="#profile-save-copy" data-open-save-copy>Salvar este plano no banco</a>' : authState.authenticated ? '<button class="button button--secondary" type="button" data-sync-refresh>Consultar banco novamente</button>' : '<a class="button button--primary" href="/entrar" data-route>Entrar na conta</a>'}
          ${ready && syncState.exists ? `<button class="button button--secondary" type="button" data-sync-pull>${local ? 'Restaurar do banco neste navegador' : 'Usar cópia remota neste dispositivo'}</button>` : ''}
        </div>
        ${syncState.error && authState.authenticated ? `<p role="status">${escapeHtml(syncState.error)}</p>` : ''}
      </section>
    </div>
    ${comparison ? renderSyncComparison() : ''}
    <p class="data-overview__hint">A cópia é manual. Entrar na conta ou trocar o destino não transfere o plano.</p>
  </section>`
}
