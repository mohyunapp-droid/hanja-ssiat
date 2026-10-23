import { useEffect, useState } from 'react'
import Compose from './Compose'
import { loadGroup } from './data'
import type { Group, Hanja } from './types'

interface Props {
  group: Group
  h: string
  onBack?: () => void
  onQuiz?: () => void
  onSolved?: () => void
  onMiss?: () => void
  onOpenChar?: (ch: string) => void
  prevChar?: string
  onPrev?: () => void
}

// 조합 화면에 필요한 상세 정보를 불러온 뒤 Compose 를 띄움
export default function GroupCompose({ group, h, ...rest }: Props) {
  const [chars, setChars] = useState<Hanja[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    setChars(null)
    setError(false)
    loadGroup(group)
      .then((c) => alive && setChars(c))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [group])

  if (error) return <p className="empty">불러오지 못했어요. 인터넷 연결을 확인해 주세요.</p>
  const target = chars?.find((c) => c.h === h)
  if (!chars || !target) return <p className="empty">불러오는 중…</p>
  return <Compose key={h} target={target} pool={chars} {...rest} />
}
