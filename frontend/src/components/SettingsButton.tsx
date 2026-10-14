import { Link } from 'react-router'
import Sprite from './Sprite'

// Gear icon, top-right of the main menu.
// (DUMMY) /settings is a mock page. TODO(later): link to the real settings page.
export default function SettingsButton() {
  return (
    <Link to="/settings" className="btn grid size-[24px] shrink-0 place-items-center !p-0" aria-label="Settings" title="Settings">
      <Sprite name="gear" />
    </Link>
  )
}
