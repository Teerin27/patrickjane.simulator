import type { ReactNode } from 'react'
import { Link } from 'react-router'
import PixelScreen from './PixelScreen'

// Shared shell for the account pages (login, profile): back-to-menu button on top, scrollable
// content below. Content goes inside the PixelScreen, so it may call usePixelScreen().
// Forms need more room than the menu's 240x168, so these pages count on 400x225 logical px
// (like gameplay): on a 1440x900 window that is a 3x scale, not 5x, and the profile gets two columns.
export default function PageFrame({ children }: { children: ReactNode }) {
  return (
    <PixelScreen minW={400} minH={225}>
      <div className="flex min-h-0 flex-1 flex-col gap-[6px] p-[8px]">
        <header className="shrink-0">
          <Link to="/" className="btn dark inline-flex h-[20px] items-center !px-[5px]">
            <span className="h">&lt; Menu</span>
          </Link>
        </header>
        {/* my-auto on the content (not justify-center) keeps it reachable by scroll in a tiny window */}
        <main className="scroll flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
      </div>
    </PixelScreen>
  )
}
