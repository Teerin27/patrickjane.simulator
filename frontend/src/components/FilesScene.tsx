import { useElementSize } from '../hooks/useElementSize'
import type { Interrogation } from '../hooks/useInterrogation'
import CaseNotes from './CaseNotes'
import EvidencePanel from './EvidencePanel'
import { usePixelScreen } from './PixelScreen'
import SuspectDossier from './SuspectDossier'
import SuspectList from './SuspectList'

/** Scene 1: the case files. Pick a suspect to read their file; the locker holds the exhibits. */
export default function FilesScene({ game, onInterrogate }: { game: Interrogation; onInterrogate: () => void }) {
  const { wide } = usePixelScreen()
  const [pageRef, page] = useElementSize<HTMLDivElement>()
  // the double-size portrait only when the page can hold it and still leave room for the notes
  const dossier = (big: boolean) => <SuspectDossier variant="file" big={big} suspect={game.suspect} mood={game.mood} left={game.qLeft} onInterrogate={onInterrogate} />
  // the locker is for reading exhibits; nothing is "DONE" until it is presented in the room
  const locker = (cols: 2 | 4, className: string) => (
    <EvidencePanel evidence={game.evidence} selected={game.selected} shown={game.shown} surname={game.suspect.surname} cols={cols} className={className} onToggle={game.toggleEvidence} />
  )

  if (wide)
    return (
      <div className="flex min-h-0 flex-1 gap-[4px] p-[4px] pt-0">
        <aside className="panel flex w-[88px] shrink-0 flex-col gap-[3px] self-start">
          <h2 className="h">Suspects</h2>
          <SuspectList suspects={game.suspects} active={game.who} left={game.left} onSelect={game.switchTo} />
        </aside>
        <div ref={pageRef} className="flex min-h-0 min-w-0 flex-1 flex-col gap-[4px]">
          {dossier(page.w >= 280 && page.h >= 300)}
          <CaseNotes pins={game.pins} className="min-h-[40px] flex-1" />
        </div>
        {locker(2, 'w-[104px] shrink-0')}
      </div>
    )

  // narrow: one scrolling column
  return (
    <div className="scroll flex min-h-0 flex-1 flex-col gap-[4px] overflow-y-auto p-[4px] pt-0">
      <SuspectList suspects={game.suspects} active={game.who} left={game.left} onSelect={game.switchTo} row />
      <div className="shrink-0">{dossier(false)}</div>
      {locker(4, 'h-[110px] shrink-0')}
      <CaseNotes pins={game.pins} className="h-[56px] shrink-0" />
    </div>
  )
}
