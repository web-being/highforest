#!/usr/bin/env node
// mobile-audit – render a page at phone widths and report what breaks.
// usage: node mobile-audit.mjs <url|file.html> [--widths 320,375,414,768]
// exit 1 when any error is found. `probe` runs in the page and can be
// evaluated by any browser tool when Playwright is not installed.

export const probe = () => {
  const W = innerWidth, out = [], seen = new Set()
  const vis = el => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0 &&
      (el.checkVisibility?.() ?? true) // false inside a closed <details>: its content is laid out but not rendered
  }
  const name = el => {
    const id = el.id ? '#' + el.id : ''
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''
    const txt = (el.innerText || el.alt || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 32)
    return el.tagName.toLowerCase() + id + cls + (txt ? ` "${txt}"` : '')
  }
  const add = (level, rule, el, note) => {
    const key = rule + '|' + (el ? name(el) : '') + '|' + note
    if (seen.has(key)) return
    seen.add(key); out.push({ level, rule, el: el ? name(el) : '', note })
  }
  // an ancestor that scrolls or clips sideways owns its overflow
  const clipped = el => {
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX
      if (o !== 'visible' && p !== document.body) return true
    }
    return false
  }

  // 1 viewport meta
  const vp = document.querySelector('meta[name=viewport]')
  if (!vp || !/width\s*=\s*device-width/.test(vp.content)) add('error', 'viewport', null, 'no <meta name=viewport content="width=device-width">')

  // 2 horizontal overflow
  if (document.documentElement.scrollWidth > W + 1) {
    add('error', 'overflow-x', null, `page is ${document.documentElement.scrollWidth}px wide in a ${W}px viewport`)
    for (const el of document.body.querySelectorAll('*')) {
      if (!vis(el) || clipped(el)) continue
      const r = el.getBoundingClientRect()
      if (r.right > W + 1 || r.left < -1) add('error', 'overflow-x', el, `spans ${Math.round(r.left)}…${Math.round(r.right)}px`)
    }
  }

  // 3 tap targets, 4 wrapped controls
  const controls = document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [tabindex]:not([tabindex="-1"])')
  for (const el of controls) {
    if (!vis(el)) continue
    const s = getComputedStyle(el), r = el.getBoundingClientRect()
    // a link inside a sentence is exempt from target size (WCAG 2.5.8, inline exception):
    // compare its text with the text of the nearest block around it
    let box = el.parentElement
    while (box && getComputedStyle(box).display.startsWith('inline')) box = box.parentElement
    const inText = el.tagName === 'A' && s.display === 'inline' && box &&
      box.innerText.trim().length > (el.innerText || '').trim().length + 12
    if (!inText) {
      const min = Math.min(r.width, r.height)
      if (min < 24) add('error', 'tap-target', el, `${Math.round(r.width)}×${Math.round(r.height)}px, below the 24px floor (WCAG 2.5.8)`)
      else if (min < 44) add('warn', 'tap-target', el, `${Math.round(r.width)}×${Math.round(r.height)}px, under 44px`)
      // count the lines the label's own text occupies, whatever the box around it does
      const range = document.createRange(); range.selectNodeContents(el)
      const tops = [...range.getClientRects()].filter(q => q.width > 1).map(q => Math.round(q.top + q.height / 2))
      const lines = tops.sort((a, b) => a - b).filter((v, i, a) => !i || v - a[i - 1] > parseFloat(s.fontSize) * 0.6).length
      const label = (el.innerText || '').trim()
      if (lines > 1 && label && label.length < 40 && !el.querySelector('img, svg, picture, br, p, h1, h2, h3, h4, div'))
        add('error', 'wrapped-control', el, `label wraps to ${lines} lines`)
    }
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && parseFloat(s.fontSize) < 16)
      add('error', 'input-zoom', el, `font-size ${s.fontSize}; under 16px iOS zooms the page on focus`)
  }

  // 5 small text
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n; (n = walker.nextNode());) {
    if (!n.nodeValue.trim() || !n.parentElement || !vis(n.parentElement)) continue
    const fs = parseFloat(getComputedStyle(n.parentElement).fontSize)
    const script = n.parentElement.closest('sub, sup') ? 2 : 0 // subscripts and superscripts may run two pixels smaller
    if (fs < 11 - script) add('error', 'small-text', n.parentElement, `${fs}px`)
    else if (fs < 12 - script) add('warn', 'small-text', n.parentElement, `${fs}px`)
  }

  // 6 images
  for (const img of document.images) {
    if (!vis(img)) continue
    if (!img.getAttribute('width') || !img.getAttribute('height')) {
      if (getComputedStyle(img).aspectRatio === 'auto') add('warn', 'img-size', img, 'no width/height or aspect-ratio: layout shifts while loading')
    }
    if (img.naturalWidth && getComputedStyle(img).objectFit === 'fill') {
      const r = img.getBoundingClientRect(), a = img.naturalWidth / img.naturalHeight, b = r.width / r.height
      if (Math.abs(a - b) / a > 0.03) add('error', 'img-distorted', img, `natural ${a.toFixed(2)} rendered ${b.toFixed(2)}`)
    }
  }

  // 7 pinned elements eating the screen
  for (const el of document.body.querySelectorAll('*')) {
    const p = getComputedStyle(el).position
    if ((p !== 'fixed' && p !== 'sticky') || !vis(el)) continue
    const r = el.getBoundingClientRect()
    if (r.height > innerHeight * 0.3 && r.width > W * 0.6) add('warn', 'pinned', el, `${p} element covers ${Math.round(r.height / innerHeight * 100)}% of the viewport height`)
  }

  // 8 bare 100vh: in-app browsers resize the viewport and the page jumps
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules } catch { continue }
    const scan = list => {
      for (const r of list) {
        if (r.cssRules) scan(r.cssRules)
        if (r.style && /(^|[^a-z-])100vh/.test(r.style.cssText) && !/100[sd]vh/.test(r.style.cssText))
          add('warn', '100vh', null, `${r.selectorText}: use svh/dvh or content height`)
      }
    }
    scan(rules)
  }
  return out
}

const main = async () => {
  const args = process.argv.slice(2)
  const wi = args.indexOf('--widths')
  const widths = (wi >= 0 ? args.splice(wi, 2)[1] : '320,375,414,768').split(',').map(Number)
  const target = args[0]
  if (!target) { console.error('usage: mobile-audit.mjs <url|file.html> [--widths 320,375,414,768]'); process.exit(2) }
  const { resolve } = await import('node:path')
  const { pathToFileURL } = await import('node:url')
  const url = /^[a-z]+:\/\//.test(target) ? target : pathToFileURL(resolve(target)).href
  let chromium
  try { ({ chromium } = await import('playwright')) }
  catch { console.error('Playwright is not installed here. Run `npm i -D playwright && npx playwright install chromium`,\nor evaluate the exported `probe` function in a browser tool at each width.'); process.exit(2) }
  const browser = await chromium.launch()
  let errors = 0, warns = 0
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 800 }, deviceScaleFactor: 2, isMobile: width < 768, hasTouch: width < 768 })
    await page.goto(url, { waitUntil: 'networkidle' })
    const issues = await page.evaluate(probe)
    console.log(`\n${width}px – ${issues.length ? issues.length + ' issue(s)' : 'clean'}`)
    for (const i of issues) {
      i.level === 'error' ? errors++ : warns++
      console.log(`  ${i.level === 'error' ? '✗' : '!'} ${i.rule}${i.el ? '  ' + i.el : ''}  ${i.note}`)
    }
    await page.close()
  }
  await browser.close()
  console.log(`\n${errors} error(s), ${warns} warning(s) across ${widths.join(', ')}px`)
  process.exit(errors ? 1 : 0)
}

if (import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1] || '').href) main()
