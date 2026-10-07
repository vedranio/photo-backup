import { STAGE_LABELS, type BackupSnapshot } from '@shared/api'

/** Each stage of the backup and its % completed. */
export function StageProgressList({ snapshot }: { snapshot: BackupSnapshot }): React.JSX.Element {
  return (
    <ol className="stages">
      {snapshot.stages.map((stage) => {
        const current = stage.id === snapshot.currentStage
        const labelId = `stage-${stage.id}`
        return (
          <li
            key={stage.id}
            className={current ? 'stage current' : 'stage'}
            aria-current={current ? 'step' : undefined}
          >
            <span id={labelId} className="stage-label">
              {STAGE_LABELS[stage.id]}
            </span>
            <progress aria-labelledby={labelId} max={100} value={stage.percent} />
            <span className="stage-percent">{stage.percent}%</span>
          </li>
        )
      })}
    </ol>
  )
}
