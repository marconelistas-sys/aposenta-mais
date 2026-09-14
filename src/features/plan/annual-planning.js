import { state, updateCashFlow } from '../../app/state.js'
import { saveSolvencyAssets } from '../../app/property-solvency.js'
import { assetCategories, sanitizeAnnualRows, validateAnnualRow } from '../../domain/annual-planning.js'
import { escapeHtml, privateCurrency } from '../../shared/formatters.js'

const kinds = { annualGoals: 'Metas anuais e periódicas', nonFinancialAssets: 'Bens não financeiros' }
const categoryLabels = { 'real-estate': 'Imóvel', vehicle: 'Veículo', other: 'Outro bem', unclassified: 'Tipo não informado' }
export function saveAnnualPlanning(data) {
  const kind = data.get('kind')
  if (!Object.hasOwn(kinds, kind)) throw new Error('Grupo inválido.')
  const existing = state.cashFlow[kind] || []
  const id = String(data.get('id') || crypto.randomUUID())
  if (data.get('id') && !existing.some(row => row.id === id)) throw new Error('Registro não encontrado.')
  if (!data.get('id') && existing.length >= 50) throw new Error('Limite de 50 registros.')
  const row = { id, name: String(data.get('name')).trim(), currency: data.get('currency'), amount: Number(data.get('amount')), startYear: Number(data.get('startYear')), endYear: Number(data.get('endYear')), everyYears: kind === 'nonFinancialAssets' ? 1 : Number(data.get('everyYears')), realGrowth: Number(data.get('realGrowth')) / 100 }
  validateAnnualRow(row)
  const category = kind === 'nonFinancialAssets' && assetCategories.has(data.get('category')) ? data.get('category') : 'other'
  const saved = { ...row, ...(data.get('category') === 'unclassified' && kind === 'nonFinancialAssets' ? {} : { category }), ...(kind === 'nonFinancialAssets' && category === 'real-estate' ? { includeInSolvency: data.get('includeInSolvency') === 'on' } : {}) }
  const rows = [...existing.filter(item => item.id !== id), saved]
  if (kind === 'nonFinancialAssets') saveSolvencyAssets(rows)
  else updateCashFlow({ [kind]: rows })
}
export function renderAnnualPlanning(kind) {
  const assets = kind === 'nonFinancialAssets'
  const rows = sanitizeAnnualRows(state.cashFlow[kind])
  const field = (name, label, min, max, step = 1, value = '') => `<label class="form-field"><span>${label}</span><input name="${name}" type="number" min="${min}" max="${max}" step="${step}" value="${value}" required /></label>`
  const categoryField = assets ? `<label class="form-field"><span>Tipo de bem</span><select name="category">${Object.entries(categoryLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>` : ''
  return `<section class="panel settings-card"><h2>${kinds[kind]}</h2><p>${assets ? 'Posições patrimoniais restritas, fora da Carteira. Entram no patrimônio sem gerar caixa. O tipo Imóvel permite incluí-los ou excluí-los na avaliação de solvência do fluxo de caixa e da visão geral. Início e fim do intervalo alteram o patrimônio, mas não representam compra ou venda financiada. Confira a origem do bem e evite cadastrá-lo também como investimento ou consórcio.' : 'Valor total do ano distribuído em 12 provisões mensais, sem presumir data de pagamento. Intervalo em anos e crescimento real contam desde o ano inicial. Não duplique estas provisões em despesas ou metas do calendário.'}</p><ul>${rows.map(row => `<li>${escapeHtml(row.name)}${assets ? ` <span class="badge badge--neutral">${categoryLabels[row.category] || categoryLabels.unclassified}</span>${row.category === 'real-estate' ? ` <span class="badge badge--neutral">${row.includeInSolvency === false ? 'Excluído individualmente da solvência' : state.cashFlow.includeRealEstateInSolvency === false ? 'Fora da solvência pelo filtro geral' : 'Considerado na solvência'}</span>` : ''}` : ''} · ${privateCurrency(row.amount, state.valuesHidden, true, row.currency)} · ${row.startYear} a ${row.endYear}, a cada ${row.everyYears} ano(s)${state.valuesHidden ? '' : ` · ${(row.realGrowth * 100).toFixed(2)}% real ao ano <button class="button button--secondary" data-annual-edit="${row.id}" data-annual-kind="${kind}">Editar</button>`} <button class="button button--secondary" data-annual-remove="${row.id}" data-annual-kind="${kind}">Excluir</button></li>`).join('') || '<li>Nenhum registro.</li>'}</ul>${state.valuesHidden ? '' : `<details class="disclosure"><summary>Cadastrar ou editar</summary><form data-annual-planning="${kind}"><input type="hidden" name="kind" value="${kind}" /><input type="hidden" name="id" /><div class="form-grid form-grid--two"><label class="form-field"><span>Nome</span><input name="name" maxlength="60" required /></label><label class="form-field"><span>Moeda</span><select name="currency">${['BRL', 'CHF', 'EUR', 'USD'].map(code => `<option>${code}</option>`).join('')}</select></label>${categoryField}${assets ? '<label data-property-setting><input type="checkbox" name="includeInSolvency" checked /> Considerar este imóvel na solvência quando o filtro geral incluir imóveis.</label>' : ''}${field('amount', assets ? 'Valor no ano inicial' : 'Despesa total no ano inicial', 0.01, 1e9, 0.01)}${field('startYear', 'Ano inicial', 2000, 2199)}${field('endYear', 'Ano final, inclusive', 2000, 2199)}${assets ? '<input name="everyYears" type="hidden" value="1" />' : field('everyYears', 'Repetir a cada quantos anos', 1, 100, 1, 1)}${field('realGrowth', 'Crescimento real anual (%)', -99, 100, 0.01, 0)}</div><button class="button button--primary">Salvar</button><button class="button button--secondary" type="reset">Limpar</button></form></details>`}</section>`
}
