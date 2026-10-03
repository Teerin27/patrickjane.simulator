import { useEffect, useRef } from 'react'
import { SPRITES, SPRITE_PAL } from '../lib/pixel'

export default function Sprite({ name }: { name: keyof typeof SPRITES | string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 16, 16)
    SPRITES[name].forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const c = SPRITE_PAL[ch]
        if (!c) return
        ctx.fillStyle = c
        ctx.fillRect(x, y, 1, 1)
      }),
    )
  }, [name])
  return <canvas ref={ref} width={16} height={16} style={{ width: 16, height: 16, imageRendering: 'pixelated', display: 'block' }} />
}
