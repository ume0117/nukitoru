import { describe, it, expect } from 'vitest'
import { deduplicateResults, generateId } from '../dedup'
import type { ScanResult } from '@/types'

function result(overrides: Partial<ScanResult>): ScanResult {
  return { id: generateId(), type: 'QR_CODE', value: 'x', ...overrides }
}

describe('deduplicateResults', () => {
  it('removes exact type+value duplicates', () => {
    const input = [
      result({ type: 'EAN_13', value: '4901234567894' }),
      result({ type: 'EAN_13', value: '4901234567894' }),
    ]
    expect(deduplicateResults(input)).toHaveLength(1)
  })

  it('keeps distinct values of the same type', () => {
    const input = [
      result({ type: 'EAN_13', value: '4901234567894' }),
      result({ type: 'EAN_13', value: '4912345678904' }),
    ]
    expect(deduplicateResults(input)).toHaveLength(2)
  })

  it('keeps the same value across different types', () => {
    const input = [
      result({ type: 'EAN_13', value: '12345' }),
      result({ type: 'CODE_128', value: '12345' }),
    ]
    expect(deduplicateResults(input)).toHaveLength(2)
  })

  it('collapses QR URLs that share hostname+pathname regardless of query string', () => {
    const input = [
      result({ type: 'QR_CODE', value: 'https://example.com/page?utm=a' }),
      result({ type: 'QR_CODE', value: 'https://example.com/page?utm=b' }),
    ]
    expect(deduplicateResults(input)).toHaveLength(1)
  })

  it('does not merge QR URLs with different paths', () => {
    const input = [
      result({ type: 'QR_CODE', value: 'https://example.com/a' }),
      result({ type: 'QR_CODE', value: 'https://example.com/b' }),
    ]
    expect(deduplicateResults(input)).toHaveLength(2)
  })
})

describe('generateId', () => {
  it('generates non-empty, distinct ids', () => {
    const a = generateId()
    const b = generateId()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThan(0)
  })
})
