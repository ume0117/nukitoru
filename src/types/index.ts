// ============================================================
// コード種別
// ============================================================
export type BarcodeType = 'QR_CODE' | 'EAN_13' | 'EAN_8' | 'CODE_128'

// ZXing の BarcodeFormat enum の数値マッピング
// （動的インポート後に enum が使えない箇所で使用）
export const BARCODE_FORMAT_MAP: Record<number, BarcodeType> = {
  11: 'QR_CODE',
  7:  'EAN_13',
  6:  'EAN_8',
  4:  'CODE_128',
}

export const BARCODE_LABELS: Record<BarcodeType, string> = {
  QR_CODE:  'QR Code',
  EAN_13:   'JAN / EAN-13',
  EAN_8:    'EAN-8',
  CODE_128: 'CODE 128',
}

// ============================================================
// スキャン結果
// ============================================================
export interface ScanResult {
  /** 一意ID（表示・削除管理に使用） */
  id: string
  type: BarcodeType
  value: string
  /** PDFのページ番号（画像の場合は undefined） */
  page?: number
}

// ============================================================
// スキャン進捗
// ============================================================
export type ScanStatus = 'idle' | 'scanning' | 'done' | 'error'

export interface ScanProgress {
  current: number
  total: number
  status: ScanStatus
  message: string
}

// ============================================================
// ファイルバリデーション
// ============================================================
export type FileType = 'pdf' | 'image'

export interface FileValidation {
  valid: boolean
  fileType?: FileType
  error?: string
}

// ============================================================
// 将来の拡張用スタブ（実装は有料プランで追加予定）
// ============================================================
export interface ScanHistoryEntry {
  id: string
  filename: string
  scannedAt: Date
  results: ScanResult[]
}

export interface UserPlan {
  type: 'free' | 'pro'
  features: {
    history: boolean
    batchProcessing: boolean
    csvExport: boolean
    productSearch: boolean
    aiAnalysis: boolean
  }
}
