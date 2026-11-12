#!/usr/bin/env node
// jecfa-check – hold the flavouring verdicts in atlas/data.mjs against the JECFA database itself.
// usage: node tools/jecfa-check.mjs      (needs the network; exit 1 when an entry does not say what the atlas says)
// For each compound with a verdict it reads the entry the atlas links to and checks that it is that compound's
// (its FEMA number, or failing that its name), that the year is the entry's evaluation year, and that the
// entry carries the wording the atlas's clause rests on.
import { terpenes } from '../atlas/data.mjs'

const wording = [
  [/no safety concern/, 'No safety concern at current levels of intake when used as a flavouring agent'],
  [/not specified/, 'ADI: NOT SPECIFIED'],
  [/0–0\.5 mg per kg/, '0-0.5 mg/kg bw'],
]
let failed = 0
for (const t of terpenes.filter(t => t.jecfa)) {
  const [year, clause, entry] = t.jecfa, url = `https://apps.who.int/food-additives-contaminants-jecfa-database/Home/Chemical/${entry}`
  const text = (await (await fetch(url, { headers: { 'user-agent': 'jecfa-check' } })).text()).replace(/<script[\s\S]*?<\/script>|<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/\s+/g, ' ')
  const expect = wording.filter(([said]) => said.test(clause)).map(([, source]) => source)
  const wrong = [
    !(text.includes(`FEMA number ${t.fema} `) || text.toUpperCase().includes((t.plain || t.name).replace(/^(Alpha|Beta)-/, '').toUpperCase())) && 'is not this compound',
    !text.includes(`Evaluation year: ${year} `) && `was not evaluated in ${year}`,
    !expect.length && 'the atlas clause rests on no wording this check knows',
    ...expect.map(source => !text.includes(source) && `does not say "${source}"`),
  ].filter(Boolean)
  failed += wrong.length
  console.log(`${wrong.length ? '✗' : '✓'} ${t.name}  ${url}${wrong.map(w => `\n    ${w}`).join('')}`)
}
process.exit(failed ? 1 : 0)
