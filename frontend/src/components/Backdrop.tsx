import { useEffect, useRef } from 'react'
import { drawBackdrop } from '../lib/pixel'

export default function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (ctx) drawBackdrop(ctx)
  }, [])
  return <canvas ref={ref} width={360} height={225} style={{ position: 'absolute', inset: 0, width: 360, height: 225, imageRendering: 'pixelated' }} />
}
