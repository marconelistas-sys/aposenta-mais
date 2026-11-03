import { readStatementFile } from '../../domain/statement-file.js'
import { renderStatementHistory } from './history.js'
import { state } from '../../app/state.js'
import { escapeHtml } from '../../shared/formatters.js'
import { convertCurrency } from '../../shared/exchange-rates.js'
import { reviewStatementBatch, statementBatchLimit } from '../../domain/statement-batch.js'
import { analyzeStatementPlanning, inferStatementCoverage } from '../../domain/statement-planning.js'
import { statementHistoryMonths } from '../../domain/statement-history.js'
import { statementReviewDialog } from '../cash-flow/cash-flow.js'

const supportedFiles = 'CSV, TXT, OFX ou PDF TKB, Banco do Brasil, Banco Rendimento, Swissquote, Yuh, N26 ou fatura Ourocard'

export function renderStatements(statementReview = null) {
  return `<section class="panel"><p class="eyebrow">IMPORTAR EXTRATOS</p><h1>Extratos bancários</h1>
    <p>Selecione até ${statementBatchLimit} extratos ${supportedFiles}. O período de cada extrato é detectado automaticamente. Movimentos que já estão no orçamento aparecem como “Já está nos lançamentos” e não são importados de novo, mesmo que os extratos se sobreponham.</p>
    <label class="statement-file">
      <span>Selecionar extratos para importar</span>
      <input type="file" accept=".txt,.csv,.ofx,.pdf,text/plain,text/csv,application/x-ofx,application/pdf" multiple data-statement-file />
    </label>
    <small>Nenhuma linha é adicionada antes da sua confirmação na revisão. Até 1 MB e 2.000 movimentos por arquivo.</small></section>
    <section class="panel"><p class="eyebrow">EXTRATOS E APOSENTADORIA</p><h2>Seu plano combina com sua rotina?</h2>
    <p>Compare a sobra mensal observada com o aporte que você planeja. Os arquivos são lidos neste navegador. O resumo será salvo no histórico, sem alterar seu orçamento.</p>
    <form data-bank-analysis>
      <label class="form-field">Extratos ${supportedFiles}<input name="statement" type="file" accept=".csv,.txt,.ofx,.pdf" multiple required></label>
      <p>Selecione um extrato com vários meses ou vários extratos mensais de uma vez. O período vem do próprio extrato. Sem período impresso, valem os meses dos movimentos. Movimentos repetidos em extratos sobrepostos contam uma vez.</p>
      <label><input name="complete" type="checkbox" required> Os arquivos contêm todas as receitas e despesas familiares desses meses, sem transferências entre minhas contas, aplicações, resgates ou despesas duplicadas de cartão.</label>
      <p>Para salvar no histórico, use de 2 a ${statementHistoryMonths} meses completos e consecutivos. Transações ausentes também afetam a estimativa. Meses completos sem movimentos contam como zero.</p>
      <button class="button button--primary" type="submit">Analisar e salvar resumo</button>
    </form><div data-bank-analysis-result aria-live="polite"></div></section>${renderStatementHistory()}${statementReviewDialog(statementReview)}`
}

export async function readStatementAnalysis(formData, { currency = state.currency, asOf } = {}) {
  const uploads = formData.getAll('statement').filter(file => file && file.size)
  if (!uploads.length) throw new Error('Selecione pelo menos um extrato.')
  if (uploads.length > statementBatchLimit || uploads.some(file => file.size > 1024 * 1024)) throw new Error(`Selecione até ${statementBatchLimit} extratos, com no máximo 1 MB por arquivo.`)
  const files = []
  for (const file of uploads) {
    try {
      const { inspection } = await readStatementFile(file, { maximumRows: 2000, analysisOnly: true })
      if (inspection.truncatedRows) throw new Error('Divida o extrato em arquivos com até 2.000 movimentos.')
      files.push({ fileName: file.name, inspection, mapping: inspection.suggestedMapping })
    } catch (error) { throw new Error(uploads.length > 1 ? `${file.name}: ${error.message}` : error.message) }
  }
  const review = reviewStatementBatch(files, { defaultCurrency: currency })
  if (review.mappingErrors.length || review.errors.length) throw new Error([...review.mappingErrors, ...review.errors].slice(0, 3).join(' '))
  // Repeated statements and overlapping periods share import keys. Count each movement once.
  const rows = review.rows.filter(row => row.item && !row.duplicate)
  const coverage = inferStatementCoverage(files.map((file, index) => ({ period: file.inspection.period, dates: rows.filter(row => row.fileIndex === index).map(row => row.item.startDate) })), asOf ? { asOf } : {})
  if (coverage.months > statementHistoryMonths) throw new Error(`Use no máximo ${statementHistoryMonths} meses completos por análise.`)
  const statementCurrencies = [...new Set(rows.map(row => row.item.currency))]
  if (statementCurrencies.length > 1) throw new Error(`Os extratos têm moedas diferentes (${statementCurrencies.join(', ')}). Analise cada moeda separadamente.`)
  const analysisCurrency = statementCurrencies[0] || currency
  const { start, end } = coverage
  const result = analyzeStatementPlanning(rows.map(row => row.item), { start, end, complete: formData.get('complete') === 'on', currency: analysisCurrency, ...(asOf ? { asOf } : {}) })
  const normalized = rows.map(({ item }) => [item.startDate, item.description, item.type, item.amount, item.currency]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ currency: analysisCurrency, start, end, items: normalized })))
  const id = 'analysis-' + Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
  return { ...result, id, start, end, currency: analysisCurrency, createdAt: new Date().toISOString() }
}

export async function prepareStatementAnalysis(formData, { plan = state.plan, currency = state.currency } = {}) {
  const result = await readStatementAnalysis(formData, { currency })
  const contribution = convertCurrency(Number(plan.monthlyContribution) || 0, currency, result.currency, state.exchangeRates)
  return renderStatementAnalysis(result, { currency: result.currency, contribution })
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
