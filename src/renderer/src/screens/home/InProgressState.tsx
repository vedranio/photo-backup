import { useNavigate } from 'react-router'
import type { BackupSnapshot } from '@shared/api'
import { useAppState } from '../../AppState'
import { ROUTES } from '../../design'
import { StageHero, StageProgressList } from '../../components/StageProgressList'
import { MonthHeader } from './MonthHeader'

/** Home › Backup in progress (st_5ttst55w). */
export function InProgressState({ snapshot }: { snapshot: BackupSnapshot }): React.JSX.Element {
  const { act } = useAppState()
  const navigate = useNavigate()
  return (
    <>
      <MonthHeader snapshot={snapshot} />
      {/* Progress indicator */}
      <section className="progress" aria-label="Progress">
        <StageHero snapshot={snapshot} />
        <StageProgressList snapshot={snapshot} />
      </section>
      <div className="screen-actions">
        {/* Cancel backup (cta_zygntttz) → Confirm cancel */}
        <button
          type="button"
          className="btn"
          onClick={() => act(async () => navigate(ROUTES.confirmCancel))}
        >
          Cancel backup
        </button>
        {/* Pause backup (cta_3h6nlghh) → Home › Backup paused */}
        <button type="button" className="btn" onClick={() => act((api) => api.backup.pause())}>
          Pause backup
        </button>
      </div>
    </>
  )
}
