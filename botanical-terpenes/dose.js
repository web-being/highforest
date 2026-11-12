// The dose comparison on the evidence page: move the teaspoon along the log scale.
// Without this file the figure shows the middle assumption.
const strength = document.querySelector('.strength'), buttons = [...strength.querySelectorAll('button')]
const spoon = document.querySelector('.spoon'), spoonVal = document.getElementById('spoon-val')
const { grams, lo, hi } = strength.dataset
const amount = mg => mg >= 1000 ? `${+(mg / 1000).toPrecision(2)} g` : `${+mg.toPrecision(2)} mg`

buttons.forEach(b => b.addEventListener('click', () => {
  const mg = grams * 1000 * b.dataset.pct / 100
  buttons.forEach(x => x.setAttribute('aria-pressed', x === b))
  spoon.style.setProperty('--p', `${(Math.log10(mg) - lo) / (hi - lo) * 100}%`)
  spoonVal.textContent = amount(mg)
}))
