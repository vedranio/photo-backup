import { useNavigate } from 'react-router'
import type { BackupSnapshot } from '@shared/api'
import { useAppState } from '../../AppState'
import { ROUTES } from '../../design'

/** Home › Backup failed (st_vublspne). */
export function FailedState({ snapshot }: { snapshot: BackupSnapshot }): React.JSX.Element {
  const { act } = useAppState()
  const navigate = useNavigate()
  return (
    <section className="state" aria-label="Backup failed">
      {/* Error details */}
      <div role="alert" className="error-details">
        <p className="error-title">Backup failed</p>
        <p>{snapshot.error}</p>
      </div>
      <div className="actions">
        {/* Retry (cta_zd7xrpav, primary) → Home › Backup in progress */}
        <button type="button" className="primary" onClick={() => act((api) => api.backup.retry())}>
          Retry
        </button>
        {/* Cancel (cta_ri8wpbtk) → Confirm cancel */}
        <button
          type="button"
          className="secondary"
          onClick={() => act(async () => navigate(ROUTES.confirmCancel))}
        >
          Cancel
        </button>
      </div>
    </section>
  )
}
