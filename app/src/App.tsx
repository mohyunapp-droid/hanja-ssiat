import { useEffect, useMemo, useState } from 'react'
import { GRADES, gradeLabel, type Group, type HanjaLite } from './types'
import { loadIndex } from './data'
import GroupCompose from './GroupCompose'
import HanjaCard from './HanjaCard'
import Quiz from './Quiz'
import { bracketWords, HINTS_CHANGED } from './hints'

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

  useEffect(() => {
    loadIndex()
      .then(setGroups)
      .catch(() => setLoadError(true))
  }, [])

  useEffect(() => setShowSound(false), [selected])

  // 힌트 속 (글자) 목록: 힌트를 고치면 바로 다시 모음
  const [words, setWords] = useState(bracketWords)
  useEffect(() => {
    const update = () => setWords(bracketWords())
    window.addEventListener(HINTS_CHANGED, update)
    return () => window.removeEventListener(HINTS_CHANGED, update)
  }, [])

  const byGrade = (h: HanjaLite) => !grade || h.gr === grade
  const group = groups?.find((g) => g.g === groupId) ?? null

  const visible = useMemo(
    () => (group ? group.c : (groups ?? []).flatMap((g) => g.c)).filter(byGrade),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, group, grade],
  )

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

  const pickSeed = (g: Group) => {
    setGroupId(g.g === groupId ? null : g.g)
    setSelected(null)
    setQuiz(false)
  }
  const pickGrade = (g: string | null) => {
    setGrade(g)
    setSelected(null)
    setQuiz(false)
  }
  const pickInitial = (i: string | null) => {
    setInitial(i)
    setPickingInitial(false)
  }

  return (
    <div className="app">
      <header className="grades" aria-label="한자급수">
        <button className={!grade ? 'on' : ''} onClick={() => pickGrade(null)}>전체</button>
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
            onBack={() => setSelected(null)}
            onQuiz={() => setQuiz(true)}
          />
        ) : (
          <>
            <div className="board-head">
              {group ? (
                <>
                  <span className="tag">{group.g}</span> 씨앗글자 <b className="hz">{group.c[0].h}</b>에서 나온 글자
                </>
              ) : (
                <>{grade ? gradeLabel(grade) : '전체'} 한자 {visible.length}자</>
              )}
            </div>
            {visible.length === 0 ? (
              <p className="empty">이 급수에 해당하는 글자가 없어요.</p>
            ) : group ? (
              // 씨앗글자와 음이 같은 글자는 첫 줄, 음이 다르면 음별로 다음 줄
              <div className="rows">
                {rowsByEum(group.c[0].e, visible).map((row) => (
                  <div key={row[0].e} className="row">
                    {row.map((h) => (
                      <HanjaCard key={h.h} h={h} onOpen={() => setSelected(h)} />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid">
                {visible.map((h) => (
                  <HanjaCard key={h.h} h={h} onOpen={() => setSelected(h)} />
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
        ) : words.length > 0 ? (
          <ul className="hint-words" aria-label="힌트 속 (글자) 목록">
            {words.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : (
          <span className="hint">글자를 누르면 뜻과 음을 볼 수 있어요</span>
        )}
      </footer>
    </div>
  )
}
