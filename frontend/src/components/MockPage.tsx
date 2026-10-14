import { Link } from 'react-router'
import PixelScreen from './PixelScreen'

// Shared placeholder for pages that are not built yet. Each mock page file (ProfilePage,
// MultiplayerPage, SettingsPage) renders this; replace that file's body when the real page lands.
export default function MockPage({ title, blurb, planned }: { title: string; blurb: string; planned: string[] }) {
  return (
    <PixelScreen>
      <div className="flex min-h-0 flex-1 flex-col gap-[6px] p-[8px]">
        <header className="shrink-0">
          <Link to="/" className="btn dark inline-flex h-[20px] items-center !px-[5px]">
            <span className="h">&lt; Menu</span>
          </Link>
        </header>
        <main className="scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
          <section className="panel my-auto flex w-full max-w-[220px] flex-col gap-[4px] self-center p-[3px]">
            <span className="h w-fit border-2 border-blood-500 px-[2px] py-[1px] text-blood-500">Mock page</span>
            <h1 className="h text-blood-800">{title}</h1>
            <p className="leading-[8px]">{blurb}</p>
            <h2 className="label text-paper-400">Will include later:</h2>
            <ul className="flex flex-col gap-[2px]">
              {planned.map((p) => (
                <li key={p} className="flex gap-[3px] leading-[8px]">
                  <span aria-hidden className="text-brass-600">
                    -
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <Link to="/" className="btn amber label mt-[2px] flex h-[16px] items-center !justify-center !text-center">
              BACK TO MENU
            </Link>
          </section>
        </main>
      </div>
    </PixelScreen>
  )
}
