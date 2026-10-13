// 위, 아래, 왼쪽, 오른쪽, 감싸기(囗·辶·广·門처럼 기준글자를 둘러쌈)
export type Pos = 't' | 'b' | 'l' | 'r' | 'w'

export type Word =[word: string, reading: string, meaning: string]

// 목록·급수·퀴즈에 쓰는 가벼운 정보 (index.json)
export interface HanjaLite {
  h: string // 한자
  e: string // 음
  e2?: string // 다른 음
  hun: string[] // 훈음 (예: "편안할 안")
  gr: string // 급수: "8" … "4II" … "1"
  base?: string // 기준글자 (씨앗이면 없음)
  g: string // 속한 그룹 번호 (불러올 때 채움)
}

// 조합 화면에서 필요할 때 불러오는 상세 정보 (d/NN.json)
export interface Hanja extends Omit<HanjaLite, 'base'> {
  st: number // 총획
  rad: string // 부수
  base: string | null // 기준글자 (씨앗이면 null)
  add: string[] // 보탬글자
  pos: Pos[] // 보탬글자 위치 (add와 같은 순서)
  w: Word[] // 예시 단어
  note?: string
}

export interface Group {
  g: string // 그룹 번호 "001"
  c: HanjaLite[] // 첫 글자가 씨앗글자
}

export const GRADES = ['8', '7', '6', '5', '4II', '4', '3II', '3', '2', '1'] as const

// '외'는 급수 시험 범위 밖의 글자(제외자)
export const gradeLabel = (g: string) => (g === '외' ? '급외' : g.replace('II', 'Ⅱ') + '급')
