import { useNavigate } from 'react-router'
import { STAGE_LABELS, type BackupSnapshot } from '@shared/api'
import { useAppState } from '../../AppState'
import { ROUTES } from '../../design'

/** Home › Backup paused (st_vuryip8b). */
export function PausedState({ snapshot }: { snapshot: BackupSnapshot }): React.JSX.Element {
  const { act } = useAppState()
  const navigate = useNavigate()
  const stage = snapshot.stages.find((s) => s.id === snapshot.currentStage)
  return (
    <section className="state" aria-label="Backup paused">
      {/* Backup paused */}
      <p role="status" className="paused-title">
        Backup paused
      </p>
      {/* Stage and % completed */}
      {stage && (
        <p className="paused-stage">
          {STAGE_LABELS[stage.id]}: {stage.percent}% completed
        </p>
      )}
      <div className="actions">
        {/* Resume backup (cta_k0fqblmi, primary) → Home › Backup in progress */}
        <button type="button" className="primary" onClick={() => act((api) => api.backup.resume())}>
          Resume backup
        </button>
        {/* Cancel backup (cta_1yx7q3iu) → Confirm cancel */}
        <button
          type="button"
          className="secondary"
          onClick={() => act(async () => navigate(ROUTES.confirmCancel))}
        >
          Cancel backup
        </button>
      </div>
    </section>
  )
}
