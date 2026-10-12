// data/raw/*.json (페이지별 추출본) → src/data/hanja.json 으로 합치기
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const rawDir = join(root, '..', 'data', 'raw')
const outDir = join(root, 'src', 'data')

const groups = []
for (const f of readdirSync(rawDir).filter((f) => f.endsWith('.json')).sort()) {
  groups.push(...JSON.parse(readFileSync(join(rawDir, f), 'utf8')))
}
groups.sort((a, b) => a.g.localeCompare(b.g))

const seen = new Set()
for (const g of groups) {
  if (seen.has(g.g)) throw new Error(`중복 그룹 ${g.g}`)
  seen.add(g.g)
  for (const c of g.c) {
    const bad = (msg) => {
      throw new Error(`${g.g} ${c.h}: ${msg}`)
    }
    if (!c.e || !c.hun?.length || !c.gr || !c.st || !c.rad) bad('필수 항목 누락')
    if ((c.pos ?? []).length !== c.add.length) bad('add와 pos 개수가 다름')
    if (new Set(c.pos).size !== c.pos.length) bad('같은 위치에 보탬글자가 둘')
    if (c.pos.some((p) => !'tblrw'.includes(p))) bad('알 수 없는 위치')
    if (!c.base && c.add.length) bad('기준글자 없이 보탬글자만 있음')
  }
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'hanja.json'), JSON.stringify(groups))
console.log(`groups: ${groups.length}, chars: ${groups.reduce((n, g) => n + g.c.length, 0)}`)
