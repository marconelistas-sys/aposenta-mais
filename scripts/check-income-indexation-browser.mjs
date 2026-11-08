import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from 'playwright'

// "Reajuste" of planned incomes in the budget forms (docs/product/indexacao-beneficios.md, H1, H3, H4).
// Isolated database and browser profile. Never edits the user's local plan.
const directory = await mkdtemp(join(tmpdir(), 'fin2-indexation-'))
const socket = createServer()
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
const port = socket.address().port
await new Promise(resolve => socket.close(resolve))
const server = spawn(process.execPath, ['scripts/dev-server.mjs'], { cwd: new URL('..', import.meta.url), env: { PATH: process.env.PATH, HOME: process.env.HOME, PORT: String(port), LOCAL_DB_PATH: join(directory, 'test.sqlite') }, stdio: ['ignore', 'pipe', 'pipe'] })
const year = new Date().getUTCFullYear()
let browser
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Servidor de teste não iniciou')), 10000)
    server.stdout.on('data', chunk => { if (String(chunk).includes('disponível em')) { clearTimeout(timer); resolve() } })
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Servidor encerrou: ${code}`)) })
  })
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`http://127.0.0.1:${port}`)
  await page.locator('[data-open-local]').click()
  await page.evaluate(async year => {
    const { state, saveState } = await import('/src/app/state.js')
    const { createExportableState } = await import('/src/app/state-storage.js')
    Object.assign(state, createExportableState({ isDemo: false, currency: 'CHF', plan: { currentAge: 50, retirementAge: 68, targetAge: 94, horizonReferenceMonth: `${year}-01`, retirementMonth: `${year + 19}-01`, annualRealReturn: 0.02, annualInflation: 0.01, investments: [{ id: 'cash', name: 'Caixa', amount: 400000, currency: 'CHF', assetClass: 'cash', liquidity: 'available', returnType: 'real', returnValue: 0.02 }], finappMethod: { openingConfirmed: true, pensionConfirmed: true } }, cashFlow: { referenceMonth: `${year}-01`, retirementMonth: `${year + 19}-01`, items: [
      { id: 'salary', type: 'income', categoryId: 'salary', description: 'Salário', amount: 7000, currency: 'CHF', frequency: 'monthly', startDate: `${year}-01-01`, endDate: `${year + 18}-12-31`, endMode: 'date', source: 'manual', recordKind: 'planned' },
      { id: 'home', type: 'expense', categoryId: 'housing', description: 'Moradia', amount: 4000, currency: 'CHF', frequency: 'monthly', startDate: `${year}-01-01`, source: 'manual', recordKind: 'planned' },
      { id: 'ahv', type: 'income', categoryId: 'pension', description: 'AHV antiga', amount: 2000, currency: 'CHF', frequency: 'monthly', startDate: `${year + 19}-01-01`, endMode: 'none', source: 'manual', recordKind: 'planned' }
    ] } }))
    state.valuesHidden = false
    saveState()
  }, year)
  await page.reload()
  await page.locator('[data-open-local]').click()
  const go = async href => {
    await page.evaluate(href => { history.pushState(null, '', href); window.dispatchEvent(new PopStateEvent('popstate')) }, href)
    await page.locator('[data-request-progress]').waitFor({ state: 'hidden' })
  }
  const items = () => page.evaluate(async () => (await import('/src/app/state.js')).state.cashFlow.items.map(({ id, description, categoryId, type, indexation }) => ({ id, description, categoryId, type, indexation })))

  // H4: the legacy retirement income is a pending item with a link to the field.
  await go('/viabilidade')
  await page.locator('.projection-checks > summary').click()
  const pending = page.getByRole('link', { name: 'Conferir reajuste desta renda' })
  await pending.first().waitFor({ state: 'visible' })
  assert.match(await page.locator('main').innerText(), /AHV antiga: confirme o reajuste desta renda/)

  // H1.3: a new retirement income starts empty and cannot be saved without a choice.
  await go('/orcamento?aba=lancamentos')
  await page.locator('[data-new-cash-item]:not(:disabled)').first().click()
  const add = page.locator('[data-cash-item-form]')
  const addField = add.locator('[data-income-indexation]')
  await add.locator('[name="categoryId"]').selectOption('salary')
  await addField.waitFor({ state: 'visible' })
  assert.equal(await add.locator('[name="indexation"][value="inflation"]').isChecked(), true, 'Outra receita: Acompanha a inflação marcada')
  await add.locator('[name="categoryId"]').selectOption('pension')
  assert.equal(await add.locator('[name="indexation"]:checked').count(), 0, 'Benefício novo: nenhuma opção marcada')
  assert.equal(await addField.locator('[data-indexation-required-mark]').isVisible(), true)
  assert.equal(await addField.locator('[data-indexation-help]').isVisible(), true)
  assert.equal(await addField.locator('[data-indexation-guide] summary').innerText(), 'Como saber se a renda tem reajuste')
  await add.locator('[name="description"]').fill('Caixa de pensão')
  await add.locator('[name="amount"]').fill('2500')
  await add.locator('[name="startDate"]').fill(`${year + 19}-01-01`)
  await add.locator('[name="endMode"]').selectOption('none')
  const before = (await items()).length
  await add.getByRole('button', { name: 'Salvar lançamento', exact: true }).click()
  await add.locator('[data-form-error]').waitFor({ state: 'visible' })
  assert.equal(await add.locator('[data-form-error]').innerText(), 'Escolha o reajuste desta renda.')
  assert.equal(await add.locator('[name="indexation"][aria-invalid="true"]').count(), 2)
  assert.equal((await items()).length, before, 'Nada é gravado sem a escolha')
  // H3.1: the preview appears without saving, with the inflation used.
  await add.locator('[name="indexation"][value="fixed"]').check()
  const preview = addField.locator('[data-indexation-preview]')
  await preview.waitFor({ state: 'visible' })
  assert.equal(await preview.getAttribute('aria-live'), 'polite')
  const previewText = (await preview.innerText()).replace(/ /g, ' ')
  assert.match(previewText, new RegExp(`^Em ${year + 19}, CHF 2\\.500 por mês valem CHF [\\d.]+ em dinheiro de ${year}\\. Em ${year + 44}, último ano do horizonte, valem CHF [\\d.]+: [\\d,]+% menos poder de compra\\. Inflação usada: CHF 1,0% ao ano \\(inflação do plano\\)\\.`))
  assert.equal(await preview.getByRole('link', { name: 'Alterar inflação' }).getAttribute('href'), '/carteira?review=field&field=annualInflation')
  // Keyboard: arrow keys move inside the radio group and the warning follows the choice.
  await add.locator('[name="indexation"][value="fixed"]').focus()
  await page.keyboard.press('ArrowUp')
  assert.equal(await add.locator('[name="indexation"][value="inflation"]').isChecked(), true)
  await addField.locator('[data-indexation-warning]').waitFor({ state: 'visible' })
  assert.match(await addField.locator('[data-indexation-warning]').innerText(), /^Atenção: confira no certificado ou contrato se esta renda é reajustada\. Se ela for fixa, em 30 anos perde 25,8%/)
  assert.ok((await addField.getAttribute('aria-describedby')).includes('cash-new-indexation-warning'))
  // Touched: switching category keeps the person's choice.
  await add.locator('[name="indexation"][value="fixed"]').check()
  await add.locator('[name="categoryId"]').selectOption('salary')
  assert.equal(await add.locator('[name="indexation"][value="fixed"]').isChecked(), true)
  await add.locator('[name="categoryId"]').selectOption('pension')
  // Hidden values: the preview masks money and keeps years, loss and inflation (D16).
  await page.evaluate(async () => { (await import('/src/app/state.js')).state.valuesHidden = true })
  await add.locator('[name="currency"]').dispatchEvent('change')
  const hiddenText = await preview.innerText()
  assert.doesNotMatch(hiddenText, /2\.500/)
  assert.match(hiddenText, /•••••[\s\S]*% menos poder de compra[\s\S]*CHF 1,0% ao ano/)
  await page.evaluate(async () => { (await import('/src/app/state.js')).state.valuesHidden = false })
  await add.locator('[name="currency"]').dispatchEvent('change')
  await page.setViewportSize({ width: 320, height: 900 })
  assert.ok(await add.evaluate(form => form.scrollWidth <= form.clientWidth + 1), 'Sem rolagem horizontal a 320 px')
  await page.setViewportSize({ width: 1280, height: 1000 })
  await add.getByRole('button', { name: 'Salvar lançamento', exact: true }).click()
  await page.waitForFunction(async () => (await import('/src/app/state.js')).state.cashFlow.items.some(item => item.description === 'Caixa de pensão'))
  const saved = (await items()).find(item => item.description === 'Caixa de pensão')
  assert.equal(saved.indexation, 'fixed')
  await page.locator('[data-budget-filters] [name="period"]').selectOption('all')
  await page.locator('[data-budget-results] [data-indexation-label]').first().waitFor({ state: 'visible' })
  const labels = await page.locator('[data-budget-results] [data-indexation-label]').allInnerTexts()
  assert.deepEqual(labels.map(text => text.trim()).sort(), ['· Reajuste não informado', '· Valor fixo, sem reajuste'])

  // H1.2: an expense never shows or saves the field.
  await page.locator('[data-new-cash-item]:not(:disabled)').first().click()
  await add.locator('[name="categoryId"]').selectOption('housing')
  assert.equal(await addField.isVisible(), false)
  assert.equal(await addField.evaluate(node => node.disabled), true)
  await add.getByRole('button', { name: 'Cancelar', exact: true }).click()

  // H4.1 and the review link: the old income opens with the focus on the first option.
  await go('/orcamento?review=budget&id=ahv&field=indexation')
  const edit = page.locator('[data-cash-item-edit-form]')
  await edit.locator('[data-income-indexation]').waitFor({ state: 'visible' })
  assert.equal(await page.evaluate(() => `${document.activeElement.name}:${document.activeElement.value}`), 'indexation:inflation')
  assert.equal(await edit.locator('[name="indexation"]:checked').count(), 0)
  assert.equal(await edit.locator('[data-indexation-legacy]').isVisible(), true)
  assert.equal(await edit.locator('[data-indexation-required-mark]').isVisible(), false)
  await edit.locator('[name="indexation"][value="inflation"]').check()
  await edit.getByRole('button', { name: 'Salvar alterações', exact: true }).click()
  await page.waitForFunction(async () => (await import('/src/app/state.js')).state.cashFlow.items.find(item => item.id === 'ahv').indexation === 'inflation')
  await go('/viabilidade')
  assert.doesNotMatch(await page.locator('main').evaluate(node => node.textContent), /AHV antiga: confirme o reajuste/)

  // A saved choice opens checked, and the focus goes to it.
  const fixedId = saved.id
  await go(`/orcamento?review=budget&id=${encodeURIComponent(fixedId)}&field=indexation`)
  await edit.locator('[data-income-indexation]').waitFor({ state: 'visible' })
  assert.equal(await page.evaluate(() => `${document.activeElement.name}:${document.activeElement.value}:${document.activeElement.checked}`), 'indexation:fixed:true')
  // H1.10: becoming an expense removes the field.
  await edit.locator('[name="categoryId"]').selectOption('housing')
  assert.equal(await edit.locator('[data-income-indexation]').isVisible(), false)
  await edit.getByRole('button', { name: 'Salvar alterações', exact: true }).click()
  await page.waitForFunction(async id => (await import('/src/app/state.js')).state.cashFlow.items.find(item => item.id === id).type === 'expense', fixedId)
  assert.equal((await items()).find(item => item.id === fixedId).indexation, undefined)

  // H3.5: premise line, then the Carteira field behind "Alterar inflação".
  await page.evaluate(async () => {
    const { state, saveState } = await import('/src/app/state.js')
    state.cashFlow.items.push({ id: 'bvk', type: 'income', categoryId: 'pension', description: 'BVK', amount: 2500, currency: 'CHF', frequency: 'monthly', startDate: `${new Date().getUTCFullYear() + 19}-01-01`, source: 'manual', recordKind: 'planned', indexation: 'fixed' })
    saveState()
  })
  await go('/viabilidade?aba=premissas')
  // The premises panel may start closed: read the text, not the rendering.
  assert.match(await page.locator('[data-fixed-income-assumption]').first().evaluate(node => node.textContent), new RegExp(`^Rendas sem reajuste: 1 lançamento, descontado pela inflação de CHF 1,0% ao ano a partir de ${year}\\.$`))
  await go('/carteira?review=field&field=annualInflation')
  assert.equal(await page.evaluate(() => document.activeElement.name), 'annualInflation')
  assert.deepEqual(errors, [])
  console.log('Reajuste validado: padrões por categoria, escolha obrigatória, prévia, aviso, valores ocultos, teclado, pendência, foco do link, remoção em despesa e premissas.')
} finally {
  await browser?.close()
  if (server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit') }
  await rm(directory, { recursive: true, force: true })
}
