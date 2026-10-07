import { useNavigate } from 'react-router'
import { useAppState } from '../AppState'
import { ROUTES } from '../design'
import { Modal } from '../components/Modal'

/** Confirm cancel › Default (st_fjos0gua): a modal over Home. */
export function ConfirmCancel(): React.JSX.Element | null {
  const { loaded, snapshot, act } = useAppState()
  const navigate = useNavigate()
  if (!loaded) return null

  // Keep backing up (cta_9ae5goek) → Home › Backup in progress: resumes a paused backup, retries a failed one.
  const keepBackingUp = (): Promise<void> =>
    act(async (api) => {
      if (snapshot?.status === 'paused') await api.backup.resume()
      else if (snapshot?.status === 'failed') await api.backup.retry()
      navigate(ROUTES.home)
    })

  return (
    <Modal title="Cancel backup?" onDismiss={keepBackingUp}>
      <div className="actions">
        {/* Cancel (cta_lulap6h0) → Home › Default */}
        <button
          type="button"
          className="secondary"
          onClick={() =>
            act(async (api) => {
              await api.backup.cancel()
              navigate(ROUTES.home)
            })
          }
        >
          Cancel
        </button>
        <button type="button" className="secondary" onClick={keepBackingUp}>
          Keep backing up
        </button>
      </div>
    </Modal>
  )
}
