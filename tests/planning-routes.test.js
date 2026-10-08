import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePlanningHref } from '../src/app/planning-routes.js'

test('old cash flow summary links open the single budget summary and preserve review context', () => {
  assert.equal(normalizePlanningHref('/fluxo-caixa?aba=resumo&review=budget&id=salary#details'), '/orcamento?aba=resumo&review=budget&id=salary#details')
})

test('old budget tracking links open the budget summary without losing other query values or fragment', () => {
  const result = new URL(normalizePlanningHref('/orcamento?aba=mes&id=item%201&month=2026-08#records'), 'http://localhost/')
  assert.equal(result.pathname, '/orcamento')
  assert.equal(result.searchParams.get('aba'), 'resumo')
  assert.equal(result.searchParams.get('id'), 'item 1')
  assert.equal(result.searchParams.get('month'), '2026-08')
  assert.equal(result.hash, '#records')
})

test('projection, editors, default pages and external links retain their original destination', () => {
  for (const href of ['/fluxo-caixa', '/orcamento', '/fluxo-caixa?aba=anual', '/fluxo-caixa?aba=mensal', '/orcamento?aba=lancamentos&review=budget&id=abc', '/contas?aba=resumo', 'https://example.com/fluxo-caixa?aba=resumo']) {
    assert.equal(normalizePlanningHref(href), href)
  }
})

test('normalization is idempotent and supports same-origin absolute links', () => {
  const href = normalizePlanningHref('https://fin.example/fluxo-caixa?aba=resumo#month', 'https://fin.example/contas')
  assert.equal(href, '/orcamento?aba=resumo#month')
  assert.equal(normalizePlanningHref(href), href)
})
