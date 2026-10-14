import { useEffect, useRef, useState } from 'react'

// 완성한 글자를 손가락·펜으로 직접 써 보는 칸. 점선 한자를 켜면 따라 쓸 수 있음
export default function WritePad({ ch }: { ch: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [guide, setGuide] = useState(false)

  // 화면 크기와 선명도(devicePixelRatio)에 맞춰 캔버스 준비
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    const ctx = canvas.getContext('2d')!
    ctx.scale(ratio, ratio)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(6, width / 28)
    ctx.strokeStyle = getComputedStyle(canvas).color
  }, [ch])

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget
    const ctx = canvas.getContext('2d')!
    const r = canvas.getBoundingClientRect()
    try {
      canvas.setPointerCapture(e.pointerId) // 칸 밖으로 나가도 계속 그려지게
    } catch {
      /* 지원하지 않는 환경은 무시 */
    }
    ctx.beginPath()
    ctx.moveTo(e.clientX - r.left, e.clientY - r.top)
    ctx.lineTo(e.clientX - r.left + 0.1, e.clientY - r.top) // 점 하나만 찍어도 보이게
    ctx.stroke()

    const move = (ev: PointerEvent) => {
      ctx.lineTo(ev.clientX - r.left, ev.clientY - r.top)
      ctx.stroke()
    }
    const up = () => {
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
    }
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
  }

  return (
    <div className="writepad">
      <div className="writepad-box">
        {guide && (
          <svg className="writepad-guide" viewBox="0 0 100 100" aria-hidden="true">
            <text x="50" y="52" textAnchor="middle" dominantBaseline="central" className="hz">
              {ch}
            </text>
          </svg>
        )}
        <canvas ref={canvasRef} onPointerDown={onPointerDown} aria-label={`${ch} 따라 쓰기`} />
      </div>
      <button className={`writepad-btn ${guide ? 'on' : ''}`} onClick={() => setGuide((v) => !v)}>
        {guide ? '점선 한자 숨기기' : '점선 한자 보기'}
      </button>
    </div>
  )
}
