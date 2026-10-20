// 연상 단어는 이 기기 브라우저에만 저장 (나중에 계정 동기화로 옮길 수 있음)
const PREFIX = 'hint:'

export const loadHint = (h: string) => {
  try {
    return localStorage.getItem(PREFIX + h) ?? ''
  } catch {
    return ''
  }
}

export const saveHint = (h: string, v: string) => {
  try {
    if (v) localStorage.setItem(PREFIX + h, v)
    else localStorage.removeItem(PREFIX + h)
  } catch {
    /* 저장 불가 환경은 무시 */
  }
  window.dispatchEvent(new Event(HINTS_CHANGED))
}

export const HINTS_CHANGED = 'hints-changed'

// 힌트에 (글자)로 적은 부분만 모아 가나다순으로: [괄호 속 글자, 그 힌트를 적은 한자들][]
export const bracketWords = (): [word: string, chars: string[]][] => {
  const m = new Map<string, Set<string>>()
  for (const h of hintedChars())
    for (const [, raw] of loadHint(h).matchAll(/\(([^()]+)\)/g)) {
      const w = raw.trim()
      if (w) m.set(w, (m.get(w) ?? new Set()).add(h))
    }
  return [...m].map(([w, s]) => [w, [...s]] as [string, string[]]).sort((a, b) => a[0].localeCompare(b[0], 'ko'))
}

export const hintedChars = (): Set<string> => {
  const s = new Set<string>()
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(PREFIX) && localStorage.getItem(k)) s.add(k.slice(PREFIX.length))
    }
  } catch {
    /* 저장 불가 환경은 빈 목록 */
  }
  return s
}
