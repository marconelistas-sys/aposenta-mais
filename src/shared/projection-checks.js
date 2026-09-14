import { escapeHtml } from './formatters.js'

export function renderProjectionChecks(result) {
  const confirmations = result.confirmations || []
  const pending = result.pendingIssues || result.issues.filter(issue => !confirmations.includes(issue))
  const notices = result.notices || []
  const list = messages => `<ul>${messages.map(message => `<li>${escapeHtml(message)}</li>`).join('')}</ul>`
  const forms = (result.confirmationDetails || []).filter(item => ['openingConfirmed', 'pensionConfirmed'].includes(item.field)).map(item => {
    const wording = item.field === 'openingConfirmed'
      ? `Confirmo que os saldos cadastrados correspondem à abertura de ${escapeHtml(result.rows[0].year)}.`
      : result.settings.pensionMode === 'external'
        ? 'Confirmo que as contribuições previdenciárias são créditos externos e não saem do orçamento familiar.'
        : 'Confirmo que as contribuições previdenciárias são pagas pelo orçamento familiar.'
    return `<form data-confirm-projection><input type="hidden" name="field" value="${item.field}"><label><input type="checkbox" name="confirmed" required> ${wording}</label><button class="button button--secondary" type="submit">Confirmar premissa</button></form>`
  }).join('')
  const required = pending.length || confirmations.length
    ? `<details class="disclosure projection-checks"><summary>Ver verificações da projeção</summary>${pending.length ? `<h3>Dados a revisar (${pending.length})</h3>${list(pending)}` : ''}${confirmations.length ? `<h3>Premissas a confirmar (${confirmations.length})</h3><p>São confirmações sobre como interpretar os dados cadastrados.</p>${list(confirmations)}${forms}` : ''}<a href="/viabilidade" data-route>Conferir dados e premissas</a></details>`
    : ''
  const information = notices.length ? `<details class="disclosure projection-notices"><summary>Como os saldos restritos entram no cálculo</summary>${list(notices)}<p>Esses avisos explicam o tratamento adotado e não contam como pendências. Informe a liberação se pretende usar esses recursos.</p></details>` : ''
  return required + information
}
