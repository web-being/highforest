// A molecule in space. The build draws each structure flat, as chemists write it, and leaves in data-turn
// what every atom is and where it stands in space. Here the drawing lifts off the page and turns slowly;
// a drag turns it by hand; while the pointer rests on it, or its key has the focus, it holds still and
// names its atoms. The key lays it flat again, which is also how the movement is stopped. Where less
// motion is asked for it starts flat and turns only by hand. Without this file the flat drawing is all
// there is.
//
// turn(svg, { key, up }) → lay. key: a button of the page's that stands for the drawing (the row of the
// six: the button that picks it). Its focus from the keyboard holds the drawing, and the page says when
// to lift it and lay it: lay(true), lay(false), or lay() for the other of the two. Without one, a key is
// made and put under the drawing: a click on it does that, and its arrow keys turn the drawing by hand.
// up: whether it starts lifted and turning.
import { draw } from './mol.js'

const calm = matchMedia('(prefers-reduced-motion: reduce)')
const out = u => 1 - (1 - u) ** 3 // ease-out: quick to answer, slow to settle
const PACE = 0.3, TILT = -0.35    // radians a second, a turn in about twenty; the lean that shows the depth

export const turn = (svg, { key, up = true } = {}) => {
  const { a: atoms, n: names, b: bonds, flat, lift, c } = JSON.parse(svg.dataset.turn), model = { atoms, bonds }, still = svg.innerHTML
  const pose = { yaw: 0, pitch: 0, up: 0 } // up: 0 flat on the page … 1 standing in space
  const own = !key
  key ||= Object.assign(document.createElement('button'), { type: 'button', className: 'turn-key', title: 'Arrow keys turn it by hand' })
  const holds = new Set() // what keeps it still and named: the pointer over it, a drag, the key's focus from the keyboard
  let turning = false, seen = true, drag, run, due, spin, last, label

  const paint = () => {
    due = 0
    if (pose.up) {
      const cy = Math.cos(pose.yaw), sy = Math.sin(pose.yaw), cp = Math.cos(pose.pitch), sp = Math.sin(pose.pitch)
      svg.innerHTML = draw(model, lift.map(([x, y, z], i) => {
        x -= c[0]; y -= c[1]
        const x1 = x * cy + z * sy, z1 = z * cy - x * sy, y1 = y * cp - z1 * sp
        return [flat[i][0] + (c[0] + x1 - flat[i][0]) * pose.up, flat[i][1] + (c[1] + y1 - flat[i][1]) * pose.up, (z1 * cp + y * sp) * pose.up]
      }), { turned: true, names: holds.size && names, em: holds.size && em() })
    } else svg.innerHTML = holds.size ? draw(model, flat, { names, em: em() }) : still // at rest: the build's own drawing, wedges and all
    if (own && label !== (label = pose.up || turning ? 'Lay flat' : 'Turn')) key.textContent = label
  }
  // the names are the same size on the screen whatever the size the molecule is shown at
  const em = () => 10.5 * svg.viewBox.baseVal.width / (svg.getBoundingClientRect().width || svg.viewBox.baseVal.width)
  const ask = () => { due ||= requestAnimationFrame(paint) }
  // move the named parts of the pose to their goals; the rest is left to the drag and to the slow turn
  const glide = (to, ms) => {
    cancelAnimationFrame(run)
    const from = { ...pose }, t0 = performance.now()
    const step = now => {
      const u = calm.matches ? 1 : Math.min(1, (now - t0) / ms)
      for (const k in to) pose[k] = from[k] + (to[k] - from[k]) * out(u)
      paint()
      if (u < 1) run = requestAnimationFrame(step)
    }
    run = requestAnimationFrame(step)
  }
  // the slow turn: only while it is asked for, in view, and nobody holds the molecule; it ends with the dossier
  const tick = now => {
    spin = 0
    if (!turning || !seen || holds.size || !svg.isConnected) return
    pose.yaw += PACE * Math.min(0.05, (now - last) / 1000); last = now
    paint()
    spin = requestAnimationFrame(tick)
  }
  const go = () => { if (!spin) { last = performance.now(); spin = requestAnimationFrame(tick) } }
  const hold = (why, on) => { on ? holds.add(why) : holds.delete(why); ask(); go() }
  const by = (dx, dy) => {
    pose.yaw += dx; pose.pitch -= dy
    pose.up < 1 ? glide({ up: 1 }, 300) : ask()
  }

  svg.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hold('pointer', true) })
  svg.addEventListener('pointerleave', () => hold('pointer', false))
  // A drag is the molecule's once the pointer has moved: a press alone is a click, and belongs to whatever
  // the drawing stands in. A finger drags it only where the page gives it the gesture (touch-action);
  // elsewhere the finger scrolls. The click that would follow a drag is not one, and is taken back.
  const unclick = e => { e.stopPropagation(); e.preventDefault() }
  svg.addEventListener('pointerdown', e => {
    if (e.button || (e.pointerType === 'touch' && getComputedStyle(svg).touchAction === 'auto')) return
    svg.setPointerCapture(e.pointerId)
    drag = { x: e.clientX, y: e.clientY }
  })
  svg.addEventListener('pointermove', e => {
    if (!drag) return
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y
    if (!drag.far && Math.hypot(dx, dy) < 4) return
    if (!drag.far) { drag.far = true; hold('drag', true) }
    by(dx * 0.012, dy * 0.012)
    drag.x = e.clientX; drag.y = e.clientY
  })
  for (const end of ['pointerup', 'pointercancel']) svg.addEventListener(end, () => {
    if (drag?.far) {
      hold('drag', false)
      addEventListener('click', unclick, { capture: true, once: true })
      setTimeout(() => removeEventListener('click', unclick, true))
    }
    drag = null
  })

  const lay = (rise = !pose.up) => {
    // the short way home, however many times it has gone round
    pose.yaw = Math.atan2(Math.sin(pose.yaw), Math.cos(pose.yaw))
    turning = rise && !calm.matches
    glide(rise ? { yaw: 0.7, pitch: TILT, up: 1 } : { yaw: 0, pitch: 0, up: 0 }, 400)
    go()
  }
  if (own) {
    key.addEventListener('click', () => lay())
    key.addEventListener('keydown', e => {
      const d = { ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, -0.2], ArrowDown: [0, 0.2] }[e.key]
      if (!d) return
      e.preventDefault()
      by(...d)
    })
    svg.after(key)
  }
  key.addEventListener('focus', () => hold('focus', key.matches(':focus-visible')))
  key.addEventListener('blur', () => hold('focus', false))
  new IntersectionObserver(([at]) => { seen = at.isIntersecting; go() }).observe(svg)

  if (!up || calm.matches) paint()
  else { turning = true; glide({ pitch: TILT, up: 1 }, 600); go() }
  return lay
}

// a structure on its stage (the name band of a compound) turns as soon as it is on the page
document.querySelectorAll('.turn > svg[data-turn]').forEach(svg => turn(svg))
