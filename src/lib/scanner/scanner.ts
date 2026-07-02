/**
 * scanner.ts
 *
 * QR コード  → jsQR（シンプル・高精度・反転色標準対応）
 * 1D バーコード → ZXing（EAN-13 / EAN-8 / CODE 128）
 *
 * 【重要な設計判断】
 * - 画像スケールアップは行わない（バイリニア補間でQRのエッジが灰色化し検出不能になるため）
 * - 領域切り出しは imageSmoothingEnabled = false（ニアレストネイバー = シャープなエッジ維持）
 * - jsQR は inversionAttempts: 'attemptBoth' で反転色QR（白背景でないもの）も自動対応
 */

import type { ScanResult } from '@/types'
import { deduplicateResults, generateId } from '@/lib/utils/dedup'

// ============================================================
// ZXing 初期化（1D バーコード専用）
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let zxingReader: any = null

async function getZXingReader() {
  if (zxingReader) return zxingReader
  const { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } =
    await import('@zxing/library')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hints = new Map<any, any>()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.CODE_128,
  ])
  hints.set(DecodeHintType.TRY_HARDER, true)
  zxingReader = new BrowserMultiFormatReader(hints)
  return zxingReader
}

const ZXING_FORMAT: Record<number, ScanResult['type']> = {
  7: 'EAN_13',
  6: 'EAN_8',
  4: 'CODE_128',
}

// ============================================================
// Canvas ユーティリティ
// ============================================================

/**
 * 領域を切り出す。
 * smoothing = false にすることで QR モジュールのエッジを維持し、検出精度を上げる。
 */
function extractRegion(
  src: HTMLCanvasElement,
  x: number, y: number, w: number, h: number,
  smooth = false,
): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width  = Math.max(1, Math.floor(w))
  c.height = Math.max(1, Math.floor(h))
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = smooth
  ctx.drawImage(src, x, y, w, h, 0, 0, c.width, c.height)
  return c
}

function prepareCanvas(src: HTMLCanvasElement, maxDim = 2400): HTMLCanvasElement {
  const { width: w, height: h } = src
  if (w <= maxDim && h <= maxDim) return src
  // スケールダウンのみ（スケールアップは行わない）
  const scale = Math.min(maxDim / w, maxDim / h)
  const c = document.createElement('canvas')
  c.width  = Math.floor(w * scale)
  c.height = Math.floor(h * scale)
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = true  // スケールダウン時はスムージングOK
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, c.width, c.height)
  return c
}

function enhanceContrast(src: HTMLCanvasElement): HTMLCanvasElement {
  const c   = extractRegion(src, 0, 0, src.width, src.height, false)
  const ctx = c.getContext('2d')!
  const d   = ctx.getImageData(0, 0, c.width, c.height)
  const px  = d.data
  let min = 255; let max = 0
  for (let i = 0; i < px.length; i += 4) {
    const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
    if (g < min) min = g
    if (g > max) max = g
  }
  const range = max - min || 1
  for (let i = 0; i < px.length; i += 4) {
    const g = ((0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) - min) / range * 255
    px[i] = px[i + 1] = px[i + 2] = Math.round(Math.min(255, Math.max(0, g)))
  }
  ctx.putImageData(d, 0, 0)
  return c
}

// ============================================================
// QR スキャン（jsQR）
// ============================================================

async function scanQR(
  canvas: HTMLCanvasElement,
  page?: number,
): Promise<ScanResult[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsQRModule = await import('jsqr') as any
  // CJS/ESM 両方に対応したインポート解決
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsQR: (data: Uint8ClampedArray, w: number, h: number, opts: any) => any =
    jsQRModule.default ?? jsQRModule

  if (typeof jsQR !== 'function') {
    console.error('[Nukitoru] jsQR load failed', jsQRModule)
    return []
  }

  const results: ScanResult[] = []
  const w = canvas.width
  const h = canvas.height

  // スキャン対象領域
  const regions: Array<[number, number, number, number]> = [
    [0, 0, w, h],
    // 2×2 グリッド
    [0, 0, w / 2, h / 2],
    [w / 2, 0, w / 2, h / 2],
    [0, h / 2, w / 2, h / 2],
    [w / 2, h / 2, w / 2, h / 2],
  ]
  // 3×3 グリッド（十分大きい場合）
  if (w >= 300 && h >= 300) {
    for (let r = 0; r < 3; r++) {
      for (let cc = 0; cc < 3; cc++) {
        regions.push([cc * w / 3, r * h / 3, w / 3, h / 3])
      }
    }
  }

  const opts = { inversionAttempts: 'attemptBoth' as const }

  for (const [x, y, rw, rh] of regions) {
    // smooth=false でシャープなエッジを維持
    const sub = extractRegion(canvas, x, y, rw, rh, false)
    const ctx = sub.getContext('2d')!
    const imgData = ctx.getImageData(0, 0, sub.width, sub.height)
    const hit = jsQR(imgData.data, sub.width, sub.height, opts)
    if (hit?.data) {
      results.push({ id: generateId(), type: 'QR_CODE', value: hit.data, page })
    }
  }

  // コントラスト強化版でも試す
  const enh = enhanceContrast(canvas)
  const ectx = enh.getContext('2d')!
  const eData = ectx.getImageData(0, 0, enh.width, enh.height)
  const eHit = jsQR(eData.data, enh.width, enh.height, opts)
  if (eHit?.data) {
    results.push({ id: generateId(), type: 'QR_CODE', value: eHit.data, page })
  }

  return results
}

// ============================================================
// 1D バーコードスキャン（ZXing）
// ============================================================

function tryZXing(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reader: any,
  canvas: HTMLCanvasElement,
): Omit<ScanResult, 'id' | 'page'> | null {
  if (canvas.width < 20 || canvas.height < 20) return null
  try {
    const result = reader.decodeFromCanvas(canvas)
    const type = ZXING_FORMAT[result.getBarcodeFormat() as number]
    if (!type) return null
    return { type, value: result.getText() as string }
  } catch {
    return null
  }
}

async function scan1D(
  canvas: HTMLCanvasElement,
  page?: number,
): Promise<ScanResult[]> {
  const reader = await getZXingReader()
  const w = canvas.width
  const h = canvas.height
  const raw: Omit<ScanResult, 'id'>[] = []

  const regions: Array<[number, number, number, number]> = [
    [0, 0, w, h],
    [0, 0, w / 2, h / 2],
    [w / 2, 0, w / 2, h / 2],
    [0, h / 2, w / 2, h / 2],
    [w / 2, h / 2, w / 2, h / 2],
  ]
  for (let i = 0; i < 6; i++) {
    regions.push([0, i * h / 6, w, h / 6])
  }

  let tick = 0
  for (const [x, y, rw, rh] of regions) {
    const sub = extractRegion(canvas, x, y, rw, rh, true)
    const hit = tryZXing(reader, sub)
    if (hit) raw.push({ ...hit, page })
    if (++tick % 5 === 0) await new Promise((r) => setTimeout(r, 0))
  }

  const enh = enhanceContrast(canvas)
  const enhHit = tryZXing(reader, enh)
  if (enhHit) raw.push({ ...enhHit, page })

  return raw.map((r) => ({ ...r, id: generateId() }))
}

// ============================================================
// メイン API
// ============================================================

export async function scanCanvas(
  canvas: HTMLCanvasElement,
  page?: number,
): Promise<ScanResult[]> {
  const work = prepareCanvas(canvas)
  const [qrResults, barResults] = await Promise.all([
    scanQR(work, page),
    scan1D(work, page),
  ])
  return deduplicateResults([...qrResults, ...barResults])
}

/**
 * 画像ファイルを Canvas に変換する。
 *
 * 【重要】スケールアップは行わない。
 * 小さな QR コード画像をバイリニア補間で拡大するとエッジが灰色化し、
 * jsQR の検出精度が著しく低下する。
 * ← Node.js テストで 190×190 を等倍で読んだ際に検出成功したことを確認済み。
 */
export function imageFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      // スケールダウンのみ（大きすぎる画像のメモリ保護）
      const MAX_DIM = 3000
      const maxSide = Math.max(img.width, img.height)
      const scale = maxSide > MAX_DIM ? MAX_DIM / maxSide : 1

      const c = document.createElement('canvas')
      c.width  = Math.floor(img.width  * scale)
      c.height = Math.floor(img.height * scale)
      const ctx = c.getContext('2d')!
      // スケールダウン時のみスムージング。等倍・スケールアップは false。
      ctx.imageSmoothingEnabled = scale < 1
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, c.width, c.height)
      resolve(c)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('画像の読み込みに失敗しました'))
    }
    img.src = url
  })
}
