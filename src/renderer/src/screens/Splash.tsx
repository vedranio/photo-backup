import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAppState } from '../AppState'
import { ROUTES } from '../design'

// The splash stays up at least this long, even when loading is instant, so it can be seen.
const MIN_SPLASH_MS = 1500

/** Splash › Default (st_ki442ws8). Moves on to Home once the app has loaded. */
export function Splash(): React.JSX.Element {
  const { loaded, loadError, forced } = useAppState()
  const navigate = useNavigate()
  const [minTimePassed, setMinTimePassed] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMinTimePassed(true), MIN_SPLASH_MS)
    return () => clearTimeout(timer)
  }, [])

  // "On loading finished" (cta_vuw7wy7r) → Home › Default. Automatic, so it has no button.
  useEffect(() => {
    if (loaded && minTimePassed && !forced) navigate(ROUTES.home, { replace: true })
  }, [loaded, minTimePassed, forced, navigate])

  return (
    <main className="splash">
      <div className="brand">
        <span className="brand-dot" aria-hidden="true" />
        <h1>photobackup</h1>
      </div>
      {loadError ? (
        <p role="alert" className="load-error">
          Couldn’t start: {loadError}
        </p>
      ) : (
        <div className="spinner" role="status" aria-label="Loading" />
      )}
      {/* TODO: real credits, once the design gives the wording. */}
      <p className="credits">photobackup</p>
    </main>
  )
}
