import { escapeHtml } from '../../shared/formatters.js'

const labels = { missing: 'Faltante, será incluído', identical: 'Já presente, sem alteração', conflict: 'Mesmo ID com diferenças, preservar atual', 'possible-duplicate': 'Possível duplicidade, revisar antes de incluir' }
const collections = { items: 'Receita ou despesa', investments: 'Patrimônio inicial', annualGoals: 'Meta', nonFinancialAssets: 'Bem' }
export function renderFinappReconciliation(rows, hidden = false) {
  return `<h3>Conferência registro a registro</h3><p>O modo Completar inclui somente faltantes. Preserva os registros atuais, inclusive os que foram editados. Identidades e nomes parecidos exigem revisão. A titularidade não é inferida de nomes genéricos como cônjuge.</p><div class="table-scroll" tabindex="0" role="region" aria-label="Conferência dos registros do finapp"><table><thead><tr><th scope="col">Registro de origem</th><th scope="col">Grupo</th><th scope="col">Resultado em Completar</th></tr></thead><tbody>${rows.map(row => `<tr><th scope="row">${hidden ? 'Registro oculto' : escapeHtml(row.label)}<br/><small>${escapeHtml(row.id)}</small></th><td>${collections[row.collection] || 'Registro'}</td><td>${labels[row.status] || 'Revisar'}</td></tr>`).join('')}</tbody></table></div>`
}
