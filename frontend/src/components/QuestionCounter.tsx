import { MAX_Q } from '../data/dummyCase'

export default function QuestionCounter({ left }: { left: number }) {
  const low = left <= 3
  return (
    <>
      <div className="label mt-px">
        Questions <span className={low ? 'text-[#C8323C]' : ''}>{String(left).padStart(2, '0')}/10</span>
      </div>
      <div className="mt-[1px] flex gap-[2px] pl-[1px]" aria-label={`${left} questions left`}>
        {Array.from({ length: MAX_Q }, (_, i) => (
          <span key={i} className="pip" style={i < left ? { background: low ? '#C8323C' : '#F2B33D' } : undefined} />
        ))}
      </div>
    </>
  )
}
