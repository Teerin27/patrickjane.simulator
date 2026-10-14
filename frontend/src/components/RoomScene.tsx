import { useEffect } from 'react'
import { useElementSize } from '../hooks/useElementSize'
import type { Interrogation } from '../hooks/useInterrogation'
import InterviewConsole from './InterviewConsole'
import Portrait from './Portrait'
import { MAX_Q } from '../lib/rules'
import { usePixelScreen } from './PixelScreen'
import type { Mood, Suspect, Who } from '../types'

const TABLE_H = 22 // table top plus the front panel that carries the name plates
const HINT_H = 26 // strip under the table while nobody is being questioned

function Seat({ suspect, mood, left, size, lap, active, dimmed, ml, onClick }: { suspect: Suspect; mood: Mood; left: number; size: number; lap: number; active: boolean; dimmed: boolean; ml: number; onClick: () => void }) {
  const out = left <= 0
  return (
    <button
      onClick={onClick}
      aria-label={`Question ${suspect.fullName}`}
      aria-pressed={active}
      className="group relative shrink-0 focus-visible:outline focus-visible:outline-1 focus-visible:outline-brass-400"
      style={{ width: size, marginLeft: ml }}
    >
      <Portrait who={suspect.id} look={suspect.look} mood={mood} size={size} bare className="group-hover:brightness-125 group-focus-visible:brightness-125" />
      {/* checker-dither the people you are not talking to */}
      {dimmed && <span className="dither pointer-events-none absolute inset-0" />}
      {/* name plate sits on the table front, whatever the figure size */}
      <span className="absolute inset-x-0 z-20 flex flex-col items-center justify-center" style={{ bottom: lap - TABLE_H, height: TABLE_H }}>
        <span className={`label border border-ink px-[2px] text-ink ${active ? 'bg-brass-400' : 'bg-paper-200 group-hover:bg-brass-400'}`}>{suspect.short}</span>
        <span className={`label ${left <= 3 ? 'text-blood-500' : 'text-paper-100'}`}>{out ? 'Lawyered up' : `Q ${String(left).padStart(2, '0')}/${MAX_Q}`}</span>
      </span>
    </button>
  )
}

/**
 * Scene 2: the three suspects sit behind the table under the lamp. Click one and the interview
 * panel pops up for them; Esc or Close sends the panel away again.
 */
export default function RoomScene({ game, open, onSeat, onClose }: { game: Interrogation; open: boolean; onSeat: (id: Who) => void; onClose: () => void }) {
  const { wide } = usePixelScreen()
  const [ref, size] = useElementSize<HTMLDivElement>()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Short landscape screens (phones on their side) have no height to share, so the panel moves to the right edge
  const side = open && wide && size.h < 200
  const consoleW = Math.max(240, Math.round(size.w * 0.55))
  const sceneW = side ? size.w - consoleW : size.w

  // Size everything for the panel being open, so the people never change size when you click one
  const consoleH = Math.max(110, Math.min(Math.round(size.h * (wide ? 0.5 : 0.62)), size.h - TABLE_H - 60))
  // 2x needs ~116px above the panel: head to table, ignoring the see-through top of the canvas
  const k = !side && size.w >= 408 && size.h - consoleH >= 116 ? 2 : 1
  const seat = 64 * k
  const lap = 6 * k // how much of the lower torso is hidden behind the table
  const squeeze = Math.max(0, Math.ceil((3 * seat - (sceneW - 8)) / 2)) // shoulder to shoulder when the width is short

  return (
    <div ref={ref} className={`relative flex min-h-0 flex-1 ${side ? 'flex-row' : 'flex-col justify-end'}`}>
      {/* the table and the people; in side mode this is the left half */}
      <div className={side ? 'flex min-w-0 flex-1 flex-col justify-end' : 'contents'}>
        <div className="relative flex shrink-0 items-end justify-evenly px-[4px]" style={{ paddingBottom: TABLE_H - lap }}>
          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col border-t-2 border-ink bg-paper-400" style={{ height: TABLE_H }}>
            <div className="h-[3px] bg-paper-300" />
          </div>
          {game.suspects.map((s, i) => (
            <Seat
              key={s.id}
              suspect={s}
              mood={game.moods[s.id]}
              left={game.left[s.id]}
              size={seat}
              lap={lap}
              active={open && game.who === s.id}
              dimmed={open && game.who !== s.id}
              ml={i === 0 ? 0 : -squeeze}
              onClick={() => onSeat(s.id)}
            />
          ))}
        </div>
      </div>

      {open ? (
        <InterviewConsole game={game} wide={wide && !side} side={side} size={side ? consoleW : consoleH} onClose={onClose} />
      ) : (
        <p className="label ink-shadow flex shrink-0 items-center justify-center gap-[3px] border-t-2 border-ink bg-night-900 text-paper-100" style={{ height: HINT_H }}>
          <span className="blink text-brass-400">&gt;</span> Click a suspect to question them
        </p>
      )}
    </div>
  )
}
