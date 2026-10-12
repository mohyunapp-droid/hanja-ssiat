import { useEffect, useRef, useState } from 'react'
import { gradeLabel, type Hanja } from './types'

// 연상 단어는 이 기기 브라우저에만 저장 (나중에 계정 동기화로 옮길 수 있음)
const hintKey = (h: string) => `hint:${h}`
const loadHint = (h: string) => {
  try {
    return localStorage.getItem(hintKey(h)) ?? ''
  } catch {
    return ''
  }
}
const saveHint = (h: string, v: string) => {
  try {
    if (v) localStorage.setItem(hintKey(h), v)
    else localStorage.removeItem(hintKey(h))
  } catch {
    /* 저장 불가 환경은 무시 */
  }
}

export default function HanjaCard({ h, onOpen }: { h: Hanja; onOpen: () => void }) {
  const [hint, setHint] = useState(() => loadHint(h.h))
  const [editing, setEditing] = useState(false)
  const [shown, setShown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = () => {
    const v = hint.trim()
    setHint(v)
    saveHint(h.h, v)
    setEditing(false)
  }

  return (
    <div className="card-wrap">
      <div
        className="card"
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      >
        <button
          className={`icon hint-btn ${hint ? 'has' : ''}`}
          aria-label="연상 단어 입력"
          onClick={(e) => {
            e.stopPropagation()
            setEditing((v) => !v)
          }}
        >
          💡
        </button>
        <span className="hz big">{h.h}</span>
        <span className={`eum ${shown ? 'shown' : ''}`}>{shown ? h.e2 ? `${h.e}(${h.e2})` : h.e : '?'}</span>
        <span className="gr">{gradeLabel(h.gr)}</span>
        {hint && !editing && <span className="hint-text">{hint}</span>}
        <button
          className={`icon eum-btn ${shown ? 'on' : ''}`}
          aria-label={shown ? '음 숨기기' : '음 보기'}
          onClick={(e) => {
            e.stopPropagation()
            setShown((v) => !v)
          }}
        >
          {shown ? '🙈' : '👁'}
        </button>
      </div>
      {editing && (
        <form
          className="hint-pop"
          onSubmit={(e) => {
            e.preventDefault()
            commit()
          }}
        >
          <input
            ref={inputRef}
            value={hint}
            maxLength={20}
            placeholder="연상 단어"
            onChange={(e) => setHint(e.target.value)}
            onBlur={commit}
          />
        </form>
      )}
    </div>
  )
}
