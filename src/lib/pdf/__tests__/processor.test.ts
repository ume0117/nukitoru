import { describe, it, expect } from 'vitest'
import { isValidEAN13, extractJANsFromRawText, extractURLsFromRawText } from '../processor'

describe('isValidEAN13', () => {
  it('accepts a valid Japanese JAN code (45-prefix)', () => {
    expect(isValidEAN13('4901234567894')).toBe(true)
  })

  it('accepts a valid Japanese JAN code (49-prefix)', () => {
    expect(isValidEAN13('4912345678904')).toBe(true)
  })

  it('rejects a code with a wrong check digit', () => {
    expect(isValidEAN13('4901234567891')).toBe(false)
  })

  it('rejects a code that is not 13 digits', () => {
    expect(isValidEAN13('490123456789')).toBe(false)
  })

  it('rejects a code that does not start with 45 or 49', () => {
    expect(isValidEAN13('1234567890128')).toBe(false)
  })

  it('rejects non-numeric input', () => {
    expect(isValidEAN13('490123456789a')).toBe(false)
  })
})

describe('extractJANsFromRawText', () => {
  it('extracts a valid JAN embedded in surrounding text', () => {
    expect(extractJANsFromRawText('商品コード：4901234567894 です')).toEqual(['4901234567894'])
  })

  it('ignores 13-digit numbers that fail the checksum', () => {
    expect(extractJANsFromRawText('4901234567891')).toEqual([])
  })

  it('deduplicates repeated JAN codes', () => {
    expect(extractJANsFromRawText('4901234567894 4901234567894')).toEqual(['4901234567894'])
  })

  it('returns an empty array when no JAN-like sequence exists', () => {
    expect(extractJANsFromRawText('こんにちは')).toEqual([])
  })
})

describe('extractURLsFromRawText', () => {
  it('extracts a plain https URL', () => {
    expect(extractURLsFromRawText('詳細は https://example.com/page をご覧ください')).toEqual([
      'https://example.com/page',
    ])
  })

  it('strips trailing Japanese punctuation', () => {
    expect(extractURLsFromRawText('サイト（https://example.com）参照。')).toEqual([
      'https://example.com',
    ])
  })

  it('returns an empty array when no URL exists', () => {
    expect(extractURLsFromRawText('URLはありません')).toEqual([])
  })
})
