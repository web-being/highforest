// "Same atoms, six smells": the six isomers of C10H16 in a row that begins at the left of the page column.
// One of them is picked: it stands full size, says how it is built, and its drawing lifts off the page
// and turns, so that its shape shows (turn.js); under the pointer it holds still and names its atoms.
// The others stand small beside it with what they smell of (atlas.css). This file makes each a button
// that picks it and marks the row live. A press on the picked one lays it flat, and the next lifts it
// again. Nothing here opens a dossier: the tiles below do that.
// Where the row is wider than the window, the picked one is brought to the row's start, the row says
// which of its ends has more to show, and a dot for each of the six stands under it. Without this file
// the six stand full size in a row that scrolls.
import { turn } from './turn.js'

const strip = document.querySelector('.picks')
const calm = matchMedia('(prefers-reduced-motion: reduce)')
const picks = [...strip.querySelectorAll('.pick')].map(el => {
  const b = Object.assign(document.createElement('button'), { type: 'button', className: el.className })
  b.append(...el.childNodes)
  el.replaceWith(b)
  return b
})
const lays = picks.map((b, i) => turn(b.querySelector('.mol'), { key: b, up: !i }))
const dots = Object.assign(document.createElement('div'), { className: 'pick-dots' })
dots.setAttribute('aria-hidden', 'true') // the buttons already say which is picked
dots.append(...picks.map(() => document.createElement('i')))
strip.after(dots)

const picked = () => picks.findIndex(b => b.getAttribute('aria-pressed') === 'true')
const pick = i => {
  picks.forEach((b, k) => b.setAttribute('aria-pressed', k === i))
  ;[...dots.children].forEach((d, k) => d.toggleAttribute('data-on', k === i))
}
pick(0)

strip.addEventListener('click', e => {
  const i = picks.indexOf(e.target.closest('.pick')), was = picked()
  if (i < 0) return
  if (i === was) return lays[i]()
  // the width of one that is not picked, read before any of them starts to change
  const slot = Math.min(...picks.map(b => b.parentElement.offsetWidth))
  pick(i)
  lays[was](false)
  if (!calm.matches) lays[i](true)
  // where it will stand once those before it are small: so many of their widths from the row's start
  strip.scrollTo({ left: i * slot, behavior: calm.matches ? 'instant' : 'smooth' })
})

// which ends of the row have more to show; neither, where the window shows all six
const ends = () => {
  const over = strip.scrollWidth - strip.clientWidth
  const more = over < 2 ? '' : [strip.scrollLeft > 1 && 'start', strip.scrollLeft < over - 1 && 'end'].filter(Boolean).join(' ')
  if (strip.dataset.more !== more) strip.dataset.more = more
}
strip.addEventListener('scroll', ends, { passive: true })
strip.addEventListener('transitionend', ends) // a pick changes the widths, and with them how far the row runs
new ResizeObserver(ends).observe(strip)

strip.dataset.live = ''
// the row is laid out as it will stand before its changes are eased: it does not shrink into place on arrival
void strip.offsetWidth
strip.dataset.live = 'eased'
ends()
