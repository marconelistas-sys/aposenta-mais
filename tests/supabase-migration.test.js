import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = await readFile(
  new URL('../supabase/migrations/202609040001_sprint_6_financial_plans.sql', import.meta.url),
  'utf8'
)

test('migração ativa e força RLS', () => {
  assert.match(migration, /enable row level security/i)
  assert.match(migration, /force row level security/i)
  assert.match(migration, /revoke all on public\.financial_plans from anon/i)
})

test('cada operação limita acesso ao usuário autenticado', () => {
  for (const operation of ['select', 'insert', 'update', 'delete']) {
    assert.match(migration, new RegExp(`for ${operation}[\\s\\S]*?auth\\.uid\\(\\)`, 'i'))
  }
  assert.match(migration, /references auth\.users\(id\) on delete cascade/i)
})

test('migração limita formato e tamanho do documento financeiro', () => {
  assert.match(migration, /jsonb_typeof\(payload\) = 'object'/i)
  assert.match(migration, /octet_length\(payload::text\) <= 131072/i)
})
