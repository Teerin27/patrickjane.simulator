import Sprite from './Sprite'

export default function Header({ title, caseNumber, clock, onAccuse }: { title: string; caseNumber: string; clock: string; onAccuse: () => void }) {
  return (
    <header className="absolute left-[8px] top-[6px] flex h-[14px] w-[344px] items-center justify-between">
      <div className="flex items-center gap-[6px]">
        <Sprite name="magnifier" />
        <h1 className="h text-[#F2B33D]">{title}</h1>
        <span className="label text-[#C4A97A]">{caseNumber}</span>
      </div>
      <div className="flex items-center gap-[8px]">
        <span className="label text-[#F4ECD8]">{clock}</span>
        <button className="btn crimson h-[13px] w-[52px] !pl-[3px] !text-center" onClick={onAccuse}>
          ACCUSE!
        </button>
      </div>
    </header>
  )
}
