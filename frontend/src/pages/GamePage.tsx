import { useState } from 'react'
import { useNavigate } from 'react-router'
import AccuseModal from '../components/AccuseModal'
import BootNotice from '../components/BootNotice'
import CasePicker from '../components/CasePicker'
import FilesScene from '../components/FilesScene'
import Header from '../components/Header'
import PixelScreen from '../components/PixelScreen'
import RoomScene from '../components/RoomScene'
import { useGameBoot, type Loaded } from '../hooks/useGameBoot'
import { useInterrogation } from '../hooks/useInterrogation'
import type { AccuseState, Scene, Who } from '../types'

/** /play: load (or resume) a case from the API, then sit down at the table. */
export default function GamePage() {
  const { boot, retry, choose, newCase } = useGameBoot()

  if (boot.phase === 'ready') return <GameTable key={boot.loaded.session.id} loaded={boot.loaded} onNewCase={newCase} />

  return (
    <PixelScreen minW={400} minH={225}>
      {boot.phase === 'pick' ? <CasePicker cases={boot.cases} onChoose={choose} /> : boot.phase === 'error' ? <BootNotice error={boot.error} onRetry={retry} /> : <BootNotice />}
    </PixelScreen>
  )
}

function GameTable({ loaded, onNewCase }: { loaded: Loaded; onNewCase: () => void }) {
  const navigate = useNavigate()
  const game = useInterrogation(loaded)
  const [scene, setScene] = useState<Scene>('files')
  const [seated, setSeated] = useState(false) // is the interview panel open in the room?
  const [accuse, setAccuse] = useState<AccuseState>('closed')

  // Cosmetic: the clock creeps toward midnight as questions are spent
  const clock = `11:${String(48 + Math.floor(game.asked / 3)).padStart(2, '0')} PM`
  const sitDown = (id: Who) => {
    game.switchTo(id)
    setSeated(true)
  }

  return (
    <PixelScreen backdrop={scene === 'room' ? 'room' : 'vignette'} minW={400} minH={225}>
      <Header
        title={game.caseInfo.title}
        caseNumber={game.caseInfo.number}
        clock={clock}
        scene={scene}
        onScene={setScene}
        onAccuse={() => setAccuse('open')}
        accuseDisabled={game.over}
        onMenu={() => navigate('/')}
      />

      <main className="flex min-h-0 flex-1 flex-col">
        {scene === 'files' ? (
          <FilesScene
            game={game}
            onInterrogate={() => {
              setScene('room')
              setSeated(true)
            }}
          />
        ) : (
          <RoomScene game={game} open={seated} onSeat={sitDown} onClose={() => setSeated(false)} />
        )}
      </main>

      {accuse === 'open' && <AccuseModal suspects={game.suspects} onAccuse={game.accuse} onClose={() => setAccuse('closed')} onNewCase={onNewCase} />}
    </PixelScreen>
  )
}
