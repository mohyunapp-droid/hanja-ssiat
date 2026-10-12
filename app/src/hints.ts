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
