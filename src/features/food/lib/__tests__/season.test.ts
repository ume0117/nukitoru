import { describe, it, expect } from 'vitest'
import { getSeasonFromDate } from '../season'

describe('getSeasonFromDate', () => {
  it('classifies March-May as spring', () => {
    expect(getSeasonFromDate(new Date(2026, 2, 15))).toBe('spring') // March
    expect(getSeasonFromDate(new Date(2026, 4, 31))).toBe('spring') // May
  })

  it('classifies June-August as summer', () => {
    expect(getSeasonFromDate(new Date(2026, 5, 1))).toBe('summer') // June
    expect(getSeasonFromDate(new Date(2026, 7, 25))).toBe('summer') // August
  })

  it('classifies September-November as autumn', () => {
    expect(getSeasonFromDate(new Date(2026, 8, 1))).toBe('autumn') // September
    expect(getSeasonFromDate(new Date(2026, 10, 30))).toBe('autumn') // November
  })

  it('classifies December-February as winter', () => {
    expect(getSeasonFromDate(new Date(2026, 11, 25))).toBe('winter') // December
    expect(getSeasonFromDate(new Date(2026, 0, 1))).toBe('winter') // January
    expect(getSeasonFromDate(new Date(2026, 1, 28))).toBe('winter') // February
  })
})
