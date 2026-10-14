import { useEffect, useRef } from 'react'
import { drawBackdrop, drawRoom, drawSkyline } from '../lib/pixel'

export type BackdropKind = 'skyline' | 'vignette' | 'room'

const DRAW: Record<BackdropKind, (ctx: CanvasRenderingContext2D, w: number, h: number) => void> = {
  skyline: drawSkyline, // menu screens
  vignette: drawBackdrop, // case files
  room: drawRoom, // interrogation room
}

/** Full-screen pixel canvas drawn at logical resolution; the stage scale magnifies it. */
export default function SceneBackdrop({ kind, w, h }: { kind: BackdropKind; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (ctx) DRAW[kind](ctx, w, h)
  }, [kind, w, h])
  return <canvas ref={ref} width={w} height={h} aria-hidden className="absolute inset-0" style={{ width: w, height: h, imageRendering: 'pixelated' }} />
}
