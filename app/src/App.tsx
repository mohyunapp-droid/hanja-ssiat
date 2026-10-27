import { useEffect, useMemo, useState } from 'react'
import { GRADES, gradeLabel, type Group, type HanjaLite } from './types'
import { loadIndex } from './data'
import GroupCompose from './GroupCompose'
import HanjaCard from './HanjaCard'
import Quiz from './Quiz'
import { HINTS_CHANGED, markedWords, type MarkKind } from './hints'

const INITIALS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const TABS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const SINGLE: Record<string, string> = { ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ' }

// "목" → "ㅁ" (된소리는 예사소리로 묶음)
function initialOf(s: string) {
  const code = s.charCodeAt(0) - 0xac00
  if (code < 0 || code > 11171) return ''
  const ini = INITIALS[Math.floor(code / 588)]
  return SINGLE[ini] ?? ini
}

function rowsByEum(seedEum: string, list: HanjaLite[]) {
  const rows = new Map<string, HanjaLite[]>([[seedEum, []]])
  for (const h of list) rows.set(h.e, [...(rows.get(h.e) ?? []), h])
  return [...rows.values()].filter((r) => r.length > 0)
}

export default function App() {
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [grade, setGrade] = useState<string | null>(null)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [selected, setSelected] = useState<HanjaLite | null>(null)
  const [quiz, setQuiz] = useState(false)
  const [initial, setInitial] = useState<string | null>(null)
  const [pickingInitial, setPickingInitial] = useState(false)
  const [showSound, setShowSound] = useState(false)
  const [trail, setTrail] = useState<HanjaLite[]>([]) // 단어 속 한자로 이동해 온 길 (← 이전 글자)

  useEffect(() => {
    loadIndex()
      .then(setGroups)
      .catch(() => setLoadError(true))
  }, [])

  useEffect(() => setShowSound(false), [selected])

  // 고른 씨앗글자가 왼쪽 목록의 가운데에 오도록 목록만 스크롤 (페이지 전체는 움직이지 않음)
  useEffect(() => {
    const list = document.querySelector<HTMLElement>('.seed-list')
    const on = list?.querySelector<HTMLElement>('.seed.on')
    if (!list || !on) return
    const offset = on.getBoundingClientRect().top - list.getBoundingClientRect().top
    const top = list.scrollTop + offset - (list.clientHeight - on.offsetHeight) / 2
    list.scrollTo({ top, behavior: 'smooth' })
  }, [groupId, initial, pickingInitial])

  // 힌트 속 (글자)·<숨은뜻> 목록: 힌트를 고치면 바로 다시 모음
  const loadLists = () => ({ paren: markedWords('paren'), hidden: markedWords('hidden') })
  const [lists, setLists] = useState(loadLists)
  useEffect(() => {
    const update = () => setLists(loadLists())
    window.addEventListener(HINTS_CHANGED, update)
    return () => window.removeEventListener(HINTS_CHANGED, update)
  }, [])
  const [kind, setKind] = useState<MarkKind>('paren') // 아래 영역에서 보고 있는 탭
  const words = lists[kind]

  // 아래 목록의 글자를 누르면 그 글자가 힌트에 들어간 한자만 가운데에 보여줌
  const [word, setWord] = useState<{ kind: MarkKind; w: string } | null>(null)
  const [wordInitial, setWordInitial] = useState<string | null>(null)
  const wordChars = word ? (lists[word.kind].find(([w]) => w === word.w)?.[1] ?? null) : null
  const isPicked = (w: string) => word?.kind === kind && word.w === w
  const shownWords = wordInitial ? words.filter(([w]) => initialOf(w) === wordInitial) : words
  const wordTabs = TABS.filter((t) => words.some(([w]) => initialOf(w) === t))

  const byGrade = (h: HanjaLite) => !grade || h.gr === grade
  const group = groups?.find((g) => g.g === groupId) ?? null

  const visible = useMemo(() => {
    const all = (groups ?? []).flatMap((g) => g.c)
    const list = wordChars ? all.filter((h) => wordChars.includes(h.h)) : group ? group.c : all
    return list.filter(byGrade)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, group, grade, wordChars])

  // 초성을 고르면 그 초성으로 시작하는 씨앗만 음 가나다순, 아니면 번호순
  const seeds = useMemo(() => {
    if (!groups) return []
    if (!initial) return groups
    return groups
      .filter((g) => initialOf(g.c[0].e) === initial)
      .sort((a, b) => a.c[0].e.localeCompare(b.c[0].e, 'ko') || a.g.localeCompare(b.g))
  }, [groups, initial])

  const initialCounts = useMemo(() => {
    const n: Record<string, number> = {}
    for (const g of groups ?? []) {
      const k = initialOf(g.c[0].e)
      n[k] = (n[k] ?? 0) + 1
    }
    return n
  }, [groups])

  if (loadError) return <p className="empty">한자 목록을 불러오지 못했어요. 새로고침해 주세요.</p>
  if (!groups) return <p className="empty">한자 목록을 불러오는 중…</p>

  // 목록에서 한자 유닛을 열거나 닫으면 이동해 온 길은 새로 시작
  const openUnit = (h: HanjaLite | null) => {
    setSelected(h)
    setTrail([])
  }
  const pickSeed = (g: Group) => {
    setGroupId(g.g === groupId && !word ? null : g.g)
    setWord(null)
    openUnit(null)
    setQuiz(false)
  }
  // 같은 글자를 다시 누르면 해제
  const pickWord = (w: string) => {
    setWord(isPicked(w) ? null : { kind, w })
    openUnit(null)
    setQuiz(false)
  }
  const showGroup = group && !wordChars
  const pickGrade = (g: string | null) => {
    setGrade(g)
    openUnit(null)
    setQuiz(false)
  }
  // 전체: 처음 열었을 때처럼 모든 씨앗글자·한자 유닛을 보여줌 (고른 그룹·초성·힌트 글자 모두 해제)
  const resetAll = () => {
    pickGrade(null)
    setGroupId(null)
    setWord(null)
    setWordInitial(null)
    setInitial(null)
    setPickingInitial(false)
    document.querySelector('.board')?.scrollTo({ top: 0 })
    document.querySelector('.seed-list')?.scrollTo({ top: 0 })
  }
  const pickInitial = (i: string | null) => {
    setInitial(i)
    setPickingInitial(false)
  }

  return (
    <div className="app">
      <header className="grades" aria-label="한자급수">
        <button className={!grade ? 'on' : ''} onClick={resetAll}>전체</button>
        {GRADES.map((g) => (
          <button key={g} className={grade === g ? 'on' : ''} onClick={() => pickGrade(g)}>
            {gradeLabel(g)}
          </button>
        ))}
      </header>

      <aside className="seeds" aria-label="씨앗글자">
        <button
          className={`initial-btn ${initial ? 'on' : ''}`}
          onClick={() => setPickingInitial((v) => !v)}
          aria-label="초성으로 찾기"
        >
          {initial ?? '가나다'} ▾
        </button>
        {pickingInitial ? (
          <div className="initial-grid">
            <button className={!initial ? 'on' : ''} onClick={() => pickInitial(null)}>번호순</button>
            {TABS.map((t) => (
              <button
                key={t}
                className={initial === t ? 'on' : ''}
                disabled={!initialCounts[t]}
                onClick={() => pickInitial(t)}
              >
                {t}
              </button>
            ))}
          </div>
        ) : (
          <div className="seed-list">
            {seeds.map((g) => {
              const has = g.c.some(byGrade)
              return (
                <button
                  key={g.g}
                  className={`seed ${g.g === groupId ? 'on' : ''} ${has ? '' : 'dim'}`}
                  onClick={() => pickSeed(g)}
                >
                  <span className="no">{initial ? g.c[0].e : g.g}</span>
                  <span className="hz">{g.c[0].h}</span>
                </button>
              )
            })}
          </div>
        )}
      </aside>

      <main className="board">
        {quiz ? (
          <Quiz groups={groups} onExit={() => setQuiz(false)} />
        ) : selected ? (
          <GroupCompose
            key={selected.h}
            group={groups.find((g) => g.g === selected.g)!}
            h={selected.h}
            onBack={() => {
              // 목록으로 돌아가면 지금 보던 글자가 들어 있는 씨앗글자 그룹을 보여줌
              setGroupId(selected.g)
              setWord(null)
              openUnit(null)
            }}
            onQuiz={() => setQuiz(true)}
            onOpenChar={(ch) => {
              const next = groups.flatMap((g) => g.c).find((c) => c.h === ch)
              if (!next) return
              setTrail((t) => [...t, selected])
              setSelected(next)
              document.querySelector('.board')?.scrollTo({ top: 0 })
            }}
            prevChar={trail.at(-1)?.h}
            onPrev={() => {
              setSelected(trail.at(-1) ?? null)
              setTrail((t) => t.slice(0, -1))
            }}
          />
        ) : (
          <>
            <div className="board-head">
              {wordChars ? (
                <>
                  {word?.kind === 'hidden' ? (
                    <>숨은뜻 <b className="tag hidden-tag">{word.w}</b></>
                  ) : (
                    <>힌트 속 <b className="tag">({word?.w})</b></>
                  )}{' '}
                  글자 {visible.length}자
                  <button className="clear-word" onClick={() => setWord(null)}>✕ 해제</button>
                </>
              ) : group ? (
                <>
                  <span className="tag">{group.g}</span> 씨앗글자 <b className="hz">{group.c[0].h}</b>에서 나온 글자
                </>
              ) : (
                <>{grade ? gradeLabel(grade) : '전체'} 한자 {visible.length}자</>
              )}
            </div>
            {visible.length === 0 ? (
              <p className="empty">이 급수에 해당하는 글자가 없어요.</p>
            ) : showGroup ? (
              // 씨앗글자와 음이 같은 글자는 첫 줄, 음이 다르면 음별로 다음 줄
              <div className="rows">
                {rowsByEum(group.c[0].e, visible).map((row) => (
                  <div key={row[0].e} className="row">
                    {row.map((h) => (
                      <HanjaCard key={h.h} h={h} onOpen={() => openUnit(h)} />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid">
                {visible.map((h) => (
                  <HanjaCard key={h.h} h={h} onOpen={() => openUnit(h)} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <aside className="adds" aria-label="보탬글자" id="add-panel">
        <div className="col-title">보탬</div>
      </aside>

      <footer className="sound" aria-label="한자음">
        {quiz ? (
          <span className="hint">💡 힌트를 적은 한자로 문제를 풀고 있어요</span>
        ) : selected ? (
          <>
            <span className="hz">{selected.h}</span>
            {showSound ? (
              <button className="hun" onClick={() => setShowSound(false)}>
                {selected.hun.join(', ')}
              </button>
            ) : (
              <button className="sound-btn" onClick={() => setShowSound(true)}>
                👁 뜻·음 보기
              </button>
            )}
          </>
        ) : lists.paren.length + lists.hidden.length > 0 ? (
          <div className="hint-words-box">
            {/* (글자) / 숨은뜻 탭 */}
            <div className="kind-tabs" role="tablist">
              {(['paren', 'hidden'] as const).map((k) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={kind === k}
                  className={kind === k ? 'on' : ''}
                  onClick={() => {
                    setKind(k)
                    setWordInitial(null)
                  }}
                >
                  {k === 'paren' ? '(글자)' : '숨은뜻'} <span className="cnt">{lists[k].length}</span>
                </button>
              ))}
            </div>
            {words.length === 0 ? (
              <span className="hint">
                {kind === 'hidden' ? '힌트에 <반드시>처럼 적으면 여기에 모여요' : '힌트에 (목)처럼 적으면 여기에 모여요'}
              </span>
            ) : (
              <>
            {/* 씨앗글자처럼 초성으로 거르기 */}
            <div className="word-tabs" aria-label="초성으로 거르기">
              <button className={!wordInitial ? 'on' : ''} onClick={() => setWordInitial(null)}>전체</button>
              {wordTabs.map((t) => (
                <button key={t} className={wordInitial === t ? 'on' : ''} onClick={() => setWordInitial(t)}>
                  {t}
                </button>
              ))}
            </div>
            <ul className={`hint-words ${kind}`} aria-label={kind === 'hidden' ? '숨은뜻 목록' : '힌트 속 (글자) 목록'}>
              {shownWords.map(([w, chars]) => (
                <li key={w}>
                  <button className={isPicked(w) ? 'on' : ''} onClick={() => pickWord(w)}>
                    {w} <span className="cnt">{chars.length}</span>
                  </button>
                </li>
              ))}
            </ul>
              </>
            )}
          </div>
        ) : (
          <span className="hint">글자를 누르면 뜻과 음을 볼 수 있어요</span>
        )}
      </footer>
    </div>
  )
}
