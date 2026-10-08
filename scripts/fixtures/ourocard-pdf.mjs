// Synthetic holder, account and card. Amounts exercise the supported layout.
export function ourocardFixturePages() {
  return [
    ['Ola, Pessoa Exemplo, esta e sua fatura', 'OUROCARD VISA INFINITE Final 0000', 'Vencimento', '25/10/2025', 'Resumo da fatura', 'Saldo fatura anterior R$ 1.926,94', 'Pagamentos/Creditos R$ -2.009,94', 'Compras nacionais R$ 1.693,31', 'Compras internacionais R$ 0,00', 'Tarifas, encargos e multas R$ 0,00', 'Total R$ 1.610,31', 'Saldo parcelado em faturas futuras R$ 1.325,00', 'Pagamento minimo R$ 241,55', 'Pagina 1/3'],
    ['Informacoes complementares', 'Fatura fechada em 15/10/2025', 'Fechamento da proxima fatura 13/11/2025', 'Lancamentos nesta fatura', 'Pessoa Exemplo (Cartao 0000)', 'Data Descricao Pais Valor', 'SALDO FATURA ANTERIOR BR R$ 1.926,94', 'Pagamentos/Creditos', '25/09 PGTO DEBITO CONTA 0000 000000000 000 BR R$ -1.926,94', '14/10 DESC AUTOMATICO ANUD. TIT-PARC 12/12 BR R$ -83,00', 'Servicos', '18/09 AMAZON BR SAO PAULO BR R$ 121,07', '18/09 AMAZON BR SAO PAULO BR R$ 284,71', '20/09 AMAZON BR SAO PAULO BR R$ 114,84', '30/09 BB SEGUROS A*BB S SAO PAULO BR R$ 604,23', '12/10 NETFLIX.COM SAO PAULO BR R$ 59,90', '12/10 AMAZON BR SAO PAULO BR R$ 100,76', 'Outros lancamentos', 'Pagina 2/3'],
    ['21/09 Amazon Prime Canais SAO PAULO BR R$ 39,90', '08/10 AmazonPrimeBR SAO PAULO BR R$ 19,90', '14/10 ANUIDADE DIFERENCIADA TIT-PARC 12/12 BR R$ 83,00', 'Compras parceladas', '13/05 LOJA EXEMPLO PARC 05/10 SAO PAULO BR R$ 265,00', 'Total da Fatura R$ 1.610,31', 'Fale conosco', 'Pagina 3/3']
  ]
}
export function syntheticOurocardText() { return ourocardFixturePages().map(page => page.join('\n')).join('\n\f\n') }
export function internationalOurocardFixturePages() {
  const pages = ourocardFixturePages().map(rows => rows.map(row => row.replaceAll('Compras internacionais R$ 0,00', 'Compras internacionais R$ 500,00').replaceAll('1.693,31', '1.710,81').replaceAll('1.610,31', '2.127,81')))
  pages[2].splice(0, 0, '12/10 TAP AIR 000000000 WWW.FLYTAP.CO CH R$ 500,00', '*** 90,00 FRANCO SUICO', 'equivalente a US$ 100,00', 'Cotacao do Dolar de 12/10: R$ 5,0000')
  pages[2].splice(pages[2].indexOf('Compras parceladas'), 0, '14/10 IOF - COMPRA NO EXTERIOR R$ 17,50')
  return pages
}
export function syntheticOurocardPdf(pages = ourocardFixturePages()) {
  const escape = text => text.replace(/[\\()]/g, '\\$&')
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 3} 0 R`).join(' ')}] /Count ${pages.length} >>`]
  pages.forEach((rows, index) => {
    const page = 3 + index * 3
    const stream = rows.map((text, row) => `BT /F1 8 Tf 1 0 0 1 24 ${780 - row * 18} Tm (${escape(text)}) Tj ET`).join('\n')
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${page + 1} 0 R >> >> /Contents ${page + 2} 0 R >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>', `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`)
  })
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}
