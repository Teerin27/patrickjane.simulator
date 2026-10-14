import { Link } from 'react-router'
import { ApiError, isNetworkError } from '../lib/api'

/** Opening the case file (loading) or failing to (server down, no cases). */
export default function BootNotice({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  if (error === undefined)
    return (
      <div className="grid flex-1 place-items-center" role="status">
        <p className="label ink-shadow text-paper-100">
          Opening the case file<span className="blink">...</span>
        </p>
      </div>
    )

  const offline = isNetworkError(error)
  const message = offline ? "Can't reach the server. Is the backend running?" : error instanceof ApiError || error instanceof Error ? error.message : 'Something went wrong.'
  return (
    <div className="grid flex-1 place-items-center p-[8px]">
      <div className="panel flex w-full max-w-[200px] flex-col gap-[3px]" role="alert">
        <h2 className="h text-blood-800">{offline ? 'Offline' : 'No case file'}</h2>
        <p>{message}</p>
        {onRetry && (
          <button className="btn amber label h-[11px] !text-center" onClick={onRetry}>
            TRY AGAIN
          </button>
        )}
        <Link to="/" className="btn label flex h-[11px] items-center justify-center">
          BACK TO MENU
        </Link>
      </div>
    </div>
  )
}
