import { describe, expect, it } from 'vitest'
import { currentMonth, parseMonth, previousMonth } from './month'

describe('backup months', () => {
  it('defaults to the previous month, across a year boundary', () => {
    expect(previousMonth(new Date(2026, 9, 7))).toBe('2026-09')
    expect(previousMonth(new Date(2026, 0, 1))).toBe('2025-12')
    expect(previousMonth(new Date(2026, 2, 31))).toBe('2026-02')
  })
  it('formats the current month', () => {
    expect(currentMonth(new Date(2026, 9, 7))).toBe('2026-10')
  })
  it('parses "YYYY-MM" and rejects anything else', () => {
    expect(parseMonth('2026-09')).toEqual(new Date(2026, 8, 1))
    expect(parseMonth('2026-13')).toBeNull()
    expect(parseMonth('2026-9')).toBeNull()
    expect(parseMonth('')).toBeNull()
  })
})
