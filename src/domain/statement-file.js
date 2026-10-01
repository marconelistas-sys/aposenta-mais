import { inspectStatementText } from './statement-import.js'
import { parsePdfStatement } from './pdf-statement.js'

// Retain coordinates so the debit and credit columns remain distinct.
export function pdfTextLines(items) {
  const lines = []
  for (const item of items.filter(item => typeof item.str === 'string' && item.str.trim()).sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4])) {
    let line = lines.find(line => Math.abs(line.y - item.transform[5]) < 2)
    if (!line) { line = { y: item.transform[5], items: [] }; lines.push(line) }
    line.items.push(item)
  }
  return lines.map(line => {
    let text = ''
    for (const item of line.items.sort((a, b) => a.transform[4] - b.transform[4])) {
      const column = Math.round(item.transform[4] / 4)
      text += ' '.repeat(Math.max(text.length ? 1 : 0, column - text.length)) + item.str
    }
    return text
  }).join('\n')
}

export async function readStatementFile(file, options = {}) {
  if (!file || !file.size || file.size > 1024 * 1024) throw new TypeError('Selecione um arquivo de até 1 MB.')
  let text, sourceAccount, format, internalTransferReferences
  if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
    let pdfjs
    try {
      // .js works with existing servers that don't register the .mjs MIME type.
      pdfjs = await import('../../public/vendor/pdfjs/pdf.min.js')
    } catch (cause) {
      throw new TypeError('Não foi possível carregar o leitor de PDF. Atualize a página e selecione o arquivo novamente.', { cause })
    }
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../public/vendor/pdfjs/pdf.worker.min.js', import.meta.url).href
    let task
    try {
      task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, useSystemFonts: true })
      const pdf = await task.promise
      if (pdf.numPages > 50) throw new TypeError('Use um PDF com até 50 páginas.')
      const pages = []
      for (let index = 1; index <= pdf.numPages; index++) {
        const page = await pdf.getPage(index)
        pages.push(pdfTextLines((await page.getTextContent()).items))
      }
      const pdfText = pages.join('\n\f\n')
      const parsed = parsePdfStatement(pdfText)
      text = parsed.text
      sourceAccount = parsed.sourceAccount
      format = parsed.format
      internalTransferReferences = parsed.internalTransferReferences
    } catch (error) {
      if (error instanceof TypeError) throw error
      throw new TypeError('Não foi possível ler o PDF. Use um extrato TKB ou Banco do Brasil sem senha, com texto selecionável.')
    } finally {
      await task?.destroy()
    }
  } else {
    text = await file.text()
  }
  const inspection = inspectStatementText(text, options)
  if (sourceAccount) inspection.sourceAccount = sourceAccount
  if (format) inspection.format = format
  if (internalTransferReferences?.size) {
    for (const row of inspection.rows) row.internalTransfer = internalTransferReferences.has(row.cells[inspection.suggestedMapping.reference])
  }
  return { text, inspection }
}
