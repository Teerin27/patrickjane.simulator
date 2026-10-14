import { useEffect, useRef, type ReactNode } from 'react'

// Blocking yes/no popup over the whole screen (same look as AccuseModal). Cancel has the focus
// when it opens and Escape cancels, so Enter or a stray key never confirms something destructive.
export default function ConfirmModal({
  title,
  children,
  confirmLabel,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  title: string
  children: ReactNode
  confirmLabel: string
  busy?: boolean
  error?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => cancelRef.current?.focus(), [])

  return (
    <div
      className="dither absolute inset-0 z-10 grid place-items-center"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !busy) onCancel()
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="panel rise w-[180px]">
        <div className="flex flex-col gap-[3px]">
          <h2 id="confirm-title" className="h text-blood-800">
            {title}
          </h2>
          <div className="leading-[7px]">{children}</div>
          {error && (
            <p role="alert" className="text-blood-800">
              {error}
            </p>
          )}
          <button ref={cancelRef} type="button" className="btn teal label h-[13px] !text-center" disabled={busy} onClick={onCancel}>
            CANCEL
          </button>
          <button type="button" className="btn crimson label h-[13px] !text-center" disabled={busy} onClick={onConfirm}>
            {busy ? 'WORKING...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
