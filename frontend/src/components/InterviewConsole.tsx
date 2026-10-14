import { useState } from 'react'
import { quickQuestions } from '../data/quickQuestions'
import type { Interrogation } from '../hooks/useInterrogation'
import ChatPanel from './ChatPanel'
import EvidencePanel from './EvidencePanel'
import QuestionInput from './QuestionInput'
import SuspectDossier from './SuspectDossier'

type Tab = 'chat' | 'file' | 'exhibits'
const TABS: { id: Tab; label: string }[] = [
  { id: 'chat', label: 'CHAT' },
  { id: 'file', label: 'FILE' },
  { id: 'exhibits', label: 'EXHIBITS' },
]

/**
 * The panel that pops up when you sit across from a suspect: their file, the chat, and the
 * exhibits you can present. Side by side when there is room, otherwise one tab at a time.
 * Sits under the table by default; `side` puts it on the right edge for short landscape screens.
 */
export default function InterviewConsole({ game, wide, side = false, size, onClose }: { game: Interrogation; wide: boolean; side?: boolean; size: number; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('chat')
  const { suspect } = game
  const noneLeft = game.qLeft <= 0
  const locked = game.busy || noneLeft || game.over

  const file = <SuspectDossier variant="compact" suspect={suspect} mood={game.mood} left={game.qLeft} />
  const chat = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[2px]">
      <ChatPanel
        messages={game.messages}
        speaker={suspect.surname}
        thinking={game.thinking}
        typingId={game.typingId}
        notice={game.notice}
        lawyeredUp={noneLeft}
        status={game.status}
        onTypingDone={game.finishTyping}
      />
      <QuestionInput
        presets={quickQuestions}
        used={game.used}
        disabled={locked}
        placeholder={game.over ? 'CASE CLOSED' : noneLeft ? 'NO QUESTIONS LEFT' : 'Type a question...'}
        onPreset={game.askPreset}
        onAsk={game.askText}
      />
    </div>
  )
  const exhibits = (className: string) => (
    <EvidencePanel
      evidence={game.evidence}
      selected={game.selected}
      shown={game.shown}
      surname={suspect.surname}
      disabled={locked}
      cols={wide ? 4 : 2}
      className={className}
      onToggle={game.toggleEvidence}
      onPresent={game.confront}
    />
  )

  return (
    <section className={`rise flex shrink-0 flex-col gap-[3px] border-ink bg-night-900 p-[3px] ${side ? 'border-l-2' : 'border-t-2'}`} style={side ? { width: size } : { height: size }}>
      <header className="flex h-[13px] shrink-0 items-center justify-between gap-[4px]">
        <h2 className="h truncate text-paper-100">
          {suspect.fullName} <span className="label text-paper-300">{suspect.role}</span>
        </h2>
        <button className="btn label h-[12px] shrink-0 !px-[4px] !text-center" onClick={onClose}>
          X Close
        </button>
      </header>

      {wide ? (
        <div className="flex min-h-0 flex-1 gap-[3px]">
          <div className="panel w-[124px] shrink-0">{file}</div>
          <section className="panel flex min-w-0 flex-1 flex-col">{chat}</section>
          {exhibits('w-[124px] shrink-0')}
        </div>
      ) : (
        <>
          <div className="flex shrink-0 gap-[2px]">
            {TABS.map((t) => (
              <button key={t.id} className={`btn label h-[12px] flex-1 !px-0 !text-center ${tab === t.id ? 'on' : ''}`} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          {tab === 'chat' && <section className="panel flex min-h-0 flex-1 flex-col">{chat}</section>}
          {tab === 'file' && <div className="panel min-h-0 flex-1">{file}</div>}
          {tab === 'exhibits' && exhibits('flex-1')}
        </>
      )}
    </section>
  )
}
