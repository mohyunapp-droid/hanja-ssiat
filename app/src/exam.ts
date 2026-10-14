// 1급 기출문제 (public/data/exam.json, scripts/build-data.mjs 가 data/exam 에서 생성)
// [회, 번호, 유형, 문제, 정답, 문제에 딸린 오답 후보, 다른 문제의 정답으로 만든 오답 후보]
export type ExamQ = [round: number, no: string, type: string, prompt: string, answer: string, wrong: string[], others: string[]]

let cache: Promise<{ qs: ExamQ[]; by: Record<string, number[]> }> | null = null

export function loadExam() {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/exam.json`).then((r) => {
    if (!r.ok) throw new Error(String(r.status))
    return r.json()
  })
  cache.catch(() => (cache = null))
  return cache
}

export const EXAM_GUIDE: Record<string, string> = {
  읽기: '한자어의 읽는 소리는?',
  뜻: '한자어의 뜻은?',
  전의: '글자 그대로가 아닌, 바뀐 뜻은?',
  유의어: '뜻이 같거나 비슷한 한자어는?',
  반의어: '뜻이 반대인 한자어는?',
  반의결합: '반대 뜻의 글자끼리 이루어진 한자어는?',
  유의결합: '같은 뜻의 글자끼리 이루어진 한자어는?',
  훈음: '한자의 훈과 음은?',
  부수: '한자의 부수는?',
  쓰기: '밑줄 친 말을 한자로 쓰면?',
  장음: '첫소리를 길게 읽는 것은?',
  훈음단어: '훈과 음으로 이어진 단어는?',
  동음: '밑줄 친 말에 알맞은 한자는?',
  약자: '정자는 약자로, 약자는 정자로 쓰면?',
  유의자: '( )에 들어갈 뜻이 같은 한자는?',
  반의자: '( )에 들어갈 반대 뜻의 한자는?',
  성어: '( )에 들어갈 한자는?',
  구조: '글자끼리 이어진 관계가 다른 하나는?',
  뜻한자어: '뜻풀이에 맞는 한자어는?',
  뜻글자: '밑줄 친 뜻에 맞는 한자는?',
}
