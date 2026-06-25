/**
 * scanner.ts
 *
 * QR コード    → jsQR（シンプル・高精度・反転色標準対応）
 * 1D バーコード → quagga2（EAN-13 / EAN-8 / CODE 128 の静止画検出に特化）
 *
 * ZXing は動画/カメラ向けで静止画の1D検出が不安定なため quagga2 に切り替え。
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
    const ctx = sub.getContext('2d', { willReadFrequently: true })!
    const imgData = ctx.getImageData(0, 0, sub.width, sub.height)
    const hit = jsQR(imgData.data, sub.width, sub.height, opts)
    if (hit?.data) {
      results.push({ id: generateId(), type: 'QR_CODE', value: hit.data, page })
    }
  }

  // コントラスト強化版
  const enh = enhanceContrast(canvas)
  const ectx = enh.getContext('2d', { willReadFrequently: true })!
  const eData = ectx.getImageData(0, 0, enh.width, enh.height)
  const eHit = jsQR(eData.data, enh.width, enh.height, opts)
  if (eHit?.data) {
    results.push({ id: generateId(), type: 'QR_CODE', value: eHit.data, page })
  }

  return results
}

// ============================================================
// 1D バーコードスキャン（quagga2）
// ============================================================

type QuaggaResult = {
  codeResult?: {
    code: string | null
    format: string
  }
} | null

const FORMAT_MAP_QUAGGA: Record<string, ScanResult['type']> = {
  'ean_13':   'EAN_13',
  'ean_8':    'EAN_8',
  'code_128': 'CODE_128',
}

async function decodeWith1D(dataUrl: string): Promise<Omit<ScanResult, 'id' | 'page'> | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const QuaggaModule = await import('@ericblade/quagga2') as any
  const Quagga = QuaggaModule.default ?? QuaggaModule

  return new Promise((resolve) => {
    try {
      Quagga.decodeSingle(
        {
          decoder: {
            readers: ['ean_reader', 'ean_8_reader', 'code_128_reader'],
            multiple: false,
          },
          locate: true,
          src: dataUrl,
        },
        (result: QuaggaResult) => {
          if (result?.codeResult?.code && result.codeResult.format) {
            const type = FORMAT_MAP_QUAGGA[result.codeResult.format]
            if (type) {
              resolve({ type, value: result.codeResult.code })
              return
            }
          }
          resolve(null)
        },
      )
    } catch (e) {
      console.error('[Nukitoru] quagga2 error:', e)
      resolve(null)
    }
  })
}

async function scan1D(
  canvas: HTMLCanvasElement,
  page?: number,
): Promise<ScanResult[]> {
  const raw: Omit<ScanResult, 'id'>[] = []

  // 全体スキャン（オリジナル）
  const hit1 = await decodeWith1D(canvas.toDataURL('image/png'))
  if (hit1) raw.push({ ...hit1, page })

  // コントラスト強化版
  const enh = enhanceContrast(canvas)
  const hit2 = await decodeWith1D(enh.toDataURL('image/png'))
  if (hit2) raw.push({ ...hit2, page })

  // 上半分・下半分（ページに複数バーコードがある場合）
  const w = canvas.width
  const h = canvas.height
  const halves: Array<[number, number, number, number]> = [
    [0, 0, w / 2, h],
    [w / 2, 0, w / 2, h],
    [0, 0, w, h / 2],
    [0, h / 2, w, h / 2],
  ]
  for (const [x, y, rw, rh] of halves) {
    const sub = extractRegion(canvas, x, y, rw, rh, false)
    const hit = await decodeWith1D(sub.toDataURL('image/png'))
    if (hit) raw.push({ ...hit, page })
    await new Promise((r) => setTimeout(r, 0))
  }

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
