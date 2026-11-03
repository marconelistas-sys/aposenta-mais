// Builds text-only PDFs from rows of [column, text]. Columns are in units of 4
// points, the scale used by pdfTextLines.

// pdf.js text items, as read from the PDF.
export const textItems = rows => rows.flatMap((row, index) => row.map(([column, str]) => ({ str, transform: [1, 0, 0, 1, column * 4, 800 - index * 16] })))

export function textPdf(pages) {
  const escape = text => text.replace(/[\\()]/g, '\\$&')
  const streams = pages.map(rows => rows.flatMap((row, index) => row.map(([column, text]) => `BT /F1 6 Tf 1 0 0 1 ${column * 4} ${800 - index * 16} Tm (${escape(text)}) Tj ET`)).join('\n'))
  const pageIds = streams.map((_, index) => 4 + index * 2)
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${streams.length} >>`,
    // WinAnsi encoding with latin1 bytes keeps the accented letters of the labels.
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
    ...streams.flatMap((stream, index) => [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageIds[index] + 1} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`
    ])
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}
