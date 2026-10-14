import { createContext, useContext, type ReactNode } from 'react'
import { usePixelViewport, type PixelViewport } from '../hooks/usePixelViewport'
import { stageVars } from '../lib/theme'
import SceneBackdrop, { type BackdropKind } from './SceneBackdrop'

// `wide` = room for side-by-side columns (landscape and at least 400 logical px across)
type Screen = PixelViewport & { wide: boolean }
const ScreenContext = createContext<Screen>({ scale: 1, w: 360, h: 225, wide: false })

/** Logical size of the surrounding PixelScreen, for layouts that switch between columns and tabs. */
export const usePixelScreen = () => useContext(ScreenContext)

/**
 * Full-window screen. Children are laid out in logical pixels (flex/grid, any aspect ratio) inside
 * a stage that is magnified by a whole number, so the UI fills the window and pixel art never blurs.
 */
export default function PixelScreen({ children, backdrop = 'skyline', minW, minH }: { children: ReactNode; backdrop?: BackdropKind; minW?: number; minH?: number }) {
  const vp = usePixelViewport({ minW, minH })
  const { scale, w, h } = vp
  return (
    <div className="fixed inset-0 overflow-hidden bg-night-950">
      <div className="stage" style={{ ...stageVars, width: w, height: h, transform: `scale(${scale})` }}>
        <SceneBackdrop kind={backdrop} w={w} h={h} />
        <ScreenContext.Provider value={{ ...vp, wide: w >= 400 && w > h }}>
          <div className="absolute inset-0 flex flex-col">{children}</div>
        </ScreenContext.Provider>
      </div>
    </div>
  )
}
