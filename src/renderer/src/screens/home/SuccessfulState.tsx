import { useEffect, useState } from 'react'
import type { BackupSnapshot } from '@shared/api'
import { useAppState } from '../../AppState'
import { formatBytes, formatCount } from '../../format'
import { MonthHeader } from './MonthHeader'

/** Copies `text`, showing a check for a moment afterwards. */
function CopyButton({ text, label }: { text: string; label: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])
  return (
    <button
      type="button"
      className="copy-btn"
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
      onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true))}
    >
      {copied ? (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="5 12.5 10 17.5 19 7" />
        </svg>
      ) : (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
        </svg>
      )}
    </button>
  )
}

/** Home › Backup successful (st_uh8cvm18). */
export function SuccessfulState({ snapshot }: { snapshot: BackupSnapshot }): React.JSX.Element {
  const { act } = useAppState()
  const result = snapshot.result
  const [size, unit] = formatBytes(result?.totalBytes ?? 0).split(' ')
  return (
    <>
      <MonthHeader snapshot={snapshot} />
      {/* Confirmation of number of items and size backed up */}
      <section role="status" className="result">
        <p className="eyebrow">Backup complete</p>
        <div className="result-grid">
          <div className="stat">
            <span className="stat-number">{formatCount(result?.itemCount ?? 0)}</span>
            <span className="label-xs">
              {result?.itemCount === 1 ? 'Item backed up' : 'Items backed up'}
            </span>
          </div>
          <div className="stat">
            <span className="stat-number">
              {size}
              <span className="stat-unit"> {unit}</span>
            </span>
            <span className="label-xs">Size</span>
          </div>
        </div>
        {result && (
          <div className="destination-row">
            <p className="destination">{result.destination}</p>
            <CopyButton text={result.destination} label="Copy location" />
          </div>
        )}
      </section>
      <div className="screen-actions">
        {/* Done (cta_82byeemg) → Home › Default */}
        <button
          type="button"
          className="btn primary"
          onClick={() => act((api) => api.backup.dismiss())}
        >
          Done
        </button>
      </div>
    </>
  )
}
