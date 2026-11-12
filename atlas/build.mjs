#!/usr/bin/env node
// Builds the terpene atlas into ../botanical-terpenes/ from data.mjs, the PubChem structure records in
// mol/ (as drawn) and mol3d/ (in space) and the icons in icons/: the index, a page per compound, the
// boiling-point page and the evidence page. The plate images it places are made by tools/plates.mjs.
// usage: node atlas/build.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { terpenes, blends, families, rungs, books, grades, doses, spoon, strengths, refs, revised } from './data.mjs'
import { draw, naming } from '../botanical-terpenes/mol.js'

const here = p => new URL(p, import.meta.url)
const e = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
const f = n => +n.toFixed(1)
const sub = s => e(s).replace(/(\d+)/g, '<sub>$1</sub>')
const cite = ns => ns.length ? `<sup class="cite">${ns.map(n => `<a href="#ref-${n}">${n}</a>`).join(' ')}</sup>` : ''
const plain = t => t.plain || t.name
// running text from the data: a name that begins with a Greek letter is not broken after its hyphen (a word joiner)
const prose = s => e(s).replace(/([α-ω])-/gi, '$1-\u2060')
// a Greek locant stays lower case when a style sets names in capitals
const nm = t => e(t.name).replace(/^[α-ω]/, '<span class="gr">$&</span>')
// the size of one of the atlas's images, from the file: a WebP with an alpha channel keeps it in its VP8X chunk
const size = file => {
  const b = readFileSync(here(`../botanical-terpenes/${file}`))
  if (b.toString('latin1', 12, 16) !== 'VP8X') throw new Error(`${file} is not a WebP with an alpha channel`)
  return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)]
}
// a line icon from Lucide (ISC licence, icons/LICENSE): its paths, on an <svg> of our own
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${readFileSync(here(`icons/${name}.svg`), 'utf8').replace(/[\s\S]*<svg[^>]*>|<\/svg>/g, '').replace(/\s+/g, ' ').trim()}</svg>`

// ── structures ─────────────────────────────────────────────────────────────
// A PubChem record (MDL molfile, V2000). The page's y runs down, so y is turned over; x and z are kept,
// which describes the same molecule, not its mirror image. dir: mol for the drawing, mol3d for the shape in space.
const sdf = (id, dir = 'mol') => {
  const L = readFileSync(here(`${dir}/${id}.sdf`), 'utf8').split('\n')
  const na = +L[3].slice(0, 3), nb = +L[3].slice(3, 6)
  return {
    atoms: L.slice(4, 4 + na).map(l => ({ x: +l.slice(0, 10), y: -l.slice(10, 20), z: +l.slice(20, 30), el: l.slice(31, 34).trim() })),
    bonds: L.slice(4 + na, 4 + na + nb).map(l => ({ a: +l.slice(0, 3) - 1, b: +l.slice(3, 6) - 1, order: +l.slice(6, 9), stereo: +l.slice(9, 12) })),
  }
}

// What a skeletal formula shows of a record: the carbons and oxygens, and a hydrogen only where a wedge
// or hash bond holds it. from: the record's number for each atom kept; xy: where the record draws it;
// names: what each is when asked, a carbon with the hydrogens the drawing leaves out (CH3, CH2, CH, C).
const skeleton = id => {
  const { atoms, bonds } = sdf(id)
  const from = atoms.map((_, i) => i).filter(i => atoms[i].el !== 'H' || bonds.some(b => b.stereo && (b.a === i || b.b === i)))
  const hs = i => bonds.flatMap(b => b.a === i ? [b.b] : b.b === i ? [b.a] : []).filter(j => atoms[j].el === 'H')
  const hasH = i => hs(i).length > 0
  return {
    from,
    names: from.map(i => atoms[i].el === 'H' ? 'H' : atoms[i].el + ['', 'H', 'H2', 'H3', 'H4'][hs(i).filter(j => !from.includes(j)).length]),
    atoms: from.map(i => atoms[i].el === 'C' ? '' : atoms[i].el === 'O' && hasH(i) ? 'OH' : atoms[i].el),
    bonds: bonds.filter(b => from.includes(b.a) && from.includes(b.b)).map(b => [from.indexOf(b.a), from.indexOf(b.b), b.order, b.stereo]),
    xy: from.map(i => [atoms[i].x, atoms[i].y]),
  }
}

// s: px to a bond length. groups: sets of the skeleton's atoms; the bonds within each are marked as one unit.
// names: every atom's name goes with the drawing, for the page to show when it wants. turn: so does what
// turn.js needs to lift it off the page.
const mol = (id, { s = 24, pad = 16, groups, label, names, turn } = {}) => {
  const m = skeleton(id)
  const x0 = Math.min(...m.xy.map(p => p[0])), y0 = Math.min(...m.xy.map(p => p[1]))
  const W = (Math.max(...m.xy.map(p => p[0])) - x0) * s + pad * 2, H = (Math.max(...m.xy.map(p => p[1])) - y0) * s + pad * 2
  const P = m.xy.map(([x, y]) => [(x - x0) * s + pad, (y - y0) * s + pad])
  return `<svg class="mol" viewBox="0 0 ${f(W)} ${f(H)}" width="${f(W)}" height="${f(H)}"${label ? ` role="img" aria-label="${e(label)}"` : ' aria-hidden="true"'}${turn ? ` data-turn="${e(JSON.stringify(lifted(id, m, P, s).turn))}"` : ''}>${draw(m, P, { groups })}${names ? naming(m.bonds, P, m.names) : ''}</svg>`
}

// ── the isoprene rule ──────────────────────────────────────────────────────
// A terpene's carbons divided into isoprene units: five each, a carbon that carries a branch, the two
// carbons beside it and the chain of two on its third side; and each unit joined to the next head to
// tail, from a carbon beside its branch to the far end of the next unit. Found by search, so no unit is
// marked by hand. A molecule that divides in no way, or in more than one, stops the build.
const units = id => {
  const m = skeleton(id), n = m.atoms.length, next = m.atoms.map((_, i) => m.bonds.flatMap(([a, b]) => a === i ? [b] : b === i ? [a] : []))
  if (m.atoms.some(t => t)) throw new Error(`units: ${id} is not a bare carbon skeleton`)
  // every unit in it: [the far end, the carbon before the branch, the branch carbon, the two carbons beside it]
  const all = []
  for (let b = 0; b < n; b++) for (const c of next[b]) for (const far of next[c]) for (const h1 of next[b]) for (const h2 of next[b]) {
    const u = [far, c, b, h1, h2]
    if (h1 < h2 && new Set(u).size === 5 && m.bonds.filter(([p, q]) => u.includes(p) && u.includes(q)).length === 4) all.push(u)
  }
  // chains of units that use every carbon once, each unit taken up at its far end by a carbon beside the last one's branch
  const found = []
  const grow = chain => {
    if (chain.length * 5 === n) return void found.push(chain)
    const used = chain.flat(), [, , , h1, h2] = chain.at(-1)
    for (const u of all) if (!u.some(i => used.includes(i)) && (next[u[0]].includes(h1) || next[u[0]].includes(h2))) grow([...chain, u])
  }
  for (const u of all) grow([u])
  const ways = [...new Set(found.map(chain => chain.map(u => [...u].sort((p, q) => p - q).join()).join(' | ')))]
  if (ways.length !== 1) throw new Error(`units: ${id} divides into isoprene units in ${ways.length} ways: ${ways.join(' ; ')}`)
  return found[0]
}

// ── a structure to turn ────────────────────────────────────────────────────
// The rotation that lays points Q on targets P, both centred: Horn's closed form (1987), in which the
// rotation is the quaternion that is the largest eigenvector of a 4×4 matrix; power iteration finds it.
// A rotation only, never a reflection, so a molecule is not turned into its mirror image.
const fit = (Q, P) => {
  const [[xx, xy, xz], [yx, yy, yz], [zx, zy, zz]] = [0, 1, 2].map(a => [0, 1, 2].map(b => Q.reduce((t, q, i) => t + q[a] * P[i][b], 0)))
  const N = [[xx + yy + zz, yz - zy, zx - xz, xy - yx], [yz - zy, xx - yy - zz, xy + yx, zx + xz], [zx - xz, xy + yx, yy - xx - zz, yz + zy], [xy - yx, zx + xz, yz + zy, zz - xx - yy]]
  const shift = N.flat().reduce((t, v) => t + Math.abs(v), 0) // makes every eigenvalue positive
  let q = [1, 0.3, 0.2, 0.1]
  for (let i = 0; i < 4000; i++) {
    const v = N.map((row, k) => row.reduce((t, n, j) => t + n * q[j], shift * q[k])), len = Math.hypot(...v)
    q = v.map(n => n / len)
  }
  const [w, x, y, z] = q
  return [[1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)], [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)], [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]]
}

// What turn.js needs to lift a drawing off the page: what each atom is, where the drawing puts it (flat,
// in px), and where it stands in space (lift): PubChem's 3D record, brought to the drawing's scale (s px
// to a bond) and laid on the drawing as closely as a rotation can. c: the point it turns about.
const lifted = (id, m, flat, s) => {
  const a3 = sdf(id, 'mol3d').atoms
  const mean = pts => pts[0].map((_, k) => pts.reduce((sum, p) => sum + p[k], 0) / pts.length)
  const P = flat.map(([x, y]) => [x, y, 0]), raw = m.from.map(i => [a3[i].x, a3[i].y, a3[i].z])
  const c2 = mean(P), c3 = mean(raw), k = s / 1.5 // the 3D record is in ångström; a drawn bond stands for about 1.5 Å
  const Q = raw.map(p => p.map((v, i) => (v - c3[i]) * k)), R = fit(Q, P.map(p => p.map((v, i) => v - c2[i])))
  const lift = Q.map(q => R.map((row, i) => row[0] * q[0] + row[1] * q[1] + row[2] * q[2] + c2[i]))
  const mid = k => (Math.min(...flat.map(p => p[k])) + Math.max(...flat.map(p => p[k]))) / 2, c = [mid(0), mid(1)]
  return { c, lift, turn: { a: m.atoms, n: m.names, b: m.bonds, flat: flat.map(p => p.map(f)), lift: lift.map(p => p.map(f)), c: c.map(f) } }
}

// The structure in a name band: drawn flat, as everywhere, on a square with room to turn it about its
// centre. data-turn tells turn.js what each atom is and where it stands in space.
const stage = (t, s = 27) => {
  const m = skeleton(t.id), flat = m.xy.map(([x, y]) => [x * s, y * s]), { c, lift, turn } = lifted(t.id, m, flat, s)
  const r = Math.max(...[...flat.map(p => [...p, 0]), ...lift].map(p => Math.hypot(p[0] - c[0], p[1] - c[1], p[2]))) + 14
  return `<svg class="mol" viewBox="${f(c[0] - r)} ${f(c[1] - r)} ${f(2 * r)} ${f(2 * r)}" width="${f(2 * r)}" height="${f(2 * r)}" role="img" aria-label="Skeletal structure of ${e(plain(t))}" data-turn="${e(JSON.stringify(turn))}">${draw(m, flat)}</svg>`
}

// ── small parts ────────────────────────────────────────────────────────────
const rungOf = t => rungs[t.level - 1]
// what the joint FAO/WHO committee on food additives made of a compound as a flavouring: its entry in the committee's database
const jecfa = t => `https://apps.who.int/food-additives-contaminants-jecfa-database/Home/Chemical/${t.jecfa[2]}`
const judged = terpenes.filter(t => t.jecfa)
// a word of explanation on a mark: read out with the mark, and shown when the pointer rests on it
const tip = text => `<span class="tip">${e(text)}</span>`
// the honeys a compound is in: a dot each, in the honey's colour; the pointer that rests on them is shown the jars
const honeys = keys => `<span class="honeys">${keys.map(b => `<i class="b-${b}"></i>`).join('')}<span class="tip tip-jars"><span class="sr">In </span>${keys.map(jar).join('')}</span></span>`
// a honey shown by its jar, the small cut-out (on the index, which is where honeys are shown so); and the jar with the name
const jarOf = b => {
  const src = `../assets/jars/small/${jars[b]}.webp`, [w, h] = size(src)
  return `<img src="${src}" width="${w}" height="${h}" loading="lazy" decoding="async" alt="">`
}
const jar = b => `<span class="jar">${jarOf(b)}${e(blends[b].name)}</span>`
const inBlend = b => terpenes.filter(t => t.blends.includes(b))
for (const [k, b] of Object.entries(blends)) if (!b.time || !b.aroma || !b.told) throw new Error(`data.mjs: the honey "${k}" lacks its time of day, its aroma or what customers have described`)
// the plant a compound is best known from, small: it stands before the compound's name
const plant = (t, root) => {
  const src = `plates/icon/${t.id}.webp`, [w, h] = size(src)
  return `<img class="plant" src="${root}${src}" width="${w}" height="${h}" loading="lazy" decoding="async" alt="">`
}
// a compound named in a table or a chart: its plant and its name, as a way to its page
const named = (t, root) => `<a class="named" href="${root}${t.id}/">${plant(t, root)}${e(t.name)}</a>`

// the name band of a compound: on the index it heads the dossier, on the compound's own page it is the page head
const nameBand = (t, H) => `
        <header class="dossier-head" data-ground="wood">
          <div>
            <${H}>${nm(t)}</${H}>
            <p class="formula">${sub(t.formula)} <span>${e(families[t.family])}</span></p>
          </div>
          <div class="turn">${stage(t)}</div>
        </header>`

// own: the dossier is the compound's own page; otherwise it waits in the index, in its tile's template
const dossier = (t, root, own) => {
  const [w, h] = size(`plates/${t.id}.webp`), p = t.plate
  return `
    <article class="dossier">
      <figure class="plate">
        <img src="${root}plates/${t.id}.webp" width="${w}" height="${h}"${own ? '' : ' loading="lazy"'} decoding="async" alt="Botanical plate of ${e(p.common)}, ${e(p.species)}.">
        <figcaption><i>${e(p.species)}</i>, ${e(p.common)}. Printed as “${e(p.printed)}”. ${e(books[p.book])}.</figcaption>
      </figure>
      <div class="dossier-body">${own ? '' : nameBand(t, 'h3')}
        <p class="shape">${t.named ? prose(t.named) + ' ' : ''}${prose(t.shape)}</p>
        <dl class="sheet">
          <div><dt>Scent</dt><dd>${t.scent.map(e).join(', ')}${t.odour ? ` <span class="src">Reference description: “${e(t.odour[0])}” (${e(t.odour[1])})</span>` : ''}</dd></div>
          <div><dt>Found in</dt><dd>${t.plants.map(e).join(', ')}.</dd></div>
          <div><dt>In our honeys</dt><dd>${t.blends.map(b => `<span class="blend"><i class="b-${b}"></i>${e(blends[b].name)}</span>`).join(' ')} <span class="src">as a flavouring ingredient; amount not published</span></dd></div>
          <div><dt>In food</dt><dd>${t.jecfa ? `Evaluated as a flavouring in ${t.jecfa[0]} by JECFA, the FAO/WHO expert committee on food additives: ${e(t.jecfa[1])}. <span class="src"><a href="${jecfa(t)}">Its entry in the JECFA database</a></span>` : '<span class="src">No evaluation by JECFA, the FAO/WHO expert committee on food additives, is listed in PubChem.</span>'}</dd></div>
        </dl>
        <dl class="facts">
          <div><dt>Molar mass</dt><dd>${t.mw} g/mol</dd></div>
          <div><dt>Boiling point</dt><dd>${e(t.bp[1])} <span class="src">${e(t.bp[2])}</span></dd></div>
          <div><dt>CAS number</dt><dd>${e(t.cas)}</dd></div>
          <div><dt>FEMA number</dt><dd>${t.fema ? e(t.fema) : '<span class="src">none listed in PubChem</span>'}</dd></div>
          <div><dt>Record</dt><dd><a href="https://pubchem.ncbi.nlm.nih.gov/compound/${t.cid}">PubChem ${t.cid}</a></dd></div>
          <div class="wide"><dt>Systematic name</dt><dd>${e(t.iupac)}${t.form ? ` <span class="src">${e(t.form)}</span>` : ''}</dd></div>
        </dl>
        <section class="studied">
          <${own ? 'h2' : 'h4'}>What has been studied <span class="reach">${icon(rungOf(t).icon)}So far: ${e(rungOf(t).reach)}</span></${own ? 'h2' : 'h4'}>
          <ul>${t.studied.map(([g, text, r]) => `
            <li><span class="grade g-${g}">${e(grades[g])}</span><span>${prose(text)}${cite(r)}</span></li>`).join('')}
            <li class="unknown"><span class="grade">Not known</span><span>${prose(t.unknown)}</span></li>
          </ul>${own ? '' : `
          <p class="own"><a href="${root}${t.id}/">${e(t.name)} on its own page</a></p>`}
        </section>
      </div>
    </article>`
}

// one compound in the index: a tile that links to the compound's page, the plant it is best known from
// (the main figure of its plate) large in the corner and named at the foot. Its dossier waits in a
// template, neither rendered nor indexed there; atlas.js opens it in a layer over the index.
const entry = t => {
  const [w, h] = size(`plates/small/${t.id}.webp`)
  return `
      <li class="entry" id="${t.id}">
        <a class="card" href="${t.id}/">
          <img class="card-plant" src="plates/small/${t.id}.webp" width="${w}" height="${h}" loading="lazy" decoding="async" alt="">
          <span class="card-fig">${mol(t.id, { s: 20, pad: 14 })}</span>
          <span class="card-name">${nm(t)}</span>
          <span class="card-meta"><span>${sub(t.formula)}</span><span>${e(families[t.family].toLowerCase())}</span></span>
          <span class="card-scent">${t.scent.slice(0, 3).map(w => `<span>${e(w)}</span>`).join('')}</span>
          <span class="card-foot">${honeys(t.blends)}<span class="label">${e(t.plate.common)}</span></span>
        </a>
        <template>${dossier(t, './')}</template>
      </li>`
}

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

// ── same atoms, six smells ─────────────────────────────────────────────────
const isomers = terpenes.filter(t => t.formula === 'C10H16')
// the section's name and the hero's word on it are written by hand: stop the build if the data no longer says six
if (isomers.length !== 6) throw new Error('data.mjs formulas changed: rewrite "Same atoms, six smells" and the hero figure that leads to it')

// ── what is in each honey ──────────────────────────────────────────────────
// A table of the eleven against the three honeys, and beside it, where the window is wide enough to read
// it, the same as three circles, one a honey, on the corners of a triangle: each compound stands in the
// part its honeys share. The two point at each other (atlas.js): a compound under the pointer is marked
// in both, with the part of the circles it stands in.
const venn = () => {
  const keys = Object.keys(blends), r = 170, d = 164, G = [300, 268], rho = d / Math.sqrt(3)
  const C = [[-d / 2, -rho / 2], [d / 2, -rho / 2], [0, rho]].map(([x, y]) => [G[0] + x, G[1] + y]) // the centres, in the blends' order
  const inC = (p, i) => Math.hypot(p[0] - C[i][0], p[1] - C[i][1]) <= r
  const part = p => keys.filter((_, i) => inC(p, i)).join('+') // the part of the diagram a point is in, as its honeys
  const members = k => terpenes.filter(t => t.blends.join('+') === k)

  // where two circles cross: [the crossing inside the third circle, the one outside]
  const cross = (i, j) => {
    const m = [(C[i][0] + C[j][0]) / 2, (C[i][1] + C[j][1]) / 2], h = Math.sqrt(r * r - d * d / 4), n = [(C[j][1] - C[i][1]) / d, (C[i][0] - C[j][0]) / d]
    const pts = [1, -1].map(g => [m[0] + n[0] * h * g, m[1] + n[1] * h * g]), k = 3 - i - j
    return inC(pts[0], k) ? pts : pts.reverse()
  }
  // an arc of circle i from p to q, the shorter way round unless it should pass nearest `by`
  const arc = (i, p, q, by) => {
    const ang = v => Math.atan2(v[1] - C[i][1], v[0] - C[i][0]), a = ang(p)
    let turn = ((ang(q) - a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI
    if (by && Math.abs(((ang(by) - a - turn / 2 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) > Math.PI / 2) turn -= 2 * Math.PI * Math.sign(turn)
    return Array.from({ length: 16 }, (_, n) => { const t = a + turn * (n + 1) / 16; return `L${f(C[i][0] + r * Math.cos(t))} ${f(C[i][1] + r * Math.sin(t))}` }).join('')
  }
  const far = i => [2 * C[i][0] - G[0], 2 * C[i][1] - G[1]] // beyond circle i, away from the middle
  const start = p => `M${f(p[0])} ${f(p[1])}`
  const outline = k => {
    const on = keys.flatMap((b, i) => k.split('+').includes(b) ? [i] : [])
    if (on.length === 3) { const [ab, bc, ca] = [cross(0, 1)[0], cross(1, 2)[0], cross(2, 0)[0]]; return start(ca) + arc(0, ca, ab) + arc(1, ab, bc) + arc(2, bc, ca) + 'Z' }
    if (on.length === 2) { const [i, j] = on, z = 3 - i - j, o = cross(i, j)[1], a = cross(i, z)[0], b = cross(j, z)[0]; return start(o) + arc(i, o, a) + arc(z, a, b) + arc(j, b, o) + 'Z' }
    const [i] = on, [j, z] = [0, 1, 2].filter(n => n !== i), a = cross(i, j)[1], b = cross(i, z)[1], c = cross(j, z)[0]
    return start(a) + arc(i, a, b, far(i)) + arc(z, b, c) + arc(j, c, a) + 'Z'
  }
  // a line of text at height y inside a part: the middle of the stretch of that part the line crosses
  const line = (k, y, text, cls = '') => {
    const xs = []; for (let x = 0; x <= 600; x += 2) if (part([x, y - 5]) === k && part([x, y - 14]) === k && part([x, y + 3]) === k) xs.push(x)
    if (xs.at(-1) - xs[0] < text.length * 8.4) throw new Error(`the honey diagram has no room for "${text}" at ${y}`)
    return { x: (xs[0] + xs.at(-1)) / 2, y, text, cls }
  }
  const rows = { 'sunshine+berry': [114, 138, 162, 186], 'sunshine+berry+rest': [262, 286], 'sunshine+rest': [322, 346], 'berry+rest': [334], rest: [416, 440] }
  const names = Object.entries(rows).flatMap(([k, ys]) => {
    const list = members(k).sort((a, b) => a.name.length - b.name.length) // the short names where the part is narrow
    if (list.length !== ys.length) throw new Error(`the honey diagram has ${ys.length} lines for the ${list.length} compounds in ${k}`)
    return list.map((t, n) => ({ ...line(k, ys[n], t.name), t }))
  })
  if (names.length !== terpenes.length) throw new Error('the honey diagram does not place every compound')
  // the sentence above the diagram is written by hand: stop the build if the data no longer says it
  if (members('sunshine+berry+rest').length !== 2 || members('sunshine').length || members('berry').length) throw new Error('data.mjs blends changed: rewrite the sentence above the honey diagram')
  const titles = [line('sunshine', 166, blends.sunshine.name), line('berry', 156, blends.berry.name), line('rest', 478, blends.rest.name)]
  const parts = ['sunshine+berry+rest', 'sunshine+berry', 'sunshine+rest', 'berry+rest', 'sunshine', 'berry', 'rest'].filter(k => members(k).length)
  // the outlines are pieced together from arcs: hold each against plain membership in the circles, on a grid, away from the edges
  const within = (poly, [x, y]) => poly.reduce((odd, [x1, y1], i) => { const [x2, y2] = poly[(i + 1) % poly.length]; return (y1 > y) !== (y2 > y) && x < x1 + (y - y1) * (x2 - x1) / (y2 - y1) ? !odd : odd }, false)
  for (const k of parts) {
    const poly = [...outline(k).matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map(m => [+m[1], +m[2]])
    for (let x = 40; x < 560; x += 13) for (let y = 40; y < 545; y += 13) {
      if (C.some(c => Math.abs(Math.hypot(x - c[0], y - c[1]) - r) < 5)) continue
      if (within(poly, [x, y]) !== (part([x, y]) === k)) throw new Error(`the honey diagram draws the part "${k}" wrongly at ${x},${y}`)
    }
  }

  return `
  <table class="in-honey">
    <thead><tr><th scope="col"><span class="sr">Compound</span></th>${keys.map(b => `<th scope="col"><span class="jar-key" tabindex="0">${jarOf(b)}<span class="jar-name" aria-hidden="true">${e(blends[b].name)}</span><span class="tip"><b>${e(blends[b].name)}</b>, ${e(blends[b].honey)}, for the ${e(blends[b].time)}. ${prose(blends[b].aroma)} Customers and testers have described ${prose(blends[b].told)}.</span></span></th>`).join('')}</tr></thead>
    <tbody>${terpenes.map(t => `
      <tr data-t="${t.id}"><th scope="row">${named(t, '')}</th>${keys.map(b => t.blends.includes(b) ? `<td><i class="b-${b}"></i><span class="sr">yes</span></td>` : '<td><span class="sr">no</span></td>').join('')}</tr>`).join('')}
    </tbody>
  </table>
  <figure class="venn">
    <svg viewBox="30 36 540 516" role="group" aria-label="Which of the eleven compounds are in which honey">${keys.map((b, i) => `
      <circle class="venn-set b-${b}" cx="${f(C[i][0])}" cy="${f(C[i][1])}" r="${r}"/>`).join('')}${parts.map(k => `
      <path class="venn-part" data-holds="${members(k).map(t => t.id).join(' ')}" d="${outline(k)}"/>`).join('')}${titles.map((l, i) => `
      <text class="venn-title" y="${l.y}">${l.text.split(' ').map((w, n) => `<tspan x="${f(l.x)}"${n ? ' dy="1.2em"' : ''}>${e(w)}</tspan>`).join('')}</text>`).join('')}${names.map(({ x, y, t }) => `
      <a href="${t.id}/" data-t="${t.id}"><rect x="${f(x - t.name.length * 4.4 - 6)}" y="${y - 18}" width="${f(t.name.length * 8.8 + 12)}" height="24"/><text x="${f(x)}" y="${y}">${e(t.name)}</text></a>`).join('')}
    </svg>
    <figcaption>Each circle is a honey. A compound stands where the honeys that contain it overlap.</figcaption>
  </figure>`
}

// ── the frame every page shares ────────────────────────────────────────────
const site = 'https://highforest.ca/botanical-terpenes'
// the shop and the guide are pages of the live site: full addresses, so they also work from a staging host
const live = 'https://highforest.ca'
// the cut-out photographs of the jars in assets/jars/, and in small/ the same 96 px high for a tooltip
// (cwebp -q 80 -alpha_q 90 -resize 0 96)
const jars = { sunshine: 'sunshine', berry: 'soothing-berry', rest: 'grounding-rest' }
const atlas = [['', 'What are terpenes?'], ['boiling-points/', 'Boiling points'], ['do-terpenes-do-anything/', 'Do terpenes do anything?']]
const nav = (root, here) => `
<nav class="sections" aria-label="Terpenes">${atlas.map(([dir, label]) => `
  <a href="${root}${dir}"${dir === here ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
</nav>`

// the sources a page cites, under the numbers they have everywhere; the index lists every source of the atlas
const sources = (body, all) => {
  const cited = new Set(all ? refs.map(r => r[0]) : [...body.matchAll(/href="#ref-(\d+)"/g)].map(m => +m[1]))
  return !cited.size ? '' : `
<section class="sources" id="sources">
  <h2>Sources</h2>
  <ol>${refs.filter(r => cited.has(r[0])).map(([n, who, title, where, url]) => `
    <li id="ref-${n}" value="${n}">${who ? e(who).replace(/\.$/, '') + '. ' : ''}<a href="${e(url)}">${prose(title)}</a>.${where ? ' ' + e(where) + '.' : ''}</li>`).join('')}
  </ol>
</section>`
}

// dir: the page's folder inside the atlas, '' for the index. body: root => html, root being the way back to the index.
const written = []
const page = ({ dir = '', title, desc, body, scripts = [], tail = '' }) => {
  const root = dir ? '../' : './', main = body(root)
  const html = `<!doctype html>
<html lang="en">
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
<link rel="stylesheet" href="${root}atlas.css">${scripts.map(src => `
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
${sources(main, !dir)}
</main>

<footer class="colophon" data-ground="wood">
  <nav class="foot-honeys" aria-label="The honeys">
    <h2>The honeys</h2>
    <ul>${Object.entries(blends).map(([k, b]) => `
      <li>
        <a href="${live}${b.url}"><img src="${root}../assets/jars/${jars[k]}.webp" width="720" height="600" loading="lazy" decoding="async" alt=""><b>${e(b.name)}</b><span>${e(b.honey)}</span></a>
        <p class="with">Flavoured with ${inBlend(k).map(t => `<a href="${root}${t.id}/">${e(t.name.toLowerCase())}</a>`).join(', ').replace(/, (?=[^,]*$)/, ' and ')}.</p>
      </li>`).join('')}
    </ul>
  </nav>
  <div class="foot-base">
    <a class="wordmark" href="${root}../prototypes/home.html"><b>High</b>Forest</a>
    <p>Structures and identity data are from <a href="https://pubchem.ncbi.nlm.nih.gov">PubChem</a>; the plates from ${e(books.kohler)}, and ${e(books.thome)}; the icons from <a href="https://lucide.dev">Lucide</a>. Scent words and plant lists are our own. In the honeys these compounds are flavourings: these pages are not medical advice and make no claim about what the honeys do. Corrections to <a href="mailto:info@highforest.world">info@highforest.world</a>. Last revised ${e(revised)}.</p>
  </div>
</footer>${tail}
</body>
</html>
`
  mkdirSync(here(`../botanical-terpenes/${dir}`), { recursive: true })
  writeFileSync(here(`../botanical-terpenes/${dir}index.html`), html)
  written.push([dir, html])
  return main.length
}

// ── the index ──────────────────────────────────────────────────────────────
const index = root => `
<section class="hero" data-ground="wood">
  <h1>What are <em>botanical terpenes?</em></h1>
  <p class="lead">The molecules that make a lemon smell of lemon and a pine wood of pine. We scent our honeys with eleven of them. Here is each one: the plant it is known from, how it smells, and which honey it is in.</p>
  <ul class="hero-facts">
    <li><a href="#terpenes"><b>${terpenes.length}</b><span>aroma<br>compounds</span>${tip('The terpenes in our honeys, each shown with the plant it is best known from.')}</a></li>
    <li><a href="${root}do-terpenes-do-anything/#flavourings"><b>${judged.length}</b><span>reviewed<br>flavourings</span>${tip('Ten of the eleven have been evaluated as food flavourings by JECFA, the FAO/WHO expert committee on food additives.')}</a></li>
    <li><a href="#same"><b>${isomers.length}</b><span>share one<br>formula</span><span class="tip">Six of the eleven are made of the same atoms, ${sub('C10H16')}, joined in six ways. Each smells different.</span></a></li>
  </ul>
</section>
${nav(root, '')}

<section class="what" id="what">
  <header class="head">
    <h2>What a terpene is</h2>
    <p class="lead">Plants build terpenes from five‑carbon pieces called isoprene units.</p>
  </header>
  <ol class="units">
    <li>
      ${mol('isoprene', { s: 30, groups: units('isoprene'), names: true, label: 'Skeletal structure of isoprene' })}
      <p class="num"><b>5</b> carbons</p>
      <h3>One unit</h3>
      <p>Isoprene, C<sub>5</sub>H<sub>8</sub>.</p>
    </li>
    <li>
      ${mol('myrcene', { s: 30, groups: units('myrcene'), names: true, label: 'Myrcene drawn as two isoprene units joined by one bond' })}
      <p class="num"><b>10</b> carbons</p>
      <h3>Two units make a monoterpene</h3>
      <p>Light enough to leave a leaf at the touch of a finger. Drawn: myrcene, one of its two units in colour.</p>
    </li>
    <li>
      ${mol('humulene', { s: 30, groups: units('humulene'), names: true, label: 'Humulene drawn as three isoprene units joined in a ring' })}
      <p class="num"><b>15</b> carbons</p>
      <h3>Three units make a sesquiterpene</h3>
      <p>Heavier and slower to evaporate. Drawn: humulene, its first and third units in colour.</p>
    </li>
  </ol>
  <div class="more">
    <p>Add an oxygen atom and chemists call the result a terpenoid. Outside chemistry all of them are called terpenes, and these pages follow that habit.${cite([1])}</p>
    <p>Plants make them to repel what eats the leaf and to attract what pollinates the flower, and they are part of how a plant responds to heat and injury.${cite([2])} The smell of a forest is largely terpenes in the air.</p>
  </div>
</section>

<section id="terpenes">
  <h2>The terpenes in our honeys</h2>
  <ul class="cards">${terpenes.map(entry).join('')}
  </ul>
</section>

<section class="same" id="same">
  <header class="head">
    <h2>Same atoms, six smells</h2>
    <p class="lead">Six of the eleven share one formula, C<sub>10</sub>H<sub>16</sub>: ten carbons and sixteen hydrogens joined six different ways. They smell different because they are shaped differently.</p>
  </header>
  <ul class="picks">${isomers.map(t => `
    <li><div class="pick"><span class="pick-fig">${mol(t.id, { s: 30, pad: 12, names: true, turn: true })}</span><b>${plant(t, '')}${nm(t)}</b><span class="pick-scent">${t.scent.map(e).join(', ')}</span><span class="pick-shape">${e(t.shape)}</span></div></li>`).join('')}
  </ul>
</section>

<section class="blends" id="blends">
  <header class="head">
    <h2>What is in each honey</h2>
    <p class="lead">Two compounds are in all three honeys, and neither Sunshine nor Soothing Berry has one to itself.</p>
  </header>
  ${venn()}
</section>

<section class="qa" id="faq">
  <h2>Common questions</h2>
  <dl>
    <div><dt>Why add terpenes to honey?</dt><dd>For the aroma. Citrus and conifer make a morning honey, floral and berry notes an afternoon one, earthy and hop-like notes an evening one. You meet them when the jar is opened, when the honey is tasted, and when it is stirred into a drink.</dd></div>
    <div><dt>Is this a cannabis product?</dt><dd>No. Our honeys contain no cannabis, THC or CBD, and nothing intoxicating. Terpenes are not particular to cannabis: lemon peel, lavender, pine needles, hops and black pepper are full of them.${cite([1, 2])}</dd></div>
    <div><dt>Are terpenes safe to eat?</dt><dd>People have always eaten them in fruit, herbs and spices.${cite([1, 2])} As food flavourings, ten of the eleven have been evaluated by the FAO/WHO committee JECFA, with <a href="${root}do-terpenes-do-anything/#flavourings">no safety concern at current levels of intake</a> for eight.${cite([26])} Honey itself is not for infants under one year.${cite([24])}</dd></div>
    <div><dt>How much is in a teaspoon, and is it from plants?</dt><dd>We have not published the amounts; each honey is made to a fixed recipe, so its terpenes keep their proportions from batch to batch. Our supplier sells them as botanical terpene isolates: in the trade, terpenes taken from plants other than cannabis.</dd></div>
    <div><dt>Where do the terpenes come from?</dt><dd>We buy them food-grade from True Terpenes, whose facilities are certified to ISO 9001:2015 and FSSC 22000. Each batch is tested for terpene content, solvents, pesticides and heavy metals, and comes with a certificate of analysis that we review.</dd></div>
    <div><dt>Does hot water drive the aroma off?</dt><dd>Some of it. None of these compounds boils in a cup, but all of them evaporate from it, faster the hotter the water. We suggest about 50&nbsp;°C. <a href="${root}boiling-points/">Boiling points</a>.</dd></div>
  </dl>
</section>

<section class="next">
  <a href="${root}boiling-points/">
    <h2>Boiling points</h2>
    <p>All eleven, each with the source that reported it, as a chart, a table and a CSV file.</p>
  </a>
  <a href="${root}do-terpenes-do-anything/">
    <h2>Do terpenes do anything?</h2>
    <p>How far the research has reached for each compound, what doses the human studies gave, how each is judged as a food flavouring, and four mistakes about terpenes.</p>
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
    <p>We <a href="${live}/highforest-product-guide">suggest</a> water at about 50&nbsp;°C, not boiling. Hotter water drives aroma off faster, so more of it is gone before you drink.</p>
  </div>
  <figure class="plot">
    <figcaption>Boiling point at atmospheric pressure. Lower means more volatile. <span class="legend">${Object.entries(families).map(([k, v]) => `<span><i class="f-${k}"></i>${e(v.toLowerCase())}</span>`).join('')}</span></figcaption>
    ${ticks([160, 180, 200, 220, 240, 260], bpPos, v => v + ' °C')}
    <ol class="rows">${byBp.map(t => `
        <li style="--p:${f(bpPos(t.bp[0]) * 100)}%">${named(t, root)}<span class="track"><i class="f-${t.family}"></i></span><span class="val">${t.bp[0]} °C</span></li>`).join('')}
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
        <tr><th scope="row">${named(t, root)}</th><td>${span(bpRange(t), bpAt(t))}</td><td>${span(bpRange(t).map(toF), bpAt(t))}</td><td>${e(t.bp[2])}</td></tr>`).join('')}
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
// so is the paragraph on flavourings
const cleared = judged.filter(t => t.jecfa[1].startsWith('no safety concern'))
if (judged.length !== 10 || cleared.length !== 8 || judged.filter(t => !cleared.includes(t)).map(t => t.id).join() !== 'limonene,citronellol') throw new Error('data.mjs jecfa changed: rewrite the paragraph on flavourings on the evidence page')

const evidence = root => `
<section class="band" data-ground="wood">
  <h1>Do terpenes do anything?</h1>
  <p class="lead">They give plants and food their smell. Whether they do more in a person is mostly untested. Ten of the eleven terpenes here have been studied only in cells and animals, limonene has been measured in people, and none has been through a randomized trial as a treatment.</p>
</section>
${nav(root, 'do-terpenes-do-anything/')}

<section class="evidence" id="evidence">
  <div class="prose">
    <h2>Reading the research</h2>
    <p>Most research on terpenes stops at cells and animals. Each compound’s entry marks how far it has reached, on four rungs.</p>
  </div>
  <ol class="rungs">${rungs.map((r, i) => `
    <li>${icon(r.icon)}<b>${e(r.name)}</b><span>${e(r.note)}</span><em>${terpenes.filter(t => t.level === i + 1).map(t => `<a href="${root}${t.id}/">${e(t.name)}</a>`).join(', ') || (i === 3 ? 'None. Lavender oil, which contains linalool, has trials of its own.' : 'All eleven have passed this rung.')}</em></li>`).join('')}
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
    <p class="todo">We have not published the terpene content of our blends. A published figure would replace the three assumptions above.</p>
  </figure>
  <div class="prose">
    <h3>By the nose, more likely than by the mouth</h3>
    <p>If scented honey changes how someone feels, smell is the plausible route. In mice, linalool’s calming effect vanished when the sense of smell was removed.${cite([13])} In people the measured effects are small. A controlled trial of aromas found that lemon scent lifted reported mood and left stress hormones, heart rate and blood pressure unchanged.${cite([22])} A meta-analysis of lavender found signs that inhaling it eases anxiety, in studies too mixed in quality to settle the question.${cite([23])} Nobody can be blinded to a smell, so expectation is hard to rule out. Scented honey itself has not been tested.</p>
  </div>
</section>

<section id="flavourings">
  <div class="prose">
    <h2>As flavourings in food</h2>
    <p>Ten of the eleven have been evaluated as food flavourings by JECFA, the Joint FAO/WHO Expert Committee on Food Additives.${cite([26])} For eight it found no safety concern at current levels of intake. Limonene and citronellol come under acceptable daily intakes the committee had set earlier. Humulene has no evaluation listed.</p>
    <p>A verdict is about the compound as a flavouring, at the amounts food normally carries. It says nothing about larger doses. Myrcene’s dates from 2004, before the animal study described under the last of the four mistakes below. We have not published the amounts in our honeys.</p>
  </div>
  <div class="table">
    <table>
      <thead><tr><th scope="col">Compound</th><th scope="col">Evaluated</th><th scope="col">Verdict</th></tr></thead>
      <tbody>${terpenes.map(t => `
        <tr><th scope="row">${named(t, root)}</th>${t.jecfa ? `<td>${t.jecfa[0]}</td><td><a href="${jecfa(t)}">${e(t.jecfa[1][0].toUpperCase() + t.jecfa[1].slice(1))}</a></td>` : '<td></td><td>None listed in PubChem</td>'}</tr>`).join('')}
      </tbody>
    </table>
  </div>
</section>

<section class="qa" id="mistakes">
  <h2>Four mistakes</h2>
  <dl>
    <div><dt>“Terpenes are a cannabis thing.”</dt><dd>Cannabis is one of many plants that make them. Lemon peel, lavender, pine needles, hops, black pepper and rose petals are full of them, and people have always eaten and breathed them.${cite([1, 2])}</dd></div>
    <div><dt>“Each terpene has its effect: one for energy, one for sleep.”</dt><dd>That idea comes from studies of single compounds given to rodents at high doses. In the one controlled human test cited here, inhaled limonene on its own could not be told from placebo.${cite([11])} For myrcene, the “sleep terpene”, no human study exists.${cite([15])}</dd></div>
    <div><dt>“If it worked in a study, it works in the cup.”</dt><dd>Most findings come from animals given large doses, or from people who swallowed between 80 milligrams and several grams a day. How a flavouring amount compares depends on how much terpene the honey holds, and we have not published that. See <a href="#dose">the scale above</a>.</dd></div>
    <div><dt>“Natural means harmless at any dose.”</dt><dd>Myrcene, natural in hops and mango, caused tumours in male rats and mice given very large amounts for two years.${cite([20])} The amounts used to flavour food are far smaller, and the US Food and Drug Administration judged them no risk to public health.${cite([21])} Honey itself is not for infants under one year.${cite([24])}</dd></div>
  </dl>
</section>`

// ── write ──────────────────────────────────────────────────────────────────
const kB = n => (n / 1024).toFixed(1)
const made = [
  ['index', page({
    title: 'What are botanical terpenes?',
    desc: 'Botanical terpenes are the molecules that give plants their smell. We scent our honeys with eleven of them: the plant each is known from, how it smells, which honey it is in, and what research has and has not shown.',
    body: index, scripts: ['atlas.js', 'isomers.js'],
    tail: `

<dialog class="viewer">
  <div class="viewer-panel">
    <div class="viewer-top"><button type="button" class="viewer-close"><span>Close</span>${icon('x')}</button></div>
    <nav class="viewer-nav" aria-label="Compounds">
      <button type="button" class="viewer-prev">${icon('chevron-left')}<span class="sr">Previous: </span><span data-name></span></button>
      <button type="button" class="viewer-next"><span class="sr">Next: </span><span data-name></span>${icon('chevron-right')}</button>
    </nav>
    <div class="viewer-body"></div>
  </div>
</dialog>`,
  })],
  ...terpenes.map((t, i) => [t.id, page({
    dir: `${t.id}/`,
    title: `${t.name}${t.plain ? ` (${t.plain.toLowerCase()})` : ''}: scent, plants and research`,
    desc: `${t.name}, ${t.formula}, is a ${families[t.family].toLowerCase()}. Scent: ${t.scent.join(', ')}. Found in ${t.plants.slice(0, 3).join(', ')}. What has been studied, and what is not known.`,
    body: compound(t, i), scripts: ['turn.js'],
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

// the pages are High Forest's own and speak as it does ("we", "our honeys"): its name stands in a page's title, not in its text
for (const [dir, html] of written) if (/High Forest/.test(html.slice(html.indexOf('<body>')))) throw new Error(`${dir}index.html speaks of High Forest by name in its text`)

// every page stands on what it points to: a local link or file exists, an anchor has its target on the page
for (const [dir, html] of written) for (const [, ref] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
  if (/^(https?|mailto|data):/.test(ref)) continue
  const [path, anchor] = ref.split('#'), to = path && new URL(path, here(`../botanical-terpenes/${dir}`))
  if (path ? !existsSync(to.pathname.endsWith('/') ? new URL('index.html', to) : to) : !html.includes(`id="${anchor}"`)) throw new Error(`${dir}index.html: ${ref} leads nowhere`)
}
console.log(`botanical-terpenes/  ${made.length} pages  ${made.map(([name, n]) => `${name} ${kB(n)}`).join('  ')} kB  ${terpenes.length} compounds  ${refs.length} sources`)
