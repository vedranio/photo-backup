import { useNavigate } from 'react-router'
import { parseMonth } from '@shared/month'
import { useAppState } from '../../AppState'
import { ROUTES } from '../../design'
import { AppHeader } from '../../components/AppHeader'
import { MonthScale } from '../../components/MonthScale'

function Check(): React.JSX.Element {
  return (
    <span className="check" aria-hidden="true">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#111111"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="5 12.5 10 17.5 19 7" />
      </svg>
    </span>
  )
}

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
    <>
      <AppHeader>
        {/* Settings (cta_brxb5a35) → Settings */}
        <button
          type="button"
          className="btn small"
          onClick={() => act(async () => navigate(ROUTES.settings))}
        >
          Settings
        </button>
      </AppHeader>

      <div className="home-grid">
        {/* Select items to back up (cta_it7orxzx): in-place checkboxes */}
        <fieldset className="items">
          <legend className="eyebrow">Select items to back up</legend>
          {sources.map((source, i) => {
            const hintId = `source-${source.id}-hint`
            return (
              <label key={source.id} className={i === sources.length - 1 ? 'item last' : 'item'}>
                <input
                  type="checkbox"
                  checked={selection.sourceIds.includes(source.id)}
                  disabled={!source.configured}
                  aria-describedby={hintId}
                  onChange={(e) => toggle(source.id, e.target.checked)}
                />
                <Check />
                <span className="item-text">
                  <span className="item-name">{source.name}</span>
                  <span id={hintId} className="item-hint">
                    {source.configured
                      ? (source.displayLocation ?? source.location)
                      : source.notConfiguredReason}
                  </span>
                </span>
              </label>
            )
          })}

          {/* Clean up after backup (cta_kvwg329n): in-place checkbox, grouped with the items it affects */}
          <label className="item option">
            <input
              type="checkbox"
              checked={selection.cleanUp}
              aria-describedby="clean-up-hint"
              onChange={(e) => setSelection({ ...selection, cleanUp: e.target.checked })}
            />
            <Check />
            <span className="item-text">
              <span className="item-name">Clean up after backup</span>
              <span id="clean-up-hint" className="visually-hidden">
                Moves the backed-up files to the trash once they’re safely in AWS
              </span>
            </span>
          </label>
        </fieldset>

        {/* Set backup month (cta_jtpm50ep): in-place month scale */}
        <MonthScale
          labelId="backup-month-label"
          value={selection.month}
          onChange={(month) => setSelection({ ...selection, month })}
        />
      </div>

      <div className="screen-actions">
        {/* Back up (cta_d13d4frc, primary) → Home › Backup in progress */}
        <button
          type="button"
          className="btn primary"
          disabled={selection.sourceIds.length === 0 || !parseMonth(selection.month)}
          onClick={() => act((api) => api.backup.start(selection))}
        >
          Back up
        </button>
      </div>
    </>
  )
}
