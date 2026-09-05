import test from 'node:test'
import assert from 'node:assert/strict'
import { closeLocalPlan, openLocalPlan, canRenderFinancialPage } from '../src/app/local-access.js'
import { renderWelcome } from '../src/features/welcome/welcome.js'
test('acesso começa fechado e logout fecha todas as rotas financeiras', () => {
  closeLocalPlan()
  assert.equal(canRenderFinancialPage('/'), false)
  assert.equal(canRenderFinancialPage('/perfil'), false)
  assert.equal(canRenderFinancialPage('/entrar'), true)
  openLocalPlan()
  assert.equal(canRenderFinancialPage('/fluxo-caixa'), true)
  closeLocalPlan()
  assert.equal(canRenderFinancialPage('/carteira'), false)
})
test('entrada explica sequência e retenção sem interpolar dados financeiros', () => {
  const html = renderWelcome()
  assert.match(html, /Patrimônio inicial/)
  assert.match(html, /não apaga os dados/)
  assert.doesNotMatch(html, /R\$|demo-salary/)
})
