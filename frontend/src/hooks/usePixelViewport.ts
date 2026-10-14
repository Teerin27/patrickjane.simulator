import { useEffect, useState } from 'react'

// Full-window screens are laid out in "logical" pixels and magnified by a whole number, so pixel
// art stays crisp while the layout still fills any window.
export type PixelViewport = { scale: number; w: number; h: number }

export type PixelViewportOptions = {
  /** Logical size a layout may count on, unless the window is too narrow for it (phones). */
  minW?: number
  minH?: number
}

const MIN_SCALE = 2 // keeps pixel fonts at >= 16px on screen

function measure(minW: number, minH: number): PixelViewport {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const scale = Math.max(MIN_SCALE, Math.floor(Math.min(vw / minW, vh / minH)))
  // round up so the scaled screen always covers the window; the overflow is clipped
  return { scale, w: Math.ceil(vw / scale), h: Math.ceil(vh / scale) }
}

/** Integer scale plus the logical size of the viewport at that scale. Defaults suit the menu screens. */
export function usePixelViewport({ minW = 240, minH = 168 }: PixelViewportOptions = {}) {
  const [vp, setVp] = useState(() => measure(minW, minH))
  useEffect(() => {
    const onResize = () => {
      const next = measure(minW, minH)
      setVp((cur) => (cur.scale === next.scale && cur.w === next.w && cur.h === next.h ? cur : next))
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [minW, minH])
  return vp
}
