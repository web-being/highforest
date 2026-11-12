// The atlas index. Without this file every tile is a link to its compound's page.
// This opens a compound's dossier in a layer over the index instead.
import { turn } from './turn.js'

const $ = (s, r = document) => [...r.querySelectorAll(s)]
const root = document.documentElement
const entries = $('.entry')

// what is in each honey: the table and the circles point at each other. The compound under the pointer,
// or in focus, is marked in both, with the part of the circles it stands in.
const honey = document.querySelector('.blends'), named = $('[data-t]', honey), parts = $('.venn-part', honey)
const mark = id => {
  named.forEach(n => n.toggleAttribute('data-on', n.dataset.t === id))
  parts.forEach(p => p.toggleAttribute('data-on', !!id && p.dataset.holds.split(' ').includes(id)))
}
const marked = e => mark(e.target.closest('[data-t]')?.dataset.t)
honey.addEventListener('pointerover', marked)
honey.addEventListener('pointerleave', () => mark())
honey.addEventListener('focusin', marked)
honey.addEventListener('focusout', () => mark())

// ── dossiers ───────────────────────────────────────────────────────────────
// One dossier is open at a time, in a modal dialog that covers the window and scrolls in the page's place.
// While it is open the address is that of the compound's own page (…/limonene, which a host forwards to
// …/limonene/): copied, it leads to the same words. The open dossier is a history entry, so Back closes
// it, and the entry's state says which compound it is and where it was opened from. The address stays
// in the index's folder, so every relative link and image of the index goes on meaning what it meant.
const viewer = document.querySelector('.viewer'), page = viewer.querySelector('.viewer-body')
const pagers = $('.viewer-prev, .viewer-next', viewer)
const current = () => entries.find(el => el.id === history.state?.dossier)
let drawn

const fill = el => {
  const i = entries.indexOf(el), at = d => entries[(i + d + entries.length) % entries.length]
  page.replaceChildren(el.querySelector('template').content.cloneNode(true))
  $('svg[data-turn]', page).forEach(svg => turn(svg))
  viewer.setAttribute('aria-label', el.querySelector('.card-name').textContent)
  // the keys to the compound before and the compound after
  pagers.forEach((b, n) => {
    const to = at(n ? 1 : -1)
    b.dataset.to = to.id
    b.querySelector('[data-name]').replaceChildren(...to.querySelector('.card-name').cloneNode(true).childNodes)
  })
  viewer.scrollTop = 0
}

const render = () => {
  const el = current()
  if (el === drawn) return
  drawn = el
  if (!el) return viewer.open && viewer.close()
  fill(el)
  if (viewer.open) return
  // the page hands its scrollbar to the layer and keeps its own width: html:has(.viewer[open]) in atlas.css
  root.style.setProperty('--scrollbar', `${Math.max(0, innerWidth - root.clientWidth)}px`)
  viewer.showModal()
}

// opening adds a history entry; moving between dossiers rewrites it; closing goes back out of it
const select = id => {
  const open = history.state?.dossier
  if (!id) return open && history.back()
  if (open) history.replaceState({ ...history.state, dossier: id }, '', id)
  else {
    // an anchor still in the address (#terpenes, #ref-9) has done its work: left there, closing the dossier
    // would take the reader back to the anchor and not to where they were
    if (location.hash) history.replaceState(history.state, '', location.pathname + location.search)
    history.pushState({ dossier: id, from: location.pathname + location.search }, '', id)
  }
  render()
}

// a plain click on a link to a compound opens its dossier here; with a modifier key the browser opens the page
addEventListener('click', e => {
  const a = e.target.closest('a[href]')
  if (!a || e.defaultPrevented || a.closest('.viewer') || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  // where it leads, from the attribute: a link inside a drawing (the circles of the honeys) has no href that is a string
  const to = new URL(a.getAttribute('href'), a.baseURI).href
  const el = entries.find(x => to === new URL(`${x.id}/`, location.href).href)
  if (!el) return
  select(el.id)
  e.preventDefault() // only once the dossier is open: if opening fails, the link still leads to the page
})
// a press and release on the layer itself is outside the dossier, on the dimmed page.
// A drag that began in the text does not count, nor does the layer's scrollbar.
let pressed
viewer.addEventListener('pointerdown', e => { pressed = e.target })
viewer.addEventListener('click', e => {
  const b = e.target.closest('button'), cite = e.target.closest('a[href^="#"]')
  const outside = e.target === viewer && pressed === viewer && e.offsetX < viewer.clientWidth
  if (outside || b?.classList.contains('viewer-close')) select(null)
  else if (b?.dataset.to) select(b.dataset.to)
  else if (cite) {
    // a citation leads to its source in the index: a new entry under the index's own address, so Back reopens the dossier
    e.preventDefault()
    history.pushState(null, '', history.state.from)
    render()
    location.replace(cite.hash)
  }
})
// Escape closes the dialog on its own: bring the address along
viewer.addEventListener('close', () => select(null))
addEventListener('popstate', render)
