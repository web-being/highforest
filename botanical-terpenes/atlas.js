// The atlas index. The page reads completely without this file: every tile is a <details>
// that opens on its own. This adds filtering and the animated dossier.
const $ = (s, r = document) => [...r.querySelectorAll(s)]
const root = document.documentElement

// ── filter the eleven by family or blend ───────────────────────────────────
const items = $('[data-family]'), entries = $('.entry'), filters = $('.filters button'), count = document.getElementById('shown')
const match = (el, k) => k === 'all' || el.dataset.family === k || el.dataset.blends.split(' ').includes(k)

const show = (k, write) => {
  if (!filters.some(b => b.dataset.show === k)) k = 'all'
  filters.forEach(b => b.setAttribute('aria-pressed', b.dataset.show === k))
  items.forEach(el => { el.hidden = !match(el, k) })
  count.textContent = `${entries.filter(el => !el.hidden).length} of ${entries.length} compounds shown`
  if (!write) return
  const url = new URL(location)
  k === 'all' ? url.searchParams.delete('show') : url.searchParams.set('show', k)
  history.replaceState(history.state, '', url)
}

filters.forEach(b => b.addEventListener('click', () => show(b.dataset.show, true)))
show(new URLSearchParams(location.search).get('show') || 'all')

// ── dossiers ───────────────────────────────────────────────────────────────
// One dossier is open at a time and its id is in the address, so it can be linked.
// Three ways of opening are under comparison (prototype), named by <html data-dossier>:
//   inline – the tile's own <details> opens across its row, inside a View Transition
//   modal  – a copy in a layer over the dimmed page; the layer scrolls, the dossier keeps its full height
//   sheet  – a copy in the dialog at the right edge; the page stays live
// On a narrow screen the sheet comes up as a drawer from the bottom.
const viewer = document.querySelector('.viewer'), page = viewer.querySelector('.viewer-body')
const [prev, next] = $('.viewer-bar div button', viewer)
const calm = matchMedia('(prefers-reduced-motion: reduce)'), wide = matchMedia('(min-width: 62rem)')
const way = () => root.dataset.dossier
const name = el => el.querySelector('.card-name').innerHTML
let current = null, drawn

// an address that names a compound opens it; an empty one closes; any other anchor leaves things as they are
const fromAddress = () => {
  const id = decodeURIComponent(location.hash.slice(1))
  if (!id) current = null
  else if (entries.some(el => el.id === id)) current = id
}

// the grid reflows when a tile opens: without a transition the other tiles would jump
const morph = (fn, still) => still || calm.matches || !document.startViewTransition ? fn() : document.startViewTransition(fn)

const fill = el => {
  const list = entries.filter(e => !e.hidden), i = list.indexOf(el), at = d => list[(i + d + list.length) % list.length]
  page.replaceChildren(el.querySelector('.dossier').cloneNode(true))
  viewer.setAttribute('aria-label', el.querySelector('.card-name').textContent)
  prev.dataset.to = at(-1).id; prev.innerHTML = `<span aria-hidden="true">‹</span><span>${name(at(-1))}</span>`
  next.dataset.to = at(1).id; next.innerHTML = `<span>${name(at(1))}</span><span aria-hidden="true">›</span>`
  prev.parentElement.hidden = list.length < 2
  viewer.scrollTop = 0
}

const render = first => {
  const el = entries.find(e => e.id === current), w = way(), key = `${w} ${current}`
  if (key === drawn) return
  drawn = key
  if (el?.hidden) show('all', true)
  if (w === 'inline') {
    if (viewer.open) viewer.close()
    const was = entries.find(e => e.firstElementChild.open)
    return morph(() => {
      entries.forEach(e => { e.firstElementChild.open = e === el })
      ;(el || was)?.scrollIntoView({ behavior: 'instant', block: el ? 'start' : 'nearest' })
    }, first)
  }
  entries.forEach(e => { e.firstElementChild.open = false })
  if (!el) return viewer.open && viewer.close()
  fill(el)
  const form = w === 'modal' ? 'modal' : wide.matches ? 'side' : 'bottom'
  if (viewer.open && viewer.dataset.form === form) return
  if (viewer.open) viewer.close()
  viewer.dataset.form = form
  form === 'side' ? viewer.show() : viewer.showModal()
}

// a layer over the page gets a history entry, so Back closes it; a dossier in the flow only rewrites the address
const select = id => {
  const url = new URL(location), layer = way() !== 'inline'
  url.hash = id || ''
  if (layer && !id && history.state?.dossier) return history.back()
  if (layer && id && !current) history.pushState({ dossier: true }, '', url)
  else history.replaceState(history.state, '', url)
  current = id || null
  render()
}

entries.forEach(el => el.querySelector('summary').addEventListener('click', e => {
  e.preventDefault()
  select(current === el.id ? null : el.id)
}))
// links to a compound from the diagrams and plots open it where the reader is
addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]'), el = a && entries.find(x => `#${x.id}` === a.hash)
  if (!el) return
  e.preventDefault()
  select(el.id)
})
// a press and release on the layer itself is outside the dossier: the dimmed page around the modal, the
// backdrop of a drawer. A drag that began in the text does not count, nor does the layer's scrollbar.
let pressed
viewer.addEventListener('pointerdown', e => { pressed = e.target })
viewer.addEventListener('click', e => {
  const b = e.target.closest('button')
  const outside = e.target === viewer && pressed === viewer && e.offsetX < viewer.clientWidth
  if (outside || b?.classList.contains('viewer-close')) select(null)
  else if (b?.dataset.to) select(b.dataset.to)
})
// Escape closes a modal dialog natively; the sheet is not modal
addEventListener('keydown', e => { if (e.key === 'Escape' && viewer.open && !viewer.matches(':modal')) select(null) })
viewer.addEventListener('close', () => { if (!viewer.open && current && way() !== 'inline') select(null) })
addEventListener('popstate', () => { fromAddress(); render() })
addEventListener('hashchange', () => { fromAddress(); render() })
addEventListener('proto:way', () => render())
// on paper every dossier is open: drop the shared name that keeps them exclusive on screen
addEventListener('beforeprint', () => entries.forEach(el => { const d = el.firstElementChild; d.removeAttribute('name'); d.open = true }))
fromAddress()
render(true)
