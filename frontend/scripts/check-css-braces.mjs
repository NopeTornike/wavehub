// Fails lint when global.css has an unclosed block. A missing "}" after an @media block is still
// valid CSS, so the build passes while every later rule silently becomes phone-only — this
// happened once in a merge (2026-10-30). Comments and strings are ignored.
import { readFileSync } from 'node:fs'

const file = new URL('../styles/global.css', import.meta.url)
const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' ')).replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, (c) => c.replace(/[^\n]/g, ' '))
const open = []
let line = 1
for (const ch of css) {
  if (ch === '\n') line++
  else if (ch === '{') open.push(line)
  else if (ch === '}' && !open.pop()) {
    console.error(`global.css: extra "}" on line ${line}`)
    process.exit(1)
  }
}
if (open.length) {
  console.error(`global.css: block opened on line ${open[0]} is never closed`)
  process.exit(1)
}
