import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const appCss = await readFile(new URL('../src/styles/app.css', import.meta.url), 'utf8')
const responsiveCss = await readFile(new URL('../src/styles/responsive.css', import.meta.url), 'utf8')

const memory = new Map()
globalThis.localStorage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key)
}

const { authState } = await import('../src/app/auth-state.js')
const { resetState, state, updateCashFlow } = await import('../src/app/state.js')
const { syncState } = await import('../src/app/sync-state.js')
const { appLayout } = await import('../src/app/layout.js')
const { productEventDetail, trackProductEvent } = await import('../src/app/product-events.js')
const { renderDashboard } = await import('../src/features/dashboard/dashboard.js')
const { renderRegister } = await import('../src/features/auth/auth.js')
const { renderPremium } = await import('../src/features/premium/premium.js')
const { renderProfile } = await import('../src/features/profile/profile.js')

function setVisitor(configured = true) {
  Object.assign(authState, { configured, authenticated: false, user: null })
}

test('visitante em demonstração vê convite compacto para o Premium', () => {
  resetState()
  setVisitor()

  const html = renderDashboard()

  assert.match(html, /data-premium-promo/)
  assert.match(html, /premium-promo--compact/)
  assert.match(html, /Uma visão da casa para decisões dos dois/)
  assert.match(html, /href="\/premium"/)
  assert.match(html, /Nenhum compartilhamento está ativo/)
})

test('home prioriza resultado, uma ação principal e três indicadores', () => {
  resetState()
  setVisitor()

  const html = renderDashboard()
  const metricCards = html.match(/class="metric-card"/g) || []

  assert.match(html, /Veja se seu plano de aposentadoria cabe na sua vida/)
  assert.match(html, /Calcular com meus dados/)
  assert.doesNotMatch(html, /next-action-card/)
  assert.equal(metricCards.length, 3)
  assert.match(html, /chart chart--patrimony/)
  assert.match(html, /preserveAspectRatio="xMidYMid meet"/)
  assert.doesNotMatch(html, /preserveAspectRatio="none"/)
})

test('home descreve corretamente os três estados de armazenamento', () => {
  resetState()
  setVisitor()
  Object.assign(syncState, { exists: false })
  assert.match(renderDashboard(), /Dados financeiros somente neste dispositivo/)

  Object.assign(authState, { authenticated: true, user: { email: 'pessoa@example.com' } })
  assert.match(renderDashboard(), /Conta conectada\. Seu plano continua somente neste dispositivo/)

  Object.assign(syncState, { exists: true })
  assert.match(renderDashboard(), /Cópia remota ativa, vinculada à sua conta/)
})

test('visitante com dados próprios vê proposta familiar após a projeção', () => {
  resetState()
  setVisitor()
  updateCashFlow({ ...state.cashFlow, recurringIncome: 9000 })

  const html = renderDashboard()
  const detailStart = html.indexOf('class="dashboard-grid"')
  const premiumStart = html.indexOf('data-premium-promo')

  assert.equal(state.isDemo, false)
  assert.match(html, /premium-promo--compact/)
  assert.match(html, /Ver prévia do painel do casal/)
  assert.ok(premiumStart > detailStart)
})

test('usuário autenticado não vê convite de cadastro no dashboard', () => {
  resetState()
  Object.assign(authState, { configured: true, authenticated: true, user: { email: 'pessoa@example.com' } })

  const html = renderDashboard()

  assert.doesNotMatch(html, /data-premium-promo/)
  assert.doesNotMatch(html, /create_account_click/)
})

test('Supabase indisponível oculta CTAs que levariam ao cadastro', () => {
  resetState()
  setVisitor(false)

  const dashboard = renderDashboard()
  const layout = appLayout('<p>Conteúdo</p>', '/')

  assert.doesNotMatch(dashboard, /data-premium-promo/)
  assert.doesNotMatch(layout, /class="account-cta"/)
})

test('header e perfil diferenciam cadastro grátis de login', () => {
  resetState()
  setVisitor()

  const layout = appLayout('<p>Conteúdo</p>', '/')
  const profile = renderProfile()

  assert.match(layout, /class="account-cta"[\s\S]*Criar conta/)
  assert.match(profile, /Criar conta grátis/)
  assert.match(profile, /Já tenho conta/)
  assert.match(profile, /não envia seus dados financeiros automaticamente/i)
})

test('cadastro explica benefícios sem confundir conta grátis e Premium', () => {
  setVisitor()

  const html = renderRegister()

  assert.match(html, /Conta gratuita/)
  assert.match(html, /Cópia remota sob seu controle/)
  assert.match(html, /futuro Premium/)
  assert.match(html, /não envia dados financeiros automaticamente/i)
  assert.doesNotMatch(html, /Assinar/)
})

test('página Premium identifica recursos futuros e ausência de cobrança', () => {
  setVisitor()

  const html = renderPremium()

  assert.match(html, /Premium familiar/)
  assert.match(html, /Em breve/)
  assert.match(html, /Nenhuma assinatura será iniciada nesta versão/)
  assert.match(html, /Preço, cobrança e período de teste ainda não foram definidos/)
  assert.doesNotMatch(html, /Assinar agora/)
})

test('rodapé informa quando uma cópia remota está ativa', () => {
  Object.assign(authState, { configured: true, authenticated: true, user: { email: 'pessoa@example.com' } })
  Object.assign(syncState, { exists: true })

  const html = appLayout('<p>Conteúdo</p>', '/')

  assert.match(html, /Cópia remota ativa\. Gerencie ou exclua em Perfil e dados/i)
})

test('eventos de produto aceitam apenas nomes sem dados pessoais', () => {
  assert.deepEqual(productEventDetail('create_account_click'), { name: 'create_account_click' })
  assert.equal(productEventDetail('email=pessoa@example.com'), null)

  const received = []
  const target = new EventTarget()
  target.addEventListener('aposenta:product-event', (event) => received.push(event.detail))

  assert.equal(trackProductEvent('premium_view', target), true)
  assert.equal(trackProductEvent('R$ 9.000', target), false)
  assert.deepEqual(received, [{ name: 'premium_view' }])
})

test('CTAs preservam foco, área mínima e layout de 320 px', () => {
  assert.match(appCss, /min-width:\s*320px/)
  assert.match(appCss, /\.button\s*\{[\s\S]*?min-height:\s*44px/)
  assert.match(appCss, /a:focus-visible[\s\S]*?outline:\s*3px/)
  assert.match(responsiveCss, /@media \(max-width: 390px\)/)
})
