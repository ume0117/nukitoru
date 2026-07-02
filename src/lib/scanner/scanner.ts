/**
 * scanner.ts
 *
 * QR コード    → jsQR（全ブラウザ・高精度・反転色対応）
 * 1D バーコード → zbar-wasm（全ブラウザ対応）+ BarcodeDetector（Chrome補完）
 *
 * zbar-wasm は pyzbar と同じ zbar エンジンの WASM 版。
 * Safari/Firefox を含む全ブラウザで EAN-13・EAN-8・CODE128 を検出できる。
 */

import type { ScanResult } from '@/types'
import { deduplicateResults, generateId } from '@/lib/utils/dedup'

// ============================================================
// Canvas ユーティリティ
// ============================================================

function extractRegion(
  src: HTMLCanvasElement,
  x: number, y: number, w: number, h: number,
  smooth = false,
): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width  = Math.max(1, Math.floor(w))
  c.height = Math.max(1, Math.floor(h))
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = smooth
  ctx.drawImage(src, x, y, w, h, 0, 0, c.width, c.height)
  return c
}

function prepareCanvas(src: HTMLCanvasElement, maxDim = 2400): HTMLCanvasElement {
  const { width: w, height: h } = src
  if (w <= maxDim && h <= maxDim) return src
  const scale = Math.min(maxDim / w, maxDim / h)
  const c = document.createElement('canvas')
  c.width  = Math.floor(w * scale)
  c.height = Math.floor(h * scale)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, c.width, c.height)
  return c
}

function enhanceContrast(src: HTMLCanvasElement): HTMLCanvasElement {
  const c   = extractRegion(src, 0, 0, src.width, src.height)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
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

function getImageData(canvas: HTMLCanvasElement): ImageData {
  return canvas.getContext('2d', { willReadFrequently: true })!
    .getImageData(0, 0, canvas.width, canvas.height)
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsQR: (data: Uint8ClampedArray, w: number, h: number, opts: any) => any =
    jsQRModule.default ?? jsQRModule
  if (typeof jsQR !== 'function') return []

  const results: ScanResult[] = []
  const w = canvas.width
  const h = canvas.height
  const opts = { inversionAttempts: 'attemptBoth' as const }

  const regions: Array<[number, number, number, number]> = [
    [0, 0, w, h],
    [0, 0, w / 2, h / 2],
    [w / 2, 0, w / 2, h / 2],
    [0, h / 2, w / 2, h / 2],
    [w / 2, h / 2, w / 2, h / 2],
  ]
  if (w >= 300 && h >= 300) {
    for (let r = 0; r < 3; r++) {
      for (let cc = 0; cc < 3; cc++) {
        regions.push([cc * w / 3, r * h / 3, w / 3, h / 3])
      }
    }
  }

  for (const [x, y, rw, rh] of regions) {
    const sub = extractRegion(canvas, x, y, rw, rh, false)
    const imgData = getImageData(sub)
    const hit = jsQR(imgData.data, sub.width, sub.height, opts)
    if (hit?.data) {
      const val = hit.data.trim()
      // 既に同じ値があれば追加しない
      if (!results.some(r => r.value === val)) {
        results.push({ id: generateId(), type: 'QR_CODE', value: val, page })
      }
    }
  }

  // コントラスト強化版
  const enh = enhanceContrast(canvas)
  const eData = getImageData(enh)
  const eHit = jsQR(eData.data, enh.width, enh.height, opts)
  if (eHit?.data) {
    const val = eHit.data.trim()
    if (!results.some(r => r.value === val)) {
      results.push({ id: generateId(), type: 'QR_CODE', value: val, page })
    }
  }

  return results
}

// ============================================================
// 1D バーコード: zbar-wasm（全ブラウザ対応）
// ============================================================

const ZBAR_FORMAT_MAP: Record<string, ScanResult['type']> = {
  'ZBAR_EAN13':   'EAN_13',
  'ZBAR_EAN8':    'EAN_8',
  'ZBAR_CODE128': 'CODE_128',
}

async function scan1DWithZBar(
  canvas: HTMLCanvasElement,
  page?: number,
): Promise<ScanResult[]> {
  try {
    const { scanImageData } = await import('@undecaf/zbar-wasm')
    const results: ScanResult[] = []

    // 通常スキャン + コントラスト強化版を両方試す
    const targets = [canvas, enhanceContrast(canvas)]

    for (const target of targets) {
      const imageData = getImageData(target)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const symbols: any[] = await scanImageData(imageData)

      for (const sym of symbols) {
        const type = ZBAR_FORMAT_MAP[sym.typeName]
        if (type) {
          results.push({
            id: generateId(),
            type,
            value: sym.decode(),
            page,
          })
        }
      }
    }

    return results
  } catch (e) {
    console.error('[Nukitoru] zbar-wasm error:', e)
    return []
  }
}

// ============================================================
// 1D バーコード: BarcodeDetector（Chrome 補完）
// ============================================================

const BD_FORMAT_MAP: Record<string, ScanResult['type']> = {
  'ean_13':   'EAN_13',
  'ean_8':    'EAN_8',
  'code_128': 'CODE_128',
}

async function scan1DWithBarcodeDetector(
  canvas: HTMLCanvasElement,
  page?: number,
): Promise<ScanResult[]> {
  if (!('BarcodeDetector' in window)) return []

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BD = (window as any).BarcodeDetector
    const detector = new BD({ formats: ['ean_13', 'ean_8', 'code_128'] })
    const results: ScanResult[] = []

    for (const target of [canvas, enhanceContrast(canvas)]) {
      const bitmap = await createImageBitmap(target)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const barcodes: any[] = await detector.detect(bitmap)
      bitmap.close()
      for (const b of barcodes) {
        const type = BD_FORMAT_MAP[b.format]
        if (type && b.rawValue) {
          results.push({ id: generateId(), type, value: b.rawValue, page })
        }
      }
    }

    return results
  } catch (e) {
    console.warn('[Nukitoru] BarcodeDetector error:', e)
    return []
  }
}

// ============================================================
// 1D ディスパッチャー: zbar-wasm + BarcodeDetector を並行実行
// ============================================================

async function scan1D(
  canvas: HTMLCanvasElement,
  page?: number,
): Promise<ScanResult[]> {
  const [zbarResults, bdResults] = await Promise.all([
    scan1DWithZBar(canvas, page),
    scan1DWithBarcodeDetector(canvas, page),
  ])
  return deduplicateResults([...zbarResults, ...bdResults])
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

export function imageFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX_DIM = 3000
      const maxSide = Math.max(img.width, img.height)
      const scale = maxSide > MAX_DIM ? MAX_DIM / maxSide : 1
      const c = document.createElement('canvas')
      c.width  = Math.floor(img.width  * scale)
      c.height = Math.floor(img.height * scale)
      const ctx = c.getContext('2d', { willReadFrequently: true })!
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
