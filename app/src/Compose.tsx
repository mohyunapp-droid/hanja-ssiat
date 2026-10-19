import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import WritePad from './WritePad'
import { loadCharMap, type CharInfo } from './data'
import { gradeLabel, type Hanja, type Idiom, type Pair, type Pos, type Word } from './types'

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

// 사자성어·유의어 등 이 글자가 들어간 단어 목록. 많으면 3개만 보이고 더보기
function IdiomList({ title, list }: { title: string; list: (Word | Idiom)[] }) {
  const [all, setAll] = useState(false)
  const shown = all ? list : list.slice(0, 3)
  return (
    <div className="idioms">
      <h3 className="idioms-title">
        {title} <span>{list.length}</span>
      </h3>
      <ul className="words">
        {shown.map(([w, r, m, gr]) => (
          <WordBoard key={w} word={[w, r, m]} grade={gr} />
        ))}
      </ul>
      {list.length > 3 && (
        <button className="more-btn" onClick={() => setAll((v) => !v)}>
          {all ? '접기' : `더보기 (${list.length - 3})`}
        </button>
      )}
    </div>
  )
}

// 단어 속 다른 글자의 짜임(씨앗글자·보탬글자) 풀이에 필요한 정보
const WordCtx = createContext<{
  target: string
  chars: Map<string, CharInfo>
  parts: Record<string, [string, string]>
  hun: Record<string, string> // 1급 책에 없는 글자의 훈음
} | null>(null)
const isHanChar = (ch: string) => /\p{Script=Han}/u.test(ch)
const short = (hun: string[]) => hun[0] ?? ''

// 보탬글자 이름: 앱 한자면 훈음, 아니면 parts.json 의 이름. (人人戈)는 한 글자씩
function partName(tile: string, ctx: NonNullable<React.ContextType<typeof WordCtx>>) {
  return [...new Set(tile.replace(/[()]/g, ''))]
    .filter(isHanChar)
    .map((ch) => `${ch} ${ctx.parts[ch]?.[0] ?? (short(ctx.chars.get(ch)?.hun ?? []) || ctx.hun[ch] || '')}`.trim())
    .join(' + ')
}

function WordParts({ word }: { word: string }) {
  const ctx = useContext(WordCtx)
  if (!ctx) return null
  const others = [...new Set(word)].filter((ch) => isHanChar(ch) && ch !== ctx.target && (ctx.chars.has(ch) || ctx.hun[ch]))
  if (!others.length) return null
  return (
    <ul className="wb-parts">
      {others.map((ch) => {
        const c = ctx.chars.get(ch)
        if (!c)
          return (
            <li key={ch}>
              <span className="hz">{ch}</span> <b>{ctx.hun[ch]}</b>
            </li>
          )
        const seed = c.seed.h === ch ? null : c.seed
        return (
          <li key={ch}>
            <span className="hz">{ch}</span> <b>{short(c.hun)}</b>
            {seed ? (
              <span className="wb-line">
                씨앗 <span className="hz">{seed.h}</span> {short(seed.hun)}
                {c.a?.length ? <> · 보탬 {c.a.map((t) => partName(t, ctx)).join(', ')}</> : null}
              </span>
            ) : (
              <span className="wb-line">씨앗글자</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// 예시 단어: 읽기를 ?로 가려두고, 누르면 보드가 한 바퀴 돌며 읽기가 나타남
function WordBoard({ word: [w, r, m], grade }: { word: Word; grade?: string }) {
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
      {(m || shown) && (
        <div className="wb-side">
          {m && <span className="mn">{m}</span>}
          {shown && <WordParts word={w} />}
        </div>
      )}
      {grade && <span className="idiom-gr">{gradeLabel(grade)}</span>}
    </li>
  )
}

// 짝 단어: 두 단어의 뜻을 한 줄씩 ("寄與: …" 다음 줄 "貢獻: …")
const pairWords = (list: Pair[], sign: string) =>
  list.map(
    ([a, ra, b, rb, ma, mb]) =>
      [`${a} ${sign} ${b}`, `${ra} ${sign} ${rb}`, [ma && `${a}: ${ma}`, mb && `${b}: ${mb}`].filter(Boolean).join('\n')] as Word,
  )
const PAIR_LISTS = [
  ['pr', '뜻이 비슷한 단어', '≈'],
  ['op', '뜻이 반대인 단어', '↔'],
  ['ho', '음이 같은 단어', '='],
] as const
const EXTRA_LISTS = [
  [['다음'], '여러 음으로 읽는 단어'],
  [['속음'], '속음 (본래 음과 다르게 읽는 말)'],
  [['장음', '단음'], '장단음 (길게·짧게 읽는 말)'],
] as const

// 자리 이름: 위=머리, 아래=발, 왼쪽=변, 오른쪽=방, 감싸면=몸
const POS_LABEL: Record<Pos, string> = { t: '머리', b: '발', l: '변', r: '방', w: '감싸기·몸' }

// 보탬글자 설명 (public/data/parts.json) — 길게 누르면 보여줌
let partsCache: Promise<Record<string, [string, string]>> | null = null
const loadParts = () => {
  partsCache ??= fetch(`${import.meta.env.BASE_URL}data/parts.json`).then((r) => r.json())
  partsCache.catch(() => (partsCache = null))
  return partsCache
}

let hunCache: Promise<Record<string, string>> | null = null
const loadExtraHun = () => {
  hunCache ??= fetch(`${import.meta.env.BASE_URL}data/hun.json`).then((r) => r.json())
  hunCache.catch(() => (hunCache = null))
  return hunCache
}

function PartInfo({ tile, onClose }: { tile: string; onClose: () => void }) {
  const [parts, setParts] = useState<Record<string, [string, string]> | null>(null)
  useEffect(() => {
    loadParts().then(setParts, () => setParts({}))
  }, [])
  // (人人戈)처럼 묶인 보탬글자는 한 글자씩 풀어서 설명 (같은 글자는 한 번만)
  const chars = [...new Set(tile.replace(/[()]/g, ''))]
  return createPortal(
    <div className="part-info-backdrop" onPointerDown={onClose}>
      <div className="part-info" role="dialog">
        <div className="part-info-head">
          <span className={isText(tile) ? 'txt' : 'hz'}>{tile}</span>
          <span className="muted">보탬글자</span>
        </div>
        {chars.map((ch) => {
          const info = parts?.[ch]
          return (
            <div key={ch} className="part-info-row">
              <span className="hz">{ch}</span>
              <div>
                <b>{info ? info[0] : parts ? '획·부분' : '…'}</b>
                {info?.[1] && <p>{info[1]}</p>}
              </div>
            </div>
          )
        })}
        <p className="part-info-foot">눌러서 닫기</p>
      </div>
    </div>,
    document.body,
  )
}

const LONG_PRESS = 450 // ms

interface Props {
  target: Hanja
  pool: Hanja[]
  onBack?: () => void
  onQuiz?: () => void
  onSolved?: () => void // 문제풀기 모드: 완성되면 호출, 상세 정보는 숨김
  onMiss?: () => void
}

export default function Compose({ target, pool, onBack, onQuiz, onSolved, onMiss }: Props) {
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
  const [info, setInfo] = useState<string | null>(null) // 길게 눌러 설명을 보는 보탬글자
  const [chars, setChars] = useState<Map<string, CharInfo> | null>(null)
  const [partsMap, setPartsMap] = useState<Record<string, [string, string]>>({})
  const [extraHun, setExtraHun] = useState<Record<string, string>>({})
  useEffect(() => {
    if (onSolved) return // 문제풀기에서는 상세 정보를 보여주지 않음
    loadCharMap().then(setChars, () => {})
    loadParts().then(setPartsMap, () => {})
    loadExtraHun().then(setExtraHun, () => {})
  }, [onSolved])
  const wordCtx = useMemo(
    () => (chars ? { target: target.h, chars, parts: partsMap, hun: extraHun } : null),
    [chars, partsMap, extraHun, target.h],
  )

  useEffect(() => setPanel(document.getElementById('add-panel')), [])

  const isSeed = !target.base
  const done = phase === 'done'

  const place = (t: string, i: number) => {
    if (phase !== 'play' || placed[i]) return
    if (slots[i].part !== t) {
      onMiss?.()
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
      if (onSolved) setTimeout(onSolved, 1600)
    }
  }

  const onPointerDown = (t: string) => (e: React.PointerEvent) => {
    e.preventDefault()
    const start = { x: e.clientX, y: e.clientY }
    let moved = false
    let long = false
    const timer = setTimeout(() => {
      long = true
      setInfo(t)
    }, LONG_PRESS)
    const move = (ev: PointerEvent) => {
      if (long) return
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) {
        moved = true
        clearTimeout(timer)
      }
      if (moved) setDrag({ t, x: ev.clientX, y: ev.clientY })
    }
    const up = (ev: PointerEvent) => {
      clearTimeout(timer)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDrag(null)
      if (long) return // 길게 누른 것은 고르기·놓기로 치지 않음
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
      {!onSolved && (
        <div className="compose-top">
          <button className="back" onClick={onBack}>← 목록</button>
          <button className="quiz-btn" onClick={onQuiz}>✏️ 문제풀기</button>
        </div>
      )}

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
                : '보탬글자를 알맞은 자리에 끌어다 놓으세요 · 길게 누르면 설명'}
          </p>
        </div>
      )}

      {done && !onSolved && (
        <WordCtx.Provider value={wordCtx}>
        <div className="detail">
          {isSeed && <span className="hz huge">{target.h}</span>}
          <WritePad ch={target.h} />
          <div className="meta">
            <span>{gradeLabel(target.gr)}</span>
            <span>총 {target.st}획</span>
            <span>부수 <b className="hz">{target.rad}</b></span>
            {target.ab && <span>약자 <b className="hz">{target.ab.join(' ')}</b></span>}
          </div>
          {target.w.length > 0 && (
            <ul className="words">
              {target.w.map((word) => (
                <WordBoard key={word[0]} word={word} />
              ))}
            </ul>
          )}
          {target.id && target.id.length > 0 && <IdiomList title="사자성어" list={target.id} />}
          {target.sy && target.sy.length > 0 && (
            <IdiomList title="유의어 (비슷한 뜻의 글자로 된 단어)" list={target.sy.map(([w, r, m]) => [w, r, m ?? ''] as Word)} />
          )}
          {target.an && target.an.length > 0 && (
            <IdiomList title="상대어 (반대 뜻의 글자로 된 단어)" list={target.an.map(([w, r, m]) => [w, r, m ?? ''] as Word)} />
          )}
          {PAIR_LISTS.map(([key, title, sign]) => {
            const list = target[key]
            return list && list.length > 0 ? <IdiomList key={key} title={title} list={pairWords(list, sign)} /> : null
          })}
          {EXTRA_LISTS.map(([kinds, title]) => {
            const list = (target.ex ?? []).filter(([k]) => (kinds as readonly string[]).includes(k))
            return list.length > 0 ? (
              <IdiomList key={title} title={title} list={list.map(([k, w, r]) => [w, r, kinds.length > 1 ? k : ''] as Word)} />
            ) : null
          })}
          {target.note && <p className="note">{target.note}</p>}
        </div>
        </WordCtx.Provider>
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
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <span className={isText(t) ? 'txt' : 'hz'}>{t}</span>
                </button>
              )
            })}
          </div>,
          panel,
        )}

      {info && <PartInfo tile={info} onClose={() => setInfo(null)} />}

      {drag && (
        <div className="ghost" style={{ left: drag.x, top: drag.y }}>
          <span className={isText(drag.t) ? 'txt' : 'hz'}>{drag.t}</span>
        </div>
      )}
    </div>
  )
}
