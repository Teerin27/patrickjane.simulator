import { useId, type InputHTMLAttributes } from 'react'

type Props = { label: string; error?: string; hint?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'>

// Labelled text input for the account forms. A server error replaces the hint under the input.
export default function Field({ label, error, hint, ...input }: Props) {
  const id = useId()
  const noteId = `${id}-note`
  const note = error ?? hint
  return (
    <div className="flex flex-col gap-[1px]">
      <label htmlFor={id} className="label text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        className={`h-[13px] w-full min-w-0 border bg-paper-100 px-[2px] font-[inherit] text-[8px] leading-[7px] text-ink caret-brass-600 placeholder:text-paper-400 disabled:opacity-60 ${error ? 'border-blood-500' : 'border-ink'}`}
        {...input}
      />
      {note && (
        <p id={noteId} role={error ? 'alert' : undefined} className={error ? 'text-blood-800' : 'text-night-800'}>
          {note}
        </p>
      )}
    </div>
  )
}
