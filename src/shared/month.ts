// Backup months as "YYYY-MM" (the value format of <input type="month">).

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

const format = (year: number, monthIndex: number): string =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}`

export const currentMonth = (today: Date): string => format(today.getFullYear(), today.getMonth())

/** The month before `today`'s: backups usually cover last month, run early in the next. */
export function previousMonth(today: Date): string {
  const d = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  return format(d.getFullYear(), d.getMonth())
}

/** First day of the month, or null if `value` isn't "YYYY-MM". */
export function parseMonth(value: string): Date | null {
  const m = value.match(MONTH_RE)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : null
}
