import { STAGE_LABELS, type BackupSnapshot } from '@shared/api'

const TICKS = 21

/** A scale of 21 ticks, filled up to `percent`, with a red index at the current position. */
function Ticks({ percent, current }: { percent: number; current: boolean }): React.JSX.Element {
  const filled = Math.round(percent / 5)
  return (
    <span className="ticks" aria-hidden="true">
      {Array.from({ length: TICKS }, (_, i) => {
        const marker = current && percent < 100 && i === filled
        const classes = [
          'tick',
          i % 10 === 0 && 'major',
          (i < filled || percent === 100) && 'on',
          marker && 'marker'
        ]
        return <span key={i} className={classes.filter(Boolean).join(' ')} />
      })}
    </span>
  )
}

/** Each stage of the backup and its % completed. */
export function StageProgressList({ snapshot }: { snapshot: BackupSnapshot }): React.JSX.Element {
  return (
    <ol className="stage-rows">
      {snapshot.stages.map((stage) => {
        const current = stage.id === snapshot.currentStage
        const labelId = `stage-${stage.id}`
        const state = current ? 'current' : stage.percent === 0 ? 'pending' : 'done'
        return (
          <li
            key={stage.id}
            className={`stage-row ${state}`}
            aria-current={current ? 'step' : undefined}
          >
            <span id={labelId} className="stage-label">
              {STAGE_LABELS[stage.id]}
            </span>
            <span
              role="progressbar"
              aria-labelledby={labelId}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={stage.percent}
            >
              <Ticks percent={stage.percent} current={current} />
            </span>
            <span className="stage-pct">{stage.percent}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** The current stage's % in large numerals, with its name. */
export function StageHero({ snapshot }: { snapshot: BackupSnapshot }): React.JSX.Element {
  const stage = snapshot.stages.find((s) => s.id === snapshot.currentStage)
  return (
    <div className="hero">
      <span className="hero-number">
        {stage?.percent ?? 0}
        <span className="hero-unit">%</span>
      </span>
      <span className="hero-label">{stage ? STAGE_LABELS[stage.id] : 'Starting'}</span>
    </div>
  )
}
