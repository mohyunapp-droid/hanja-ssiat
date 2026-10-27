import { useEffect, useMemo, useState } from 'react'
import { loadExam, EXAM_GUIDE, type ExamQ } from './exam'
import GroupCompose from './GroupCompose'
import HintText from './HintText'
import { hintedChars, loadHint } from './hints'
import type { Group, HanjaLite as Hanja } from './types'

type Step = 'compose' | 'eum' | 'meaning' | 'exam'
const EXAM_PER_CHAR = 2 // 한 글자에 붙이는 기출문제 수 (많으면 무작위로 고름)
type Miss = Record<string, Step[]> // 한자별로 처음에 틀린 단계

const shuffle = <T,>(a: T[]) => {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

// "잠잘 매" → "잠잘"
const meaningsOf = (h: Hanja) => h.hun.map((x) => x.slice(0, x.lastIndexOf(' ')).trim())

const EUM_FILL = ['가', '고', '나', '대', '사', '수', '아', '자', '정', '하']

function options(answer: string, candidates: string[], exclude: string[]) {
  const wrong = shuffle([...new Set(candidates)].filter((c) => !exclude.includes(c)))
  return shuffle([answer, ...wrong.slice(0, 3)])
}

function makeQuestions(all: Hanja[]) {
  const hinted = hintedChars()
  const list = shuffle(all.filter((h) => hinted.has(h.h)))
  return list.slice(0, Math.floor(list.length / 3) * 3)
}

export default function Quiz({ groups, onExit }: { groups: Group[]; onExit: () => void }) {
  const all = useMemo(() => groups.flatMap((g) => g.c), [groups])
  const [round, setRound] = useState(0)
  const [questions, setQuestions] = useState(() => makeQuestions(groups.flatMap((g) => g.c)))
  const [idx, setIdx] = useState(0)
  const [step, setStep] = useState<Step>(() => firstStep(questions[0]))
  const [miss, setMiss] = useState<Miss>({})
  const [picked, setPicked] = useState<{ v: string; ok: boolean } | null>(null)
  const [finished, setFinished] = useState(false)
  const [exam, setExam] = useState<Awaited<ReturnType<typeof loadExam>> | null>(null)
  const [examIdx, setExamIdx] = useState(0)

  useEffect(() => {
    loadExam().then(setExam, () => setExam({ qs: [], by: {} })) // 못 불러오면 기출 단계 없이 진행
  }, [])

  const q = questions[idx]
  // 이 한자가 들어간 기출문제 (글자마다 최대 EXAM_PER_CHAR개, 다시 풀 때마다 새로 고름)
  const examQs: ExamQ[] = useMemo(
    () => (q && exam ? shuffle(exam.by[q.h] ?? []).slice(0, EXAM_PER_CHAR).map((i) => exam.qs[i]) : []),
    [q, exam, round],
  )
  const eq = step === 'exam' ? examQs[examIdx] : undefined

  const choices = useMemo(() => {
    if (!q) return []
    if (step === 'eum')
      return options(q.e, [...all.map((h) => h.e), ...EUM_FILL], [q.e, q.e2 ?? ''])
    if (step === 'meaning')
      return options(meaningsOf(q)[0], all.flatMap(meaningsOf), meaningsOf(q))
    if (eq) {
      const [, , , , a, x, o] = eq
      const wrong = [...new Set([...shuffle(x), ...shuffle(o)])].filter((v) => v !== a).slice(0, 3)
      return shuffle([a, ...wrong])
    }
    return []
  }, [q, step, all, eq])

  const hinted = hintedChars().size

  if (questions.length === 0) {
    return (
      <div className="quiz">
        <div className="quiz-empty">
          <p>💡 힌트를 적은 한자가 3개 이상 있어야 문제를 풀 수 있어요.</p>
          <p className="muted">지금 힌트를 적은 한자: {hinted}개</p>
          <button className="primary" onClick={onExit}>돌아가기</button>
        </div>
      </div>
    )
  }

  const markMiss = (s: Step) =>
    setMiss((m) => (m[q.h]?.includes(s) ? m : { ...m, [q.h]: [...(m[q.h] ?? []), s] }))

  const next = () => {
    setPicked(null)
    if (step === 'compose') return setStep('eum')
    if (step === 'eum') return setStep('meaning')
    if (step === 'meaning' && examQs.length) {
      setExamIdx(0)
      return setStep('exam')
    }
    if (step === 'exam' && examIdx + 1 < examQs.length) return setExamIdx(examIdx + 1)
    if (idx + 1 >= questions.length) return setFinished(true)
    setIdx(idx + 1)
    setExamIdx(0)
    setStep(firstStep(questions[idx + 1]))
  }

  const choose = (v: string) => {
    if (picked?.ok) return
    const ok = step === 'eum' ? v === q.e : step === 'exam' ? v === eq?.[4] : v === meaningsOf(q)[0]
    setPicked({ v, ok })
    if (ok) setTimeout(next, 700)
    else markMiss(step)
  }

  const restart = () => {
    const qs = makeQuestions(all)
    setQuestions(qs)
    setStep(firstStep(qs[0]))
    setRound((r) => r + 1)
    setIdx(0)
    setExamIdx(0)
    setMiss({})
    setFinished(false)
    setPicked(null)
  }

  if (finished) {
    const total = questions.length
    const perfect = questions.filter((h) => !miss[h.h]).length
    return (
      <div className="quiz">
        <div className="quiz-result">
          <div className="score">
            <b>{perfect}</b> / {total}
          </div>
          <p className="muted">한 번에 모두 맞힌 한자</p>
          {perfect < total && (
            <ul className="miss-list">
              {questions
                .filter((h) => miss[h.h])
                .map((h) => (
                  <li key={h.h}>
                    <span className="hz">{h.h}</span>
                    <span>{h.hun.join(', ')}</span>
                    <span className="muted">
                      {miss[h.h].map((s) => ({ compose: '조합', eum: '음', meaning: '뜻', exam: '기출' })[s]).join('·')} 틀림
                    </span>
                  </li>
                ))}
            </ul>
          )}
          <div className="quiz-actions">
            <button className="primary" onClick={restart}>다시 풀기</button>
            <button onClick={onExit}>돌아가기</button>
          </div>
        </div>
      </div>
    )
  }

  const stepLabel = { compose: '', eum: '음을 고르세요', meaning: '뜻을 고르세요', exam: '' }[step] // 조합 안내는 조합 칸 아래에 이미 있음

  return (
    <div className="quiz">
      <div className="quiz-top">
        <button className="back" onClick={onExit}>✕ 그만</button>
        <span className="progress">
          {idx + 1} / {questions.length}
        </span>
        <span className="quiz-top-spacer" />
      </div>
      <div className="progress-bar">
        <span style={{ width: `${(idx / questions.length) * 100}%` }} />
      </div>
      <p className="quiz-hint">💡 <HintText text={loadHint(q.h)} /></p>
      {stepLabel && <p className="step-label">{stepLabel}</p>}

      {step === 'compose' ? (
        <GroupCompose
          key={`${round}-${q.h}`}
          group={groups.find((g) => g.g === q.g)!}
          h={q.h}
          onSolved={next}
          onMiss={() => markMiss('compose')}
        />
      ) : (
        <>
          {eq ? (
            <div className="exam-q">
              <p className="exam-tag">
                기출 {eq[0]}회 {eq[1]}번 · {examIdx + 1}/{examQs.length}
              </p>
              <p className="exam-guide">{EXAM_GUIDE[eq[2]]}</p>
              {eq[3] && <ExamPrompt text={eq[3]} />}
            </div>
          ) : (
            <>
              <div className="quiz-char hz">{q.h}</div>
              {step === 'meaning' && <p className="muted center-text">음: {q.e}</p>}
            </>
          )}
          <div className="choices">
            {choices.map((c) => (
              <button
                key={`${step}-${examIdx}-${c}`}
                className={`choice ${eq ? 'exam-choice' : ''} ${picked?.v === c ? (picked.ok ? 'ok' : 'no') : ''}`}
                onClick={() => choose(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// 문제 글: [ ]로 감싼 부분은 밑줄 친 말
function ExamPrompt({ text }: { text: string }) {
  const parts = text.split(/\[(.+?)\]/)
  return (
    <p className={`exam-prompt ${text.length <= 12 ? 'short' : ''}`}>
      {parts.map((p, i) => (i % 2 ? <u key={i}>{p}</u> : <span key={i}>{p}</span>))}
    </p>
  )
}

function firstStep(h: Hanja | undefined): Step {
  return h?.base ? 'compose' : 'eum'
}
