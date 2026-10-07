import { useNavigate } from 'react-router'
import { currentMonth, parseMonth } from '@shared/month'
import { useAppState } from '../../AppState'
import { ROUTES } from '../../design'

/** Home › Default (st_fsjlc5tb). Locations come from Settings and can only be changed there. */
export function DefaultState(): React.JSX.Element {
  const { config, selection, setSelection, act } = useAppState()
  const navigate = useNavigate()
  const sources = config?.sources ?? []

  const toggle = (id: number, checked: boolean): void =>
    setSelection({
      ...selection,
      sourceIds: checked
        ? [...selection.sourceIds, id]
        : selection.sourceIds.filter((s) => s !== id)
    })

  return (
    <section className="state" aria-label="Back up">
      <div className="toolbar">
        {/* Settings (cta_brxb5a35) → Settings */}
        <button
          type="button"
          className="secondary"
          onClick={() => act(async () => navigate(ROUTES.settings))}
        >
          Settings
        </button>
      </div>

      {/* Select items to back up (cta_it7orxzx): in-place checkboxes */}
      <fieldset className="items">
        <legend>Select items to back up</legend>
        {sources.map((source) => {
          const hintId = `source-${source.id}-hint`
          return (
            <div key={source.id} className="item">
              <input
                type="checkbox"
                id={`source-${source.id}`}
                checked={selection.sourceIds.includes(source.id)}
                disabled={!source.configured}
                aria-describedby={hintId}
                onChange={(e) => toggle(source.id, e.target.checked)}
              />
              <label htmlFor={`source-${source.id}`}>{source.name}</label>
              <span id={hintId} className="hint">
                {source.configured ? source.location : source.notConfiguredReason}
              </span>
            </div>
          )
        })}
      </fieldset>

      {/* Set backup month (cta_jtpm50ep): in-place month picker. Listed last in the design; placed above
          Back up on request until modelwright can reorder actions. */}
      <div className="field backup-month">
        <label htmlFor="backup-month">Set backup month</label>
        <input
          type="month"
          id="backup-month"
          value={selection.month}
          max={currentMonth(new Date())}
          required
          onChange={(e) => setSelection({ ...selection, month: e.target.value })}
        />
      </div>

      {/* Back up (cta_d13d4frc, primary) → Home › Backup in progress */}
      <button
        type="button"
        className="primary"
        disabled={selection.sourceIds.length === 0 || !parseMonth(selection.month)}
        onClick={() => act((api) => api.backup.start(selection))}
      >
        Back up
      </button>

      {/* Clean up after backup (cta_kvwg329n): in-place checkbox */}
      <div className="item cleanup">
        <input
          type="checkbox"
          id="clean-up"
          checked={selection.cleanUp}
          aria-describedby="clean-up-hint"
          onChange={(e) => setSelection({ ...selection, cleanUp: e.target.checked })}
        />
        <label htmlFor="clean-up">Clean up after backup</label>
        <span id="clean-up-hint" className="hint">
          Moves the backed-up files to the trash once they’re safely in AWS
        </span>
      </div>
    </section>
  )
}
