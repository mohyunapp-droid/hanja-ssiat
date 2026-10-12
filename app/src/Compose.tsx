import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { gradeLabel, type Hanja, type Pos, type Word } from './types'

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
    <li className="word-board" role="button" tabIndex={0} onClick={flip} onKeyDown={(e) => e.key === 'Enter' && flip()}>
      <span className="hz">{w}</span>
      <span className={`rd ${shown ? '' : 'hidden'} ${spinning ? 'spin' : ''}`}>{shown ? r : '?'}</span>
      <span className="mn">{m}</span>
    </li>
  )
}

const POS_LABEL: Record<Pos, string> = { t: '위', b: '아래', l: '왼쪽', r: '오른쪽', w: '감싸기' }

export default function Compose({ target, pool, onBack }: { target: Hanja; pool: Hanja[]; onBack: () => void }) {
  const tiles = useMemo(() => makeTiles(target, pool), [target, pool])
  // 정답 자리 + 비어 있는 위·아래·좌·우는 함정 칸(part: null)으로 채워 항상 4칸을 보여줌
  const slots: { part: string | null; pos: Pos }[] = target.add.map((part, i) => ({ part, pos: target.pos[i] ?? 't' }))
  for (const p of ['t', 'b', 'l', 'r'] as const) if (!slots.some((s) => s.pos === p)) slots.push({ part: null, pos: p })
  const [placed, setPlaced] = useState<(string | null)[]>(() => slots.map(() => null))
  const [phase, setPhase] = useState<'play' | 'merge' | 'done'>(target.base ? 'play' : 'done')
  const [wrong, setWrong] = useState<{ tile: string; slot: number | null } | null>(null)
  const [picked, setPicked] = useState<string | null>(null) // 탭 방식: 보탬글자를 고른 뒤 자리를 탭
  const [drag, setDrag] = useState<{ t: string; x: number; y: number } | null>(null)
  const [panel, setPanel] = useState<HTMLElement | null>(null)

  useEffect(() => setPanel(document.getElementById('add-panel')), [])

  const isSeed = !target.base
  const done = phase === 'done'

  const place = (t: string, i: number) => {
    if (phase !== 'play' || placed[i]) return
    if (slots[i].part !== t) {
      setWrong({ tile: t, slot: i })
      setTimeout(() => setWrong(null), 450)
      return
    }
    const next = placed.map((p, k) => (k === i ? t : p))
    setPlaced(next)
    setPicked(null)
    if (slots.every((s, k) => !s.part || next[k])) {
      setTimeout(() => setPhase('merge'), 250)
      setTimeout(() => setPhase('done'), 950)
    }
  }

  const onPointerDown = (t: string) => (e: React.PointerEvent) => {
    e.preventDefault()
    const start = { x: e.clientX, y: e.clientY }
    let moved = false
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) moved = true
      if (moved) setDrag({ t, x: ev.clientX, y: ev.clientY })
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDrag(null)
      if (!moved) {
        setPicked((p) => (p === t ? null : t))
        return
      }
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-slot]')
      if (el) place(t, Number(el.dataset.slot))
      else {
        setWrong({ tile: t, slot: null })
        setTimeout(() => setWrong(null), 450)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const slotEl = (i: number) => {
    const s = slots[i]
    const p = placed[i]
    return (
      <div
        key={i}
        data-slot={i}
        className={`slot pos-${s.pos} ${p ? 'filled' : ''} ${wrong?.slot === i ? 'shake' : ''} ${picked && !p ? 'ready' : ''} ${phase === 'merge' ? 'merge' : ''}`}
        onClick={() => picked && place(picked, i)}
      >
        {p ? <span className={isText(p) ? 'txt' : 'hz'}>{p}</span> : '?'}
        <span className="slot-label">{POS_LABEL[s.pos]}</span>
      </div>
    )
  }
  const wrapIdx = slots.findIndex((s) => s.pos === 'w')

  return (
    <div className="compose">
      <button className="back" onClick={onBack}>← 목록</button>

      {!isSeed && (
        <div className={`drop ${drag ? 'armed' : ''} ${done ? 'done' : ''}`}>
          {done ? (
            <span className="hz huge pop">{target.h}</span>
          ) : (
            <div className="cross">
              {slots.map((s, i) => (s.pos === 'w' ? null : slotEl(i)))}
              <div className={`center ${phase === 'merge' ? 'merge' : ''}`}>
                <span className="hz huge base">{target.base}</span>
                {wrapIdx >= 0 && slotEl(wrapIdx)}
              </div>
            </div>
          )}
          <p className="drop-hint">
            {done
              ? `${target.base} + ${target.add.join(' + ')} = ${target.h}`
              : picked
                ? `'${picked}'를 놓을 자리를 누르세요`
                : '보탬글자를 알맞은 자리에 끌어다 놓으세요'}
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
                  className={`tile ${used ? 'used' : ''} ${picked === t ? 'picked' : ''} ${wrong?.tile === t ? 'shake' : ''}`}
                  disabled={used || phase !== 'play'}
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
