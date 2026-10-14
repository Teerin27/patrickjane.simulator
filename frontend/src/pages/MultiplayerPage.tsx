import MockPage from '../components/MockPage'

// MOCK PAGE. TODO(later): replace with the real multiplayer flow (lobby / room, needs realtime transport).
export default function MultiplayerPage() {
  return (
    <MockPage
      title="Multiplayer"
      blurb="Investigate with other detectives. Not built yet."
      planned={['Create or join a room', 'Lobby and ready-up', 'Shared case file']}
    />
  )
}
