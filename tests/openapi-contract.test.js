import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const contract = await readFile(
  new URL('../packages/api-contracts/openapi.yaml', import.meta.url),
  'utf8'
)

function pathBlock(path) {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return contract.match(new RegExp(`^  ${escaped}:[\\s\\S]*?(?=^  \\/|^components:)`, 'm'))?.[0] || ''
}

test('separa status e operações de dados em rotas distintas', () => {
  const status = pathBlock('/sync/status')
  const data = pathBlock('/sync/data')

  assert.match(status, /summary: Consulta se o usuário possui uma cópia/)
  assert.doesNotMatch(status, /^    post:|^    delete:/m)
  assert.match(data, /^    get:/m)
  assert.match(data, /^    post:/m)
  assert.match(data, /^    delete:/m)
})

test('cópia financeira exige uma moeda base permitida', () => {
  const schema = contract.match(/^    FinancialState:[\s\S]*?(?=^    [A-Z][A-Za-z]+:)/m)?.[0] || ''

  assert.match(schema, /required: \[version, lastUpdatedAt, currency, exchangeRates, customCategories, plan, cashFlow, scenarios\]/)
  assert.match(schema, /currency:[\s\S]*enum: \[BRL, EUR, USD, CHF\]/)
})
