import { readPdfText } from '../../domain/statement-file.js'
import { applyPensionBalance, parsePensionBalance, pensionBalanceTargets } from '../../domain/pension-balance-import.js'
import { investmentNativeAmount } from '../../domain/investment-currency.js'
import { currencies } from '../../shared/currencies.js'
import { escapeHtml, privateCurrency } from '../../shared/formatters.js'

export function renderPensionImport(state) {
  const accounts = state.plan.investments.filter(item => item.assetClass === 'pension')
  return `<section class="panel pension-import" aria-labelledby="pension-import-title"><h2 id="pension-import-title">Importar saldo de previdência</h2><p>Atualize o patrimônio de uma conta de previdência existente. O saldo substitui o valor anterior, sem criar receita, despesa ou aporte.</p>${state.valuesHidden ? '<p>Exiba os valores para importar e revisar o saldo.</p>' : !accounts.length ? '<p>Cadastre abaixo um investimento da classe Previdência antes de importar seu saldo.</p>' : `<details><summary>Importar documento ou informar saldo de outro fundo</summary><form data-pension-import-form>
    <label class="form-field"><span>Documento de previdência</span><input type="file" accept=".pdf,.txt" data-pension-import-file /><small>PDF ou TXT de até 1 MB. Leitura automática do certificado BVK com saldo atual. Para outros fundos, preencha os campos conforme o documento.</small></label>
    <div class="form-grid">
    <label class="form-field"><span>Fundo de previdência</span><input name="pensionFund" maxlength="120" required /></label>
    <label class="form-field"><span>Identificação da conta no fundo</span><input name="pensionSourceAccount" maxlength="128" required /><small>Use sempre a mesma identificação para esta conta.</small></label>
    <label class="form-field"><span>Data do saldo</span><input type="date" name="pensionDate" required /></label>
    <label class="form-field"><span>Moeda do documento</span><select name="pensionCurrency">${Object.keys(currencies).map(code => `<option ${code === state.currency ? 'selected' : ''}>${code}</option>`).join('')}</select></label>
    <label class="form-field"><span>Saldo atual acumulado</span><input type="number" name="pensionAmount" min="0" max="1000000000" step="0.01" required /><small>Informe o capital atual. Benefícios e saldos futuros projetados ficam fora.</small></label>
    <label class="form-field"><span>Conta de previdência na Carteira</span><select name="pensionInvestmentId" required><option value="">Selecione a conta correspondente</option>${accounts.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.currency || state.currency)}</option>`).join('')}</select></label>
    </div><div data-pension-import-status role="status" aria-live="polite"></div><div data-pension-import-preview></div>
    <button class="button button--secondary" type="submit" data-pension-review>Revisar saldo</button>
    <button class="button button--primary" type="submit" data-pension-confirm hidden>Confirmar atualização do patrimônio</button>
  </form></details>`}</section>`
}

export function bindPensionImport(root, { getState, save, onSaved }) {
  const previews = new WeakMap()
  const targetVersion = (state, id) => JSON.stringify([state.currency, state.plan.investments.find(item => item.id === id), state.exchangeRates])
  const invalidate = form => {
    previews.delete(form)
    form.querySelector('[data-pension-import-preview]').replaceChildren()
    form.querySelector('[data-pension-confirm]').hidden = true
    form.querySelector('[data-pension-review]').hidden = false
  }
  root.addEventListener('input', event => {
    const form = event.target.closest('[data-pension-import-form]')
    if (form) invalidate(form)
  })
  root.addEventListener('change', async event => {
    const form = event.target.closest('[data-pension-import-form]')
    if (!form) return
    invalidate(form)
    const status = form.querySelector('[data-pension-import-status]')
    status.textContent = ''
    if (!event.target.matches('[data-pension-import-file]')) return
    const file = event.target.files[0]
    if (!file) return
    const controls = [...form.elements]
    controls.forEach(control => { control.disabled = true })
    for (const name of ['pensionFund', 'pensionSourceAccount', 'pensionDate', 'pensionAmount', 'pensionInvestmentId']) form.elements.namedItem(name).value = ''
    status.textContent = 'Lendo documento…'
    try {
      if (!file.size || file.size > 1024 * 1024) throw new TypeError('Selecione um documento de até 1 MB.')
      const snapshot = parsePensionBalance(/\.pdf$/i.test(file.name) ? await readPdfText(file) : await file.text())
      if (!form.isConnected || event.target.files[0] !== file) return
      for (const [name, value] of Object.entries({ pensionFund: snapshot.name, pensionSourceAccount: snapshot.sourceAccount, pensionDate: snapshot.asOfDate, pensionCurrency: snapshot.currency, pensionAmount: snapshot.amount })) form.elements.namedItem(name).value = value
      const state = getState()
      const targets = pensionBalanceTargets(snapshot, state.plan.investments, state.currency)
      form.elements.namedItem('pensionInvestmentId').value = targets.length === 1 ? targets[0].id : ''
      status.textContent = 'Saldo atual identificado. Confira os campos e revise a conta de destino antes de confirmar.'
    } catch (error) {
      status.textContent = error.message
    } finally {
      controls.forEach(control => { control.disabled = false })
    }
  })
  root.addEventListener('submit', event => {
    const form = event.target.closest('[data-pension-import-form]')
    if (!form) return
    event.preventDefault()
    const state = getState()
    const status = form.querySelector('[data-pension-import-status]')
    try {
      if (state.valuesHidden) throw new TypeError('Exiba os valores para revisar a importação.')
      if (event.submitter?.matches('[data-pension-confirm]') && previews.has(form)) {
        const { snapshot, targetId, version } = previews.get(form)
        if (targetVersion(state, targetId) !== version) throw new TypeError('A conta ou o câmbio mudou desde a revisão. Revise o saldo novamente.')
        save(snapshot, targetId)
        previews.delete(form)
        onSaved()
        return
      }
      const data = new FormData(form)
      const snapshot = { name: data.get('pensionFund').trim(), sourceAccount: data.get('pensionSourceAccount').trim(), currency: data.get('pensionCurrency'), asOfDate: data.get('pensionDate'), amount: data.get('pensionAmount') === '' ? NaN : Number(data.get('pensionAmount')) }
      const targetId = data.get('pensionInvestmentId')
      applyPensionBalance(state.plan, snapshot, targetId, state.currency, state.exchangeRates)
      const target = state.plan.investments.find(item => item.id === targetId)
      const money = value => privateCurrency(value, false, true, snapshot.currency)
      form.querySelector('[data-pension-import-preview]').innerHTML = `<h3>Confira a atualização</h3><p>Conta: ${escapeHtml(target.name)}</p><p>Saldo anterior: ${escapeHtml(money(investmentNativeAmount(target, state.currency)))} · Data: ${escapeHtml(target.balanceAsOf || 'Não informada')}</p><p>Novo saldo: ${escapeHtml(money(snapshot.amount))} · Data: ${escapeHtml(snapshot.asOfDate)}</p><p>Os aportes, rendimentos e prazos cadastrados serão preservados.</p>`
      previews.set(form, { snapshot, targetId, version: targetVersion(state, targetId) })
      status.textContent = ''
      form.querySelector('[data-pension-confirm]').hidden = false
      form.querySelector('[data-pension-review]').hidden = true
      form.querySelector('[data-pension-confirm]').focus()
    } catch (error) {
      invalidate(form)
      status.textContent = error.message
    }
  })
}
