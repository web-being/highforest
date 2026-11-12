#!/usr/bin/env node
// Builds the terpene atlas into ../botanical-terpenes/ from data.mjs and the PubChem structure
// records in mol/: the index, a page per compound, the boiling-point page and the evidence page.
// usage: node atlas/build.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { terpenes, blends, families, rungs, books, plateSize, grades, doses, spoon, strengths, refs, revised } from './data.mjs'

const here = p => new URL(p, import.meta.url)
const e = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
const f = n => +n.toFixed(1)
const sub = s => e(s).replace(/(\d+)/g, '<sub>$1</sub>')
const cite = ns => ns.length ? `<sup class="cite">${ns.map(n => `<a href="#ref-${n}">${n}</a>`).join(' ')}</sup>` : ''
const plain = t => t.plain || t.name
// a Greek locant stays lower case when a style sets names in capitals
const nm = t => e(t.name).replace(/^[α-ω]/, '<span class="gr">$&</span>')

// ── structures ─────────────────────────────────────────────────────────────
// MDL molfile (V2000) → skeletal formula. Hydrogens are dropped unless they sit on a wedge or hash bond.
const sdf = id => {
  const L = readFileSync(here(`mol/${id}.sdf`), 'utf8').split('\n')
  const na = +L[3].slice(0, 3), nb = +L[3].slice(3, 6)
  return {
    atoms: L.slice(4, 4 + na).map(l => ({ x: +l.slice(0, 10), y: -l.slice(10, 20), el: l.slice(31, 34).trim() })),
    bonds: L.slice(4 + na, 4 + na + nb).map(l => ({ a: +l.slice(0, 3) - 1, b: +l.slice(3, 6) - 1, order: +l.slice(6, 9), stereo: +l.slice(9, 12) })),
  }
}

const mol = (id, { s = 24, pad = 16, groups, label } = {}) => {
  const { atoms, bonds } = sdf(id)
  const keep = atoms.map((a, i) => a.el !== 'H' || bonds.some(b => b.stereo && (b.a === i || b.b === i)))
  const kb = bonds.filter(b => keep[b.a] && keep[b.b])
  const kept = atoms.filter((_, i) => keep[i])
  const x0 = Math.min(...kept.map(a => a.x)), y0 = Math.min(...kept.map(a => a.y))
  const W = (Math.max(...kept.map(a => a.x)) - x0) * s + pad * 2, H = (Math.max(...kept.map(a => a.y)) - y0) * s + pad * 2
  const P = atoms.map(a => [(a.x - x0) * s + pad, (a.y - y0) * s + pad])
  const heavy = i => kb.filter(b => b.a === i || b.b === i).map(b => b.a === i ? b.b : b.a).filter(j => atoms[j].el !== 'H')
  const hasH = i => bonds.some(b => (b.a === i && atoms[b.b].el === 'H') || (b.b === i && atoms[b.a].el === 'H'))
  const lab = atoms.map((a, i) => !keep[i] || a.el === 'C' ? '' : a.el === 'O' && hasH(i) ? 'OH' : a.el)
  const trim = i => lab[i] ? (lab[i] === 'H' ? 6.5 : 8.5) : 0
  const unit = b => !groups ? '' : (k => k >= 0 ? `u${k}` : 'uj')(groups.findIndex(g => g.includes(b.a + 1) && g.includes(b.b + 1)))

  const lines = {}, fills = {}
  const put = (o, k, v) => (o[k] ||= []).push(v)
  for (const b of kb) {
    let [x1, y1] = P[b.a], [x2, y2] = P[b.b]
    const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len, nx = -uy, ny = ux
    x1 += ux * trim(b.a); y1 += uy * trim(b.a); x2 -= ux * trim(b.b); y2 -= uy * trim(b.b)
    const k = unit(b), seg = (ax, ay, bx, by) => put(lines, k, `M${f(ax)} ${f(ay)}L${f(bx)} ${f(by)}`)
    if (b.stereo === 1) put(fills, k, `M${f(x1)} ${f(y1)}L${f(x2 + nx * 2.6)} ${f(y2 + ny * 2.6)}L${f(x2 - nx * 2.6)} ${f(y2 - ny * 2.6)}Z`)
    else if (b.stereo === 6) for (let i = 1; i <= 6; i++) { const t = i / 6, w = 0.5 + 2.3 * t, cx = x1 + (x2 - x1) * t, cy = y1 + (y2 - y1) * t; seg(cx + nx * w, cy + ny * w, cx - nx * w, cy - ny * w) }
    else if (b.order === 2 && (heavy(b.a).length === 1 || heavy(b.b).length === 1)) { seg(x1 + nx * 2.2, y1 + ny * 2.2, x2 + nx * 2.2, y2 + ny * 2.2); seg(x1 - nx * 2.2, y1 - ny * 2.2, x2 - nx * 2.2, y2 - ny * 2.2) }
    else if (b.order === 2) {
      const o = [...heavy(b.a).filter(j => j !== b.b), ...heavy(b.b).filter(j => j !== b.a)].map(j => P[j])
      const side = Math.sign(o.reduce((t, p) => t + (p[0] - x1) * nx + (p[1] - y1) * ny, 0)) || 1, d = 4.2 * side
      seg(x1, y1, x2, y2); seg(x1 + nx * d + ux * 3, y1 + ny * d + uy * 3, x2 + nx * d - ux * 3, y2 + ny * d - uy * 3)
    } else seg(x1, y1, x2, y2)
  }
  const text = lab.map((t, i) => {
    if (!t) return ''
    const [x, y] = P[i], n = heavy(i)[0], right = t === 'OH' && n != null && P[n][0] > x + 2
    return t === 'OH'
      ? `<text x="${f(x + (right ? 5 : -5))}" y="${f(y + 4.6)}"${right ? ' text-anchor="end"' : ''}>${right ? 'HO' : 'OH'}</text>`
      : `<text x="${f(x)}" y="${f(y + 4.6)}" text-anchor="middle">${t}</text>`
  }).join('')
  const paths = Object.keys({ ...lines, ...fills }).map(k =>
    (lines[k] ? `<path${k ? ` class="${k}"` : ''} d="${lines[k].join('')}"/>` : '') +
    (fills[k] ? `<path class="mol-w${k ? ' ' + k : ''}" d="${fills[k].join('')}"/>` : '')).join('')
  return `<svg class="mol" viewBox="0 0 ${f(W)} ${f(H)}" width="${f(W)}" height="${f(H)}"${label ? ` role="img" aria-label="${e(label)}"` : ' aria-hidden="true"'}>${paths}${text}</svg>`
}

// ── small parts ────────────────────────────────────────────────────────────
const rungOf = t => rungs[t.level - 1]
const pips = t => `<span class="pips" role="img" aria-label="Evidence: ${e(rungOf(t).name.toLowerCase())}${t.related ? '; trials of a related preparation' : ''}">${rungs.map((r, i) => `<i${i < t.level ? ' class="on"' : t.related && i === 3 ? ' class="half"' : ''}></i>`).join('')}</span>`
const dots = t => `<span class="dots">${Object.keys(blends).map(b => t.blends.includes(b) ? `<i class="b-${b}" title="${e(blends[b].name)}"></i>` : '<i></i>').join('')}<span class="sr">In ${t.blends.map(b => blends[b].name).join(', ')}</span></span>`
const attrs = t => `data-family="${t.family}" data-blends="${t.blends.join(' ')}"`
const count = k => terpenes.filter(k).length
const inBlend = b => terpenes.filter(t => t.blends.includes(b))

// the name band of a compound: on the index it heads the dossier, on the compound's own page it is the page head
const nameBand = (t, H) => `
        <header class="dossier-head" data-ground="wood">
          <div>
            <${H}>${nm(t)}</${H}>
            <p class="formula">${sub(t.formula)} <span>${e(families[t.family])}</span></p>
          </div>
          ${mol(t.id, { s: 27, label: `Skeletal structure of ${plain(t)}` })}
        </header>`

// own: the dossier is the compound's own page; otherwise it sits in the index under its tile
const dossier = (t, root, own) => {
  const [w, h] = plateSize[t.id], p = t.plate
  return `
    <article class="dossier">
      <figure class="plate">
        <img src="${root}plates/${t.id}.webp" width="${w}" height="${h}"${own ? '' : ' loading="lazy"'} decoding="async" alt="Botanical plate of ${e(p.common)}, ${e(p.species)}.">
        <figcaption><i>${e(p.species)}</i>, ${e(p.common)}. Printed as “${e(p.printed)}”. ${e(books[p.book])}.</figcaption>
      </figure>
      <div class="dossier-body">${own ? '' : nameBand(t, 'h3')}
        <p class="shape">${t.named ? e(t.named) + ' ' : ''}${e(t.shape)}</p>
        <dl class="sheet">
          <div><dt>Scent</dt><dd>${t.scent.map(e).join(', ')}${t.odour ? ` <span class="src">Reference description: “${e(t.odour[0])}” (${e(t.odour[1])})</span>` : ''}</dd></div>
          <div><dt>Found in</dt><dd>${t.plants.map(e).join(', ')}.</dd></div>
          <div><dt>In High Forest</dt><dd>${t.blends.map(b => `<span class="blend"><i class="b-${b}"></i>${e(blends[b].name)}</span>`).join(' ')} <span class="src">as a flavouring ingredient; amount not published</span></dd></div>
        </dl>
        <dl class="facts">
          <div><dt>Molar mass</dt><dd>${t.mw} g/mol</dd></div>
          <div><dt>Boiling point</dt><dd>${e(t.bp[1])} <span class="src">${e(t.bp[2])}</span></dd></div>
          <div><dt>CAS number</dt><dd>${e(t.cas)}</dd></div>
          <div><dt>FEMA number</dt><dd>${t.fema ? e(t.fema) : '<span class="src">none listed in PubChem</span>'}</dd></div>
          <div><dt>Record</dt><dd><a href="https://pubchem.ncbi.nlm.nih.gov/compound/${t.cid}">PubChem ${t.cid}</a></dd></div>
          <div class="wide"><dt>Systematic name</dt><dd>${e(t.iupac)}${t.form ? ` <span class="src">${e(t.form)}</span>` : ''}</dd></div>
        </dl>${own ? `
        <aside class="first">
          <h2>Read this first</h2>
          <p>In High Forest honeys ${e(t.name.toLowerCase())} is a flavouring. High Forest has not published how much a jar contains, and nobody has tested the honeys themselves. <a href="${root}do-terpenes-do-anything/">How to read the research</a></p>
        </aside>` : ''}
        <section class="studied">
          <${own ? 'h2' : 'h4'}>What has been studied ${pips(t)} <span class="src">highest rung: ${e(rungOf(t).name.toLowerCase())}</span></${own ? 'h2' : 'h4'}>
          <ul>${t.studied.map(([g, text, r]) => `
            <li><span class="grade g-${g}">${e(grades[g])}</span><span>${e(text)}${cite(r)}</span></li>`).join('')}
            <li class="unknown"><span class="grade">Not known</span><span>${e(t.unknown)}</span></li>
          </ul>${own ? '' : `
          <p class="own"><a href="${root}${t.id}/">${e(t.name)} on its own page</a></p>`}
        </section>
      </div>
    </article>`
}

// one compound in the index: a tile that opens into its dossier; the shared name lets one be open at a time
const entry = t => `
      <li class="entry" id="${t.id}" ${attrs(t)} style="--vt: e-${t.id}"><details name="compound">
        <summary class="card">
          ${mol(t.id, { s: 20, pad: 14 })}
          <span class="card-name">${nm(t)}</span>
          <span class="card-meta"><span>${sub(t.formula)}</span><span>${e(families[t.family].toLowerCase())}</span></span>
          <span class="card-scent">${t.scent.slice(0, 3).map(w => `<span>${e(w)}</span>`).join('')}</span>
          <span class="card-foot">${dots(t)}${pips(t)}</span>
          <span class="card-close">Close <span aria-hidden="true">×</span></span>
        </summary>${dossier(t, './')}
      </details></li>`

// Cleveland dot plot rows: a label and a dot on a shared axis
const byBp = terpenes.filter(t => t.bp[0]).sort((a, b) => a.bp[0] - b.bp[0])
const BP = [150, 260], bpPos = v => (v - BP[0]) / (BP[1] - BP[0])
const LOG = [-1, 5], logPos = mg => (Math.log10(mg) - LOG[0]) / (LOG[1] - LOG[0])
const mgText = mg => mg >= 1000 ? `${+(mg / 1000).toPrecision(2)} g` : `${+mg.toPrecision(2)} mg`
const spoonMg = pct => spoon * 1000 * pct / 100
const ticks = (list, pos, fmt) => `<span class="axis" aria-hidden="true">${list.map(v => `<i style="--p:${f(pos(v) * 100)}%">${fmt(v)}</i>`).join('')}</span>`
// a boiling point as PubChem prints it → its numbers in °C and °F, and the pressure when it is not atmospheric
const bpRange = t => t.bp[1].split(' °C')[0].split('–').map(Number)
const bpAt = t => t.bp[1].split(' at ')[1]
// a word joiner after the dash keeps a range on one line
const span = (r, at) => r.join('–\u2060') + (at ? ` at ${at}` : '')
const toF = c => Math.round(c * 9 / 5 + 32)

// ── the frame every page shares ────────────────────────────────────────────
const site = 'https://highforest.ca/botanical-terpenes'
// the shop and the guide are pages of the live site: full addresses, so they also work from a staging host
const live = 'https://highforest.ca'
const atlas = [['', 'The eleven'], ['boiling-points/', 'Boiling points'], ['do-terpenes-do-anything/', 'Do terpenes do anything?']]
const nav = (root, here) => `
<nav class="sections" aria-label="Atlas">${atlas.map(([dir, label]) => `
  <a href="${root}${dir}"${dir === here ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
</nav>`

// the sources a page cites, under the numbers they have everywhere
const sources = body => {
  const cited = new Set([...body.matchAll(/href="#ref-(\d+)"/g)].map(m => +m[1]))
  return !cited.size ? '' : `
<section class="sources" id="sources">
  <h2>Sources</h2>
  <ol>${refs.filter(r => cited.has(r[0])).map(([n, who, title, where, url]) => `
    <li id="ref-${n}" value="${n}">${who ? e(who).replace(/\.$/, '') + '. ' : ''}<a href="${e(url)}">${e(title)}</a>.${where ? ' ' + e(where) + '.' : ''}</li>`).join('')}
  </ol>
</section>`
}

// dir: the page's folder inside the atlas, '' for the index. body: root => html, root being the way back to the index.
const page = ({ dir = '', title, desc, body, scripts = [], head = '', tail = '', attr = '' }) => {
  const root = dir ? '../' : './', main = body(root)
  mkdirSync(here(`../botanical-terpenes/${dir}`), { recursive: true })
  writeFileSync(here(`../botanical-terpenes/${dir}index.html`), `<!doctype html>
<html lang="en"${attr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)} | High Forest</title>
<meta name="description" content="${e(desc)}">
<link rel="canonical" href="${site}${dir && '/' + dir.slice(0, -1)}">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(desc)}">
<meta property="og:type" content="article">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,400;0,500;1,400&family=Barlow+Condensed:wght@500;600;700&display=swap">
<link rel="stylesheet" href="${root}../tokens.css">
<link rel="stylesheet" href="${root}atlas.css">${head}${scripts.map(src => `
<script type="module" src="${root}${src}"></script>`).join('')}
</head>
<body>
<a class="skip" href="#content">Skip to content</a>

<header class="mast" data-ground="wood">
  <a class="wordmark" href="${root}../prototypes/home.html"><b>High</b>Forest</a>
  <nav aria-label="Site">
    <a href="${live}/shop-wellness-honey">Shop</a>
    <a href="${live}/unpasteurized-honey">The honey</a>
    <a href="${live}/highforest-product-guide">Make a cup</a>
  </nav>
</header>

<main id="content">${main}
${sources(main)}
</main>

<footer class="colophon" data-ground="wood">
  <p><b>How this atlas was made.</b> Structures are drawn from PubChem two-dimensional records (US National Library of Medicine). Identity data come from PubChem; the contributing source is named beside each boiling point and reference scent description. Scent words and plant lists are High Forest’s own. The plates are from ${e(books.kohler)}, and ${e(books.thome)}; both are in the public domain and were taken from Wikimedia Commons and cut out of their paper.</p>
  <p><b>What this atlas is not.</b> It is not medical advice and makes no claim about the effects of High Forest products. If you find an error, write to <a href="mailto:info@highforest.world">info@highforest.world</a>.</p>
  <p><b>The honeys.</b> ${Object.values(blends).map(b => `<a href="${live}${b.url}">${e(b.name)}</a>`).join(', ')}.</p>
  <p class="src">Last revised ${e(revised)}.</p>
</footer>${tail}
</body>
</html>
`)
  return main.length
}

// ── the index ──────────────────────────────────────────────────────────────
// ways of opening a dossier under comparison (prototype stage), switched by ?v= and the picker
const ways = ['Inline', 'Modal', 'Sheet']
const filter = (id, label, n) => `<button type="button" data-show="${id}" aria-pressed="${id === 'all'}">${label} <span>${n}</span></button>`
const isomers = terpenes.filter(t => t.formula === 'C10H16')

const index = root => `
<section class="hero">
  <div class="hero-text" data-ground="wood">
    <h1>An atlas of <em>botanical terpenes</em></h1>
    <p class="lead">Terpenes are the molecules that make a lemon smell of lemon and a pine wood of pine. This atlas describes the eleven used in High Forest honeys: what each one is, where it grows, how it smells, and what research has and has not shown.</p>
  </div>
  <aside class="first" data-ground="wood">
    <h2>Read this first</h2>
    <p>In these honeys terpenes are flavourings. High Forest has not published how much a jar contains, and nobody has tested the honeys themselves. Most of the research cited here was done in animals. In the human studies, doses ran from milligrams inhaled to grams swallowed. This atlas describes the ingredients and makes no statement about what a jar of honey does. <a href="${root}do-terpenes-do-anything/">How to read the research</a></p>
  </aside>
  <p class="credit">Stand-in photograph. To be replaced by one taken in Quebec.</p>
</section>
${nav(root, '')}

<section class="what" id="what">
  <div class="prose">
    <h2>What a terpene is</h2>
    <p>Plants build terpenes from five-carbon pieces called isoprene units. Two units make a monoterpene: ten carbons, light enough to leave a leaf at the touch of a finger. Three units make a sesquiterpene: fifteen carbons, heavier and slower to evaporate. Add an oxygen atom and chemists call the result a terpenoid. Outside chemistry all of them are called terpenes, and this atlas follows that habit.${cite([1])}</p>
    <p>Plants make them to repel what eats the leaf and to attract what pollinates the flower, and they are part of how a plant responds to heat and injury.${cite([2])} The smell of a forest is largely terpenes in the air.</p>
  </div>
  <figure class="units">
    <div class="units-row">
      <div>${mol('isoprene', { s: 26, label: 'Skeletal structure of isoprene' })}<span>Isoprene, C<sub>5</sub>H<sub>8</sub></span></div>
      <b aria-hidden="true">× 2</b>
      <div>${mol('myrcene', { s: 26, groups: [[4, 6, 7, 3, 1], [2, 5, 9, 8, 10]], label: 'Myrcene drawn as two isoprene units joined by one bond' })}<span>Myrcene, C<sub>10</sub>H<sub>16</sub></span></div>
    </div>
    <figcaption>Myrcene is two isoprene units joined head to tail. One unit is highlighted.</figcaption>
  </figure>
  <figure class="isomers">
    <ul>${isomers.map(t => `<li><a href="#${t.id}">${mol(t.id, { s: 19, pad: 12 })}<span>${e(t.name)}</span></a></li>`).join('')}</ul>
    <figcaption><b>Same atoms, six smells.</b> Six of the eleven share one formula, C<sub>10</sub>H<sub>16</sub>: ten carbons and sixteen hydrogens joined six different ways. They smell different because they are shaped differently.</figcaption>
  </figure>
</section>

<section class="eleven" id="eleven">
  <div class="eleven-head">
    <h2>The eleven</h2>
    <div class="filters" role="group" aria-label="Show">
      ${filter('all', 'All', terpenes.length)}
      ${Object.entries(families).map(([k, v]) => filter(k, v + 's', count(t => t.family === k))).join('\n      ')}
      <span class="sep" aria-hidden="true"></span>
      ${Object.entries(blends).map(([k, v]) => filter(k, `<i class="b-${k}"></i>In ${e(v.name)}`, inBlend(k).length)).join('\n      ')}
    </div>
    <p class="key"><span class="key-item">${Object.keys(blends).map(b => `<i class="b-${b}"></i>`).join('')} blends that contain it: ${Object.values(blends).map(b => b.name).join(', ')}</span> <span class="key-item"><span class="pips"><i class="on"></i><i class="on"></i><i></i><i></i></span> how far the research has reached: cells, animals, people, trials</span></p>
    <p class="sr" aria-live="polite" id="shown"></p>
  </div>
  <ul class="cards">${terpenes.map(entry).join('')}
  </ul>
</section>

<section class="blends" id="blends">
  <div class="prose">
    <h2>What is in each honey</h2>
    <p>High Forest has not published the amounts.</p>
  </div>
  <ul class="blend-list">${Object.entries(blends).map(([k, b]) => `
    <li>
      <h3><i class="b-${k}"></i>${e(b.name)}</h3>
      <p class="label">${e(b.honey)}, ${inBlend(k).length} of the eleven</p>
      <ul>${inBlend(k).map(t => `
        <li><a href="#${t.id}">${e(t.name)}</a> <span>${t.scent.slice(0, 2).map(e).join(', ')}</span> <span class="src">found in ${e(t.plants[0])}</span></li>`).join('')}
      </ul>
      <p><a href="${live}${b.url}">${e(b.name)} in the shop</a></p>
    </li>`).join('')}
  </ul>
</section>

<section class="next">
  <a href="${root}boiling-points/">
    <h2>Boiling points</h2>
    <p>All eleven, each with the source that reported it, as a chart, a table and a CSV file.</p>
  </a>
  <a href="${root}do-terpenes-do-anything/">
    <h2>Do terpenes do anything?</h2>
    <p>How far the research has reached for each compound, what doses the human studies gave, and four mistakes about terpenes.</p>
  </a>
</section>`

// ── a compound's own page ──────────────────────────────────────────────────
const compound = (t, i) => root => {
  const to = d => terpenes[(i + d + terpenes.length) % terpenes.length]
  return `
<section class="band" data-ground="wood">${nameBand(t, 'h1')}
</section>
${nav(root)}

<section class="compound">${dossier(t, root, true)}
  <nav class="pager" aria-label="Compounds">
    <a rel="prev" href="${root}${to(-1).id}/"><span aria-hidden="true">‹</span> <span>${nm(to(-1))}</span></a>
    <a rel="next" href="${root}${to(1).id}/"><span>${nm(to(1))}</span> <span aria-hidden="true">›</span></a>
  </nav>
</section>`
}

// ── boiling points ─────────────────────────────────────────────────────────
const boiling = root => `
<section class="band" data-ground="wood">
  <h1>Terpene boiling points</h1>
  <p class="lead">Boiling points of eleven plant terpenes, each with the source that reported it. Ten are at atmospheric pressure; humulene is listed only at reduced pressure.</p>
</section>
${nav(root, 'boiling-points/')}

<section class="cup" id="chart">
  <div class="prose">
    <h2>In the cup</h2>
    <p>None of these molecules boils in a cup of warm water; they evaporate from it. Boiling point is a rough guide to how readily: the lower it is, the more easily a compound evaporates. How fast each one leaves a cup also depends on how well it dissolves, and that has not been measured for these honeys.</p>
    <p>High Forest <a href="${live}/highforest-product-guide">suggests</a> water at about 50&nbsp;°C, not boiling. Hotter water drives aroma off faster, so more of it is gone before you drink.</p>
  </div>
  <figure class="plot">
    <figcaption>Boiling point at atmospheric pressure. Lower means more volatile. <span class="legend">${Object.entries(families).map(([k, v]) => `<span><i class="f-${k}"></i>${e(v.toLowerCase())}</span>`).join('')}</span></figcaption>
    ${ticks([160, 180, 200, 220, 240, 260], bpPos, v => v + ' °C')}
    <ol class="rows">${byBp.map(t => `
        <li style="--p:${f(bpPos(t.bp[0]) * 100)}%"><a href="${root}${t.id}/">${e(t.name)}</a><span class="track"><i class="f-${t.family}"></i></span><span class="val">${t.bp[0]} °C</span></li>`).join('')}
    </ol>
    <p class="src">Where a source gives a range, the dot marks its middle. Humulene is not plotted: see “Check the pressure” below.</p>
  </figure>
</section>

<section class="figures" id="table">
  <div class="prose">
    <h2>The figures</h2>
    <p>The same data as a file: <a href="terpene-boiling-points.csv" download>terpene-boiling-points.csv</a></p>
  </div>
  <div class="table">
    <table>
      <thead><tr><th scope="col">Compound</th><th scope="col">°C</th><th scope="col">°F</th><th scope="col">Source</th></tr></thead>
      <tbody>${[...byBp, ...terpenes.filter(t => !t.bp[0])].map(t => `
        <tr><th scope="row"><a href="${root}${t.id}/">${e(t.name)}</a></th><td>${span(bpRange(t), bpAt(t))}</td><td>${span(bpRange(t).map(toF), bpAt(t))}</td><td>${e(t.bp[2])}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>
  <p class="src">Values as PubChem listed them on 10 November 2026, with the source that contributed each; °F converted from °C. JECFA is the Joint FAO/WHO Expert Committee on Food Additives, HSDB the Hazardous Substances Data Bank, HMDB the Human Metabolome Database. Each compound’s page links to its PubChem record.</p>
</section>

<section id="pressure">
  <div class="prose">
    <h2>Check the pressure</h2>
    <p>A liquid boils at a lower temperature under reduced pressure, and some reference values are measured that way. A boiling point quoted without its pressure can be far off.</p>
    <p><a href="https://pubchem.ncbi.nlm.nih.gov/compound/5281515#section=Boiling-Point">PubChem</a> carries two figures for β-caryophyllene: 256 °C at atmospheric pressure, from JECFA, and 264 to 266 °F, about 130 °C, at 14 mm Hg, from CAMEO Chemicals. Read as an atmospheric value, the second would make one of the two heaviest compounds here the most volatile of all. If a chart gives caryophyllene a boiling point near 130 °C, this is its likely origin: the two match to the degree.</p>
    <p>Humulene is missing from the chart for the same reason. PubChem lists its boiling point only at 3 mm Hg.</p>
  </div>
</section>`

const csv = [['compound', 'cas', 'formula', 'family', 'boiling_point_c_low', 'boiling_point_c_high', 'pressure', 'reported_by', 'pubchem_cid'],
  ...terpenes.map(t => [plain(t), t.cas, t.formula, families[t.family].toLowerCase(), bpRange(t)[0], bpRange(t).at(-1), bpAt(t) || 'atmospheric', t.bp[2], t.cid])]
  .map(row => row.map(v => /[",]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v).join(',')).join('\n') + '\n'

// ── the evidence ───────────────────────────────────────────────────────────
// the answer below is written by hand: stop the build if the data no longer says what it says
const reached = l => terpenes.filter(t => t.level === l).map(t => t.id).join()
if (reached(1) || reached(3) !== 'limonene' || reached(4)) throw new Error('data.mjs levels changed: rewrite the answer on the evidence page')

const evidence = root => `
<section class="band" data-ground="wood">
  <h1>Do terpenes do anything?</h1>
  <p class="lead">They give plants and food their smell. Whether they do more in a person is mostly untested. Ten of the eleven terpenes here have been studied only in cells and animals, limonene has been measured in people, and none has been through a randomized trial as a treatment.</p>
</section>
${nav(root, 'do-terpenes-do-anything/')}

<section class="evidence" id="evidence">
  <div class="prose">
    <h2>Reading the research</h2>
    <p>Most research on terpenes stops at cells and animals. Each entry in the atlas marks how far it has reached for that compound, on four rungs.</p>
  </div>
  <ol class="rungs">${rungs.map((r, i) => `
    <li><span class="pips">${rungs.map((_, j) => `<i${j <= i ? ' class="on"' : ''}></i>`).join('')}</span><b>${e(r.name)}</b><span>${e(r.note)}</span><em>${terpenes.filter(t => t.level === i + 1).map(t => `<a href="${root}${t.id}/">${e(t.name)}</a>`).join(', ') || (i === 3 ? 'None. Lavender oil, which contains linalool, has trials of its own.' : 'All eleven have passed this rung.')}</em></li>`).join('')}
  </ol>
  <div class="prose">
    <h3 id="dose">How much is a study dose?</h3>
    <p>A heaping teaspoon of honey weighs about ${spoon} g. Choose how much of it is terpenes, and compare the result with the doses given to people in the studies cited here. The scale is logarithmic: each step to the right is ten times more.</p>
  </div>
  <figure class="plot dose">
    <div class="strength" role="group" aria-label="Terpene content of the honey" data-grams="${spoon}" data-lo="${LOG[0]}" data-hi="${LOG[1]}">
      <span class="label">If the honey is</span>
      ${strengths.map(s => `<button type="button" data-pct="${s.pct}" aria-pressed="${s.pct === 0.1}">${s.label}</button>`).join('')}
      <span class="label">terpenes</span>
    </div>
    ${ticks([1, 10, 100, 1000, 10000], logPos, mgText)}
    <ol class="rows">
        <li class="spoon" style="--p:${f(logPos(spoonMg(0.1)) * 100)}%"><span>One teaspoon of honey, all terpenes together</span><span class="track"><i></i></span><span class="val" id="spoon-val">${mgText(spoonMg(0.1))}</span></li>${doses.map(d => `
        <li style="--p:${f(logPos(d.mg) * 100)}%"><span>${e(d.label)}${cite([d.ref])}</span><span class="track"><i></i></span><span class="val">${mgText(d.mg)}</span></li>`).join('')}
    </ol>
    <p class="todo">High Forest has not yet published the terpene content of its blends. When it does, that figure replaces the three assumptions above.</p>
  </figure>
  <div class="prose">
    <h3>By the nose, more likely than by the mouth</h3>
    <p>If scented honey changes how someone feels, smell is the plausible route. In mice, linalool’s calming effect vanished when the sense of smell was removed.${cite([13])} In people the measured effects are small. A controlled trial of aromas found that lemon scent lifted reported mood and left stress hormones, heart rate and blood pressure unchanged.${cite([22])} A meta-analysis of lavender found signs that inhaling it eases anxiety, in studies too mixed in quality to settle the question.${cite([23])} Nobody can be blinded to a smell, so expectation is hard to rule out. Scented honey itself has not been tested.</p>
  </div>
</section>

<section class="mistakes" id="mistakes">
  <h2>Four mistakes</h2>
  <dl>
    <div><dt>“Terpenes are a cannabis thing.”</dt><dd>Cannabis is one of many plants that make them. Lemon peel, lavender, pine needles, hops, black pepper and rose petals are full of them, and people have always eaten and breathed them.${cite([1, 2])}</dd></div>
    <div><dt>“Each terpene has its effect: one for energy, one for sleep.”</dt><dd>That idea comes from studies of single compounds given to rodents at high doses. In the one controlled human test cited here, inhaled limonene on its own could not be told from placebo.${cite([11])} For myrcene, the “sleep terpene”, no human study exists.${cite([15])}</dd></div>
    <div><dt>“If it worked in a study, it works in the cup.”</dt><dd>Most findings come from animals given large doses, or from people who swallowed between 80 milligrams and several grams a day. How a flavouring amount compares depends on how much terpene the honey holds, and High Forest has not published that. See <a href="#dose">the scale above</a>.</dd></div>
    <div><dt>“Natural means harmless at any dose.”</dt><dd>Myrcene, natural in hops and mango, caused tumours in male rats and mice given very large amounts for two years.${cite([20])} The amounts used to flavour food are far smaller, and the US Food and Drug Administration judged them no risk to public health.${cite([21])} Honey itself is not for infants under one year.${cite([24])}</dd></div>
  </dl>
</section>`

// ── write ──────────────────────────────────────────────────────────────────
const kB = n => (n / 1024).toFixed(1)
const made = [
  ['index', page({
    title: 'An atlas of botanical terpenes',
    desc: 'The eleven plant aroma compounds used in High Forest honeys: structure, scent, where each grows, and what research has and has not shown, with its sources.',
    body: index, scripts: ['atlas.js', 'proto.js'], attr: ' data-dossier="modal"',
    head: `
<link rel="stylesheet" href="../prototypes/picker.css">
<script>
// prototype: the way of opening a dossier, from ?v=, before first paint
(d => { const w = ${JSON.stringify(ways.map(w => w.toLowerCase()))}[parseInt(new URLSearchParams(location.search).get('v'), 10) - 1]; if (w) d.dossier = w })(document.documentElement.dataset)
</script>`,
    tail: `

<dialog class="viewer">
  <div class="viewer-panel">
    <div class="viewer-bar">
      <div><button type="button" class="viewer-prev"></button><button type="button" class="viewer-next"></button></div>
      <button type="button" class="viewer-close">Close <span aria-hidden="true">×</span></button>
    </div>
    <div class="viewer-body"></div>
  </div>
</dialog>

<nav class="proto-picker" aria-label="Prototype variants">
  <span class="proto-picker-highlight" aria-hidden="true"></span>
  ${ways.map(w => `<button class="proto-picker-item">${w}</button>`).join('\n  ')}
</nav>`,
  })],
  ...terpenes.map((t, i) => [t.id, page({
    dir: `${t.id}/`,
    title: `${t.name}${t.plain ? ` (${t.plain.toLowerCase()})` : ''}: scent, plants and research`,
    desc: `${t.name}, ${t.formula}, is a ${families[t.family].toLowerCase()}. Scent: ${t.scent.join(', ')}. Found in ${t.plants.slice(0, 3).join(', ')}. Research on it has reached ${rungOf(t).reach}.`,
    body: compound(t, i),
  })]),
  ['boiling-points', page({
    dir: 'boiling-points/',
    title: 'Terpene boiling points, with sources',
    desc: 'Boiling points of eleven plant terpenes, each with the source that reported it, as a chart, a table and a CSV file.',
    body: boiling,
  })],
  ['do-terpenes-do-anything', page({
    dir: 'do-terpenes-do-anything/',
    title: 'Do terpenes do anything? The research on eleven of them',
    desc: 'Terpenes give plants and food their smell. For the eleven described here, research on other effects mostly stops at cells and animals. How to read it, what doses were given, and four mistakes.',
    body: evidence, scripts: ['dose.js'],
  })],
]
writeFileSync(here('../botanical-terpenes/boiling-points/terpene-boiling-points.csv'), csv)
console.log(`botanical-terpenes/  ${made.length} pages  ${made.map(([name, n]) => `${name} ${kB(n)}`).join('  ')} kB  ${terpenes.length} compounds  ${refs.length} sources`)
