import { renderStatementHistory } from './history.js'
import { state } from '../../app/state.js'
import { escapeHtml } from '../../shared/formatters.js'
import { inspectStatementText, reviewStatementImport } from '../../domain/statement-import.js'
import { analyzeStatementPlanning } from '../../domain/statement-planning.js'

export function renderStatements() {
  return `<section class="panel"><p class="eyebrow">EXTRATOS E APOSENTADORIA</p><h1>Seu plano combina com sua rotina?</h1>
    <p>Compare a sobra mensal observada com o aporte que você planeja. O arquivo é lido neste navegador. O resumo será salvo no histórico, sem alterar seu orçamento.</p>
    <form data-bank-analysis>
      <label class="form-field">Extrato CSV, TXT ou OFX<input name="statement" type="file" accept=".csv,.txt,.ofx" required></label>
      <p>CSV/TXT: colunas data, descricao e valor, com despesas negativas. Use a moeda do plano. Até 1 MB e 2.000 movimentos, sem cortes silenciosos.</p>
      <label class="form-field">Início da cobertura<input name="start" type="date" required></label>
      <label class="form-field">Fim da cobertura<input name="end" type="date" required></label>
      <label><input name="complete" type="checkbox" required> O arquivo contém todas as receitas e despesas familiares do período, sem transferências entre minhas contas, aplicações, resgates ou despesas duplicadas de cartão.</label>
      <p>Para salvar no histórico, use de 2 a 24 meses completos. Transações ausentes também afetam a estimativa. A análise inclui meses completos sem movimentos como zero.</p>
      <button class="button button--primary" type="submit">Analisar e salvar resumo</button>
    </form><div data-bank-analysis-result aria-live="polite"></div>
    <p><a href="/orcamento" data-route>Revisar orçamento e importar movimentos selecionados</a></p></section>${renderStatementHistory()}`
}

export async function readStatementAnalysis(formData, { currency = state.currency } = {}) {
  const file = formData.get('statement')
  if (!file || !file.size || file.size > 1024 * 1024) throw new Error('Selecione um arquivo de até 1 MB.')
  const inspection = inspectStatementText(await file.text(), { maximumRows: 2000, analysisOnly: true })
  if (inspection.truncatedRows) throw new Error('Divida o extrato em arquivos com até 2.000 movimentos.')
  const review = reviewStatementImport(inspection, { defaultCurrency: currency })
  if (review.mappingErrors.length || review.errors.length) throw new Error([...review.mappingErrors, ...review.errors].slice(0, 3).join(' '))
  // Equal transactions may be legitimate. Require review instead of silently discarding them.
  if (review.rows.some(row => row.duplicate)) throw new Error('Há movimentos possivelmente duplicados. Revise o arquivo antes de analisar.')
  const result = analyzeStatementPlanning(review.rows.map(row => row.item), { start: formData.get('start'), end: formData.get('end'), complete: formData.get('complete') === 'on', currency })
  if (result.excluded.currency) throw new Error('O extrato contém outra moeda. Converta os valores de forma consistente antes de comparar com o plano.')
  const start = formData.get('start'), end = formData.get('end')
  const normalized = review.rows.map(({ item }) => [item.startDate, item.description, item.type, item.amount, item.currency]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ currency, start, end, items: normalized })))
  const id = 'analysis-' + Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
  return { ...result, id, start, end, currency, createdAt: new Date().toISOString() }
}

export async function prepareStatementAnalysis(formData, { plan = state.plan, currency = state.currency } = {}) {
  const result = await readStatementAnalysis(formData, { currency })
  return renderStatementAnalysis(result, { currency, contribution: Number(plan.monthlyContribution) || 0 })
}

export function renderStatementAnalysis(result, { currency, contribution }) {
  const money = value => escapeHtml(new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value))
  const maximum = Math.max(1, ...result.months.flatMap(m => [m.income, m.expense]))
  const difference = result.surplus - contribution
  return `<h2>${result.surplus < 0 ? 'As despesas superaram as receitas' : difference < 0 ? 'A sobra observada ficou abaixo do aporte planejado' : 'A sobra observada comporta o aporte planejado'}</h2>
    <p>Média de ${result.months.length} meses completos: receitas ${money(result.income)}, despesas ${money(result.expense)}, sobra ${money(result.surplus)}. Aporte planejado: ${money(contribution)}.</p>
    <p>${difference < 0 ? `Faltaram ${money(-difference)} por mês para manter o aporte. Revise despesas e teste um aporte menor em Simulações.` : 'Teste em Simulações quanto dessa sobra pode ser mantido depois de reservar recursos para imprevistos.'} Esta comparação descreve o passado. A sustentabilidade até a data-alvo continua sendo calculada no Dashboard.</p>
    <figure><figcaption>Receitas e despesas por mês. Barras na mesma escala.</figcaption>${result.months.map(m => `<div><strong>${escapeHtml(m.month)}</strong><div>Receitas <meter min="0" max="${maximum}" value="${m.income}"></meter> ${money(m.income)}</div><div>Despesas <meter min="0" max="${maximum}" value="${m.expense}"></meter> ${money(m.expense)}</div><p>Sobra: ${money(m.balance)}</p></div>`).join('')}</figure>
    <details><summary>Possíveis recorrências para revisar</summary><p>Repetição não confirma renda futura. Salários precisam de uma data de término compatível com a aposentadoria. Nenhuma sugestão foi aplicada.</p><ul>${result.recurring.map(r => `<li>${escapeHtml(r.description)}: ${money(r.monthly)} por mês, ${r.months} meses com movimentos (${r.type === 'income' ? 'receita' : 'despesa'}).</li>`).join('') || '<li>Nenhum padrão recorrente suficiente.</li>'}</ul></details>
    <p>${result.excluded.transfer} transferências ou aplicações identificadas e ${result.excluded.outside} movimentos fora dos meses completos foram excluídos.</p>
    <p><a href="/simulacoes" data-route>Testar aporte em Simulações</a> · <a href="/" data-route>Ver sustentabilidade do plano</a></p>`
}
