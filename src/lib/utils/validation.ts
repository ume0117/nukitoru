import type { FileValidation } from '@/types'

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const PDF_TYPE = 'application/pdf'

const MAX_PDF_BYTES   = 50 * 1024 * 1024 // 50 MB
const MAX_IMAGE_BYTES = 20 * 1024 * 1024 // 20 MB

function fmtSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function validateFile(file: File): FileValidation {
  if (file.type === PDF_TYPE) {
    if (file.size > MAX_PDF_BYTES) {
      return {
        valid: false,
        error: `PDFは50MB以下にしてください（現在: ${fmtSize(file.size)}）`,
      }
    }
    return { valid: true, fileType: 'pdf' }
  }

  if (ALLOWED_IMAGE_TYPES.has(file.type)) {
    if (file.size > MAX_IMAGE_BYTES) {
      return {
        valid: false,
        error: `画像は20MB以下にしてください（現在: ${fmtSize(file.size)}）`,
      }
    }
    return { valid: true, fileType: 'image' }
  }

  return {
    valid: false,
    error: 'PDF・JPG・PNG・WEBPのみ対応しています',
  }
}
