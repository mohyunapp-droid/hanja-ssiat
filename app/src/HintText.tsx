// 힌트 글: <반드시>처럼 적은 숨은뜻은 꺾쇠를 떼고 색을 달리해 굵게 보여줌
export default function HintText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/<([^<>]+)>/)
  return (
    <span className={className}>
      {parts.map((p, i) => (i % 2 ? <b key={i} className="hint-hidden">{p}</b> : p))}
    </span>
  )
}
