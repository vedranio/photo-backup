import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAppState } from '../AppState'
import { ROUTES } from '../design'

/** Splash › Default (st_ki442ws8). Moves on to Home as soon as the app has loaded. */
export function Splash(): React.JSX.Element {
  const { loaded, loadError, forced } = useAppState()
  const navigate = useNavigate()

  // "On loading finished" (cta_vuw7wy7r) → Home › Default. Automatic, so it has no button.
  useEffect(() => {
    if (loaded && !forced) navigate(ROUTES.home, { replace: true })
  }, [loaded, forced, navigate])

  return (
    <main className="splash">
      <h1>photobackup</h1>
      {loadError ? (
        <p role="alert" className="error">
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
