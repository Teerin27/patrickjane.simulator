import { useState } from 'react'
import AccuseModal from './components/AccuseModal'
import Backdrop from './components/Backdrop'
import CaseNotes from './components/CaseNotes'
import ChatPanel from './components/ChatPanel'
import EvidencePanel from './components/EvidencePanel'
import Header from './components/Header'
import QuestionInput from './components/QuestionInput'
import SuspectList from './components/SuspectList'
import SuspectProfile from './components/SuspectProfile'
import { CULPRIT, caseInfo, evidence, presets, suspects, verdictText } from './data/dummyCase'
import { useInterrogation } from './hooks/useInterrogation'
import { useStageScale } from './hooks/useStageScale'
import { stageVars } from './lib/theme'
import type { AccuseState } from './types'

export default function App() {
  const scale = useStageScale()
  const game = useInterrogation()
  const [accuse, setAccuse] = useState<AccuseState>('closed')

  const noneLeft = game.qLeft <= 0
  const locked = game.busy || noneLeft
  const clock = `11:${String(48 + Math.floor(game.asked / 3)).padStart(2, '0')} PM`

  return (
    <div className="fixed inset-0 grid place-items-center bg-[#0F1220]">
      <div className="relative overflow-hidden" style={{ width: 360 * scale, height: 225 * scale }}>
        <div className="stage" style={{ ...stageVars, transform: `scale(${scale})` }}>
          <Backdrop />
          <Header title={caseInfo.title} caseNumber={caseInfo.number} clock={clock} onAccuse={() => setAccuse('pick')} />

          <main className="absolute left-[8px] top-[24px] flex h-[195px] w-[344px] gap-[4px]">
            <aside className="panel flex h-full w-[84px] shrink-0 flex-col gap-[3px]">
              <h2 className="h">Suspects</h2>
              <SuspectList suspects={suspects} active={game.who} left={game.left} onSelect={game.switchTo} />
              <CaseNotes pins={game.pins} />
            </aside>

            <section className="panel flex h-full w-[168px] shrink-0 flex-col gap-[2px]">
              <SuspectProfile suspect={game.suspect} mood={game.mood} left={game.qLeft} />
              <ChatPanel messages={game.messages} thinking={game.thinking} typingId={game.typingId} onTypingDone={game.finishTyping} />
              <QuestionInput presets={presets[game.who]} used={game.used} disabled={locked} noneLeft={noneLeft} onPreset={game.askPreset} onAsk={game.askText} />
            </section>

            <EvidencePanel
              evidence={evidence}
              selected={game.selected}
              used={game.used}
              surname={game.suspect.surname}
              disabled={locked}
              onToggle={game.toggleEvidence}
              onPresent={game.confront}
            />
          </main>

          {accuse !== 'closed' && <AccuseModal state={accuse} suspects={suspects} culprit={CULPRIT} verdict={verdictText} onChange={setAccuse} />}
        </div>
      </div>
    </div>
  )
}
