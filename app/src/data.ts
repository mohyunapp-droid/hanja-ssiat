import type { Group, Hanja, HanjaLite } from './types'

// public/data 는 빌드 때 data/raw 에서 생성됨 (scripts/build-data.mjs)
const BASE = `${import.meta.env.BASE_URL}data/`
const CHUNK = 50

type Detail = Pick<Hanja, 'st' | 'rad' | 'add' | 'pos' | 'w' | 'note' | 'id' | 'sy' | 'pr'>

export async function loadIndex(): Promise<Group[]> {
  const res = await fetch(`${BASE}index.json`)
  const raw = (await res.json()) as { g: string; c: Omit<HanjaLite, 'g'>[] }[]
  return raw.map((grp) => ({ g: grp.g, c: grp.c.map((c) => ({ ...c, g: grp.g })) }))
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
