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
