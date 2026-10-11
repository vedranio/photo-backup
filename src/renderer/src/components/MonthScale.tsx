import { useEffect, useRef, type KeyboardEvent } from 'react'
import { currentMonth, parseMonth } from '@shared/month'
import { formatMonth, MONTH_ABBREVIATIONS } from '../format'

const toIndex = (value: string): number | null => {
  const d = parseMonth(value)
  return d ? d.getFullYear() * 12 + d.getMonth() : null
}

const fromIndex = (i: number): string =>
  `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`

interface Props {
  labelId: string
  value: string
  onChange(value: string): void
}

/**
 * A five-month scale, like a lens's focus scale, with a red index over the chosen month. The window
 * keeps the choice second from the right (never past the current month), so picking the leftmost
 * month walks it further back. A radio group: Tab reaches the chosen month, ←/→ move it, Home/End
 * jump to the window's ends.
 */
export function MonthScale({ labelId, value, onChange }: Props): React.JSX.Element {
  const max = toIndex(currentMonth(new Date()))!
  const selected = toIndex(value) ?? max - 1
  const end = Math.min(max, selected + 1)
  const months = Array.from({ length: 5 }, (_, i) => end - 4 + i)

  const scale = useRef<HTMLDivElement>(null)
  const moveFocus = useRef(false)
  // After a keyboard move, keep focus on the newly chosen month (the window may have shifted).
  useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    scale.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
  }, [selected])

  const onKeyDown = (e: KeyboardEvent): void => {
    const target = {
      ArrowLeft: selected - 1,
      ArrowRight: Math.min(max, selected + 1),
      Home: months[0],
      End: months[months.length - 1]
    }[e.key]
    if (target === undefined) return
    e.preventDefault()
    if (target === selected) return
    moveFocus.current = true
    onChange(fromIndex(target))
  }

  return (
    <div className="month-scale">
      <span id={labelId} className="eyebrow">
        Set backup month
      </span>
      <div
        ref={scale}
        className="month-ticks"
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={onKeyDown}
      >
        {months.map((i) => {
          const month = fromIndex(i)
          return (
            <button
              key={i}
              type="button"
              className="month-btn"
              role="radio"
              aria-checked={i === selected}
              tabIndex={i === selected ? 0 : -1}
              aria-label={formatMonth(month)}
              onClick={() => onChange(month)}
            >
              <span className="month-marker" aria-hidden="true" />
              <span className="month-tick" aria-hidden="true" />
              <span aria-hidden="true">{MONTH_ABBREVIATIONS[i % 12]}</span>
            </button>
          )
        })}
      </div>
      <span className="month-full" aria-live="polite">
        {formatMonth(fromIndex(selected))}
      </span>
    </div>
  )
}
