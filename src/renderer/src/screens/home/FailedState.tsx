import { useNavigate } from 'react-router'
import type { BackupSnapshot } from '@shared/api'
import { useAppState } from '../../AppState'
import { ROUTES } from '../../design'
import { MonthHeader } from './MonthHeader'

/** Home › Backup failed (st_vublspne). */
export function FailedState({ snapshot }: { snapshot: BackupSnapshot }): React.JSX.Element {
  const { act } = useAppState()
  const navigate = useNavigate()
  return (
    <>
      <MonthHeader snapshot={snapshot} />
      {/* Error details */}
      <div role="alert" className="error-panel">
        <p className="error-title">
          <span className="brand-dot" aria-hidden="true" />
          Backup failed
        </p>
        <p className="error-message">{snapshot.error}</p>
      </div>
      <div className="screen-actions">
        {/* Retry (cta_zd7xrpav, primary) → Home › Backup in progress */}
        <button
          type="button"
          className="btn primary"
          onClick={() => act((api) => api.backup.retry())}
        >
          Retry
        </button>
        {/* Cancel (cta_ri8wpbtk) → Confirm cancel */}
        <button
          type="button"
          className="btn"
          onClick={() => act(async () => navigate(ROUTES.confirmCancel))}
        >
          Cancel
        </button>
      </div>
    </>
  )
}
