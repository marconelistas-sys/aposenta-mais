import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'
import { balanceInvestedLine, fanChart, figure, historyLine } from '../src/features/report/report-charts.js'

// Isolated synthetic charts: no server, account, stored plan or external data.
const output = resolve(process.argv[2] || join(tmpdir(), 'fin2-panorama-charts'))
await mkdir(output, { recursive: true })
const styles = (await Promise.all(['tokens', 'app', 'report'].map(name => readFile(new URL(`../src/styles/${name}.css`, import.meta.url), 'utf8')))).join('\n')
const common = { currency: 'CHF', label: 'Valores sintéticos' }
const charts = [
  ['Saldo e aportado coincidentes', balanceInvestedLine({ ...common, series: [{ date: '2026-01-01', balance: 12000000, invested: 12000000 }, { date: '2026-01-11', balance: 14000000, invested: 14000000 }, { date: '2026-04-11', balance: 15000000, invested: 15000000 }] })],
  ['Fotos com meses sem registro', historyLine({ ...common, series: [{ month: '2026-01', netWorth: -1000 }, { month: '2026-02', netWorth: 0 }, { month: '2026-12', netWorth: 5000 }] })],
  ['Percentis coincidentes', fanChart({ ...common, retirementYear: 2027, series: [2026, 2027].map(year => ({ year, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 })) })]
].map(([title, body]) => figure({ title, body })).join('')
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR' })
  await page.setContent(`<html lang="pt-BR"><head><style>${styles}</style></head><body><main class="report" style="padding:16px"><h1>Gráficos do panorama</h1>${charts}</main></body></html>`)
  for (const width of [320, 360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `página sem rolagem horizontal a ${width}px`)
    for (const chart of await page.locator('.report-chart-scroll').all()) {
      const metrics = await chart.evaluate(node => {
        const svg = node.querySelector('svg')
        const tick = svg.querySelector('.report-svg-tick')
        const labels = [...svg.querySelectorAll('.report-svg-label')].map(label => label.getBoundingClientRect())
        const bounds = svg.getBoundingClientRect()
        return {
          width: bounds.width,
          textPixels: parseFloat(getComputedStyle(tick).fontSize) * bounds.width / svg.viewBox.baseVal.width,
          labelsFit: labels.every(label => label.right <= bounds.right + 1 && label.top >= bounds.top && label.bottom <= bounds.bottom),
          overlap: labels.some((a, index) => labels.slice(index + 1).some(b => a.top < b.bottom && b.top < a.bottom)),
          scrollable: node.scrollWidth > node.clientWidth
        }
      })
      assert.ok(metrics.width >= 680, 'SVG preserva largura de leitura')
      assert.ok(metrics.textPixels >= 12, 'texto do eixo com pelo menos 12 pixels')
      assert.equal(metrics.labelsFit, true, 'rótulos finais cabem no SVG')
      assert.equal(metrics.overlap, false, 'rótulos finais não se sobrepõem')
      if (width <= 390) assert.equal(metrics.scrollable, true, 'rolagem fica dentro da região')
    }
    const first = page.locator('.report-chart-scroll').first()
    await first.focus()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Shift+Tab')
    assert.equal(await first.evaluate(node => node.matches(':focus-visible')), true)
    assert.equal(await first.evaluate(node => getComputedStyle(node).outlineStyle), 'solid')
    await page.screenshot({ path: join(output, `graficos-${width}.png`), fullPage: true })
  }
  await page.setViewportSize({ width: 320, height: 1000 })
  const region = page.locator('.report-chart-scroll').first()
  await region.focus()
  for (let index = 0; index < 5; index++) await page.keyboard.press('ArrowRight')
  await page.waitForFunction(() => document.querySelector('.report-chart-scroll').scrollLeft > 0)
  assert.ok(await region.evaluate(node => node.scrollLeft > 0), 'teclado move a região')
  console.log(`Gráficos validados em 320, 360, 390, 768 e 1440 px: texto legível, rótulos sem colisão, rolagem local e teclado. Capturas em ${output}.`)
} finally {
  await browser.close()
}
