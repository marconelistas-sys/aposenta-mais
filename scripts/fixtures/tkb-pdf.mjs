// Synthetic statement. No account holder or real bank transactions.
export function syntheticTkbPdf({ month = 8, year = 2026, knownMerchants = false } = {}) {
  const rows = [
    [[8, 'Privatkonto CHF']],
    [[8, 'Kontoauszug 01.08.2026 - 31.08.2026']],
    [[8, 'Datum'], [16, 'Text'], [68, 'Belastung'], [82, 'Gutschrift'], [98, 'Valuta'], [116, 'Saldo']],
    [[8, '01.08.'], [16, 'Saldovortrag'], [114, "10'000.00"]],
    [[8, '03.08.'], [16, 'Warenbezug und Dienstleistungen'], [70, '4.20'], [98, '30.07.26'], [114, "9'995.80"]],
    [[16, 'Loja exemplo']],
    [[16, 'TKB Debit Mastercard']],
    [[8, '10.08.'], [16, 'Belastung e-banking'], [70, '823.50'], [98, '10.08.26'], [114, "9'172.30"]],
    [[16, 'Empresa exemplo']],
    [[8, '25.08.'], [16, 'Gutschrift'], [82, "8'081.30"], [98, '25.08.26'], [114, "17'253.60"]],
    [[16, 'Empregador exemplo']],
    [[16, 'Umsatztotal'], [70, '827.70'], [82, "8'081.30"]],
    [[8, '31.08.'], [16, 'Saldo'], [114, "17'253.60"]]
  ]
  const monthText = String(month).padStart(2, '0')
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  for (const row of rows) for (const cell of row) {
    cell[1] = cell[1].replaceAll('31.08.', `${lastDay}.08.`).replaceAll('08.2026', `${monthText}.${year}`).replaceAll('08.', `${monthText}.`).replaceAll('.26', `.${String(year).slice(-2)}`)
    if (knownMerchants) cell[1] = cell[1].replace('Loja exemplo', 'Migros exemplo').replace('Empresa exemplo', 'Netflix exemplo').replace('Empregador exemplo', 'Lohn/Gehalt exemplo')
  }
  const escape = text => text.replace(/[\\()]/g, '\\$&')
  const stream = rows.flatMap((row, index) => row.map(([column, text]) => `BT /F1 6 Tf 1 0 0 1 ${column * 4} ${780 - index * 18} Tm (${escape(text)}) Tj ET`)).join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf)
}
