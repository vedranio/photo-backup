import { parseMonth } from '@shared/month'

export function formatBytes(bytes: number): string {
  const units = ['bytes', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit++
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`
}

export const formatCount = (n: number): string => n.toLocaleString()

export const MONTH_ABBREVIATIONS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC'
] as const

/** "2026-09" → "September 2026". */
export function formatMonth(value: string | undefined): string {
  const date = value ? parseMonth(value) : null
  return date ? date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : ''
}
