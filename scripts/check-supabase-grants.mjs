import { readdirSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Every new table requires an explicit access review here, including private tables
// (use empty arrays). Never infer service_role writes from its BYPASSRLS attribute.
export const tableAccess = {
  'public.financial_plans': {
    public: [], anon: [],
    authenticated: ['select', 'insert', 'update', 'delete'],
    service_role: ['select']
  }
}

// Small, deliberately conservative SQL lexer. Quoted bodies and comments cannot
// satisfy a grant check. Unsupported ACL/DDL syntax fails for manual review.
export function statements(sql) {
  const result = []
  let current = '', i = 0
  while (i < sql.length) {
    const tail = sql.slice(i)
    if (tail.startsWith('--')) {
      const end = sql.indexOf('\n', i)
      i = end < 0 ? sql.length : end
      current += ' '
    } else if (tail.startsWith('/*')) {
      let depth = 1
      i += 2
      while (i < sql.length && depth) {
        if (sql.slice(i, i + 2) === '/*') { depth++; i += 2 }
        else if (sql.slice(i, i + 2) === '*/') { depth--; i += 2 }
        else i++
      }
      if (depth) throw new Error('Unterminated SQL comment')
      current += ' '
    } else if (tail[0] === "'" || /^\$[a-z_0-9]*\$/i.test(tail)) {
      const delimiter = tail[0] === "'" ? "'" : tail.match(/^\$[a-z_0-9]*\$/i)[0]
      const start = i
      i += delimiter.length
      for (;;) {
        const end = sql.indexOf(delimiter, i)
        if (end < 0) throw new Error('Unterminated SQL literal')
        i = end + delimiter.length
        if (delimiter === "'" && sql[i] === "'") { i++; continue }
        break
      }
      if (delimiter !== "'" && /\b(?:create\s+(?:unlogged\s+)?table|execute)\b/i.test(sql.slice(start, i))) {
        throw new Error('Dynamic table DDL requires an explicit grant-checker review')
      }
      current += ' __literal__ '
    } else if (tail[0] === '"') {
      const match = tail.match(/^"([a-z_][a-z_0-9]*)"/)
      if (!match) throw new Error('Unsupported quoted identifier: review grant checker')
      current += match[1]
      i += match[0].length
    } else if (tail[0] === ';') {
      if (current.trim()) result.push(current.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*\.\s*/g, '.'))
      current = ''; i++
    } else { current += sql[i++]; }
  }
  if (current.trim()) throw new Error('SQL statement must end with a semicolon')
  return result
}

export function checkMigrations(migrations, contract = tableAccess) {
  const states = new Map()
  function verify(table, state, file) {
    for (const [role, expected] of Object.entries(contract[table])) {
      if (!state.reset.has(role)) throw new Error(`${file}: ${table}: explicit REVOKE ALL required for ${role}`)
      const actual = [...state.roles[role]].sort()
      if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
        throw new Error(`${file}: ${table}: ${role} grants must be exactly [${expected}] (found [${actual}])`)
      }
    }
    if (!state.enabled || !state.forced) throw new Error(`${file}: ${table}: ENABLE and FORCE ROW LEVEL SECURITY required`)
  }
  for (const { name, sql } of migrations) {
    const created = new Set()
    for (const statement of statements(sql)) {
      if (/^alter default privileges\b/.test(statement) || /^set (?:local |session )?search_path\b/.test(statement)) {
        throw new Error(`${name}: defaults/search_path changes require explicit grant-checker review`)
      }
      if (/^create\b.*\btable\b/.test(statement)) {
        const match = statement.match(/^create (?:unlogged )?table (?:if not exists )?([a-z_][\w]*\.[a-z_][\w]*)\s*\(/)
        const table = match?.[1]
        if (!table || !Object.hasOwn(contract, table)) throw new Error(`${name}: CREATE TABLE requires a schema-qualified table and reviewed tableAccess entry`)
        states.set(table, { roles: Object.fromEntries(Object.keys(contract[table]).map(role => [role, new Set()])), reset: new Set(), enabled: false, forced: false })
        created.add(table)
      }
      if (/^(grant|revoke)\b/.test(statement) && !/ on function /.test(statement)) {
        const match = statement.match(/^(grant|revoke) ([a-z, ]+) on (?:table )?([a-z_][\w]*\.[a-z_][\w]*) (?:to|from) ([a-z_, ]+)$/)
        if (!match || !states.has(match[3])) throw new Error(`${name}: unsupported ACL statement: ${statement}`)
        const [, action, privileges, table, roles] = match
        const state = states.get(table)
        for (const role of roles.split(',').map(s => s.trim())) {
          if (!Object.hasOwn(state.roles, role)) throw new Error(`${name}: unreviewed role ${role}`)
          if (action === 'revoke' && /^(all|all privileges)$/.test(privileges)) {
            state.roles[role].clear(); state.reset.add(role)
          } else {
            for (const privilege of privileges.split(',').map(s => s.trim())) {
              if (action === 'grant') state.roles[role].add(privilege)
              else state.roles[role].delete(privilege)
            }
          }
        }
      }
      const rls = statement.match(/^alter table (?:only )?([\w.]+) (enable|force|disable|no force) row level security$/)
      if (rls && states.has(rls[1])) {
        const state = states.get(rls[1])
        if (['enable', 'disable'].includes(rls[2])) state.enabled = rls[2] === 'enable'
        else state.forced = rls[2] === 'force'
      }
    }
    // Later migrations cannot compensate for missing grants at table creation.
    for (const table of created) verify(table, states.get(table), name)
    for (const [table, state] of states) verify(table, state, name)
  }
  for (const table of Object.keys(contract)) {
    if (!states.has(table)) throw new Error(`Missing CREATE TABLE for ${table}`)
  }
  return states.size
}

export function readMigrations(directory = new URL('../supabase/migrations/', import.meta.url)) {
  return readdirSync(directory, { recursive: true }).filter(name => name.endsWith('.sql')).sort()
    .map(name => ({ name, sql: readFileSync(new URL(name, directory), 'utf8') }))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(`Supabase grants verified: ${checkMigrations(readMigrations())} table(s).`) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
