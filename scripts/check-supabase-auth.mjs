import { pathToFileURL } from 'node:url'

export async function checkSupabaseAuth({ env = process.env, fetchImpl = fetch } = {}) {
  const url = String(env.SUPABASE_URL || '').replace(/\/$/, '')
  const anonKey = String(env.SUPABASE_ANON_KEY || '')

  if (!url || !anonKey) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_ANON_KEY antes do teste.')
  }

  const response = await fetchImpl(`${url}/auth/v1/settings`, {
    method: 'GET',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`
    }
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(`Supabase Auth respondeu com HTTP ${response.status}. Verifique a URL e a chave publicável.`)
  }

  return {
    connected: true,
    emailProviderEnabled: payload.external?.email === true,
    emailConfirmationRequired: payload.mailer_autoconfirm === false
  }
}

async function main() {
  try {
    const result = await checkSupabaseAuth()
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
