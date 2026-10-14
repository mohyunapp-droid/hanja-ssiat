// data/raw/*.json (페이지별 추출본) → public/data/ 로 나누어 내보내기
//   index.json : 목록·급수·퀴즈에 필요한 가벼운 정보 (앱 시작 때 한 번)
//   d/NN.json  : 조합 화면에 필요한 상세 정보 (그룹 50개 단위, 필요할 때만)
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const rawDir = join(root, '..', 'data', 'raw')
const outDir = join(root, 'public', 'data')
const CHUNK = 50

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
    if (new Set(c.add).size !== c.add.length) bad('같은 보탬글자가 둘 (괄호로 묶을 것)')
    if (c.pos.some((p) => !'tblrw'.includes(p))) bad('알 수 없는 위치')
    if (!c.base && c.add.length) bad('기준글자 없이 보탬글자만 있음')
  }
}

mkdirSync(join(outDir, 'd'), { recursive: true })
const index = groups.map((g) => ({
  g: g.g,
  c: g.c.map(({ h, e, e2, hun, gr, base }) => ({ h, e, ...(e2 ? { e2 } : {}), hun, gr, ...(base ? { base } : {}) })),
}))
writeFileSync(join(outDir, 'index.json'), JSON.stringify(index))
// 사자성어: data/idioms/*.txt (사자성어|읽기|급수|뜻) → 구성 글자마다 연결
const idiomDir = join(root, '..', 'data', 'idioms')
const idiomsByChar = {}
let idiomCount = 0
for (const f of readdirSync(idiomDir).filter((f) => f.endsWith('.txt')).sort()) {
  for (const raw of readFileSync(join(idiomDir, f), 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const [w, r, gr, m] = line.split('|')
    if (!w || !r || !gr || !m) throw new Error(`사자성어 형식 오류: ${f} ${line}`)
    idiomCount++
    for (const ch of new Set(w)) (idiomsByChar[ch] ??= []).push([w, r, m, gr])
  }
}

const lines = (dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.txt'))
    .sort()
    .flatMap((f) => readFileSync(join(dir, f), 'utf8').split('\n').map((l) => [f, l.trim()]))
    .filter(([, l]) => l && !l.startsWith('#'))

// 유의어(결합어): data/synonyms/*.txt (단어 읽기) → 구성 글자마다 연결
const synByChar = {}
const synSeen = new Set()
for (const [f, line] of lines(join(root, '..', 'data', 'synonyms'))) {
  const [w, r] = line.split(/\s+/)
  if (!w || !r || w.length !== r.length) throw new Error(`유의어 형식 오류: ${f} ${line}`)
  if (synSeen.has(w)) continue
  synSeen.add(w)
  for (const ch of new Set(w)) (synByChar[ch] ??= []).push([w, r])
}

// 비슷한 말 짝: data/pairs/*.txt (종류|단어|읽기|짝|읽기) → 두 단어의 글자마다 연결 (순서 무관 중복 제거)
const pairByChar = {}
const pairSeen = new Set()
for (const [f, line] of lines(join(root, '..', 'data', 'pairs'))) {
  const [, a, ra, b, rb] = line.split('|')
  if (!a || !ra || !b || !rb) throw new Error(`짝 형식 오류: ${f} ${line}`)
  const key = [a, b].sort().join('|')
  if (pairSeen.has(key)) continue
  pairSeen.add(key)
  for (const ch of new Set(a + b)) (pairByChar[ch] ??= []).push([a, ra, b, rb])
}

const chunks = {}
for (const g of groups) {
  const k = Math.floor((Number(g.g) - 1) / CHUNK)
  chunks[k] ??= {}
  for (const { h, st, rad, add, pos, w, note } of g.c) chunks[k][h] = { st, rad, add, pos, w, ...(note ? { note } : {}), ...(idiomsByChar[h] ? { id: idiomsByChar[h] } : {}), ...(synByChar[h] ? { sy: synByChar[h] } : {}), ...(pairByChar[h] ? { pr: pairByChar[h] } : {}) }
}
for (const [k, v] of Object.entries(chunks)) writeFileSync(join(outDir, 'd', `${k}.json`), JSON.stringify(v))
console.log(`groups: ${groups.length}, chars: ${groups.reduce((n, g) => n + g.c.length, 0)}, idioms: ${idiomCount}, synonyms: ${synSeen.size}, pairs: ${pairSeen.size}`)
