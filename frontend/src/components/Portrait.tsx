import { useEffect, useRef, useState } from 'react'
import { W, renderPortrait, type Appearance, type Mood } from '../lib/pixel'

// bare: transparent background, for seating the figure in another scene (the interrogation room)
// look: how a suspect from a generated case is drawn (the three sample suspects have hand-drawn portraits)
export default function Portrait({
  who,
  look,
  mood,
  size = 64,
  animate = true,
  bare = false,
  className = '',
}: {
  who: string
  look?: Appearance
  mood: Mood
  size?: number
  animate?: boolean
  bare?: boolean
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [t, setT] = useState(0)

  useEffect(() => {
    if (!animate) return
    const id = setInterval(() => setT((v) => v + 1), 250)
    return () => clearInterval(id)
  }, [animate])

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const blink = animate && t % 16 === 0 && t > 0
    const sweat = animate && (mood === 'nervous' || mood === 'broken') ? 16 + (t % 7) * 2 : null
    const dx = animate && (mood === 'angry' || mood === 'broken') && t % 2 === 1 ? 1 : 0
    const px = renderPortrait(who, mood, blink, sweat, bare, look)
    ctx.clearRect(0, 0, W, W)
    for (let y = 0; y < W; y++)
      for (let x = 0; x < W; x++) {
        const c = px[y * W + x]
        if (!c) continue
        ctx.fillStyle = c
        ctx.fillRect(x + dx, y, 1, 1)
      }
    // `look` is an object that arrives fresh with each case; its content is what matters
  }, [who, JSON.stringify(look), mood, t, animate, bare])

  return <canvas ref={ref} width={W} height={W} className={className} style={{ width: size, height: size, imageRendering: 'pixelated', display: 'block' }} aria-label={`Portrait of ${who}`} />
}
