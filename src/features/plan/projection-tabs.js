const tabs = [
  ['/viabilidade', 'Resumo'],
  ['/riscos', 'Risco'],
  ['/apos-aposentadoria', 'Após a aposentadoria']
]

export function renderProjectionTabs(activePath) {
  return `<nav class="page-tabs page-tabs--links" aria-label="Seções da avaliação anual">${tabs.map(([href, label]) => `<a href="${href}" data-route ${activePath === href ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`
}
