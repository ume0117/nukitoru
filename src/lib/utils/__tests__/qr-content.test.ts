import { describe, it, expect } from 'vitest'
import { detectQRContentType, analyzeURL, extractDomain } from '../qr-content'

describe('detectQRContentType', () => {
  it('detects URL', () => {
    expect(detectQRContentType('https://example.com')).toBe('URL')
    expect(detectQRContentType('http://example.com')).toBe('URL')
  })

  it('detects WiFi config', () => {
    expect(detectQRContentType('WIFI:T:WPA;S:MyNetwork;P:password;;')).toBe('WIFI')
  })

  it('detects vCard', () => {
    expect(detectQRContentType('BEGIN:VCARD\nFN:Taro Yamada\nEND:VCARD')).toBe('VCARD')
  })

  it('detects mailto', () => {
    expect(detectQRContentType('mailto:someone@example.com')).toBe('EMAIL')
  })

  it('detects tel', () => {
    expect(detectQRContentType('tel:+81312345678')).toBe('TEL')
  })

  it('falls back to plain text', () => {
    expect(detectQRContentType('ただのテキストです')).toBe('TEXT')
  })
})

describe('extractDomain', () => {
  it('strips protocol and www prefix', () => {
    expect(extractDomain('https://www.example.com/path')).toBe('example.com')
  })

  it('returns the raw value for a non-URL string', () => {
    expect(extractDomain('not a url')).toBe('not a url')
  })
})

describe('analyzeURL', () => {
  it('has no warnings for an ordinary URL', () => {
    const result = analyzeURL('https://example.com/page')
    expect(result.hasWarnings).toBe(false)
    expect(result.warnings).toEqual([])
  })

  it('warns on IP-address URLs', () => {
    const result = analyzeURL('http://192.168.0.1/login')
    expect(result.hasWarnings).toBe(true)
    expect(result.warnings.some((w) => w.type === 'ip')).toBe(true)
  })

  it('warns on punycode domains', () => {
    const result = analyzeURL('https://xn--eckwd4c7c.jp/')
    expect(result.warnings.some((w) => w.type === 'punycode')).toBe(true)
  })

  it('warns on known URL shorteners', () => {
    const result = analyzeURL('https://bit.ly/abc123')
    expect(result.warnings.some((w) => w.type === 'shortener')).toBe(true)
  })

  it('warns on suspicious TLDs', () => {
    const result = analyzeURL('https://free-gift.top/win')
    expect(result.warnings.some((w) => w.type === 'suspicious_tld')).toBe(true)
  })

  it('warns on very long URLs', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(200)
    const result = analyzeURL(longUrl)
    expect(result.warnings.some((w) => w.type === 'long_url')).toBe(true)
  })
})
