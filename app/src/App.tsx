import { useMemo, useState } from 'react'
import raw from './data/hanja.json'
import { GRADES, gradeLabel, type Group, type Hanja } from './types'
import Compose from './Compose'

const groups = raw as Group[]

export default function App() {
  const [grade, setGrade] = useState<string | null>(null)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Hanja | null>(null)

  const group = groups.find((g) => g.g === groupId) ?? null
  const byGrade = (h: Hanja) => !grade || h.gr === grade

  const visible = useMemo(
    () => (group ? group.c : groups.flatMap((g) => g.c)).filter(byGrade),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [group, grade],
  )

  const pickSeed = (g: Group) => {
    setGroupId(g.g === groupId ? null : g.g)
    setSelected(null)
  }
  const pickGrade = (g: string | null) => {
    setGrade(g)
    setSelected(null)
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
        <div className="col-title">씨앗</div>
        <div className="seed-list">
          {groups.map((g) => {
            const has = g.c.some(byGrade)
            return (
              <button
                key={g.g}
                className={`seed ${g.g === groupId ? 'on' : ''} ${has ? '' : 'dim'}`}
                onClick={() => pickSeed(g)}
              >
                <span className="no">{g.g}</span>
                <span className="hz">{g.c[0].h}</span>
              </button>
            )
          })}
        </div>
      </aside>

      <main className="board">
        {selected ? (
          <Compose key={selected.h} target={selected} pool={group ? group.c : visible} onBack={() => setSelected(null)} />
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
            ) : (
              <div className="grid">
                {visible.map((h) => (
                  <button key={h.h} className="card" onClick={() => setSelected(h)}>
                    <span className="hz big">{h.h}</span>
                    <span className="eum">{h.e}</span>
                    <span className="gr">{gradeLabel(h.gr)}</span>
                  </button>
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
        {selected ? (
          <>
            <span className="hz">{selected.h}</span>
            <span className="hun">{selected.hun.join(', ')}</span>
          </>
        ) : (
          <span className="hint">글자를 누르면 뜻과 음이 여기에 나와요</span>
        )}
      </footer>
    </div>
  )
}
