import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, isAbsolute, join, normalize, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { securityHeaders } from './security-headers.mjs'

const projectRoot = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..'))
const requestedPort = Number(process.env.PORT || 4173)

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
})
