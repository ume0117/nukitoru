import { describe, it, expect } from 'vitest'
import { getStockStatus, setStockStatus, isValidStockStatus } from '../stock-status'
import type { StockStatusEntry } from '@/features/food/types'

const FIXED_NOW = '2026-08-26T00:00:00.000Z'

describe('getStockStatus', () => {
  it('returns available when no entry exists for the item', () => {
    expect(getStockStatus({}, '卵')).toBe('available')
  })

  it('returns the stored status when an available entry exists', () => {
    const map: Record<string, StockStatusEntry> = { 卵: { status: 'available' } }
    expect(getStockStatus(map, '卵')).toBe('available')
  })

  it('returns the stored status when a low entry exists', () => {
    const map: Record<string, StockStatusEntry> = { 卵: { status: 'low' } }
    expect(getStockStatus(map, '卵')).toBe('low')
  })

  it('returns the stored status when an out entry exists', () => {
    const map: Record<string, StockStatusEntry> = { 卵: { status: 'out' } }
    expect(getStockStatus(map, '卵')).toBe('out')
  })

  it('works for custom (non-master) item names', () => {
    const map: Record<string, StockStatusEntry> = { 自家製梅干し: { status: 'low' } }
    expect(getStockStatus(map, '自家製梅干し')).toBe('low')
  })

  it('falls back to available for a malformed status value', () => {
    const map = { 卵: { status: 'unknown' } } as unknown as Record<string, StockStatusEntry>
    expect(getStockStatus(map, '卵')).toBe('available')
  })
})

describe('setStockStatus', () => {
  it('sets the status and updatedAt using the injected now value', () => {
    const result = setStockStatus({}, '卵', 'low', FIXED_NOW)
    expect(result).toEqual({ 卵: { status: 'low', updatedAt: FIXED_NOW } })
  })

  it('does not mutate the input map', () => {
    const input: Record<string, StockStatusEntry> = { 卵: { status: 'available' } }
    setStockStatus(input, '卵', 'out', FIXED_NOW)
    expect(input).toEqual({ 卵: { status: 'available' } })
  })

  it('preserves other entries when updating one item', () => {
    const input: Record<string, StockStatusEntry> = {
      卵: { status: 'available' },
      牛乳: { status: 'low' },
    }
    const result = setStockStatus(input, '卵', 'out', FIXED_NOW)
    expect(result.牛乳).toEqual({ status: 'low' })
    expect(result.卵).toEqual({ status: 'out', updatedAt: FIXED_NOW })
  })

  it('works for custom (non-master) item names', () => {
    const result = setStockStatus({}, '自家製ピクルス', 'available', FIXED_NOW)
    expect(result.自家製ピクルス).toEqual({ status: 'available', updatedAt: FIXED_NOW })
  })
})

describe('isValidStockStatus', () => {
  it('accepts available / low / out', () => {
    expect(isValidStockStatus('available')).toBe(true)
    expect(isValidStockStatus('low')).toBe(true)
    expect(isValidStockStatus('out')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isValidStockStatus('unknown')).toBe(false)
    expect(isValidStockStatus(undefined)).toBe(false)
    expect(isValidStockStatus(123)).toBe(false)
  })
})
