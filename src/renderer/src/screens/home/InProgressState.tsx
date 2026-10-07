import { useNavigate } from 'react-router'
import type { BackupSnapshot } from '@shared/api'
import { useAppState } from '../../AppState'
import { ROUTES } from '../../design'
import { StageProgressList } from '../../components/StageProgressList'

/** Home › Backup in progress (st_5ttst55w). */
export function InProgressState({ snapshot }: { snapshot: BackupSnapshot }): React.JSX.Element {
  const { act } = useAppState()
  const navigate = useNavigate()
  return (
    <section className="state" aria-label="Backup in progress">
      {/* Progress indicator */}
      <StageProgressList snapshot={snapshot} />
      <div className="actions">
        {/* Cancel backup (cta_zygntttz) → Confirm cancel */}
        <button
          type="button"
          className="secondary"
          onClick={() => act(async () => navigate(ROUTES.confirmCancel))}
        >
          Cancel backup
        </button>
        {/* Pause backup (cta_3h6nlghh) → Home › Backup paused */}
        <button
          type="button"
          className="secondary"
          onClick={() => act((api) => api.backup.pause())}
        >
          Pause backup
        </button>
      </div>
    </section>
  )
}
