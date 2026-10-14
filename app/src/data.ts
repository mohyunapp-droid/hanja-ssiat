import type { Group, Hanja, HanjaLite } from './types'

// public/data 는 빌드 때 data/raw 에서 생성됨 (scripts/build-data.mjs)
const BASE = `${import.meta.env.BASE_URL}data/`
const CHUNK = 50

type Detail = Pick<Hanja, 'st' | 'rad' | 'add' | 'pos' | 'w' | 'note' | 'id' | 'sy' | 'an' | 'pr' | 'op' | 'ho' | 'ab' | 'ex'>

let indexCache: Promise<Group[]> | null = null

export function loadIndex(): Promise<Group[]> {
  indexCache ??= fetch(`${BASE}index.json`)
    .then((res) => res.json() as Promise<{ g: string; c: Omit<HanjaLite, 'g'>[] }[]>)
    .then((raw) => raw.map((grp) => ({ g: grp.g, c: grp.c.map((c) => ({ ...c, g: grp.g })) })))
  indexCache.catch(() => (indexCache = null))
  return indexCache
}

// 한자 → { 글자 정보, 그 그룹의 씨앗글자 } (단어 속 다른 글자의 짜임 풀이용)
export type CharInfo = HanjaLite & { seed: HanjaLite }
let charMapCache: Promise<Map<string, CharInfo>> | null = null
export function loadCharMap() {
  charMapCache ??= loadIndex().then((groups) => {
    const m = new Map<string, CharInfo>()
    for (const g of groups) for (const c of g.c) if (!m.has(c.h)) m.set(c.h, { ...c, seed: g.c[0] })
    return m
  })
  charMapCache.catch(() => (charMapCache = null))
  return charMapCache
}

const chunks = new Map<number, Promise<Record<string, Detail>>>()

function loadChunk(g: string) {
  const k = Math.floor((Number(g) - 1) / CHUNK)
  let p = chunks.get(k)
  if (!p) {
    p = fetch(`${BASE}d/${k}.json`).then((r) => r.json())
    p.catch(() => chunks.delete(k)) // 실패하면 다음에 다시 시도
    chunks.set(k, p)
  }
  return p
}

// 그룹 하나의 글자들을 상세 정보와 합쳐서 돌려줌
export async function loadGroup(group: Group): Promise<Hanja[]> {
  const detail = await loadChunk(group.g)
  return group.c.map((c) => ({ ...c, base: c.base ?? null, ...detail[c.h] }))
}
