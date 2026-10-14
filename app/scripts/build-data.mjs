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

// 유의어·상대어(결합어): data/synonyms, data/antonyms (단어 읽기) → 구성 글자마다 연결
const wordsByChar = (dir, label) => {
  const byChar = {}
  const seen = new Set()
  for (const [f, line] of lines(join(root, '..', 'data', dir))) {
    const [w, r] = line.split(/\s+/)
    if (!w || !r || w.length !== r.length) throw new Error(`${label} 형식 오류: ${f} ${line}`)
    if (seen.has(w)) continue
    seen.add(w)
    for (const ch of new Set(w)) (byChar[ch] ??= []).push([w, r])
  }
  return [byChar, seen.size]
}
const [synByChar, synCount] = wordsByChar('synonyms', '유의어')
const [antByChar, antCount] = wordsByChar('antonyms', '상대어')

// 단어 짝: data/pairs/*.txt (종류|단어|읽기|짝|읽기) → 두 단어의 글자마다 연결 (순서 무관 중복 제거)
//   유의 → pr, 상대 → op, 동음 → ho
const PAIR_KEY = { 유의: 'pr', 상대: 'op', 동음: 'ho' }
const pairByChar = { pr: {}, op: {}, ho: {} }
const pairSeen = new Set()
for (const [f, line] of lines(join(root, '..', 'data', 'pairs'))) {
  const [kind, a, ra, b, rb] = line.split('|')
  const key = PAIR_KEY[kind]
  if (!key || !a || !ra || !b || !rb) throw new Error(`짝 형식 오류: ${f} ${line}`)
  const id = kind + [a, b].sort().join('|')
  if (pairSeen.has(id)) continue
  pairSeen.add(id)
  for (const ch of new Set(a + b)) (pairByChar[key][ch] ??= []).push([a, ra, b, rb])
}

// 약자: data/abbr/*.txt (기본체 약자[,약자…])
const abbr = {}
for (const [f, line] of lines(join(root, '..', 'data', 'abbr'))) {
  const [h, ab] = line.split(/\s+/)
  if (!h || !ab) throw new Error(`약자 형식 오류: ${f} ${line}`)
  abbr[h] = [...new Set([...(abbr[h] ?? []), ...ab.split(',')])]
}

// 속음·장단음·다음: data/extra/*.txt
//   한자|종류|단어|읽기  또는  한자|종류|단어:읽기 단어:읽기 …
const EXTRA_KINDS = ['속음', '단음', '장음', '다음']
const extra = {}
let extraCount = 0
for (const [f, line] of lines(join(root, '..', 'data', 'extra'))) {
  const [h, kind, ...rest] = line.split('|')
  if (!h || !EXTRA_KINDS.includes(kind) || !rest.length) throw new Error(`extra 형식 오류: ${f} ${line}`)
  const words = rest.length === 2 ? [rest] : rest[0].split(/\s+/).map((x) => x.split(':'))
  for (const [w, r] of words) {
    if (!w || !r) throw new Error(`extra 형식 오류: ${f} ${line}`)
    ;(extra[h] ??= []).push([kind, w, r])
    extraCount++
  }
}

const chunks = {}
for (const g of groups) {
  const k = Math.floor((Number(g.g) - 1) / CHUNK)
  chunks[k] ??= {}
  for (const { h, st, rad, add, pos, w, note } of g.c) chunks[k][h] = { st, rad, add, pos, w, ...(note ? { note } : {}), ...(idiomsByChar[h] ? { id: idiomsByChar[h] } : {}), ...(synByChar[h] ? { sy: synByChar[h] } : {}), ...(antByChar[h] ? { an: antByChar[h] } : {}), ...Object.fromEntries(Object.entries(pairByChar).filter(([, m]) => m[h]).map(([k, m]) => [k, m[h]])), ...(abbr[h] ? { ab: abbr[h] } : {}), ...(extra[h] ? { ex: extra[h] } : {}) }
}
for (const [k, v] of Object.entries(chunks)) writeFileSync(join(outDir, 'd', `${k}.json`), JSON.stringify(v))
console.log(`groups: ${groups.length}, chars: ${groups.reduce((n, g) => n + g.c.length, 0)}, idioms: ${idiomCount}, synonyms: ${synCount}, antonyms: ${antCount}, pairs: ${pairSeen.size}, abbr: ${Object.keys(abbr).length}, extra: ${extraCount}`)
