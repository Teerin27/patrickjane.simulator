import Portrait from './Portrait'
import QuestionCounter from './QuestionCounter'
import type { Mood, Suspect } from '../types'

export default function SuspectProfile({ suspect, mood, left }: { suspect: Suspect; mood: Mood; left: number }) {
  return (
    <div className="flex h-[66px] gap-[3px] p-[1px]">
      <div className="h-[64px] w-[64px] shrink-0 outline outline-1 outline-[#1A1414]">
        <Portrait who={suspect.id} mood={mood} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="h text-[#7A1E2A]">{suspect.surname}</div>
        <div className="label text-[#8A6E4B]">{suspect.role}</div>
        <p className="mt-[1px] line-clamp-3 h-[21px]">{suspect.alibi}</p>
        <QuestionCounter left={left} />
        <div className="label mt-[2px] text-[#8A6E4B]">
          Mood: <span className={mood === 'calm' ? '' : 'text-[#C8323C]'}>{mood}</span>
        </div>
      </div>
    </div>
  )
}
