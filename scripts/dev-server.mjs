import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, isAbsolute, join, normalize, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { securityHeaders } from './security-headers.mjs'
import { createAuthHandler } from '../src/server/auth/auth-handler.mjs'
import { createExchangeRateHandler } from '../src/server/exchange-rates.mjs'
import { createExchangeHistoryHandler } from '../src/server/exchange-history.mjs'

const projectRoot = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..'))
const requestedPort = Number(process.env.PORT || 4173)
const handleAuth = createAuthHandler()
const handleExchangeRates = createExchangeRateHandler()
const handleExchangeHistory = createExchangeHistoryHandler()

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8'
}

function safePath(pathname) {
  const decodedPath = decodeURIComponent(pathname).replace(/^\/+/, '')
  const candidate = normalize(join(projectRoot, decodedPath))
  const relativeCandidate = relative(projectRoot, candidate)
  const isInsideProject =
    !relativeCandidate.startsWith('..') && !isAbsolute(relativeCandidate)
  return isInsideProject ? candidate : null
}

async function resolveFile(pathname) {
  const pathnameWithoutQuery = pathname.split('?')[0]
  const candidate = safePath(pathnameWithoutQuery)

  if (candidate) {
    try {
      const fileStats = await stat(candidate)
      if (fileStats.isFile()) return candidate
    } catch {
      // Rotas da SPA usam o arquivo principal.
    }
  }

  return join(projectRoot, 'index.html')
}

const server = createServer(async (request, response) => {
  try {
    for (const [name, value] of Object.entries(securityHeaders)) response.setHeader(name, value)
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`)
    if (await handleAuth(request, response, requestUrl)) return
    if (await handleExchangeRates(request, response, requestUrl)) return
    if (await handleExchangeHistory(request, response, requestUrl)) return

    const filePath = await resolveFile(request.url || '/')
    const body = await readFile(filePath)
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      ...securityHeaders
    })
    response.end(body)
  } catch {
    response.writeHead(500, {
      'Content-Type': 'text/plain; charset=utf-8',
      ...securityHeaders
    })
    response.end('Não foi possível carregar o Aposenta+.')
  }
})

server.listen(requestedPort, '127.0.0.1', () => {
  console.log(`Aposenta+ disponível em http://127.0.0.1:${requestedPort}`)
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.log('Supabase Auth desativado. Configure SUPABASE_URL e SUPABASE_ANON_KEY para ativar contas.')
  }
})
