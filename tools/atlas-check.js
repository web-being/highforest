// Checks of the atlas that only a browser can make: each is a fault that got through once.
// A Playwright function, not a module: hand it a page, with the repo served at localhost:4173
// (python3 -m http.server 4173). It returns the list of failures; an empty list is a pass.
//   const failures = await (eval(readFileSync('tools/atlas-check.js', 'utf8')))(page)
async (page) => {
  const base = 'http://localhost:4173/botanical-terpenes/', index = new URL(base).pathname, failures = []
  const check = (ok, what) => { if (!ok) failures.push(what) }
  const fresh = async (url, w = 1440, h = 900) => {
    await page.goto('about:blank'); await page.setViewportSize({ width: w, height: h })
    await page.goto(base + url, { waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300)
  }
  // the index with a compound's dossier opened from its tile
  const opened = async (id, w, h) => { await fresh('', w, h); await page.locator(`#${id} .card`).click(); await page.waitForTimeout(700) }
  const at = () => page.evaluate(() => ({ y: Math.round(scrollY), open: !!document.querySelector('.viewer')?.open, where: location.pathname + location.hash }))
  const box = sel => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), h: r.height } }, sel)

  // 0. The hero's three figures: they stand in one line, each label right beside its figure, its last line
  //    on the figure's own, and no longer than three words; no line of a label is one small word ("of" alone
  //    on a line). Under the pointer each says in a sentence what it counts, inside the window and clear of
  //    the bar under the hero.
  for (const [url, w] of [['', 1440], ['', 1130], ['', 834], ['', 390]]) {
    await fresh(url, w)
    const facts = await page.evaluate(() => {
      const items = [...document.querySelectorAll('.hero-facts li')]
      const alone = items.flatMap(li => {
        const lines = {}
        for (const text of li.querySelector('span').childNodes) if (text.nodeType === 3) for (const m of text.data.matchAll(/\S+/g)) {
          const r = document.createRange(); r.setStart(text, m.index); r.setEnd(text, m.index + m[0].length); (lines[Math.round(r.getBoundingClientRect().top)] ||= []).push(m[0])
        }
        return Object.values(lines).filter(l => l.length === 1 && l[0].replace(/\W/g, '').length <= 3).map(l => l[0])
      })
      // where a run of text stands: the top of an empty box set on its line
      const line = el => { const i = el.appendChild(Object.assign(document.createElement('i'), { style: 'display: inline-block' })), y = i.getBoundingClientRect().top; i.remove(); return y }
      return { alone, off: Math.max(...items.map(li => Math.abs(line(li.querySelector('span')) - line(li.querySelector('b'))))), long: items.map(li => li.querySelector('span').innerText.trim()).filter(t => t.split(/\s+/).length > 3), rows: new Set(items.map(li => Math.round(li.getBoundingClientRect().top))).size, apart: Math.max(...items.map(li => li.querySelector('span').getBoundingClientRect().left - li.querySelector('b').getBoundingClientRect().right)) }
    })
    check(!facts.alone.length, `the hero's figures at ${w}${url}: "${facts.alone.join('", "')}" stands alone on a line`)
    check(facts.rows === 1, `the hero's figures at ${w}${url}: they stand in ${facts.rows} lines`)
    for (const n of [1, 2, 3]) {
      await page.locator(`.hero-facts li:nth-child(${n}) a`).hover(); await page.waitForTimeout(250)
      const said = await page.evaluate(k => { const t = document.querySelector(`.hero-facts li:nth-child(${k}) .tip`), r = t.getBoundingClientRect(); return { seen: +getComputedStyle(t).opacity > 0.9, words: t.textContent.trim().split(/\s+/).length, inside: r.left >= 0 && r.right <= document.documentElement.clientWidth && r.top >= 0 && r.bottom <= document.querySelector('.sections').getBoundingClientRect().top } }, n)
      check(said.seen && said.words > 5 && said.inside, `the hero's figures at ${w}${url}, number ${n}: under the pointer its sentence is ${said.seen ? 'shown' : 'not shown'}, ${said.words} words, ${said.inside ? 'inside' : 'outside'} the window above the bar`)
    }
    await page.mouse.move(5, 5)
    check(facts.off < 1, `the hero's figures at ${w}${url}: a label's last line stands ${facts.off.toFixed(1)}px off its figure's line`)
    check(!facts.long.length, `the hero's figures at ${w}${url}: a label runs to more than three words: ${facts.long.join(' | ')}`)
    check(facts.apart <= 12, `the hero's figures at ${w}${url}: a label stands ${Math.round(facts.apart)}px from its figure`)
  }

  // 1. An open dossier has the address of the compound's own page, and that address leads there; under it
  //    the dossier's own relative addresses still mean what they meant (its plate loads, its link to the
  //    page leads to the page). Closing it leaves the reader where they were, however it is closed, also
  //    when an anchor (the hero's figure that leads to the eleven) was still in the address; Forward
  //    opens it again.
  const ways = {
    Escape: () => page.keyboard.press('Escape'),
    'the close key': () => page.locator('.viewer-close').click(),
    'a click outside': () => page.mouse.click(40, 300),
    Back: () => page.goBack(),
  }
  for (const [name, close] of Object.entries(ways)) {
    await fresh('')
    await page.locator('.hero-facts a[href="#eleven"]').click(); await page.waitForTimeout(900)
    await page.locator('#caryophyllene .card').click(); await page.waitForTimeout(600)
    const before = await at()
    check(before.where === `${index}caryophyllene`, `an open dossier has the address ${before.where}`)
    if (name === 'Escape') {
      const leads = await page.evaluate(async () => { const r = await fetch(location.href); return r.ok && new URL(r.url).pathname })
      check(leads === `${index}caryophyllene/`, `the address of an open dossier leads to ${leads} and not to the compound's page`)
      const own = await page.evaluate(async () => { const img = document.querySelector('.viewer .plate img'); await img.decode().catch(() => {}); return { plate: img.naturalWidth > 0, links: [...document.querySelectorAll('.viewer a[href$="/"]')].map(a => a.pathname).filter(p => !p.startsWith('//')).join() } })
      check(own.plate, 'under its own address an open dossier does not load its plate')
      check(own.links === `${index}caryophyllene/`, `under its own address an open dossier links to ${own.links}`)
      await page.locator('.viewer-next').click(); await page.waitForTimeout(400)
      check((await at()).where === `${index}humulene`, 'the next dossier did not take its own address')
    }
    await close(); await page.waitForTimeout(1200)
    const after = await at()
    check(before.open && !after.open, `closing by ${name}: the dossier did not open and close`)
    check(after.y === before.y, `closing by ${name}: the page moved from ${before.y} to ${after.y}`)
    check(after.where === index, `closing by ${name}: the address is ${after.where}`)
    if (name === 'Back') {
      await page.goForward(); await page.waitForTimeout(800)
      const again = await at()
      check(again.open && again.where === `${index}caryophyllene`, `Forward after Back: the dossier is ${again.open ? 'open' : 'closed'} at ${again.where}`)
    }
  }

  // 2. A citation followed from a dossier arrives at its source in the index, under the index's address
  //    with whatever query it had, and Back reopens the dossier.
  await fresh('?from=elsewhere'); await page.locator('#limonene .card').click(); await page.waitForTimeout(700)
  await page.locator('.viewer .cite a').first().click(); await page.waitForTimeout(1200)
  const cited = await page.evaluate(() => { const r = document.querySelector(location.hash || 'none')?.getBoundingClientRect(); return { open: document.querySelector('.viewer').open, seen: !!r && r.top >= 0 && r.bottom <= innerHeight, path: location.pathname + location.search } })
  check(!cited.open && cited.seen, 'a citation in a dossier: its source is not in view with the dossier closed')
  check(cited.path === `${index}?from=elsewhere`, `a citation in a dossier: the source is shown under the address ${cited.path}`)
  await page.goBack(); await page.waitForTimeout(800)
  const back = await at()
  check(back.open && back.where === `${index}limonene`, 'Back from a source did not reopen the dossier')

  // 3. The row of the six. It begins at the left edge of the page column. One is picked: it alone says how
  //    it is built, and every one says what it smells of, right under its name and within its own place.
  //    Picking another moves the pick and neither the row's height nor the page; nothing of the picked one
  //    runs into the next; a name that begins with a Greek letter stays on one line; and no click in the
  //    row opens a dossier. A wide window shows all six without scrolling the row; on a phone the picked
  //    one is brought to the row's start, the row fades at an end that has more to show, and a dot stands
  //    under it for each of the six, the picked one's longer. A wide window has neither fade nor dots.
  // the words of a name stand on one line (a plant that stands before them has a foot of its own)
  const oneLine = sel => page.evaluate(s => {
    const walk = document.createTreeWalker(document.querySelector(s), NodeFilter.SHOW_TEXT), lines = new Set()
    for (let n; (n = walk.nextNode());) { const r = document.createRange(); r.selectNodeContents(n); for (const q of r.getClientRects()) if (q.width > 1) lines.add(Math.round(q.bottom / 8)) }
    return lines.size === 1
  }, sel)
  const row = () => page.evaluate(() => {
    const strip = document.querySelector('.picks'), cur = strip.querySelector('.pick[aria-pressed="true"]'), next = cur.parentElement.nextElementSibling?.firstElementChild
    const rest = [...strip.querySelectorAll('.pick[aria-pressed="false"]')]
    const words = el => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect() }
    const begins = b => Math.min(words(b.querySelector('b')).left, b.querySelector('.mol').getBoundingClientRect().left)
    const ends = b => Math.max(words(b.querySelector('b')).right, b.querySelector('.mol').getBoundingClientRect().right, words(b.querySelector('.pick-scent')).right)
    return {
      name: cur.querySelector('b').textContent, left: begins(cur), column: document.querySelector('#same h2').getBoundingClientRect().left,
      gap: next ? begins(next) - ends(cur) : Infinity, over: strip.scrollWidth - strip.clientWidth, height: strip.offsetHeight, y: Math.round(scrollY),
      built: +getComputedStyle(cur.querySelector('.pick-shape')).opacity, others: Math.max(...rest.map(b => +getComputedStyle(b.querySelector('.pick-shape')).opacity)),
      spill: Math.max(...rest.map(b => ends(b) - b.parentElement.getBoundingClientRect().right)),
      under: rest.map(b => words(b.querySelector('.pick-scent')).top - words(b.querySelector('b')).bottom),
      more: strip.dataset.more, fades: ['--fade-start', '--fade-end'].map(v => parseFloat(getComputedStyle(strip).getPropertyValue(v)) > 0).join(),
      dots: getComputedStyle(document.querySelector('.pick-dots')).display !== 'none', long: [...document.querySelectorAll('.pick-dots i')].map(i => i.getBoundingClientRect().width > 12).indexOf(true),
    }
  })
  // picks: the ones to click in turn; the last of them is the one with the Greek letter
  for (const [w, h, picks, name] of [[1440, 900, [4], 'α-Phellandrene'], [390, 844, [1, 2], 'β-Pinene']]) {
    await fresh('', w, h)
    await page.evaluate(() => document.querySelector('.picks').scrollIntoView({ block: 'center', behavior: 'instant' }))
    const spot = n => page.evaluate(k => { const r = document.querySelectorAll('.pick')[k].querySelector('.mol').getBoundingClientRect(); return [Math.min(innerWidth - 6, Math.max(6, r.left + r.width / 2)), r.top + r.height / 2] }, n)
    const was = await row()
    check(Math.abs(was.left - was.column) < 1.5, `the row at ${w}: it begins ${Math.round(was.left - was.column)}px from the left edge of the page column`)
    if (w > 1200) check(was.over < 1 && !was.dots && was.fades === 'false,false', `the row at ${w}: the six do not all show (the row scrolls by ${was.over}px), or it has dots (${was.dots}) or fades (${was.fades})`)
    else check(was.more === 'end' && was.fades === 'false,true' && was.dots && was.long === 0, `the row at ${w}, before a pick: more to show at "${was.more}", fades at start,end ${was.fades}, dots ${was.dots ? 'shown' : 'hidden'}, the long one is number ${was.long + 1}`)
    for (const n of picks) { await page.mouse.click(...await spot(n)); await page.waitForTimeout(900) }
    const m = await row()
    check(m.name === name, `the row at ${w}: picking did not pick ${name} but ${m.name}`)
    check(m.built > 0.95 && m.others < 0.05, `the row at ${w}: the picked one is not the only one that says how it is built`)
    check(m.spill < 1, `the row at ${w}: a small one runs ${Math.round(m.spill)}px out of its place`)
    check(m.under.every(d => d > -1 && d < 12), `the row at ${w}: a small one's smell stands ${m.under.map(Math.round).join(', ')}px under its name`)
    check(m.gap >= 8, `the row at ${w}: the picked one runs into the next (${Math.round(m.gap)}px between them)`)
    check(m.height === was.height && m.y === was.y, `the row at ${w}: picking moved the page (the row from ${was.height} to ${m.height} high, the page from ${was.y} to ${m.y})`)
    if (w < 600) {
      check(Math.abs(m.left - m.column) < 2, `the row at ${w}: the picked one stands ${Math.round(m.left - m.column)}px from the row's start`)
      check(m.fades === 'true,true' && m.long === picks.at(-1), `the row at ${w}, after picks: fades at start,end ${m.fades}, the long dot is number ${m.long + 1}`)
    }
    check(await oneLine('.pick[aria-pressed="true"] b'), `the row at ${w}: a name with a Greek letter is broken across lines`)
    await page.mouse.click(...await spot(picks.at(-1))); await page.waitForTimeout(700)
    const then = await at()
    check(!then.open && then.where === index, `the row at ${w}: a click in it opened a dossier`)
  }
  // 3a. The picked one's drawing lifts off the page and turns; the others lie still. A drag turns it by hand
  //     and is not a press; a press lays it flat, so the movement can be stopped; and where less motion is
  //     asked for, nothing turns by itself.
  const drawn = n => page.evaluate(k => document.querySelectorAll('.pick .mol')[k].innerHTML, n)
  const turns = async n => { const a = await drawn(n); await page.waitForTimeout(400); return a !== await drawn(n) }
  const toRow = async () => { await page.evaluate(() => document.querySelector('.picks').scrollIntoView({ block: 'center', behavior: 'instant' })); await page.mouse.move(700, 890); await page.waitForTimeout(900) }
  await fresh(''); await toRow()
  check(await turns(0), 'the row: the picked one does not turn')
  check(!await turns(1), 'the row: one that is not picked turns')
  const [px, py] = await page.evaluate(() => { const r = document.querySelector('.pick .mol').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })
  await page.mouse.move(px, py); await page.mouse.down(); await page.mouse.move(px + 40, py + 8, { steps: 4 }); await page.mouse.up(); await page.mouse.move(700, 890); await page.waitForTimeout(500)
  check(await turns(0), 'the row: a drag on the picked one was taken for a press and laid it flat')
  await page.mouse.click(px, py); await page.mouse.move(700, 890); await page.waitForTimeout(700)
  check(!await turns(0), 'the row: a press on the picked one does not lay it flat')
  await page.mouse.click(px, py); await page.mouse.move(700, 890); await page.waitForTimeout(700)
  check(await turns(0), 'the row: a second press on the picked one does not lift it again')
  await page.mouse.click(...await page.evaluate(() => { const r = document.querySelectorAll('.pick .mol')[3].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })); await page.mouse.move(700, 890); await page.waitForTimeout(900)
  check(await turns(3), 'the row: one newly picked does not turn')
  check(!await turns(0), 'the row: the one picked before goes on turning')
  await page.emulateMedia({ reducedMotion: 'reduce' }); await fresh(''); await toRow()
  check(!await turns(0), 'the row: with less motion asked for, the picked one turns by itself')
  await page.emulateMedia({ reducedMotion: null })

  // 3a2. What a terpene is: the pointer that rests on a tile is shown what every corner of its drawing is,
  //      all the carbons the tile counts, at a size that can be read.
  await fresh('')
  for (const [n, carbons] of [[1, 5], [2, 10], [3, 15]]) {
    await page.locator(`.units li:nth-child(${n})`).scrollIntoViewIfNeeded(); await page.locator(`.units li:nth-child(${n})`).hover(); await page.waitForTimeout(300)
    const named = await page.evaluate(k => { const svg = document.querySelector(`.units li:nth-child(${k}) .mol`), g = svg.querySelector('.mol-names'); return { seen: +getComputedStyle(g).opacity, n: g.children.length, px: parseFloat(getComputedStyle(g.firstElementChild).fontSize) * svg.getBoundingClientRect().width / svg.viewBox.baseVal.width } }, n)
    check(named.seen > 0.9 && named.n === carbons && named.px >= 9.5, `what a terpene is, tile ${n}: under the pointer ${named.n} of its ${carbons} carbons are named, ${named.px.toFixed(1)}px high, at opacity ${named.seen}`)
  }

  await opened('phellandrene')
  check(await oneLine('.viewer .dossier-head h3'), 'a dossier: a name with a Greek letter is broken across lines')
  // without the row's script the six stand full size side by side: no name or description runs into the next
  await page.route('**/isomers.js', route => route.abort())
  await fresh('')
  const crowded = await page.evaluate(() => [...document.querySelectorAll('.pick')].map(a => ['b', '.pick-scent', '.pick-shape'].map(s => { const r = document.createRange(); r.selectNodeContents(a.querySelector(s)); return r.getBoundingClientRect() })).some((boxes, i, all) => i && boxes.some((r, k) => r.left < all[i - 1][k].right - 1)))
  check(!crowded, 'the row without its script: a name or a description runs into its neighbour')
  await page.unroute('**/isomers.js')

  // 3b. The compounds of a honey at the foot of the page are words in a sentence that begins with a capital
  //     and ends with a full stop (the jar link's layout once reached the links under it), none is broken
  //     across lines, and on the index one opens its dossier.
  await fresh('')
  await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' })); await page.waitForTimeout(600)
  const listed = await page.evaluate(() => { const all = [...document.querySelectorAll('.foot-honeys .with a')]; return { n: all.length, display: getComputedStyle(all[0]).display, said: [...document.querySelectorAll('.foot-honeys .with')].every(p => /^[A-Z].*\.$/.test(p.textContent.trim())), broken: all.filter(a => a.getClientRects().length > 1).map(a => a.textContent).join(', ') } })
  check(listed.n > 20 && listed.display === 'inline' && listed.said, `the compounds at the foot: ${listed.n} of them, laid out as ${listed.display}${listed.said ? '' : ', not as a sentence'}`)
  check(!listed.broken, `the compounds at the foot: ${listed.broken} broken across lines`)
  await page.locator('.foot-honeys .with a').first().click(); await page.waitForTimeout(600)
  check((await at()).open, 'a compound at the foot of the index did not open the dossier')

  // 3c. What is in each honey. The table and the circles point at each other: a compound under the pointer
  //     in one is marked in the other, with the part of the circles it stands in. Nothing else is marked:
  //     not by a part of the circles, not by a jar. A name in the circles opens its dossier. Where there
  //     are two columns the table and the circles take half each; narrower, the table is as wide as the
  //     sentence above it, its three honeys sharing the width, each jar with its honey's name under it.
  //     It keeps to the width of a small phone (it once scrolled sideways), and its jar columns are equal.
  await fresh('')
  await page.evaluate(() => document.querySelector('.venn').scrollIntoView({ block: 'center', behavior: 'instant' }))
  const marks = () => page.evaluate(() => ({
    rows: [...document.querySelectorAll('.in-honey tr[data-on]')].map(tr => tr.dataset.t).join(' '),
    names: [...document.querySelectorAll('.venn a[data-on]')].map(a => a.dataset.t).join(' '),
    parts: [...document.querySelectorAll('.venn-part[data-on]')].map(p => p.dataset.holds).join(' | '),
    all: document.querySelectorAll('.blends [data-on]').length,
  }))
  await page.locator('.venn a[data-t="myrcene"]').hover(); await page.waitForTimeout(300)
  let on = await marks()
  check(on.rows === 'myrcene' && on.parts === 'myrcene', `a compound under the pointer in the circles marks the rows "${on.rows}" and the parts "${on.parts}"`)
  await page.locator('.in-honey tr[data-t="geraniol"] th').hover(); await page.waitForTimeout(300)
  on = await marks()
  check(on.names === 'geraniol' && on.parts.split(' ').includes('geraniol'), `a row under the pointer marks "${on.names}" in the circles and the parts "${on.parts}"`)
  await page.mouse.move(...await page.evaluate(() => { const r = [...document.querySelectorAll('.venn-part')].find(p => p.dataset.holds.split(' ').sort().join() === 'linalool,terpinolene').getBoundingClientRect(); return [r.left + r.width / 2, r.bottom - r.height * 0.12] })); await page.waitForTimeout(300)
  check(!(await marks()).all, `a part of the circles under the pointer marks ${(await marks()).all} things`)
  await page.locator('.in-honey thead .jar-key').first().hover(); await page.waitForTimeout(300)
  check(!(await marks()).all, `a jar under the pointer marks ${(await marks()).all} things`)
  // a compound's name in the circles is a link in a drawing; a click on it opens the dossier here, as a tile does (it once went to the page)
  await page.locator('.venn a[data-t="myrcene"]').click(); await page.waitForTimeout(700)
  const fromCircles = await at()
  check(fromCircles.open && fromCircles.where === `${index}myrcene`, `a compound clicked in the circles: the dossier is ${fromCircles.open ? 'open' : 'not open'}, the address ${fromCircles.where}`)
  await fresh('') // wherever that click led
  await page.locator('.in-honey tr[data-t="linalool"] a').click(); await page.waitForTimeout(700)
  const fromTable = await at()
  check(fromTable.open && fromTable.where === `${index}linalool`, `a compound clicked in the honey table: the dossier is ${fromTable.open ? 'open' : 'not open'}, the address ${fromTable.where}`)
  await fresh('')
  const tight = () => page.evaluate(() => [...document.querySelectorAll('.in-honey tbody tr')].filter(tr => { const a = tr.querySelector('a'), r = document.createRange(); r.selectNodeContents(a); return r.getBoundingClientRect().right > tr.querySelector('td').getBoundingClientRect().left || !a.querySelector('img').naturalWidth }).map(tr => tr.dataset.t).join(' '))
  check(!await tight(), `the honey table at 1440: ${await tight()} run into the first honey's column, or have no plant`)
  // each jar at the head of a column has its honey's name under it, the three jars on one line; on a small phone there is no room for the names
  const level = () => page.evaluate(() => { const tops = [...document.querySelectorAll('.in-honey .jar-key img')].map(i => i.getBoundingClientRect().top); return Math.max(...tops) - Math.min(...tops) < 1 })
  const heads = () => page.evaluate(() => [...document.querySelectorAll('.in-honey .jar-key')].map(k => { const j = k.querySelector('img').getBoundingClientRect(), r = k.querySelector('.jar-name').getBoundingClientRect(); return !r.width ? 'none' : r.top >= j.bottom - 1 ? 'under' : r.left >= j.right - 1 ? 'beside' : 'over' }).join(' '))
  const cols = () => page.evaluate(() => [...document.querySelectorAll('.in-honey thead th + th')].map(th => Math.round(th.getBoundingClientRect().width)))
  const widths = () => page.evaluate(() => Object.fromEntries(['.in-honey', '.venn', '.blends .lead', '.blends .head'].map(s => [s, Math.round(document.querySelector(s).getBoundingClientRect().width)])))
  // a jar says what its honey is to the pointer that rests on it, or to the finger: its name, its time of day, what it
  // smells of and what customers have described, inside the window (on a narrow screen, at the foot of the window)
  const jarSays = async how => {
    const out = []
    for (const n of [1, 2, 3]) {
      const key = page.locator(`.in-honey thead th:nth-child(${n + 1}) .jar-key`)
      await key.scrollIntoViewIfNeeded(); how === 'focus' ? await key.focus() : await key.hover(); await page.waitForTimeout(300)
      const said = await page.evaluate(k => { const t = document.querySelector(`.in-honey thead th:nth-child(${k + 1}) .tip`), r = t.getBoundingClientRect(); return { seen: +getComputedStyle(t).opacity > 0.9, says: /for the (morning|afternoon|evening)\..*have described/.test(t.textContent), inside: r.left >= 0 && r.right <= document.documentElement.clientWidth && r.top >= 0 && r.bottom <= innerHeight } }, n)
      if (!said.seen || !said.says || !said.inside) out.push(`jar ${n}: ${said.seen ? 'shown' : 'not shown'}, ${said.says ? '' : 'does not say what the honey is, '}${said.inside ? 'inside' : 'outside'} the window`)
    }
    await page.mouse.move(5, 5); await page.evaluate(() => document.activeElement?.blur())
    return out.join('; ')
  }
  check(!await jarSays('hover'), `the honeys at 1440, a jar under the pointer: ${await jarSays('hover')}`)
  const wide = await widths()
  check(await heads() === 'under under under' && await level(), `the honeys at 1440: the jars' names stand "${await heads()}", the jars ${await level() ? '' : 'not '}on one line`)
  check(Math.abs(wide['.in-honey'] - wide['.venn']) < 2 && wide['.in-honey'] > wide['.blends .head'] * 0.45, `the honeys at 1440: the table is ${wide['.in-honey']}px wide and the circles' half ${wide['.venn']}px, of ${wide['.blends .head']}px`)
  check(Math.abs(wide['.blends .lead'] - wide['.blends .head'] * 2 / 3) < 2, `a section's sentence at 1440 may run ${wide['.blends .lead']}px, of ${wide['.blends .head']}px`)
  await fresh('', 900, 900)
  const mid = await widths()
  check(mid['.in-honey'] === mid['.blends .head'] && mid['.blends .lead'] === mid['.blends .head'], `the honeys at 900: the table is ${mid['.in-honey']}px wide and the sentence above it ${mid['.blends .lead']}px, of ${mid['.blends .head']}px`)
  check(!await tight(), `the honey table at 900: ${await tight()} run into the first honey's column, or have no plant`)
  check(!await jarSays('hover'), `the honeys at 900, a jar under the pointer: ${await jarSays('hover')}`)
  const spread = await cols()
  check(await heads() === 'under under under' && await level() && Math.min(...spread) * 3 > mid['.in-honey'] * 0.6, `the honeys at 900: the jars' names stand "${await heads()}", the jars ${await level() ? '' : 'not '}on one line, and the three honeys' columns (${spread.join(', ')}px) leave the table's ${mid['.in-honey']}px mostly to the names`)
  await fresh('', 600, 900)
  check(!await tight(), `the honey table at 600: ${await tight()} run into the first honey's column, or have no plant`)
  check(await heads() === 'under under under' && await level(), `the honeys at 600: the jars' names stand "${await heads()}", the jars ${await level() ? '' : 'not '}on one line`)
  await fresh('', 320, 700)
  const table = await page.evaluate(() => { const t = document.querySelector('.in-honey'), s = getComputedStyle(t.parentElement), cols = [...t.querySelectorAll('thead th + th')].map(th => th.getBoundingClientRect().width); return { over: t.getBoundingClientRect().right - (t.parentElement.getBoundingClientRect().right - parseFloat(s.paddingRight)), cols } })
  check(table.over < 1, `the honey table at 320: it is ${Math.round(table.over)}px wider than the page column`)
  check(await heads() === 'none none none', `the honey table at 320: the jars' names stand "${await heads()}"`)
  check(!await jarSays('focus'), `the honeys at 320, a jar in focus: ${await jarSays('focus')}`)
  check(!await tight(), `the honey table at 320: ${await tight()} run into the first honey's column, or have no plant`)

  // 3d. The boiling points: each compound's plant and name stand clear of the line its dot is on, in a wide
  //     window and on a phone.
  for (const w of [1440, 800, 390]) {
    await fresh('boiling-points/', w, 900)
    const crowd = await page.evaluate(() => [...document.querySelectorAll('.plot .rows li')].filter(li => { const a = li.querySelector('a'), r = document.createRange(), t = li.querySelector('.track').getBoundingClientRect(); r.selectNodeContents(a); const n = r.getBoundingClientRect(); return !a.querySelector('img').naturalWidth || (n.right > t.left && n.bottom > t.top && n.top < t.bottom) }).map(li => li.querySelector('a').textContent).join(', '))
    check(!crowd, `the boiling points at ${w}: ${crowd} run into the line of their dots, or have no plant`)
  }

  // 4. The keys of the layer. In a window too narrow for them to stand outside, the bar at the foot has a
  //    ground of its own (it once showed only the blur of what was behind it) and stays at the foot.
  //    In a wide window the keys stand outside the dossier and keep their place while it scrolls.
  await opened('caryophyllene', 1024, 768)
  const ground = await page.evaluate(() => getComputedStyle(document.querySelector('.viewer-nav')).backgroundColor)
  const alpha = +(ground.match(/\/\s*([\d.]+)\)/)?.[1] ?? (/^rgba?\(\s*0,\s*0,\s*0,\s*0\s*\)$|transparent/.test(ground) ? 0 : 1))
  check(alpha >= 0.85, `the bar at the foot of a dossier has no ground: ${ground}`)
  const foot = await box('.viewer-nav')
  check(Math.abs(foot.y + foot.h - 768) < 2, 'the bar is not at the foot of the window')
  await opened('caryophyllene', 1440, 900)
  const [panel, close0, next0] = [await box('.viewer-panel'), await box('.viewer-close'), await box('.viewer-next')]
  check(close0.x >= panel.x + 1100 && next0.x >= panel.x + 1100, 'wide window: the keys do not stand outside the dossier')
  // 4b. A molecule held under the pointer names its atoms, small, and no name covers another.
  const fig = await box('.viewer .turn .mol')
  await page.waitForTimeout(1500)
  await page.mouse.move(fig.x + 120, fig.y + 120); await page.waitForTimeout(400)
  const names = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('.viewer .mol-name')].map(t => t.getBoundingClientRect())
    return { n: boxes.length, cover: boxes.some((a, i) => boxes.some((b, k) => k > i && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 4)), high: Math.max(...boxes.map(b => b.height)) }
  })
  check(names.n > 10 && !names.cover, `a held molecule: ${names.n} atoms named, ${names.cover ? 'one name over another' : 'none over another'}`)
  check(names.high < 18, `a held molecule: its names are ${Math.round(names.high)}px high`)
  await page.mouse.move(720, 500); await page.mouse.wheel(0, 700); await page.waitForTimeout(400)
  const [close1, next1] = [await box('.viewer-close'), await box('.viewer-next')]
  check(close1.y === close0.y && next1.y === next0.y, 'wide window: the keys moved when the dossier scrolled')

  // 4c. The structure in a name band turns by itself, in an open dossier and on the compound's own page.
  //     Its key lays it flat, which stops it, and lifts it again; the key's arrow keys turn it by hand.
  const stage = async where => {
    const html = () => page.evaluate(() => document.querySelector('.turn .mol').innerHTML), key = page.locator('.turn-key')
    const moves = async () => { const a = await html(); await page.waitForTimeout(400); return a !== await html() }
    const press = async () => { await key.click(); await page.mouse.move(5, 5); await page.waitForTimeout(700) }
    await page.mouse.move(5, 5); await page.waitForTimeout(900)
    check(await moves(), `${where}: the structure does not turn`)
    await press()
    check(!await moves() && await key.textContent() === 'Turn', `${where}: its key did not lay the structure flat`)
    await press()
    check(await moves() && await key.textContent() === 'Lay flat', `${where}: its key did not lift the structure again`)
    await press()
    const flat = await html()
    await key.press('ArrowRight'); await page.waitForTimeout(500)
    check(flat !== await html(), `${where}: an arrow key on its key does not turn the structure`)
  }
  await opened('limonene'); await stage('an open dossier')
  await fresh('limonene/'); await stage("a compound's own page")

  // 4d. A dossier arrives by fading and growing a little. The layer it stands in neither moves nor fades:
  //     it fills the window from the first frame, so its scrollbar stands still (it once grew with the dossier).
  await fresh('')
  await page.evaluate(() => document.querySelector('.cards').scrollIntoView({ behavior: 'instant' }))
  const arriving = await page.evaluate(async () => {
    document.querySelector('#limonene .card').click()
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))
    const viewer = document.querySelector('.viewer'), r = viewer.getBoundingClientRect(), p = viewer.querySelector('.viewer-panel')
    const eased = el => el.getAnimations().map(a => a.transitionProperty).filter(Boolean).sort().join(' ')
    return { layer: eased(viewer), dossier: eased(p), box: [r.left, r.top, r.width, r.height].map(Math.round).join(), window: [0, 0, innerWidth, innerHeight].join(), faint: +getComputedStyle(viewer).opacity < 1, small: p.getBoundingClientRect().width < p.offsetWidth - 1 }
  })
  check(arriving.box === arriving.window && !arriving.faint && !/opacity|transform|scale|translate/.test(arriving.layer), `a dossier arriving: its layer stands at ${arriving.box} in a window of ${arriving.window}${arriving.faint ? ', faint' : ''}, easing "${arriving.layer}"`)
  check(arriving.small && /opacity/.test(arriving.dossier), `a dossier arriving: the dossier itself does not fade and grow into place (easing "${arriving.dossier}")`)

  // 5. A tile under the pointer stays where it is.
  await fresh('')
  await page.evaluate(() => document.querySelector('.cards').scrollIntoView({ behavior: 'instant' }))
  const tile = await box('#alpha-pinene .card')
  await page.mouse.move(tile.x + 100, tile.y + 150); await page.waitForTimeout(500)
  check((await box('#alpha-pinene .card')).y === tile.y, 'a tile moved under the pointer')

  // 5b. The index goes from the honeys to the compounds to their chemistry, and ends on the questions; an
  //     answer there runs to four lines at most where there are two columns of them.
  await fresh('')
  const order = await page.evaluate(() => ({ heads: [...document.querySelectorAll('main > section > h2, main > section > .head > h2')].map(h => h.textContent).join(' | '), long: [...document.querySelectorAll('#faq dd')].map(dd => { const r = document.createRange(); r.selectNodeContents(dd); return [dd.previousElementSibling.textContent, new Set([...r.getClientRects()].filter(q => q.height > 14).map(q => Math.round(q.top / 6))).size] }).filter(([, n]) => n > 4).map(([q, n]) => `${q} (${n} lines)`).join(', ') }))
  check(order.heads.startsWith('What is in each honey | The eleven | What a terpene is | Same atoms, six smells | Common questions'), `the index runs: ${order.heads}`)
  check(!order.long, `common questions: too long an answer to ${order.long}`)

  // 6. In running text a name that begins with a Greek letter keeps its letter and what follows the hyphen
  //    on one line (α- once ended a line and phellandrene began the next), in the notes on the honeys, in
  //    a dossier's text and in the titles of the sources.
  for (const [url, w] of [['', 1440], ['', 390], ['', 320], ['beta-pinene/', 1440], ['beta-pinene/', 390]]) {
    await fresh(url, w)
    const split = await page.evaluate(() => {
      const out = [], walk = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT)
      for (let n; (n = walk.nextNode());) for (const m of n.data.matchAll(/[α-ω]-\u2060?[a-z]{3}/gi)) {
        const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length)
        if (n.parentElement.checkVisibility() && new Set([...r.getClientRects()].map(q => Math.round(q.top))).size > 1) out.push(n.data.slice(Math.max(0, m.index - 10), m.index + 14))
      }
      return out
    })
    check(!split.length, `${url || 'the index'} at ${w}: a name is broken after its Greek letter in "${split.join('", "')}"`)
  }

  return failures
}
