#!/usr/bin/env node
// css-audit – find layered, contradictory and untethered CSS.
// usage: node css-audit.mjs <file.css>... [--html <file.html|file.js>...]
// exit 1 when any error is found. No dependencies: a small block parser that
// understands comments, strings, parentheses, at-rules and nesting. It reads
// structure, not the cascade; treat findings as places to look. Custom properties are
// resolved across all files given in one run, and count as defined when the supplied
// HTML/JS sets them inline (style="--p: …" or setProperty('--p', …)).

import { readFileSync } from 'node:fs'

const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))

const parse = src => {
  let i = 0
  const n = src.length
  const block = () => {
    const out = { decls: [], rules: [] }
    let buf = '', start = i, depth = 0
    const flush = () => { if (buf.trim()) out.decls.push({ text: buf.trim(), pos: start }); buf = ''; start = i }
    while (i < n) {
      const c = src[i]
      if (c === '"' || c === "'") {
        buf += c; i++
        while (i < n && src[i] !== c) { if (src[i] === '\\') buf += src[i++]; buf += src[i++] }
        buf += src[i++] || ''; continue
      }
      if (c === '(') depth++
      if (c === ')') depth--
      if (depth > 0) { buf += c; i++; continue }
      if (c === '{') { i++; const prelude = buf.trim(), pos = start; buf = ''; const inner = block(); out.rules.push({ prelude, pos, ...inner }); start = i; continue }
      if (c === '}') { flush(); i++; return out }
      if (c === ';') { i++; flush(); continue }
      if (!buf.trim()) start = i
      buf += c; i++
    }
    flush(); return out
  }
  return block()
}

const audit = (file, src, used) => {
  const css = strip(src), tree = parse(css), issues = []
  const line = pos => css.slice(0, pos).split('\n').length
  const add = (level, rule, pos, note) => issues.push({ level, rule, line: line(pos), note })
  const defined = new Map(), referenced = new Map(), seen = new Map(), zs = []
  const hasFocusVisible = /:focus-visible/.test(css)
  const colour = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(/i

  const walk = (node, ctx, sel) => {
    const props = new Map()
    for (const d of node.decls) {
      const k = d.text.indexOf(':'); if (k < 0) continue
      const prop = d.text.slice(0, k).trim().toLowerCase(), val = d.text.slice(k + 1).trim()
      if (prop.startsWith('@')) continue
      for (const m of val.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) if (!referenced.has(m[1]) || !m[2]) referenced.set(m[1], { pos: d.pos, fallback: !!m[2] })
      if (prop.startsWith('--')) { defined.set(prop, d.pos); continue }
      if (props.has(prop) && props.get(prop) === val) add('warn', 'repeat', d.pos, `${sel}: ${prop} declared twice with the same value`)
      props.set(prop, val)
      if (/!important/.test(val)) add('warn', 'important', d.pos, `${sel} { ${prop} }`)
      if (colour.test(val) && !/mask/.test(prop)) add('warn', 'raw-colour', d.pos, `${sel} { ${prop}: ${val.slice(0, 48)} } – lift into a token`)
      if (prop === 'z-index' && /^-?\d+$/.test(val)) zs.push({ v: +val, pos: d.pos, sel })
      if (/^transition/.test(prop) && /(^|[\s,])all([\s,]|$)/.test(val)) add('warn', 'transition-all', d.pos, sel)
      if (/\b100vw\b/.test(val)) add('warn', '100vw', d.pos, `${sel}: 100vw ignores the scrollbar; use 100%`)
      if (/(^|[^a-z-])100vh/.test(val)) add('warn', '100vh', d.pos, `${sel}: use svh/dvh or content height`)
      if (prop === 'outline' && /^(none|0)\b/.test(val) && !hasFocusVisible) add('error', 'no-focus', d.pos, `${sel} removes the outline and the file has no :focus-visible rule`)
    }
    for (const r of node.rules) {
      if (/^@(media|supports|container|layer|scope|starting-style)/.test(r.prelude)) { walk(r, ctx + ' ' + r.prelude.replace(/\s+/g, ' '), sel); continue }
      if (/^@(keyframes|font-face|property|page|counter-style)/.test(r.prelude)) { for (const d of r.decls) for (const m of d.text.matchAll(/var\(\s*(--[\w-]+)/g)) referenced.set(m[1], { pos: d.pos, fallback: true }); r.rules.forEach(k => k.decls.forEach(d => { for (const m of d.text.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) referenced.set(m[1], { pos: d.pos, fallback: !!m[2] }) })); continue }
      const s = (sel ? sel + ' ' : '') + r.prelude.replace(/\s+/g, ' ')
      const key = ctx + '|' + s
      if (seen.has(key)) {
        const prev = seen.get(key), now = new Set(r.decls.map(d => d.text.split(':')[0].trim().toLowerCase()))
        const clash = [...prev.props].filter(p => now.has(p) && !p.startsWith('--'))
        add(clash.length ? 'error' : 'warn', clash.length ? 'override' : 'split-rule', r.pos,
          clash.length ? `${s} sets ${clash.join(', ')} again (first at line ${line(prev.pos)}); one of them is dead` : `${s} is declared again (first at line ${line(prev.pos)}); merge`)
        now.forEach(p => prev.props.add(p))
      } else seen.set(key, { pos: r.pos, props: new Set(r.decls.map(d => d.text.split(':')[0].trim().toLowerCase())) })
      walk(r, ctx, s)
    }
  }
  walk(tree, '', '')

  const distinct = [...new Set(zs.map(z => z.v))]
  for (const z of zs) if (Math.abs(z.v) > 100) add('warn', 'z-index', z.pos, `${z.sel}: z-index ${z.v}; use a named scale`)
  if (distinct.length > 6) add('warn', 'z-index', 0, `${distinct.length} distinct z-index values: ${distinct.sort((a, b) => a - b).join(', ')}`)
  if (used != null) {
    const classes = new Map()
    for (const [key, v] of seen) for (const m of key.split('|').pop().matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) if (!classes.has(m[1])) classes.set(m[1], v.pos)
    for (const [c, pos] of classes) if (!new RegExp(`(^|[^\\w-])${c}([^\\w-]|$)`).test(used)) add('warn', 'unused-class', pos, `.${c} appears in no supplied HTML/JS file`)
  }
  return { issues, defined, referenced, line }
}

const args = process.argv.slice(2)
const hi = args.indexOf('--html')
const htmlFiles = hi >= 0 ? args.splice(hi).slice(1) : []
if (!args.length) { console.error('usage: css-audit.mjs <file.css>... [--html <file.html|file.js>...]'); process.exit(2) }
const used = htmlFiles.length ? htmlFiles.map(f => readFileSync(f, 'utf8')).join('\n') : null
let errors = 0, warns = 0
const runs = args.map(file => ({ file, ...audit(file, readFileSync(file, 'utf8'), used) }))
const has = (k, name) => runs.some(r => r[k].has(name))
const inline = name => used != null && new RegExp(`${name}\\s*:|setProperty\\(\\s*['"\`]${name}['"\`]`).test(used)
for (const r of runs) {
  for (const [name, ref] of r.referenced) if (!ref.fallback && !has('defined', name) && !inline(name)) r.issues.push({ level: 'error', rule: 'undefined-var', line: r.line(ref.pos), note: `${name} is used and defined nowhere` })
  for (const [name, pos] of r.defined) if (!has('referenced', name) && !(used && used.includes(name))) r.issues.push({ level: 'warn', rule: 'unused-var', line: r.line(pos), note: `${name} is defined and never used` })
  r.issues.sort((a, b) => a.line - b.line)
}
for (const { file, issues } of runs) {
  console.log(`\n${file} – ${issues.length ? issues.length + ' issue(s)' : 'clean'}`)
  for (const i of issues) {
    i.level === 'error' ? errors++ : warns++
    console.log(`  ${i.level === 'error' ? '✗' : '!'} ${String(i.line).padStart(4)}  ${i.rule}  ${i.note}`)
  }
}
console.log(`\n${errors} error(s), ${warns} warning(s)`)
process.exit(errors ? 1 : 0)
