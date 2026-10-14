import MockPage from '../components/MockPage'

// MOCK PAGE. TODO(later): replace with the real settings page (persist choices, e.g. localStorage first).
export default function SettingsPage() {
  return (
    <MockPage
      title="Settings"
      blurb="Tune the game to your liking."
      planned={['Music and sound volume', 'Typewriter text speed', 'Language']}
    />
  )
}
