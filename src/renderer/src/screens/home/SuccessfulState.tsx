import type { BackupSnapshot } from '@shared/api'
import { useAppState } from '../../AppState'
import { formatBytes, formatCount } from '../../format'

/** Home › Backup successful (st_uh8cvm18). */
export function SuccessfulState({ snapshot }: { snapshot: BackupSnapshot }): React.JSX.Element {
  const { act } = useAppState()
  const result = snapshot.result
  return (
    <section className="state" aria-label="Backup successful">
      {/* Confirmation of number of items and size backed up */}
      <p role="status" className="confirmation">
        Backed up {formatCount(result?.itemCount ?? 0)} {result?.itemCount === 1 ? 'item' : 'items'}{' '}
        ({formatBytes(result?.totalBytes ?? 0)})
      </p>
      {result && <p className="hint destination">{result.destination}</p>}
      <div className="actions">
        {/* Done (cta_82byeemg) → Home › Default */}
        <button
          type="button"
          className="secondary"
          onClick={() => act((api) => api.backup.dismiss())}
        >
          Done
        </button>
      </div>
    </section>
  )
}
