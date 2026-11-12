// The skeletal drawing of a molecule, from where its atoms stand on the page. One function for
// the build, which draws every structure flat, and for turn.js, which draws one turned in space:
// so a structure at rest and the same structure lifted off the page are the same drawing.
//
// model: { atoms: ['', 'OH', …]   the label of each atom, '' for a carbon
//          bonds: [[a, b, order, stereo], …] }   stereo as in a molfile: 1 wedge, 6 hash
// P: [[x, y, z], …] in px. z is only read when turned: nearer bonds are drawn stronger.
// names: what every atom is (CH3, CH2, …), written small beside each atom in place of the drawing's few
// labels; em: the size of that lettering in the drawing's units.
const f = n => +n.toFixed(1)

// Every atom named. A name stands just off its atom, in the widest gap its bonds leave, so the skeleton
// stays whole under the names; of gaps about as wide, the one that faces out of the molecule. Where two
// names would still cover each other (atoms one behind the other in a molecule turned in space), the
// one behind is left out.
export const naming = (bonds, P, names, em = 10) => {
  const kept = [], mid = [0, 1].map(k => P.reduce((t, p) => t + p[k], 0) / P.length)
  return `<g class="mol-names" font-size="${f(em)}">${names.map((t, i) => {
    const [x, y] = P[i], out = Math.atan2(y - mid[1], x - mid[0])
    const to = bonds.flatMap(([a, b]) => a === i ? [P[b]] : b === i ? [P[a]] : []).map(q => Math.atan2(q[1] - y, q[0] - x)).sort((p, q) => p - q)
    // the middle of each gap between the bonds, and how wide it is; an atom with no bonds is named above itself
    const gaps = to.map((a, k) => { const gap = (to[k + 1] ?? to[0] + 2 * Math.PI) - a; return [gap + 0.4 * Math.cos(a + gap / 2 - out), a + gap / 2] })
    const dir = gaps.reduce((p, q) => q[0] > p[0] ? q : p, [-9, -Math.PI / 2])[1], w = (t.replace(/\d/g, '').length * 0.6 + (/\d/.test(t) ? 0.38 : 0)) * em / 2, h = em * 0.42
    const off = em * 0.25 + Math.abs(Math.cos(dir)) * w + Math.abs(Math.sin(dir)) * h // the name's box clears the atom
    return { t, z: P[i][2] || 0, x: x + Math.cos(dir) * off, y: y + Math.sin(dir) * off, w, h }
  }).sort((p, q) => q.z - p.z) // the nearest first: it is the one that stays
    .filter(n => !kept.some(k => Math.abs(k.x - n.x) < k.w + n.w && Math.abs(k.y - n.y) < k.h + n.h) && kept.push(n))
    .map(n => `<text class="mol-name" x="${f(n.x)}" y="${f(n.y + em * 0.34)}">${n.t.replace(/\d$/, '<tspan dy="0.3em" font-size="0.72em">$&</tspan>')}</text>`).join('')}</g>`
}

export const draw = ({ atoms, bonds }, P, { groups, turned, names, em } = {}) => {
  const heavy = i => bonds.filter(b => b[0] === i || b[1] === i).map(b => b[0] === i ? b[1] : b[0]).filter(j => atoms[j] !== 'H')
  const room = i => names || !atoms[i] ? 0 : atoms[i] === 'H' ? 6.5 : 8.5 // a bond stops short of a label that stands on its atom
  const unit = (a, b) => !groups ? '' : (k => k >= 0 ? `u${k}` : 'uj')(groups.findIndex(g => g.includes(a) && g.includes(b)))
  const zs = turned && P.map(p => p[2]), z0 = turned && Math.min(...zs), span = turned && (Math.max(...zs) - z0 || 1)
  const near = z => f(0.4 + 0.6 * (z - z0) / span)

  const lines = {}, fills = {}, apart = []
  const put = (o, k, v) => (o[k] ||= []).push(v)
  for (const [a, b, order, stereo] of bonds) {
    let [x1, y1] = P[a], [x2, y2] = P[b]
    const len = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / len, uy = (y2 - y1) / len, nx = -uy, ny = ux
    // seen end on, a bond is shorter than the room its labels ask for
    const ra = turned ? Math.min(room(a), len * 0.4) : room(a), rb = turned ? Math.min(room(b), len * 0.4) : room(b)
    x1 += ux * ra; y1 += uy * ra; x2 -= ux * rb; y2 -= uy * rb
    const d = [], seg = (ax, ay, bx, by) => d.push(`M${f(ax)} ${f(ay)}L${f(bx)} ${f(by)}`)
    let wedge
    if (stereo === 1 && !turned) wedge = `M${f(x1)} ${f(y1)}L${f(x2 + nx * 2.6)} ${f(y2 + ny * 2.6)}L${f(x2 - nx * 2.6)} ${f(y2 - ny * 2.6)}Z`
    else if (stereo === 6 && !turned) for (let i = 1; i <= 6; i++) { const t = i / 6, w = 0.5 + 2.3 * t, cx = x1 + (x2 - x1) * t, cy = y1 + (y2 - y1) * t; seg(cx + nx * w, cy + ny * w, cx - nx * w, cy - ny * w) }
    else if (order === 2 && (heavy(a).length === 1 || heavy(b).length === 1)) { seg(x1 + nx * 2.2, y1 + ny * 2.2, x2 + nx * 2.2, y2 + ny * 2.2); seg(x1 - nx * 2.2, y1 - ny * 2.2, x2 - nx * 2.2, y2 - ny * 2.2) }
    else if (order === 2) {
      // the second line goes on the side where the neighbours are
      const o = [...heavy(a).filter(j => j !== b), ...heavy(b).filter(j => j !== a)].map(j => P[j])
      const side = Math.sign(o.reduce((t, p) => t + (p[0] - x1) * nx + (p[1] - y1) * ny, 0)) || 1, off = 4.2 * side
      seg(x1, y1, x2, y2); seg(x1 + nx * off + ux * 3, y1 + ny * off + uy * 3, x2 + nx * off - ux * 3, y2 + ny * off - uy * 3)
    } else seg(x1, y1, x2, y2)
    if (turned) apart.push([P[a][2] + P[b][2], `<path opacity="${near((P[a][2] + P[b][2]) / 2)}" d="${d.join('')}"/>`])
    else { const k = unit(a, b); if (d.length) put(lines, k, d.join('')); if (wedge) put(fills, k, wedge) }
  }
  const text = names ? naming(bonds, P, names, em) : atoms.map((t, i) => {
    if (!t) return ''
    const [x, y] = P[i], n = heavy(i)[0], right = t === 'OH' && n != null && P[n][0] > x + 2, dim = turned ? ` opacity="${near(P[i][2])}"` : ''
    return t === 'OH'
      ? `<text x="${f(x + (right ? 5 : -5))}" y="${f(y + 4.6)}"${right ? ' text-anchor="end"' : ''}${dim}>${right ? 'HO' : 'OH'}</text>`
      : `<text x="${f(x)}" y="${f(y + 4.6)}" text-anchor="middle"${dim}>${t}</text>`
  }).join('')
  // turned: one path a bond, the far ones first. Flat: one path a class, which is all the page needs.
  const paths = turned ? apart.sort((p, q) => p[0] - q[0]).map(p => p[1]).join('') : Object.keys({ ...lines, ...fills }).map(k =>
    (lines[k] ? `<path${k ? ` class="${k}"` : ''} d="${lines[k].join('')}"/>` : '') +
    (fills[k] ? `<path class="mol-w${k ? ' ' + k : ''}" d="${fills[k].join('')}"/>` : '')).join('')
  return paths + text
}
