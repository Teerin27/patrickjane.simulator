import { useEffect, useState } from 'react'

/** Typewriter reveal. Hidden text keeps its space so the bubble doesn't reflow. */
export default function Typer({ text, run, onDone, onTick }: { text: string; run: boolean; onDone: () => void; onTick: () => void }) {
  const [n, setN] = useState(run ? 0 : text.length)
  useEffect(() => {
    if (!run) return
    const id = setInterval(() => setN((v) => (v < text.length ? v + 1 : v)), 30)
    return () => clearInterval(id)
  }, [run, text])
  useEffect(() => {
    onTick()
    if (run && n >= text.length) onDone()
  }, [n]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {text.slice(0, n)}
      <span className="invisible">{text.slice(n)}</span>
    </>
  )
}
