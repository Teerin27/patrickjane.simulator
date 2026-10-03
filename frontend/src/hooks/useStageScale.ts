import { useEffect, useState } from 'react'

const calcScale = () => Math.max(1, Math.floor(Math.min(window.innerWidth / 360, window.innerHeight / 225)))

/** Largest whole-number scale at which the 360x225 stage fits the window. */
export function useStageScale() {
  const [scale, setScale] = useState(calcScale)
  useEffect(() => {
    const f = () => setScale(calcScale())
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  return scale
}
