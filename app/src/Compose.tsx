import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { gradeLabel, type Hanja, type Word } from './types'

const shuffle = <T,>(a: T[]) => {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

// 정답 보탬글자 + 같은 그룹의 다른 보탬글자로 헷갈리는 보기 만들기
function makeTiles(target: Hanja, pool: Hanja[]) {
  const wrong = [...new Set(pool.flatMap((h) => h.add))].filter((a) => !target.add.includes(a))
  const fillers = ['氵', '扌', '亻', '木', '口', '心', '土', '日', '女', '言', '糸', '金']
  const extra = shuffle([...wrong, ...fillers.filter((f) => !target.add.includes(f) && !wrong.includes(f))])
  return shuffle([...target.add, ...extra.slice(0, Math.max(3, 6 - target.add.length))])
}

const isText = (s: string) => s.startsWith('(')

// 예시 단어: 읽기를 ?로 가려두고, 누르면 보드가 한 바퀴 돌며 읽기가 나타남
function WordBoard({ word: [w, r, m] }: { word: Word }) {
  const [shown, setShown] = useState(false)
  const [spinning, setSpinning] = useState(false)

  const flip = () => {
    if (spinning) return
    setSpinning(true)
    setTimeout(() => setShown((v) => !v), 200) // 옆면(90°)이 되어 안 보이는 순간에 바꾸기
    setTimeout(() => setSpinning(false), 600)
  }

  return (
    <li className={`word-board ${spinning ? 'spin' : ''}`} role="button" tabIndex={0} onClick={flip} onKeyDown={(e) => e.key === 'Enter' && flip()}>
      <span className="hz">{w}</span>
      <span className={`rd ${shown ? '' : 'hidden'}`}>{shown ? r : '?'}</span>
      <span className="mn">{m}</span>
    </li>
  )
}

export default function Compose({ target, pool, onBack }: { target: Hanja; pool: Hanja[]; onBack: () => void }) {
  const tiles = useMemo(() => makeTiles(target, pool), [target, pool])
  const [placed, setPlaced] = useState<string[]>([])
  const [wrong, setWrong] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ t: string; x: number; y: number } | null>(null)
  const [panel, setPanel] = useState<HTMLElement | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => setPanel(document.getElementById('add-panel')), [])

  const isSeed = !target.base
  const done = isSeed || placed.length === target.add.length

  const tryPlace = (t: string) => {
    if (done) return
    if (target.add.includes(t) && !placed.includes(t)) setPlaced((p) => [...p, t])
    else {
      setWrong(t)
      setTimeout(() => setWrong(null), 450)
    }
  }

  const onPointerDown = (t: string) => (e: React.PointerEvent) => {
    e.preventDefault()
    const start = { x: e.clientX, y: e.clientY }
    let moved = false
    setDrag({ t, x: e.clientX, y: e.clientY })
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) moved = true
      setDrag({ t, x: ev.clientX, y: ev.clientY })
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDrag(null)
      const r = dropRef.current?.getBoundingClientRect()
      const inside = r && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom
      if (inside || !moved) tryPlace(t) // 드래그 또는 탭으로 넣기
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="compose">
      <button className="back" onClick={onBack}>← 목록</button>

      {!isSeed && (
        <div ref={dropRef} className={`drop ${drag ? 'armed' : ''} ${done ? 'done' : ''}`}>
          {done ? (
            <span className="hz huge pop">{target.h}</span>
          ) : (
            <div className="formula">
              <span className="hz huge base">{target.base}</span>
              {target.add.map((_, i) => (
                <span key={i} className="plus-slot">
                  <span className="plus">+</span>
                  <span className={`slot ${placed[i] ? 'filled' : ''}`}>
                    {placed[i] ? <span className={isText(placed[i]) ? 'txt' : 'hz'}>{placed[i]}</span> : '?'}
                  </span>
                </span>
              ))}
            </div>
          )}
          <p className="drop-hint">
            {done
              ? `${target.base} + ${target.add.join(' + ')} = ${target.h}`
              : '오른쪽 보탬글자를 끌어다 놓아 글자를 완성하세요'}
          </p>
        </div>
      )}

      {done && (
        <div className="detail">
          {isSeed && <span className="hz huge">{target.h}</span>}
          <div className="meta">
            <span>{gradeLabel(target.gr)}</span>
            <span>총 {target.st}획</span>
            <span>부수 <b className="hz">{target.rad}</b></span>
          </div>
          {target.w.length > 0 && (
            <ul className="words">
              {target.w.map((word) => (
                <WordBoard key={word[0]} word={word} />
              ))}
            </ul>
          )}
          {target.note && <p className="note">{target.note}</p>}
        </div>
      )}

      {panel &&
        !isSeed &&
        createPortal(
          <div className="tiles">
            {tiles.map((t) => {
              const used = placed.includes(t)
              return (
                <button
                  key={t}
                  className={`tile ${used ? 'used' : ''} ${wrong === t ? 'shake' : ''}`}
                  disabled={used || done}
                  onPointerDown={onPointerDown(t)}
                >
                  <span className={isText(t) ? 'txt' : 'hz'}>{t}</span>
                </button>
              )
            })}
          </div>,
          panel,
        )}

      {drag && (
        <div className="ghost" style={{ left: drag.x, top: drag.y }}>
          <span className={isText(drag.t) ? 'txt' : 'hz'}>{drag.t}</span>
        </div>
      )}
    </div>
  )
}
