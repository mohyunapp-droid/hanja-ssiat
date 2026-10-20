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

// 힌트에 (글자)로 적은 부분만 모아 가나다순으로 (같은 글자는 한 번)
export const bracketWords = (): string[] => {
  const s = new Set<string>()
  for (const h of hintedChars()) for (const m of loadHint(h).matchAll(/\(([^()]+)\)/g)) if (m[1].trim()) s.add(m[1].trim())
  return [...s].sort((a, b) => a.localeCompare(b, 'ko'))
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
