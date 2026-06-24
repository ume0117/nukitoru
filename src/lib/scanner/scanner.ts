/**
 * scanner.ts
 * ブラウザ内でのみ動作するバーコード解析モジュール。
 * ZXing を動的インポートし、グリッド分割 + コントラスト強化 + 反転スキャンで
 * 複数コードを高精度に検出する。
 *
 * 対応パターン:
 * - 通常色（黒いコード + 白い背景）
 * - 反転色（白いコード + 濃色背景）← 学校プリントのQR等
 * - 薄い印字（コントラスト強化で補完）
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

  ctx.putImageData(data, 0, 0)
  return canvas
}

/**
 * 色を反転させた Canvas を返す。
 * 【重要】濃色背景に白いQRコード（例：濃紺の背景に白）の検出に必要。
 * ZXing はデフォルトで「明るい背景に暗いコード」を想定しているため、
 * 反転することで逆色パターンも検出できるようになる。
 */
function invertCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = extractRegion(src, 0, 0, src.width, src.height)
  const ctx    = canvas.getContext('2d')!
  const data   = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px     = data.data

  for (let i = 0; i < px.length; i += 4) {
    px[i]     = 255 - px[i]
    px[i + 1] = 255 - px[i + 1]
    px[i + 2] = 255 - px[i + 2]
    // Alpha はそのまま
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
  if (canvas.width < 20 || canvas.height < 20) return null

  try {
    const result = reader.decodeFromCanvas(canvas)
    const format = BARCODE_FORMAT_MAP[result.getBarcodeFormat() as number]
    if (!format) return null
    return { type: format, value: result.getText() as string }
  } catch {
    return null
  }
}

// ============================================================
// スキャン領域の生成（グリッド + ストリップ）
// ============================================================

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
 *
 * スキャン戦略（精度優先）:
 * 1. 通常スキャン（グリッド + ストリップ）
 * 2. 反転スキャン（濃色背景の白いQR対策）
 * 3. コントラスト強化スキャン（薄い印字対策）
 * 4. 反転 + コントラスト強化（最難関パターン対策）
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

  // --- Pass 1: 通常スキャン（グリッド全領域）---
  let tick = 0
  for (const [x, y, rw, rh] of regions) {
    const sub = extractRegion(work, x, y, rw, rh)
    const hit = tryDecode(reader, sub)
    if (hit) raw.push({ ...hit, page })

    if (++tick % 5 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  // --- Pass 2: 反転スキャン（濃色背景に白いQR対策）---
  // 全体 + 2×2グリッドのみ（反転は処理コストが高いため絞る）
  const invWork = invertCanvas(work)
  const invRegions: Array<[number, number, number, number]> = [
    [0, 0, w, h],
    [0, 0, w / 2, h / 2],
    [w / 2, 0, w / 2, h / 2],
    [0, h / 2, w / 2, h / 2],
    [w / 2, h / 2, w / 2, h / 2],
  ]
  for (const [x, y, rw, rh] of invRegions) {
    const sub = extractRegion(invWork, x, y, rw, rh)
    const hit = tryDecode(reader, sub)
    if (hit) raw.push({ ...hit, page })
  }
  await new Promise((resolve) => setTimeout(resolve, 0))

  // --- Pass 3: コントラスト強化版（通常 + 反転）---
  const enhanced    = enhanceContrast(work)
  const invEnhanced = enhanceContrast(invWork)

  const enhHit    = tryDecode(reader, enhanced)
  const invEnhHit = tryDecode(reader, invEnhanced)
  if (enhHit)    raw.push({ ...enhHit, page })
  if (invEnhHit) raw.push({ ...invEnhHit, page })

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
