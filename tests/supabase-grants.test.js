import test from 'node:test'
import assert from 'node:assert/strict'
import { checkMigrations, readMigrations, statements } from '../scripts/check-supabase-grants.mjs'

const sql = `
CREATE TABLE IF NOT EXISTS public.financial_plans (user_id uuid);
ALTER TABLE public.financial_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_plans FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.financial_plans FROM anon;
REVOKE ALL ON public.financial_plans FROM public, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_plans TO authenticated;
GRANT SELECT ON public.financial_plans TO service_role;
`
const run = (source, later = '') => checkMigrations([
  { name: '001.sql', sql: source },
  { name: '002.sql', sql: later }
])

test('all repository migrations define reviewed least-privilege grants', () => {
  assert.equal(checkMigrations(readMigrations()), 1)
})

test('explicit ACL works without any automatic grants', () => {
  assert.equal(run(sql), 1)
  assert.equal(run(sql.replaceAll('public.financial_plans', '"public" . "financial_plans"')), 1)
})

test('missing service_role SELECT fails, including when repaired only later', () => {
  const grant = 'GRANT SELECT ON public.financial_plans TO service_role;'
  assert.throws(() => run(sql.replace(grant, '')), /service_role grants/)
  assert.throws(() => run(sql.replace(grant, ''), grant), /001.sql.*service_role grants/)
})

test('every authenticated operation is required', () => {
  for (const missing of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
    const remaining = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].filter(value => value !== missing).join(', ')
    assert.throws(() => run(sql.replace('GRANT SELECT, INSERT, UPDATE, DELETE', `GRANT ${remaining}`)), /authenticated grants/)
  }
})

test('comments and string literals cannot satisfy required grants', () => {
  const grant = 'GRANT SELECT ON public.financial_plans TO service_role;'
  for (const replacement of [`-- ${grant}`, `/* outer /* nested */ ${grant} */`, `SELECT '${grant}';`, `SELECT $$${grant}$$;`]) {
    assert.throws(() => run(sql.replace(grant, replacement)), /service_role grants/)
  }
})

test('new public and unqualified tables cannot silently skip review', () => {
  for (const statement of [
    'CREATE TABLE public.new_table (id uuid);',
    'CREATE TABLE new_table (id uuid);',
    'CREATE UNLOGGED TABLE public.new_table (id uuid);',
    'CREATE GLOBAL TEMPORARY TABLE public.new_table (id uuid);',
    'CREATE TABLE public.new_table AS SELECT 1 AS id;'
  ]) assert.throws(() => run(sql, statement), /CREATE TABLE/)
})

test('anonymous/public access and excessive service privileges fail', () => {
  for (const grant of [
    'GRANT SELECT ON public.financial_plans TO anon;',
    'GRANT SELECT ON public.financial_plans TO public;',
    'GRANT INSERT ON public.financial_plans TO service_role;',
    'GRANT ALL ON public.financial_plans TO service_role;',
    'GRANT TRUNCATE ON public.financial_plans TO authenticated;'
  ]) assert.throws(() => run(sql, grant), /grants must be exactly/)
})

test('legacy grants must be reset and later revocations are detected', () => {
  assert.throws(() => run(sql.replace('REVOKE ALL ON public.financial_plans FROM anon;', '')), /REVOKE ALL/)
  assert.throws(() => run(sql, 'REVOKE SELECT ON public.financial_plans FROM service_role;'), /service_role grants/)
})

test('RLS cannot be omitted or disabled later', () => {
  for (const action of ['ENABLE', 'FORCE']) {
    assert.throws(() => run(sql.replace(`ALTER TABLE public.financial_plans ${action} ROW LEVEL SECURITY;`, '')), /ROW LEVEL SECURITY/)
  }
  for (const action of ['DISABLE', 'NO FORCE']) {
    assert.throws(() => run(sql, `ALTER TABLE public.financial_plans ${action} ROW LEVEL SECURITY;`), /ROW LEVEL SECURITY/)
  }
})

test('broad/default/dynamic grants or DDL fail closed for review', () => {
  for (const later of [
    'GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;',
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;',
    "DO $$ BEGIN EXECUTE 'CREATE TABLE public.hidden (id uuid)'; END $$;",
    'SET search_path = private;'
  ]) assert.throws(() => run(sql, later), /review|unsupported/)
  assert.throws(() => statements('/* unfinished'), /Unterminated/)
})

test('forward migration independently repairs legacy and missing ACLs', () => {
  const repair = readMigrations().find(({ name }) => name.includes('explicit_data_api_grants'))
  assert.ok(repair, 'An upgrade migration is required for existing installations')
  const creation = 'CREATE TABLE public.financial_plans (user_id uuid);\n' +
    'ALTER TABLE public.financial_plans ENABLE ROW LEVEL SECURITY;\n' +
    'ALTER TABLE public.financial_plans FORCE ROW LEVEL SECURITY;\n'
  assert.equal(run(creation + repair.sql), 1)
  assert.equal(run(sql, repair.sql + repair.sql), 1, 'repair is idempotent')
})
