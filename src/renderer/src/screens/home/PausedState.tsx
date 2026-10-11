import { useNavigate } from 'react-router'
import type { BackupSnapshot } from '@shared/api'
import { useAppState } from '../../AppState'
import { ROUTES } from '../../design'
import { StageHero } from '../../components/StageProgressList'
import { MonthHeader } from './MonthHeader'

/** Home › Backup paused (st_vuryip8b). */
export function PausedState({ snapshot }: { snapshot: BackupSnapshot }): React.JSX.Element {
  const { act } = useAppState()
  const navigate = useNavigate()
  return (
    <>
      <MonthHeader snapshot={snapshot} />
      <section className="progress" aria-label="Backup paused">
        {/* Backup paused */}
        <p role="status" className="eyebrow">
          Backup paused
        </p>
        {/* Stage and % completed */}
        <StageHero snapshot={snapshot} />
      </section>
      <div className="screen-actions">
        {/* Resume backup (cta_k0fqblmi, primary) → Home › Backup in progress */}
        <button
          type="button"
          className="btn primary"
          onClick={() => act((api) => api.backup.resume())}
        >
          Resume backup
        </button>
        {/* Cancel backup (cta_1yx7q3iu) → Confirm cancel */}
        <button
          type="button"
          className="btn"
          onClick={() => act(async () => navigate(ROUTES.confirmCancel))}
        >
          Cancel backup
        </button>
      </div>
    </>
  )
}
