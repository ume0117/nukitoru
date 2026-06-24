/**
 * scanner.ts
 * ブラウザ内でのみ動作するバーコード解析モジュール。
 * ZXing を動的インポートし、グリッド分割 + コントラスト強化で複数コードを高精度に検出する。
 */

import type { ScanResult } from '@/types'
import { BARCODE_FORMAT_MAP } from '@/types'
import { deduplicateResults, generateId } from '@/lib/utils/dedup'

// ============================================================
// ZXing 初期化（モジュールレベルシングルトン）
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let zxingReader: any = null

async function getReader(): Promise<NonNullable<typeof zxingReader>> {
  if (zxingReader) return zxingReader

  const {
    BrowserMultiFormatReader,
    DecodeHintType,
    BarcodeFormat,
  } = await import('@zxing/library')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hints = new Map<any, any>()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.QR_CODE,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.CODE_128,
  ])
  // TRY_HARDER: 斜め・小さいコードも検出を試みる
  hints.set(DecodeHintType.TRY_HARDER, true)

  zxingReader = new BrowserMultiFormatReader(hints)
  return zxingReader
}

// ============================================================
// Canvas 操作ユーティリティ
// ============================================================

/** 元 Canvas の指定領域を新しい Canvas に切り出す */
function extractRegion(
  src: HTMLCanvasElement,
  x: number, y: number,
  w: number, h: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width  = Math.max(1, Math.floor(w))
  canvas.height = Math.max(1, Math.floor(h))
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(src, x, y, w, h, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * サイズが大きすぎる Canvas をスキャン最適サイズに調整。
 * メモリ保護 + ZXing の処理速度向上のため。
 */
function prepareCanvas(src: HTMLCanvasElement, maxDim = 2400): HTMLCanvasElement {
  const { width, height } = src
  if (width <= maxDim && height <= maxDim) return src

  const scale = Math.min(maxDim / width, maxDim / height)
  const canvas = document.createElement('canvas')
  canvas.width  = Math.floor(width  * scale)
  canvas.height = Math.floor(height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled  = true
  ctx.imageSmoothingQuality  = 'high'
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * ヒストグラム正規化でコントラストを強化し、グレースケール変換。
 * 薄い・退色したバーコードの検出率を上げる。
 */
function enhanceContrast(src: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = extractRegion(src, 0, 0, src.width, src.height)
  const ctx    = canvas.getContext('2d')!
  const data   = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px     = data.data

  // ヒストグラムの最小・最大輝度を検出
  let min = 255; let max = 0
  for (let i = 0; i < px.length; i += 4) {
    const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
    if (g < min) min = g
    if (g > max) max = g
  }
  const range = max - min || 1

  // 輝度正規化 + グレースケール変換
  for (let i = 0; i < px.length; i += 4) {
    const g = ((0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) - min) / range * 255
    px[i] = px[i + 1] = px[i + 2] = Math.round(Math.min(255, Math.max(0, g)))
  }

  ctx.putImageData(data, 0, 0)
  return canvas
}

// ============================================================
// デコード試行
// ============================================================

function tryDecode(
  reader: NonNullable<typeof zxingReader>,
  canvas: HTMLCanvasElement,
): Omit<ScanResult, 'id' | 'page'> | null {
  // 最小サイズチェック（小さすぎる領域はスキップ）
  if (canvas.width < 20 || canvas.height < 20) return null

  try {
    const result = reader.decodeFromCanvas(canvas)
    const format = BARCODE_FORMAT_MAP[result.getBarcodeFormat() as number]
    if (!format) return null
    return { type: format, value: result.getText() as string }
  } catch {
    // NotFoundException は通常パス（コードなし）
    return null
  }
}

// ============================================================
// スキャン領域の生成（グリッド + ストリップ）
// ============================================================

/**
 * 画像全体を複数の重複あり領域に分割して返す。
 * - 全体スキャン × 1
 * - 2×2 グリッド（境界付近のコードを捕捉）
 * - 3×3 グリッド（密集した複数コードに対応）
 * - 水平ストリップ × 6（1D バーコードに特化した走査）
 */
function getScanRegions(
  w: number,
  h: number,
): Array<[number, number, number, number]> {
  const regions: Array<[number, number, number, number]> = []

  // 1. 全体
  regions.push([0, 0, w, h])

  // 2. 2×2 グリッド（10% オーバーラップ）
  const ov2 = 0.1
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const x  = Math.max(0,     (w / 2) * c - w * ov2 / 2)
      const y  = Math.max(0,     (h / 2) * r - h * ov2 / 2)
      const rw = Math.min(w - x, w / 2 + w * ov2)
      const rh = Math.min(h - y, h / 2 + h * ov2)
      regions.push([x, y, rw, rh])
    }
  }

  // 3. 3×3 グリッド（画像が十分大きい場合のみ）
  if (w >= 300 && h >= 300) {
    const ov3 = 0.12
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const x  = Math.max(0,     (w / 3) * c - w * ov3 / 3)
        const y  = Math.max(0,     (h / 3) * r - h * ov3 / 3)
        const rw = Math.min(w - x, w / 3 + w * ov3 * 2 / 3)
        const rh = Math.min(h - y, h / 3 + h * ov3 * 2 / 3)
        regions.push([x, y, rw, rh])
      }
    }
  }

  // 4. 水平ストリップ（EAN/CODE128 は横向きに走査すると精度が上がる）
  const numStrips = 6
  for (let i = 0; i < numStrips; i++) {
    const y  = (h / numStrips) * i
    const rh = h / numStrips
    regions.push([0, y, w, rh])
  }

  return regions
}

// ============================================================
// メイン API
// ============================================================

/**
 * 1枚の Canvas から全バーコード/QRを抽出する。
 * PDF の 1 ページ、または画像ファイル 1 枚に対応。
 */
export async function scanCanvas(
  canvas: HTMLCanvasElement,
  page?: number,
): Promise<ScanResult[]> {
  const reader  = await getReader()
  const work    = prepareCanvas(canvas)
  const { width: w, height: h } = work

  const raw: Omit<ScanResult, 'id'>[] = []
  const regions = getScanRegions(w, h)

  let tick = 0
  for (const [x, y, rw, rh] of regions) {
    const sub = extractRegion(work, x, y, rw, rh)
    const hit = tryDecode(reader, sub)
    if (hit) raw.push({ ...hit, page })

    // 5 領域ごとにメインスレッドを解放（UI フリーズ防止）
    if (++tick % 5 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  // コントラスト強化版で全体再スキャン（薄い印字への対策）
  const enhanced = enhanceContrast(work)
  const enhHit   = tryDecode(reader, enhanced)
  if (enhHit) raw.push({ ...enhHit, page })

  // ID 付与 + 重複除外
  return deduplicateResults(raw.map((r) => ({ ...r, id: generateId() })))
}

/**
 * 画像ファイルを Canvas に変換する。
 * 小さい画像はスケールアップして検出精度を上げる。
 */
export function imageFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)

      // 最小辺が 1000px 未満 → 最大 3 倍までスケールアップ
      // 最大辺が 3000px 超 → スケールダウン
      const MIN_DIM = 1000
      const MAX_DIM = 3000
      const minSide = Math.min(img.width, img.height)
      const maxSide = Math.max(img.width, img.height)

      let scale = 1
      if (minSide < MIN_DIM) {
        scale = Math.min(MIN_DIM / minSide, 3)
      } else if (maxSide > MAX_DIM) {
        scale = MAX_DIM / maxSide
      }

      const canvas  = document.createElement('canvas')
      canvas.width  = Math.floor(img.width  * scale)
      canvas.height = Math.floor(img.height * scale)

      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      resolve(canvas)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('画像の読み込みに失敗しました'))
    }

    img.src = url
  })
}
