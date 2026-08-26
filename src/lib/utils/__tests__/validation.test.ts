import { describe, it, expect } from 'vitest'
import { validateFile } from '../validation'

/** validateFile only reads `.type` and `.size`, so a plain object stands in for a real File. */
function fakeFile(type: string, size: number): File {
  return { type, size } as File
}

describe('validateFile', () => {
  it('accepts a PDF under the 50MB limit', () => {
    const result = validateFile(fakeFile('application/pdf', 10 * 1024 * 1024))
    expect(result).toEqual({ valid: true, fileType: 'pdf' })
  })

  it('rejects a PDF over the 50MB limit', () => {
    const result = validateFile(fakeFile('application/pdf', 51 * 1024 * 1024))
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/50MB/)
  })

  it('accepts a JPEG under the 20MB limit', () => {
    const result = validateFile(fakeFile('image/jpeg', 5 * 1024 * 1024))
    expect(result).toEqual({ valid: true, fileType: 'image' })
  })

  it('accepts PNG and WEBP', () => {
    expect(validateFile(fakeFile('image/png', 1024)).valid).toBe(true)
    expect(validateFile(fakeFile('image/webp', 1024)).valid).toBe(true)
  })

  it('rejects an image over the 20MB limit', () => {
    const result = validateFile(fakeFile('image/png', 21 * 1024 * 1024))
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/20MB/)
  })

  it('rejects unsupported file types', () => {
    const result = validateFile(fakeFile('text/plain', 100))
    expect(result.valid).toBe(false)
  })
})
