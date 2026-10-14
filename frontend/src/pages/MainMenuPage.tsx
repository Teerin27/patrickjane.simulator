import GameLogo from '../components/GameLogo'
import PixelScreen from '../components/PixelScreen'
import PlayModeSelect from '../components/PlayModeSelect'
import SettingsButton from '../components/SettingsButton'
import UserProfileCard from '../components/UserProfileCard'

export default function MainMenuPage() {
  return (
    <PixelScreen>
      <div className="flex min-h-0 flex-1 flex-col gap-[6px] p-[8px]">
        <header className="flex shrink-0 items-start justify-between gap-[6px]">
          <UserProfileCard />
          <SettingsButton />
        </header>

        {/* my-auto (not justify-center) so content stays reachable by scroll if the window is tiny */}
        <main className="scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="my-auto flex flex-col items-center gap-[8px]">
            <GameLogo />
            <PlayModeSelect />
          </div>
        </main>

        <footer className="label ink-shadow flex shrink-0 justify-between gap-[6px] text-paper-300">
          <span>Build 0.1 dev</span>
          <span>A work of fiction</span>
        </footer>
      </div>
    </PixelScreen>
  )
}
